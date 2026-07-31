import { useState, useEffect, useCallback } from 'react'

export function useModels() {
  const [available, setAvailable] = useState<Record<string, boolean>>({})
  const [downloading, setDownloading] = useState<Record<string, number>>({})

  useEffect(() => {
    window.electronAPI.listModels().then(setAvailable)
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
    try {
      await window.electronAPI.downloadModel(modelName)
    } catch {
      setDownloading(prev => {
        const next = { ...prev }
        delete next[modelName]
        return next
      })
    }
  }, [])

  return { available, downloading, download }
}
