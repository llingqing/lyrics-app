import { useState, useEffect, useCallback, useRef } from 'react'
import { InferenceConfig, InferenceProgress, TranscriptionResult } from '../types'

export function useInference(config: InferenceConfig | null) {
  const [progress, setProgress] = useState<InferenceProgress | null>(null)
  const [result, setResult] = useState<TranscriptionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const virtualTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const unsubProgress = window.electronAPI.onInferenceProgress((p) => {
      setProgress(p)
      if (virtualTimerRef.current) {
        clearInterval(virtualTimerRef.current)
        virtualTimerRef.current = null
      }
    })
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

    // Virtual progress for cloud: advance 0→90% while waiting for API
    if (config.engine === 'cloud') {
      let virtualPercent = 0
      virtualTimerRef.current = setInterval(() => {
        virtualPercent += Math.random() * 3 + 1  // advance 1-4% per tick
        if (virtualPercent > 90) virtualPercent = 90
        setProgress({
          percent: Math.round(virtualPercent),
          currentSegment: 0,
          totalSegments: 0,
          partialText: '',
          engine: 'cloud',
        })
      }, 800)
    }

    try {
      await window.electronAPI.startInference(config)
    } catch (e: any) {
      setError(e.message)
      setIsRunning(false)
      if (virtualTimerRef.current) {
        clearInterval(virtualTimerRef.current)
        virtualTimerRef.current = null
      }
    }
  }, [config])

  const cancel = useCallback(async () => {
    await window.electronAPI.cancelInference()
    setIsRunning(false)
    if (virtualTimerRef.current) {
      clearInterval(virtualTimerRef.current)
      virtualTimerRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    setProgress(null)
    setResult(null)
    setError(null)
    setIsRunning(false)
    if (virtualTimerRef.current) {
      clearInterval(virtualTimerRef.current)
      virtualTimerRef.current = null
    }
  }, [])

  return { progress, result, error, isRunning, start, cancel, reset }
}