import { useState, useEffect, useCallback } from 'react'
import { TranscriptionResult } from '../types'

export function useHistory() {
  const [history, setHistory] = useState<TranscriptionResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setError(null)
      const items = await window.electronAPI.loadHistory()
      setHistory(items)
    } catch {
      setError('历史记录加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // 识别完成和每次编辑都会写同一条记录（同 id 同文件），所以按 id 覆盖而非追加。
  // 调用方是 fire-and-forget（effect / 事件回调），错误在这里兜住并暴露给面板。
  const saveToHistory = useCallback(async (result: TranscriptionResult) => {
    try {
      await window.electronAPI.saveResult(result)
      setError(null)
      setHistory(prev =>
        prev.some(item => item.id === result.id)
          ? prev.map(item => (item.id === result.id ? result : item))
          : [result, ...prev],
      )
    } catch {
      setError('保存历史记录失败')
    }
  }, [])

  const deleteFromHistory = useCallback(async (id: string) => {
    try {
      await window.electronAPI.deleteHistory(id)
      setHistory(prev => prev.filter(item => item.id !== id))
    } catch {
      setError('删除历史记录失败')
    }
  }, [])

  return { history, loading, error, saveToHistory, deleteFromHistory }
}
