import { ipcMain, dialog, BrowserWindow } from 'electron'
import { loadAudioInfo, convertToWav } from './audio-manager'
import { runLocalInference, runCloudInference, cancelInference } from './model-manager'
import { showExportDialog } from './export-manager'
import { InferenceConfig, TranscriptionResult } from '../src/types'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs'
import { app } from 'electron'

export function registerHandlers(win: BrowserWindow): void {
  ipcMain.handle('audio:select', async () => {
    const result = await dialog.showOpenDialog(win, {
      title: '选择音频文件',
      filters: [
        { name: '音频文件', extensions: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'opus'] },
      ],
      properties: ['openFile'],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('audio:load', async (_event, filePath: string) => {
    const info = await loadAudioInfo(filePath)
    // 预转为 16kHz WAV 以便后续推理
    const tempWav = join(tmpdir(), `lyrics-input-${randomUUID()}.wav`)
    await convertToWav(filePath, tempWav)
    info.filePath = tempWav // 后续推理使用转换后的 WAV
    win.webContents.send('audio:info', info)
    return info
  })

  ipcMain.handle('inference:start', async (_event, config: InferenceConfig) => {
    try {
      const onProgress = (progress: any) => {
        win.webContents.send('inference:progress', progress)
      }

      const engine = config.engine === 'cloud' ? runCloudInference : runLocalInference
      const { segments, language } = await engine(config, onProgress)

      const result: TranscriptionResult = {
        id: randomUUID(),
        audioFileName: config.filePath,
        modelName: config.modelName,
        engine: config.engine,
        language,
        segments,
        createdAt: new Date().toISOString(),
      }

      win.webContents.send('inference:result', result)
    } catch (e: any) {
      win.webContents.send('inference:error', { message: e.message, code: 'INFERENCE_FAILED' })
    }
  })

  ipcMain.handle('inference:cancel', async () => {
    cancelInference()
  })

  ipcMain.handle('lyrics:save', async (_event, result: TranscriptionResult) => {
    const historyDir = join(app.getPath('userData'), 'history')
    if (!existsSync(historyDir)) mkdirSync(historyDir, { recursive: true })

    const historyFile = join(historyDir, `${result.id}.json`)
    writeFileSync(historyFile, JSON.stringify(result, null, 2), 'utf-8')
  })

  ipcMain.handle('export:save', async (_event, format: 'txt' | 'lrc', content: string) => {
    return showExportDialog(win, format, content)
  })

  ipcMain.handle('history:load', async () => {
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
    return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  })

  ipcMain.handle('history:delete', async (_event, id: string) => {
    const historyFile = join(app.getPath('userData'), 'history', `${id}.json`)
    if (existsSync(historyFile)) unlinkSync(historyFile)
  })
}
