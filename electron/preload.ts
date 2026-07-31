import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

  selectAudio: () => ipcRenderer.invoke('audio:select'),
  loadAudio: (filePath: string) => ipcRenderer.invoke('audio:load', filePath),
  startInference: (config: any) => ipcRenderer.invoke('inference:start', config),
  cancelInference: () => ipcRenderer.invoke('inference:cancel'),
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
})
