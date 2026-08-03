import { useState, useEffect, useCallback, useRef } from 'react'

const SAVE_DEBOUNCE_MS = 600
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
  // IPC 写入通过 promise 链串行化，防止两次快速保存乱序落盘（旧覆盖新）。
  const saveChainRef = useRef<Promise<void>>(Promise.resolve())
  const saveToHistory = useCallback((result: TranscriptionResult) => {
    const save = async () => {
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
    }
    saveChainRef.current = saveChainRef.current.then(save)
    return saveChainRef.current
  }, [])

  // 编辑场景每次按键都会触发保存，这里合并成 600ms 内最后一次再落盘
  const pendingRef = useRef<TranscriptionResult | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flushPendingSave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const pending = pendingRef.current
    pendingRef.current = null
    if (pending) saveToHistory(pending)
  }, [saveToHistory])

  const saveToHistoryDebounced = useCallback(
    (result: TranscriptionResult) => {
      pendingRef.current = result
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(flushPendingSave, SAVE_DEBOUNCE_MS)
    },
    [flushPendingSave],
  )

  // 卸载时把还没落盘的编辑写出去，避免丢最后一段改动
  useEffect(() => flushPendingSave, [flushPendingSave])

  const deleteFromHistory = useCallback(async (id: string) => {
    try {
      await window.electronAPI.deleteHistory(id)
      setHistory(prev => prev.filter(item => item.id !== id))
    } catch {
      setError('删除历史记录失败')
    }
  }, [])

  return { history, loading, error, saveToHistory, saveToHistoryDebounced, flushPendingSave, deleteFromHistory }
}
