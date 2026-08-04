import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import type { InferenceConfig, InferenceProgress, TranscriptionResult, ModelStatus } from '../src/types'

// This script is sandboxed: it can only require 'electron' and a few node
// builtins, never a relative module. Keep it free of local imports —
// argument validation lives in the main process, which is the real trust
// boundary anyway (preload runs inside the renderer process).

type ProgressCallback = (progress: InferenceProgress) => void
type ResultCallback = (result: TranscriptionResult) => void
type ErrorCallback = (error: { message: string; code: string }) => void
type ModelDownloadCallback = (p: { modelName: string; percent: number }) => void

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

  selectAudio: () => ipcRenderer.invoke('audio:select') as Promise<string | null>,
  loadAudio: (filePath: string) => ipcRenderer.invoke('audio:load', filePath),
  startInference: (config: InferenceConfig) => ipcRenderer.invoke('inference:start', config),
  cancelInference: () => ipcRenderer.invoke('inference:cancel'),
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

  listModels: () => ipcRenderer.invoke('model:list') as Promise<Record<string, ModelStatus>>,
  downloadModel: (modelName: string) => ipcRenderer.invoke('model:download', modelName) as Promise<string>,
  cancelModelDownload: (modelName: string) => ipcRenderer.invoke('model:download-cancel', modelName),
  deleteModel: (modelName: string) => ipcRenderer.invoke('model:delete', modelName),
  onModelDownloadProgress: (callback: ModelDownloadCallback) => {
    const handler = (_event: IpcRendererEvent, p: { modelName: string; percent: number }) => callback(p)
    ipcRenderer.on('model:download-progress', handler)
    return () => { ipcRenderer.removeListener('model:download-progress', handler) }
  },
})