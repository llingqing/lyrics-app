import { ChildProcess, spawn, execFile } from 'child_process'
import { join, dirname } from 'path'
import { app } from 'electron'
import { existsSync, mkdirSync, createWriteStream, statSync } from 'fs'
import { pipeline } from 'stream/promises'
import { createReadStream } from 'fs'
import { randomUUID } from 'crypto'
import { tmpdir } from 'os'
import { InferenceConfig, InferenceProgress, LyricSegment } from '../src/types'

// whisper.cpp 的 GGML 模型下载地址
const MODEL_URLS: Record<string, string> = {
  tiny: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
  base: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
  small: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
  medium: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
}

let currentProcess: ChildProcess | null = null
let cancelled = false

function getModelsDir(): string {
  const dir = join(app.getPath('userData'), 'models')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function getModelPath(modelName: string): string {
  return join(getModelsDir(), `ggml-${modelName}.bin`)
}

export async function downloadModel(
  modelName: string,
  onProgress?: (p: { percent: number }) => void,
): Promise<string> {
  const url = MODEL_URLS[modelName]
  if (!url) throw new Error(`未知模型: ${modelName}`)

  const destPath = getModelPath(modelName)
  if (existsSync(destPath)) return destPath

  const response = await fetch(url)
  if (!response.ok) throw new Error(`模型下载失败: HTTP ${response.status}`)
  const total = parseInt(response.headers.get('content-length') || '0', 10)
  let downloaded = 0

  const tempPath = destPath + '.download'
  const writer = createWriteStream(tempPath)

  const reader = response.body!.getReader()
  const pump = async () => {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      writer.write(Buffer.from(value))
      downloaded += value.length
      if (total > 0 && onProgress) {
        onProgress({ percent: Math.round((downloaded / total) * 100) })
      }
    }
    writer.end()
  }
  await pump()

  require('fs').renameSync(tempPath, destPath)
  return destPath
}

export async function ensureModel(modelName: string): Promise<string> {
  if (!existsSync(getModelPath(modelName))) {
    return downloadModel(modelName)
  }
  return getModelPath(modelName)
}

export function cancelInference(): void {
  cancelled = true
  if (currentProcess) {
    currentProcess.kill('SIGTERM')
    currentProcess = null
  }
}

export async function runLocalInference(
  config: InferenceConfig,
  onProgress: (p: InferenceProgress) => void,
): Promise<{ segments: LyricSegment[]; language: string }> {
  cancelled = false
  const modelPath = await ensureModel(config.modelName)
  const tempWav = join(tmpdir(), `lyrics-${randomUUID()}.wav`)
  const outputPath = join(tmpdir(), `lyrics-${randomUUID()}`)

  // 先转换为 16kHz mono WAV（假设 audio-manager 已转换）
  // 这里直接使用 filePath，实际由 ipc-handlers 处理前预处理
  const whisperPath = join(app.getAppPath(), 'resources', 'whisper')

  const args = [
    '-m', modelPath,
    '-f', config.filePath,  // 已在 ipc-handlers 中预转为 16kHz mono wav
    '-osrt',
    '-of', outputPath,
    '-l', config.language === 'auto' ? 'auto' : config.language,
    '--print-progress',
  ]

  return new Promise((resolve, reject) => {
    currentProcess = spawn(whisperPath, args, { stdio: ['ignore', 'pipe', 'pipe'] })

    let stderr = ''
    let lastPercent = 0

    currentProcess.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString()
      // whisper.cpp 进度输出格式如: "progress = 45%"
      const match = data.toString().match(/progress\s*=\s*(\d+)%/)
      if (match) {
        lastPercent = parseInt(match[1], 10)
        onProgress({
          percent: lastPercent,
          currentSegment: 0,
          totalSegments: 1,
          partialText: '',
        })
      }
    })

    currentProcess.on('close', (code) => {
      currentProcess = null
      if (cancelled) {
        cleanup()
        return reject(new Error('推理已被取消'))
      }
      if (code !== 0) {
        const errorMsg = extractError(stderr)
        cleanup()
        return reject(new Error(errorMsg))
      }

      const srtPath = `${outputPath}.srt`
      if (!existsSync(srtPath)) {
        cleanup()
        return reject(new Error('推理完成但未生成输出'))
      }

      try {
        const srtContent = require('fs').readFileSync(srtPath, 'utf-8')
        const { segments, language } = parseSrt(srtContent, config)
        cleanup()
        resolve({ segments, language })
      } catch (e) {
        cleanup()
        reject(e)
      }
    })

    currentProcess.on('error', (err) => {
      currentProcess = null
      cleanup()
      reject(new Error(`whisper.cpp 进程启动失败: ${err.message}。请确认已下载 whisper 可执行文件到 resources/ 目录。`))
    })
  })
}

