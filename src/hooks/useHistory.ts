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

  const addToHistory = useCallback(async (result: TranscriptionResult) => {
    await window.electronAPI.saveResult(result)
    setHistory(prev => [result, ...prev])
  }, [])

  const deleteFromHistory = useCallback(async (id: string) => {
    await window.electronAPI.deleteHistory(id)
    setHistory(prev => prev.filter(item => item.id !== id))
  }, [])

  return { history, loading, error, addToHistory, deleteFromHistory }
}
