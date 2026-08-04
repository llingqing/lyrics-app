import { ipcMain, dialog, BrowserWindow } from 'electron'
import { loadAudioInfo, convertToWav } from './audio-manager'
import { runLocalInference, runCloudInference, cancelInference, downloadModel, cancelDownload, deleteModel, getModelsStatus } from './model-manager'
import { showExportDialog } from './export-manager'
import { InferenceConfig, InferenceProgress, TranscriptionResult } from '../src/types'
import { errorMessage } from '../src/utils/error'
import { validateInferenceConfig, validateFilePath, validateModelBaseUrl } from '../src/utils/validation'
import { registerMediaPath } from './media-access'
import { saveHistoryEntry, loadHistoryEntries, deleteHistoryEntry } from './history-store'
import { trackTempFile, releaseTempFile } from './temp-files'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { app } from 'electron'

const originalFileNames = new Map<string, string>()
let currentTempWav: string | null = null
const MAX_HISTORY = 100

// ─── Shared helpers ────────────────────────────────────────

function errorCode(e: unknown): string {
  const msg = errorMessage(e)
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
  const onProgress = (progress: InferenceProgress) => {
    win.webContents.send('inference:progress', progress)
  }

  const engine = config.engine === 'cloud' ? runCloudInference : runLocalInference
  const { segments, language } = await engine(config, onProgress)

  const result: TranscriptionResult = {
    id: randomUUID(),
    audioFileName: originalFileNames.get(config.filePath) || config.filePath,
    audioPath: config.originalPath, // 存原始路径，之后从历史恢复播放
    // 云端记录实际调用的 API 模型名，而不是本地模型选项
    modelName: config.engine === 'cloud' ? config.cloudModel || 'whisper-1' : config.modelName,
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
    } catch (e: unknown) {
      throw new Error(`文件选择失败: ${errorMessage(e)}`, { cause: e })
    }
  })

  ipcMain.handle('audio:load', async (_event, filePath: string) => {
    const pathError = validateFilePath(filePath)
    if (pathError) throw new Error(pathError)

    const info = await loadAudioInfo(filePath)
    const originalFileName = info.fileName
    info.originalPath = filePath // 保留原始路径用于播放
    // 预转为 16kHz WAV 以便后续推理
    const tempWav = join(tmpdir(), `lyrics-input-${randomUUID()}.wav`)
    await convertToWav(filePath, tempWav)
    // 换新音频后上一个临时 WAV 不再被引用，立即释放
    if (currentTempWav) {
      releaseTempFile(currentTempWav)
      originalFileNames.delete(currentTempWav)
    }
    currentTempWav = tempWav
    trackTempFile(tempWav)
    info.filePath = tempWav // 后续推理使用转换后的 WAV
    originalFileNames.set(tempWav, originalFileName)
    // The player streams these over media://, so allow exactly them
    registerMediaPath(filePath)
    registerMediaPath(tempWav)
    win.webContents.send('audio:info', info)
    return info
  })

  // 从历史记录恢复播放：文件还在就重新授权 media:// 并返回信息，不做 WAV 预转
  ipcMain.handle('audio:restore', async (_event, filePath: string) => {
    const pathError = validateFilePath(filePath)
    if (pathError) throw new Error(pathError)

    try {
      const info = await loadAudioInfo(filePath)
      info.originalPath = filePath
      registerMediaPath(filePath)
      return info
    } catch {
      return null // 文件已删除/损坏，历史仍可查看但无播放器
    }
  })

  ipcMain.handle('inference:start', async (_event, config: InferenceConfig) => {
    const configError = validateInferenceConfig(config)
    if (configError) throw new Error(configError)

    try {
      await executeInference(config, win)
    } catch (e: unknown) {
      win.webContents.send('inference:error', { message: errorMessage(e), code: errorCode(e) })
    }
  })

  ipcMain.handle('inference:cancel', async () => {
    cancelInference()
  })

  ipcMain.handle('lyrics:save', async (_event, result: TranscriptionResult) => {
    try {
      await saveHistoryEntry(join(app.getPath('userData'), 'history'), result, MAX_HISTORY)
    } catch (e: unknown) {
      throw new Error(`保存结果失败: ${errorMessage(e)}`, { cause: e })
    }
  })

  ipcMain.handle('export:save', async (_event, format: 'txt' | 'lrc' | 'srt', content: string) => {
    return showExportDialog(win, format, content)
  })

  ipcMain.handle('history:load', async () => {
    try {
      return await loadHistoryEntries(join(app.getPath('userData'), 'history'), MAX_HISTORY)
    } catch (e: unknown) {
      throw new Error(`加载历史记录失败: ${errorMessage(e)}`, { cause: e })
    }
  })

  ipcMain.handle('history:delete', async (_event, id: string) => {
    try {
      await deleteHistoryEntry(join(app.getPath('userData'), 'history'), id)
    } catch (e: unknown) {
      throw new Error(`删除历史记录失败: ${errorMessage(e)}`, { cause: e })
    }
  })

  // 模型管理
  ipcMain.handle('model:list', async () => {
    return getModelsStatus()
  })

  ipcMain.handle('model:download', async (_event, modelName: string, baseUrl?: string) => {
    const baseError = validateModelBaseUrl(baseUrl)
    if (baseError) throw new Error(baseError)

    try {
      return await downloadModel(modelName, (p) => {
        win.webContents.send('model:download-progress', { modelName, percent: p.percent })
      }, baseUrl)
    } catch (e: unknown) {
      throw new Error(`模型下载失败: ${errorMessage(e)}`, { cause: e })
    }
  })

  ipcMain.handle('model:download-cancel', async (_event, modelName: string) => {
    cancelDownload(modelName)
  })

  ipcMain.handle('model:delete', async (_event, modelName: string) => {
    cancelDownload(modelName) // 兜底：正在下载时删除先停掉传输
    deleteModel(modelName)
  })
}