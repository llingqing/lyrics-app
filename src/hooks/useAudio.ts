import { useState, useCallback } from 'react'
import { AudioInfo } from '../types'
import { errorMessage } from '../utils/error'

export function useAudio() {
  const [audioInfo, setAudioInfo] = useState<AudioInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadFile = useCallback(async (filePath: string) => {
    try {
      setError(null)
      setLoading(true)
      const info = await window.electronAPI.loadAudio(filePath)
      setAudioInfo(info)
    } catch (e: unknown) {
      setError(errorMessage(e) || '音频加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const selectFile = useCallback(async () => {
    const filePath = await window.electronAPI.selectAudio()
    if (!filePath) return
    await loadFile(filePath)
  }, [loadFile])

  const clearAudio = useCallback(() => {
    setAudioInfo(null)
    setError(null)
  }, [])

  return { audioInfo, loading, error, selectFile, loadFile, clearAudio }
}
