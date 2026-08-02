import { ipcMain, dialog, BrowserWindow } from 'electron'
import { loadAudioInfo, convertToWav } from './audio-manager'
import { runLocalInference, runCloudInference, cancelInference, downloadModel, getModelPath } from './model-manager'
import { showExportDialog } from './export-manager'
import { InferenceConfig, TranscriptionResult } from '../src/types'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs'
import { app } from 'electron'

const originalFileNames = new Map<string, string>()
let lastConfig: InferenceConfig | null = null
const MAX_HISTORY = 100

// ─── Shared helpers ────────────────────────────────────────

function errorCode(e: any): string {
  const msg = e?.message || ''
  if (msg.includes('不存在')) return 'FILE_NOT_FOUND'
  if (msg.includes('下载')) return 'MODEL_DOWNLOAD_FAILED'
  if (msg.includes('取消')) return 'CANCELLED'
  if (msg.includes('重试') || msg.includes('已')) return 'RETRIES_EXHAUSTED'
  return 'INFERENCE_FAILED'
}

async function executeInference(
  config: InferenceConfig,
  win: BrowserWindow,
): Promise<void> {
  const onProgress = (progress: any) => {
    win.webContents.send('inference:progress', progress)
  }

  const engine = config.engine === 'cloud' ? runCloudInference : runLocalInference
  const { segments, language } = await engine(config, onProgress)

  const result: TranscriptionResult = {
    id: randomUUID(),
    audioFileName: originalFileNames.get(config.filePath) || config.filePath,
    modelName: config.modelName,
    engine: config.engine,
    language,
    segments,
    createdAt: new Date().toISOString(),
  }

  win.webContents.send('inference:result', result)
}

// ─── Register all IPC handlers ──────────────────────────────

export function registerHandlers(win: BrowserWindow): void {
  ipcMain.handle('audio:select', async () => {
    try {
      const result = await dialog.showOpenDialog(win, {
        title: '选择音频文件',
        filters: [
          { name: '音频文件', extensions: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'opus'] },
        ],
        properties: ['openFile'],
      })
      return result.canceled ? null : result.filePaths[0]
    } catch (e: any) {
      throw new Error(`文件选择失败: ${e.message}`)
    }
  })

  ipcMain.handle('audio:load', async (_event, filePath: string) => {
    const info = await loadAudioInfo(filePath)
    const originalFileName = info.fileName
    info.originalPath = filePath // 保留原始路径用于播放
    // 预转为 16kHz WAV 以便后续推理
    const tempWav = join(tmpdir(), `lyrics-input-${randomUUID()}.wav`)
    await convertToWav(filePath, tempWav)
    info.filePath = tempWav // 后续推理使用转换后的 WAV
    originalFileNames.set(tempWav, originalFileName)
    win.webContents.send('audio:info', info)
    return info
  })

  ipcMain.handle('inference:start', async (_event, config: InferenceConfig) => {
    lastConfig = config
    try {
      await executeInference(config, win)
    } catch (e: any) {
      win.webContents.send('inference:error', { message: e?.message || '未知错误', code: errorCode(e) })
    }
  })

  ipcMain.handle('inference:cancel', async () => {
    cancelInference()
  })

  ipcMain.handle('inference:retry', async () => {
    if (!lastConfig) throw new Error('没有可用的重试配置')
    try {
      await executeInference(lastConfig, win)
    } catch (e: any) {
      win.webContents.send('inference:error', { message: e?.message || '未知错误', code: errorCode(e) })
    }
  })

  ipcMain.handle('lyrics:save', async (_event, result: TranscriptionResult) => {
    try {
      const historyDir = join(app.getPath('userData'), 'history')
      if (!existsSync(historyDir)) mkdirSync(historyDir, { recursive: true })

      const historyFile = join(historyDir, `${result.id}.json`)
      writeFileSync(historyFile, JSON.stringify(result, null, 2), 'utf-8')

      // LRU cleanup: remove oldest entries when exceeding max
      const files = require('fs').readdirSync(historyDir)
        .filter((f: string) => f.endsWith('.json'))
        .map((f: string) => join(historyDir, f))

      if (files.length > MAX_HISTORY) {
        const sorted = files
          .map((f: string) => {
            try {
              const data = JSON.parse(readFileSync(f, 'utf-8'))
              return { path: f, time: new Date(data.createdAt || 0).getTime() }
            } catch { return { path: f, time: 0 } }
          })
          .sort((a, b) => a.time - b.time)

        for (const entry of sorted.slice(0, files.length - MAX_HISTORY)) {
          try { unlinkSync(entry.path) } catch {}
        }
      }
    } catch (e: any) {
      throw new Error(`保存结果失败: ${e.message}`)
    }
  })

  ipcMain.handle('export:save', async (_event, format: 'txt' | 'lrc' | 'srt', content: string) => {
    return showExportDialog(win, format, content)
  })

  ipcMain.handle('history:load', async () => {
    try {
      const historyDir = join(app.getPath('userData'), 'history')
      if (!existsSync(historyDir)) return []

      const results: TranscriptionResult[] = []
      const files = require('fs').readdirSync(historyDir)
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const content = readFileSync(join(historyDir, file), 'utf-8')
            results.push(JSON.parse(content))
          } catch {}
        }
      }
      return results
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, MAX_HISTORY)
    } catch (e: any) {
      throw new Error(`加载历史记录失败: ${e.message}`)
    }
  })

  ipcMain.handle('history:delete', async (_event, id: string) => {
    try {
      const historyFile = join(app.getPath('userData'), 'history', `${id}.json`)
      if (existsSync(historyFile)) unlinkSync(historyFile)
    } catch (e: any) {
      throw new Error(`删除历史记录失败: ${e.message}`)
    }
  })

  // 模型管理
  const MODEL_NAMES = ['tiny', 'base', 'small', 'medium'] as const

  ipcMain.handle('model:list', async () => {
    const result: Record<string, boolean> = {}
    for (const name of MODEL_NAMES) {
      result[name] = existsSync(getModelPath(name))
    }
    return result
  })

  ipcMain.handle('model:download', async (_event, modelName: string) => {
    try {
      return await downloadModel(modelName, (p) => {
        win.webContents.send('model:download-progress', { modelName, percent: p.percent })
      })
    } catch (e: any) {
      throw new Error(`模型下载失败: ${e.message}`)
    }
  })
}