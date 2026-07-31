import { useState, useCallback } from 'react'
import { AudioInfo } from '../types'

export function useAudio() {
  const [audioInfo, setAudioInfo] = useState<AudioInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectFile = useCallback(async () => {
    try {
      setError(null)
      const filePath = await window.electronAPI.selectAudio()
      if (!filePath) return
      setLoading(true)
      const info = await window.electronAPI.loadAudio(filePath)
      setAudioInfo(info)
    } catch (e: any) {
      setError(e.message || '音频加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const clearAudio = useCallback(() => {
    setAudioInfo(null)
    setError(null)
  }, [])

  return { audioInfo, loading, error, selectFile, clearAudio }
}
