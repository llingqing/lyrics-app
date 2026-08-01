import { contextBridge, ipcRenderer } from 'electron'
import { validateInferenceConfig, validateFilePath } from '../src/utils/validation'

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

  selectAudio: () => ipcRenderer.invoke('audio:select'),
  loadAudio: (filePath: string) => {
    const err = validateFilePath(filePath)
    if (err) return Promise.reject(new Error(err))
    return ipcRenderer.invoke('audio:load', filePath)
  },
  startInference: (config: any) => {
    const err = validateInferenceConfig(config)
    if (err) return Promise.reject(new Error(err))
    return ipcRenderer.invoke('inference:start', config)
  },
  cancelInference: () => ipcRenderer.invoke('inference:cancel'),
  retryInference: () => ipcRenderer.invoke('inference:retry'),
  saveResult: (result: any) => ipcRenderer.invoke('lyrics:save', result),
  exportFile: (format: string, content: string) => ipcRenderer.invoke('export:save', format, content),
  loadHistory: () => ipcRenderer.invoke('history:load'),
  deleteHistory: (id: string) => ipcRenderer.invoke('history:delete', id),

  onInferenceProgress: (callback: (progress: any) => void) => {
    const handler = (_event: any, progress: any) => callback(progress)
    ipcRenderer.on('inference:progress', handler)
    return () => ipcRenderer.removeListener('inference:progress', handler)
  },
  onInferenceResult: (callback: (result: any) => void) => {
    const handler = (_event: any, result: any) => callback(result)
    ipcRenderer.on('inference:result', handler)
    return () => ipcRenderer.removeListener('inference:result', handler)
  },
  onInferenceError: (callback: (error: any) => void) => {
    const handler = (_event: any, error: any) => callback(error)
    ipcRenderer.on('inference:error', handler)
    return () => ipcRenderer.removeListener('inference:error', handler)
  },

  listModels: () => ipcRenderer.invoke('model:list'),
  downloadModel: (modelName: string) => ipcRenderer.invoke('model:download', modelName),
  onModelDownloadProgress: (callback: (p: { modelName: string; percent: number }) => void) => {
    const handler = (_event: any, p: any) => callback(p)
    ipcRenderer.on('model:download-progress', handler)
    return () => ipcRenderer.removeListener('model:download-progress', handler)
  },
})
