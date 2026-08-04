import { ChildProcess, spawn } from 'child_process'
import { join, basename } from 'path'
import { app } from 'electron'
import { existsSync, mkdirSync, createWriteStream, readFileSync, renameSync, unlinkSync, statSync } from 'fs'
import { randomUUID } from 'crypto'
import { tmpdir } from 'os'
import { InferenceConfig, InferenceProgress, LyricSegment } from '../src/types'
import { errorMessage } from '../src/utils/error'

// whisper.cpp 的 GGML 模型下载地址
const MODEL_URLS: Record<string, string> = {
  tiny: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
  base: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
  small: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
  medium: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
  'large-v3-turbo': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin',
  'large-v3': 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin',
}

let currentProcess: ChildProcess | null = null
let cloudAbort: AbortController | null = null
let cancelled = false

// ─── Retry helpers ─────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface RetryOptions {
  maxRetries: number
  baseDelayMs: number
  isCancelled?: () => boolean   // 默认查推理取消标记；下载传自己的 abort 状态
  cancelMessage?: string
}

// Shape of the OpenAI Whisper transcription response (verbose_json)
interface WhisperApiSegment {
  start: number
  end: number
  text?: string
  avg_logprob?: number
}

interface WhisperApiResponse {
  language?: string
  segments?: WhisperApiSegment[]
}

// whisper.cpp -ojf（full JSON）输出结构，只声明用到的字段
interface WhisperJsonToken {
  text: string
  p?: number
}

interface WhisperJsonSegment {
  offsets?: { from: number; to: number } // 毫秒
  text?: string
  tokens?: WhisperJsonToken[]
}

interface WhisperJsonOutput {
  result?: { language?: string }
  transcription?: WhisperJsonSegment[]
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  isRetryable: (error: unknown) => boolean,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 2
  const baseDelayMs = options.baseDelayMs ?? 1000
  const isCancelled = options.isCancelled ?? (() => cancelled)
  const cancelMessage = options.cancelMessage ?? '推理已被取消'
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (isCancelled()) throw new Error(cancelMessage)
    try {
      return await fn()
    } catch (e: unknown) {
      lastError = e
      if (attempt >= maxRetries || !isRetryable(e)) {
        if (attempt >= maxRetries) {
          throw new Error(`${errorMessage(lastError)}（已重试 ${maxRetries} 次）`, { cause: e })
        }
        throw e
      }
      await sleep(baseDelayMs * (attempt + 1))
    }
  }

  throw lastError
}

function getModelsDir(): string {
  const dir = join(app.getPath('userData'), 'models')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

export function getModelPath(modelName: string): string {
  return join(getModelsDir(), `ggml-${modelName}.bin`)
}

const downloadAborts = new Map<string, AbortController>()

export function cancelDownload(modelName: string): void {
  downloadAborts.get(modelName)?.abort()
}

export async function downloadModel(
  modelName: string,
  onProgress?: (p: { percent: number }) => void,
): Promise<string> {
  const url = MODEL_URLS[modelName]
  if (!url) throw new Error(`未知模型: ${modelName}`)

  const destPath = getModelPath(modelName)
  if (existsSync(destPath)) return destPath

  const abort = new AbortController()
  downloadAborts.set(modelName, abort)
  try {
    return await retryWithBackoff(
      () => downloadAttempt(url, destPath, abort.signal, onProgress),
      (err) => {
        const msg = errorMessage(err)
        // 取消、尺寸不符（留给下次续传）、客户端错误（404 等）不重试；网络错误重试
        return !msg.includes('取消') && !msg.includes('不完整') && !/HTTP 4\d\d/.test(msg)
      },
      { maxRetries: 2, baseDelayMs: 1000, isCancelled: () => abort.signal.aborted, cancelMessage: '下载已取消' },
    )
  } finally {
    downloadAborts.delete(modelName)
  }
}

async function downloadAttempt(
  url: string,
  destPath: string,
  signal: AbortSignal,
  onProgress?: (p: { percent: number }) => void,
): Promise<string> {
  const tempPath = destPath + '.download'
  const resumeFrom = existsSync(tempPath) ? statSync(tempPath).size : 0

  let response: Response
  try {
    response = await fetch(url, {
      headers: resumeFrom > 0 ? { Range: `bytes=${resumeFrom}-` } : {},
      signal,
    })
  } catch (e: unknown) {
    if (signal.aborted || (e instanceof DOMException && e.name === 'AbortError')) {
      throw new Error('下载已取消', { cause: e })
    }
    throw e
  }

  if (!response.ok && response.status !== 206) throw new Error(`模型下载失败: HTTP ${response.status}`)
  if (!response.body) throw new Error('模型下载失败: 响应体为空')

  // 206 表示服务端接受了 Range，从断点续传；200 表示从头重发，丢弃已有部分
  const resumed = response.status === 206
  const existing = resumed ? resumeFrom : 0
  const contentLength = parseInt(response.headers.get('content-length') || '0', 10)
  const total = contentLength > 0 ? existing + contentLength : 0
  let downloaded = existing

  const writer = createWriteStream(tempPath, resumed ? { flags: 'a' } : undefined)
  const writeErrorPromise = new Promise<never>((_, reject) => {
    writer.on('error', (err) => reject(new Error(`模型写入失败: ${err.message}`)))
  })
  // fetch 的 mock/实现未必响应 signal，读取循环也要能被中断；
  // abort 可能发生在监听注册之前（事件不补发），必须先查 aborted
  const abortPromise = new Promise<never>((_, reject) => {
    const fail = () => reject(new Error('下载已取消'))
    if (signal.aborted) return fail()
    signal.addEventListener('abort', fail, { once: true })
  })

  const reader = response.body.getReader()
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
  }

  try {
    await Promise.race([pump(), writeErrorPromise, abortPromise])
  } catch (e) {
    reader.cancel().catch(() => { /* best-effort */ })
    writer.destroy() // 保留 tempPath，下次续传
    throw e
  }
  await new Promise<void>((resolve, reject) => {
    writer.end((err?: Error | null) => (err ? reject(err) : resolve()))
  })

  const finalSize = statSync(tempPath).size
  if (total > 0 && finalSize !== total) {
    throw new Error(`模型下载不完整（${finalSize}/${total} 字节），请重新下载以续传`)
  }

  renameSync(tempPath, destPath)
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
  if (cloudAbort) {
    cloudAbort.abort()
    cloudAbort = null
  }
  if (currentProcess) {
    try {
      currentProcess.kill('SIGTERM')
    } catch {
      // process may have already exited
    }
    currentProcess = null
  }
}