function cleanup() {
  // 临时文件在进程结束时由 OS 管理，此处不需要显式清理
}

function extractError(stderr: string): string {
  if (stderr.includes('out of memory')) return 'GPU/内存不足，请尝试更小的模型'
  if (stderr.includes('No such file')) return '模型文件或音频文件不存在'
  if (stderr.includes('failed to load model')) return '模型加载失败，请重新下载模型'
  return `推理失败: ${stderr.slice(-200)}`
}

export async function runCloudInference(
  config: InferenceConfig,
  onProgress: (p: InferenceProgress) => void,
): Promise<{ segments: LyricSegment[]; language: string }> {
  if (!config.cloudApiKey) {
    throw new Error('请先设置云端 API Key')
  }

  cancelled = false

  // 使用 OpenAI Whisper API
  const formData = new FormData()
  const fileBuffer = require('fs').readFileSync(config.filePath)
  formData.append('file', new Blob([fileBuffer]), 'audio.wav')
  formData.append('model', 'whisper-1')
  formData.append('response_format', 'verbose_json')
  formData.append('timestamp_granularities[]', 'segment')
  if (config.language !== 'auto') {
    formData.append('language', config.language)
  }

  let retries = 0
  const maxRetries = 3

  while (retries <= maxRetries) {
    try {
      onProgress({ percent: 0, currentSegment: 0, totalSegments: 1, partialText: '' })

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.cloudApiKey}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const errText = await response.text()
        if (response.status === 401) throw new Error('API Key 无效，请检查设置')
        if (response.status === 429) {
          retries++
          if (retries > maxRetries) throw new Error('API 请求过于频繁，请稍后重试')
          await sleep(2000 * retries)
          continue
        }
        throw new Error(`API 错误 (${response.status}): ${errText}`)
      }

      onProgress({ percent: 50, currentSegment: 0, totalSegments: 1, partialText: '' })

      const data = await response.json() as any
      const segments: LyricSegment[] = (data.segments || []).map((s: any, i: number) => ({
        id: `seg-${i}`,
        start: s.start,
        end: s.end,
        text: s.text?.trim() || '',
        confidence: (s.avg_logprob || 0) > -1 ? Math.min(1, Math.exp(s.avg_logprob || 0)) : 0.8,
        edited: false,
      }))

      onProgress({ percent: 100, currentSegment: segments.length, totalSegments: segments.length, partialText: '' })

      return { segments, language: data.language || config.language }
    } catch (e: any) {
      if (retries > maxRetries) throw e
      retries++
    }
  }

  throw new Error('API 调用失败，已达最大重试次数')
}

function parseSrt(srt: string, config: InferenceConfig): { segments: LyricSegment[]; language: string } {
  const segments: LyricSegment[] = []
  const blocks = srt.trim().split(/\n\n+/)

  for (const block of blocks) {
    const lines = block.split('\n')
    if (lines.length < 2) continue

    const timeMatch = lines[1]?.match(/([\d:,.]+)\s*-->\s*([\d:,.]+)/)
    if (!timeMatch) continue

    const start = parseSrtTime(timeMatch[1])
    const end = parseSrtTime(timeMatch[2])
    const text = lines.slice(2).join(' ').trim()
    if (!text) continue

    segments.push({
      id: `seg-${segments.length}`,
      start,
      end,
      text,
      confidence: 0.85,
      edited: false,
    })
  }

  return { segments, language: config.language === 'auto' ? 'zh' : config.language }
}

function parseSrtTime(timeStr: string): number {
  // format: "00:01:23,456" or "00:01:23.456"
  const match = timeStr.match(/(\d+):(\d+):(\d+)[,.](\d+)/)
  if (!match) return 0
  return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]) + parseInt(match[4]) / 1000
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
