import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { validateInferenceConfig, validateFilePath } from '../src/utils/validation'
import type { InferenceConfig, InferenceProgress, TranscriptionResult } from '../src/types'

type ProgressCallback = (progress: InferenceProgress) => void
type ResultCallback = (result: TranscriptionResult) => void
type ErrorCallback = (error: { message: string; code: string }) => void
type ModelDownloadCallback = (p: { modelName: string; percent: number }) => void

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

  selectAudio: () => ipcRenderer.invoke('audio:select') as Promise<string | null>,
  loadAudio: (filePath: string) => {
    const err = validateFilePath(filePath)
    if (err) return Promise.reject(new Error(err))
    return ipcRenderer.invoke('audio:load', filePath)
  },
  startInference: (config: InferenceConfig) => {
    const err = validateInferenceConfig(config)
    if (err) return Promise.reject(new Error(err))
    return ipcRenderer.invoke('inference:start', config)
  },
  cancelInference: () => ipcRenderer.invoke('inference:cancel'),
  retryInference: () => ipcRenderer.invoke('inference:retry'),
  saveResult: (result: TranscriptionResult) => ipcRenderer.invoke('lyrics:save', result),
  exportFile: (format: 'txt' | 'lrc' | 'srt', content: string) =>
    ipcRenderer.invoke('export:save', format, content) as Promise<string | null>,
  loadHistory: () => ipcRenderer.invoke('history:load') as Promise<TranscriptionResult[]>,
  deleteHistory: (id: string) => ipcRenderer.invoke('history:delete', id),

  onInferenceProgress: (callback: ProgressCallback) => {
    const handler = (_event: IpcRendererEvent, progress: InferenceProgress) => callback(progress)
    ipcRenderer.on('inference:progress', handler)
    return () => { ipcRenderer.removeListener('inference:progress', handler) }
  },
  onInferenceResult: (callback: ResultCallback) => {
    const handler = (_event: IpcRendererEvent, result: TranscriptionResult) => callback(result)
    ipcRenderer.on('inference:result', handler)
    return () => { ipcRenderer.removeListener('inference:result', handler) }
  },
  onInferenceError: (callback: ErrorCallback) => {
    const handler = (_event: IpcRendererEvent, error: { message: string; code: string }) => callback(error)
    ipcRenderer.on('inference:error', handler)
    return () => { ipcRenderer.removeListener('inference:error', handler) }
  },

  listModels: () => ipcRenderer.invoke('model:list') as Promise<Record<string, boolean>>,
  downloadModel: (modelName: string) => ipcRenderer.invoke('model:download', modelName) as Promise<string>,
  onModelDownloadProgress: (callback: ModelDownloadCallback) => {
    const handler = (_event: IpcRendererEvent, p: { modelName: string; percent: number }) => callback(p)
    ipcRenderer.on('model:download-progress', handler)
    return () => { ipcRenderer.removeListener('model:download-progress', handler) }
  },
})