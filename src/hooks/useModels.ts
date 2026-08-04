import { useState, useEffect, useCallback } from 'react'
import { errorMessage } from '../utils/error'
import { ModelStatus } from '../types'
import { loadDownloadSource } from '../config/models'

export function useModels() {
  const [available, setAvailable] = useState<Record<string, boolean>>({})
  const [sizes, setSizes] = useState<Record<string, number>>({})
  const [downloading, setDownloading] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)

  const applyStatus = useCallback((status: Record<string, ModelStatus>) => {
    const avail: Record<string, boolean> = {}
    const sz: Record<string, number> = {}
    for (const [name, s] of Object.entries(status)) {
      avail[name] = s.downloaded
      sz[name] = s.sizeBytes
    }
    setAvailable(avail)
    setSizes(sz)
  }, [])

  useEffect(() => {
    window.electronAPI.listModels().then(applyStatus).catch(() => {
      setError('加载模型列表失败')
    })
    const unsub = window.electronAPI.onModelDownloadProgress(({ modelName, percent }) => {
      setDownloading(prev => ({ ...prev, [modelName]: percent }))
      if (percent >= 100) {
        setAvailable(prev => ({ ...prev, [modelName]: true }))
        // 拿到落盘后的真实大小
        window.electronAPI.listModels().then(applyStatus).catch(() => { /* 下次刷新补上 */ })
      }
    })
    return unsub
  }, [applyStatus])

  const download = useCallback(async (modelName: string) => {
    setDownloading(prev => ({ ...prev, [modelName]: 0 }))
    setError(null)
    try {
      // 调用时读当前下载源设置：模型管理面板改了源，这里（含配置页的下载按钮）立即生效
      const baseUrl = loadDownloadSource()?.baseUrl || undefined
      await window.electronAPI.downloadModel(modelName, baseUrl)
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

  const deleteModel = useCallback(async (modelName: string) => {
    setError(null)
    try {
      await window.electronAPI.deleteModel(modelName)
      setAvailable(prev => ({ ...prev, [modelName]: false }))
      setSizes(prev => ({ ...prev, [modelName]: 0 }))
    } catch {
      setError(`删除 ${modelName} 模型失败`)
    }
  }, [])

  return { available, sizes, downloading, download, cancelDownload, deleteModel, error }
}
