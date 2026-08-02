import { execFile } from 'child_process'
import { existsSync, readFileSync, unlinkSync } from 'fs'
import { basename, extname, join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import ffmpegPath from 'ffmpeg-static'
import { app } from 'electron'
import { AudioInfo } from '../src/types'
import { isFormatSupported } from '../src/utils/format'

// 优先级：打包内置 > ffmpeg-static > 系统 ffmpeg
const resourcesDir = app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources')
const bundledFfmpeg = join(resourcesDir, 'ffmpeg')
const ffmpeg = existsSync(bundledFfmpeg) ? bundledFfmpeg
  : (ffmpegPath && existsSync(ffmpegPath) ? ffmpegPath : 'ffmpeg')

export { isFormatSupported }

export async function loadAudioInfo(filePath: string): Promise<AudioInfo> {
  if (!existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`)
  }
  if (!isFormatSupported(filePath)) {
    throw new Error(`不支持的音频格式: ${extname(filePath)}`)
  }

  const duration = await getDuration(filePath)
  const waveform = await extractWaveform(filePath)

  return {
    filePath,
    fileName: basename(filePath),
    duration,
    sampleRate: 16000,
    format: extname(filePath).slice(1),
    waveform,
  }
}

function getDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    // ffmpeg (unlike ffprobe) doesn't support -show_entries / -of csv;
    // parse the Duration line from stderr instead.
    execFile(ffmpeg, ['-i', filePath], (err, _stdout, stderr) => {
      // ffmpeg exits with code 1 when no output file is specified, which is expected.
      // Only treat it as an error if stderr is empty.
      if (err && !stderr) {
        return reject(new Error(`无法读取音频信息: ${err.message}`))
      }
      const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/)
      if (!match) return reject(new Error('无法解析音频时长'))
      const duration = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseFloat(match[3])
      resolve(duration)
    })
  })
}

export function convertToWav(inputPath: string, outputPath: string): Promise<void> {
  if (!existsSync(inputPath)) {
    return Promise.reject(new Error(`音频文件不存在: ${inputPath}`))
  }
  return new Promise((resolve, reject) => {
    const args = [
      '-i', inputPath,
      '-ar', '16000',
      '-ac', '1',
      '-sample_fmt', 's16',
      '-y',
      outputPath,
    ]
    execFile(ffmpeg, args, (err) => {
      if (err) return reject(new Error(`音频转换失败: ${err.message}`))
      resolve()
    })
  })
}

export function extractWaveform(filePath: string, samples = 200): Promise<number[]> {
  if (!existsSync(filePath)) {
    return Promise.reject(new Error(`音频文件不存在: ${filePath}`))
  }
  return new Promise((resolve, reject) => {
    const tempWav = join(tmpdir(), `waveform-${randomUUID()}.wav`)
    const tempRaw = join(tmpdir(), `raw-${randomUUID()}.raw`)

    function cleanup() {
      try { if (existsSync(tempWav)) unlinkSync(tempWav) } catch { /* cleanup */ }
      try { if (existsSync(tempRaw)) unlinkSync(tempRaw) } catch { /* cleanup */ }
    }

    // 先转为 16kHz mono WAV
    convertToWav(filePath, tempWav)
      .then(() => {
        // 输出 8kHz s16le raw PCM（降低总量，足够波形显示）
        const args = [
          '-i', tempWav,
          '-ac', '1',
          '-ar', '8000',
          '-f', 's16le',
          '-y',
          tempRaw,
        ]
        execFile(ffmpeg, args, (err) => {
          if (err) {
            cleanup()
            return reject(new Error(`波形提取失败: ${err.message}`))
          }
          try {
            const pcm = readFileSync(tempRaw)
            const totalSamples = Math.floor(pcm.length / 2)
            if (totalSamples === 0) {
              cleanup()
              return resolve(Array(samples).fill(0.1))
            }

            // 将 PCM 按 samples 个桶分组，每桶取 RMS 后归一化
            const bucketSize = Math.ceil(totalSamples / samples)
            const waveform: number[] = []

            for (let b = 0; b < samples; b++) {
              const start = b * bucketSize
              const end = Math.min(start + bucketSize, totalSamples)
              let sumSq = 0
              let count = 0
              for (let i = start; i < end; i++) {
                const offset = i * 2
                // s16le: little-endian signed 16-bit
                const val = pcm.readInt16LE(offset)
                sumSq += val * val
                count++
              }
              const rms = count > 0 ? Math.sqrt(sumSq / count) : 0
              waveform.push(rms / 32768) // normalize to [0, 1]
            }

            cleanup()
            resolve(waveform)
          } catch {
            cleanup()
            // fallback: empty flat waveform
            resolve(Array(samples).fill(0.1))
          }
        })
      })
      .catch(reject)
  })
}

export function detectVoiceSegments(
  wavPath: string,
  minSilenceDb = -30,
  minSilenceDuration = 0.5,
): Promise<Array<{ start: number; end: number }>> {
  return new Promise((resolve, reject) => {
    const args = [
      '-i', wavPath,
      '-af', `silencedetect=noise=${minSilenceDb}dB:d=${minSilenceDuration}`,
      '-f', 'null',
      '-',
    ]
    execFile(ffmpeg, args, (err, _stdout, stderr) => {
      if (err && !stderr) {
        return reject(new Error(`VAD 检测失败: ${err.message}`))
      }

      const silenceStarts: number[] = []
      const silenceEnds: number[] = []

      for (const line of stderr.split('\n')) {
        const startMatch = line.match(/silence_start: ([\d.]+)/)
        const endMatch = line.match(/silence_end: ([\d.]+)/)
        if (startMatch) silenceStarts.push(parseFloat(startMatch[1]))
        if (endMatch) silenceEnds.push(parseFloat(endMatch[1]))
      }

      // 从静音段推导有声段
      const voiceSegments: Array<{ start: number; end: number }> = []
      let lastEnd = 0

      for (let i = 0; i < silenceStarts.length; i++) {
        const silenceStart = silenceStarts[i]
        if (silenceStart - lastEnd >= 0.3) {
          voiceSegments.push({ start: lastEnd, end: silenceStart })
        }
        lastEnd = silenceEnds[i] || silenceStart
      }

      // Always append tail segment after last silence and handle empty case
      getDuration(wavPath).then(duration => {
        if (duration - lastEnd >= 0.3) {
          voiceSegments.push({ start: lastEnd, end: duration })
        }
        if (voiceSegments.length === 0) {
          voiceSegments.push({ start: 0, end: duration })
        }
        resolve(voiceSegments)
      }).catch(err => {
        if (voiceSegments.length > 0) {
          resolve(voiceSegments)
        } else {
          reject(new Error(`VAD 检测失败: 无法获取音频时长 (${err.message})`))
        }
      })
    })
  })
}
