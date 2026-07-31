import { useState, useEffect, useCallback } from 'react'
import { TranscriptionResult } from '../types'

export function useHistory() {
  const [history, setHistory] = useState<TranscriptionResult[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const items = await window.electronAPI.loadHistory()
      setHistory(items)
    } catch {
      // 静默失败
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

  return { history, loading, addToHistory, deleteFromHistory }
}
