import { useState, useEffect, useCallback } from 'react'
import { InferenceConfig, InferenceProgress, TranscriptionResult } from '../types'

export function useInference(config: InferenceConfig | null) {
  const [progress, setProgress] = useState<InferenceProgress | null>(null)
  const [result, setResult] = useState<TranscriptionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    const unsubProgress = window.electronAPI.onInferenceProgress(setProgress)
    const unsubResult = window.electronAPI.onInferenceResult((r) => {
      setResult(r)
      setIsRunning(false)
    })
    const unsubError = window.electronAPI.onInferenceError((e) => {
      setError(e.message)
      setIsRunning(false)
    })

    return () => {
      unsubProgress()
      unsubResult()
      unsubError()
    }
  }, [])

  const start = useCallback(async () => {
    if (!config) return
    setIsRunning(true)
    setError(null)
    setProgress(null)
    setResult(null)
    try {
      await window.electronAPI.startInference(config)
    } catch (e: any) {
      setError(e.message)
      setIsRunning(false)
    }
  }, [config])

  const cancel = useCallback(async () => {
    await window.electronAPI.cancelInference()
    setIsRunning(false)
  }, [])

  return { progress, result, error, isRunning, start, cancel }
}