export function buildWhisperArgs(
  config: InferenceConfig,
  modelPath: string,
  outputPath: string,
): string[] {
  return [
    '-m', modelPath,
    '-f', config.filePath,  // 已在 ipc-handlers 中预转为 16kHz mono wav
    '-ojf',  // full JSON：含真实检测语言与 token 概率（置信度来源）
    '-of', outputPath,
    '-l', config.language === 'auto' ? 'auto' : config.language,
    '--print-progress',
    '-ng',  // disable GPU — pre-built binary may lack CUDA backend
  ]
}

export async function runLocalInference(
  config: InferenceConfig,
  onProgress: (p: InferenceProgress) => void,
): Promise<{ segments: LyricSegment[]; language: string }> {
  cancelled = false

  // 检查文件是否存在
  if (!existsSync(config.filePath)) {
    throw new Error(`音频文件不存在: ${config.filePath}`)
  }

  const modelPath = await ensureModel(config.modelName)
  const outputPath = join(tmpdir(), `lyrics-${randomUUID()}`)
  const jsonPath = `${outputPath}.json`

  // 检查 whisper 二进制是否存在
  const whisperBinary = process.platform === 'win32' ? 'whisper.exe' : 'whisper'
  const resourcesDir = app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources')
  const whisperPath = join(resourcesDir, whisperBinary)
  if (!existsSync(whisperPath)) {
    throw new Error(`whisper 程序未找到: ${whisperPath}。请将 whisper 可执行文件放到 resources/ 目录。`)
  }

  const args = buildWhisperArgs(config, modelPath, outputPath)

  async function spawnInference(): Promise<{ segments: LyricSegment[]; language: string }> {
    return new Promise((resolve, reject) => {
      currentProcess = spawn(whisperPath, args, {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, LD_LIBRARY_PATH: resourcesDir },
      })

      let stderr = ''

      currentProcess.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString()
        const match = data.toString().match(/progress\s*=\s*(\d+)%/)
        if (match) {
          onProgress({
            percent: parseInt(match[1], 10),
            currentSegment: 0,
            totalSegments: 1,
            partialText: '',
            engine: 'local',
          })
        }
      })

      currentProcess.on('close', (code) => {
        currentProcess = null
        if (cancelled) {
          cleanup(jsonPath)
          return reject(new Error('推理已被取消'))
        }
        if (code !== 0) {
          const errorMsg = extractError(stderr)
          cleanup(jsonPath)
          return reject(new Error(errorMsg))
        }

        if (!existsSync(jsonPath)) {
          cleanup(jsonPath)
          return reject(new Error('推理完成但未生成输出'))
        }

        try {
          const jsonContent = readFileSync(jsonPath, 'utf-8')
          const { segments, language } = parseWhisperJson(jsonContent, config)
          cleanup(jsonPath)
          resolve({ segments, language })
        } catch (e) {
          cleanup(jsonPath)
          reject(e)
        }
      })

      currentProcess.on('error', (err) => {
        currentProcess = null
        cleanup(jsonPath)
        reject(new Error(`whisper.cpp 进程启动失败: ${err.message}。请确认已下载 whisper 可执行文件到 resources/ 目录。`))
      })
    })
  }

  function isRetryableLocal(err: unknown): boolean {
    const msg = errorMessage(err)
    return !msg.includes('文件不存在') && !msg.includes('模型加载失败') && !msg.includes('取消')
  }

  return retryWithBackoff(spawnInference, isRetryableLocal, { maxRetries: 2, baseDelayMs: 1000 })
}

