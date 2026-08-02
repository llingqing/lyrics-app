import { useState, useEffect, useCallback } from 'react'

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
    } catch {
      setDownloading(prev => {
        const next = { ...prev }
        delete next[modelName]
        return next
      })
      setError(`下载 ${modelName} 模型失败，请检查网络连接`)
    }
  }, [])

  return { available, downloading, download, error }
}
