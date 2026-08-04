import { useState, useEffect, useCallback } from 'react'
import { errorMessage } from '../utils/error'

export function useModels() {
  const [available, setAvailable] = useState<Record<string, boolean>>({})
  const [downloading, setDownloading] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.electronAPI.listModels().then(setAvailable).catch(() => {
      setError('加载模型列表失败')
    })
    const unsub = window.electronAPI.onModelDownloadProgress(({ modelName, percent }) => {
      setDownloading(prev => ({ ...prev, [modelName]: percent }))
      if (percent >= 100) {
        setAvailable(prev => ({ ...prev, [modelName]: true }))
      }
    })
    return unsub
  }, [])

  const download = useCallback(async (modelName: string) => {
    setDownloading(prev => ({ ...prev, [modelName]: 0 }))
    setError(null)
    try {
      await window.electronAPI.downloadModel(modelName)
    } catch (e: unknown) {
      setDownloading(prev => {
        const next = { ...prev }
        delete next[modelName]
        return next
      })
      // 用户主动取消不算失败
      if (!errorMessage(e).includes('取消')) {
        setError(`下载 ${modelName} 模型失败，请检查网络连接`)
      }
    }
  }, [])

  const cancelDownload = useCallback(async (modelName: string) => {
    await window.electronAPI.cancelModelDownload(modelName)
  }, [])

  return { available, downloading, download, cancelDownload, error }
}