function cleanup(outputFile?: string) {
  if (outputFile) {
    try { unlinkSync(outputFile) } catch { /* already cleaned up */ }
  }
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
  cloudAbort = new AbortController()
  const signal = cloudAbort.signal

  // OpenAI 兼容协议：第三方服务只需换 baseUrl 和模型名
  const baseUrl = (config.cloudBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')
  const apiModel = config.cloudModel || 'whisper-1'

  // 优先上传用户打开的原始压缩文件（远小于预转的 16kHz WAV），带真实文件名便于服务端识别格式
  const uploadPath =
    typeof config.originalPath === 'string' && config.originalPath && existsSync(config.originalPath)
      ? config.originalPath
      : config.filePath

  const MAX_UPLOAD_BYTES = 25 * 1024 * 1024 // OpenAI 兼容转写 API 的通行上限
  const uploadSize = statSync(uploadPath).size
  if (uploadSize > MAX_UPLOAD_BYTES) {
    throw new Error(
      `音频文件过大（${(uploadSize / 1024 / 1024).toFixed(1)} MB），云端 API 限制 25MB，请改用本地引擎或压缩音频`,
    )
  }

  const formData = new FormData()
  const fileBuffer = readFileSync(uploadPath)
  formData.append('file', new Blob([fileBuffer]), basename(uploadPath))
  formData.append('model', apiModel)
  formData.append('response_format', 'verbose_json')
  formData.append('timestamp_granularities[]', 'segment')
  if (config.language !== 'auto') {
    formData.append('language', config.language)
  }

  async function callApi(): Promise<{ segments: LyricSegment[]; language: string }> {
    // 等待期间不发进度——fetch 拿不到真实上传/转写进度，渲染端用虚拟进度动画；
    // 这里发假的中间值反而会打断它（见 useInference 的虚拟计时器）
    let response: Response
    try {
      response = await fetch(`${baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.cloudApiKey}` },
        body: formData,
        signal,
      })
    } catch (e: unknown) {
      if (cancelled || (e instanceof DOMException && e.name === 'AbortError')) {
        throw new Error('推理已被取消', { cause: e })
      }
      throw e
    }

    if (!response.ok) {
      const errText = await response.text()
      if (response.status === 401) throw new Error('API Key 无效，请检查设置')
      if (response.status === 429) throw new Error('API 请求过于频繁，请稍后重试')
      throw new Error(`API 错误 (${response.status}): ${errText}`)
    }

    const data = await response.json() as WhisperApiResponse
    const segments: LyricSegment[] = (data.segments || []).map((s, i) => ({
      id: `seg-${i}`,
      start: s.start,
      end: s.end,
      text: s.text?.trim() || '',
      confidence: (s.avg_logprob || 0) > -1 ? Math.min(1, Math.exp(s.avg_logprob || 0)) : 0.8,
      edited: false,
    }))

    onProgress({ percent: 100, currentSegment: segments.length, totalSegments: segments.length, partialText: '', engine: 'cloud' })
    return { segments, language: data.language || config.language }
  }

  function isRetryableCloud(err: unknown): boolean {
    const msg = errorMessage(err)
    return !msg.includes('API Key 无效') && !msg.includes('取消')
  }

  return retryWithBackoff(callApi, isRetryableCloud, { maxRetries: 2, baseDelayMs: 1500 })
}

// whisper.cpp full JSON 里的特殊标记 token（[_BEG_]、[_TT_150] 等），不计入置信度
const SPECIAL_TOKEN = /^\[_.*\]$/

export function parseWhisperJson(
  json: string,
  config: InferenceConfig,
): { segments: LyricSegment[]; language: string } {
  const data = JSON.parse(json) as WhisperJsonOutput
  const segments: LyricSegment[] = []

  for (const seg of data.transcription || []) {
    const text = seg.text?.trim() || ''
    if (!text) continue

    const tokens = (seg.tokens || []).filter(
      t => typeof t.p === 'number' && !SPECIAL_TOKEN.test(t.text.trim()),
    )
    const confidence = tokens.length > 0
      ? tokens.reduce((sum, t) => sum + (t.p as number), 0) / tokens.length
      : 0.85

    segments.push({
      id: `seg-${segments.length}`,
      start: (seg.offsets?.from ?? 0) / 1000,
      end: (seg.offsets?.to ?? 0) / 1000,
      text,
      confidence,
      edited: false,
    })
  }

  return { segments, language: data.result?.language || config.language }
}
