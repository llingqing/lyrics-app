import { useState, useCallback, useRef, useEffect } from 'react'
import AudioUploader from './components/AudioUploader'
import ConfigPanel from './components/ConfigPanel'
import InferenceProgress from './components/InferenceProgress'
import LyricsResult from './components/LyricsResult'
import HistoryPanel from './components/HistoryPanel'
import { useInference } from './hooks/useInference'
import { useHistory } from './hooks/useHistory'
import { AudioInfo, InferenceConfig, TranscriptionResult, LyricSegment } from './types'

type Step = 'upload' | 'config' | 'inference' | 'result'

export default function App() {
  const [step, setStep] = useState<Step>('upload')
  const [audioInfo, setAudioInfo] = useState<AudioInfo | null>(null)
  const [config, setConfig] = useState<InferenceConfig | null>(null)
  const [segments, setSegments] = useState<LyricSegment[]>([])
  const [displayedResult, setDisplayedResult] = useState<TranscriptionResult | null>(null)

  const { progress, result, error, isRunning, start, cancel } = useInference(config)
  const { addToHistory } = useHistory()

  const handleAudioLoaded = useCallback((info: AudioInfo) => {
    setAudioInfo(info)
    setStep('config')
  }, [])

  const handleStartInference = useCallback(async (cfg: InferenceConfig) => {
    setConfig(cfg)
    setStep('inference')
  }, [])

  const prevResult = useRef<TranscriptionResult | null>(null)
  useEffect(() => {
    if (result && result !== prevResult.current) {
      prevResult.current = result
      setSegments(result.segments)
      setDisplayedResult(result)
      setStep('result')
    }
  }, [result])

  // 当进入 inference 步骤且 config 已设置时自动开始
  const startedRef = useRef(false)
  useEffect(() => {
    if (step === 'inference' && config && !startedRef.current && !isRunning && !result) {
      startedRef.current = true
      start()
    }
  }, [step, config, start, isRunning, result])

  // 重置 started 标记
  useEffect(() => {
    if (step !== 'inference') {
      startedRef.current = false
    }
  }, [step])

  const handleSave = useCallback(async () => {
    if (displayedResult) {
      await addToHistory(displayedResult)
    }
  }, [displayedResult, addToHistory])

  const handleBackToUpload = useCallback(() => {
    setStep('upload')
    setAudioInfo(null)
    setConfig(null)
  }, [])

  const handleBackToConfig = useCallback(() => {
    setStep('config')
  }, [])

  const handleHistorySelect = useCallback((historyResult: TranscriptionResult) => {
    setSegments(historyResult.segments)
    setDisplayedResult(historyResult)
    setStep('result')
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-800 px-8 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">歌词识别</h1>
        {step !== 'upload' && (
          <button
            onClick={handleBackToUpload}
            className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
          >
            重新开始
          </button>
        )}
      </header>

      <main className="flex-1 py-8">
        {step === 'upload' && (
          <AudioUploader onLoaded={handleAudioLoaded} />
        )}

        {step === 'config' && audioInfo && (
          <ConfigPanel
            audioInfo={audioInfo}
            onStart={handleStartInference}
            onBack={handleBackToUpload}
          />
        )}

        {step === 'inference' && (
          <div className="flex flex-col items-center gap-4 pt-12">
            <InferenceProgress progress={progress} onCancel={cancel} />
            {error && !result && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 max-w-md">
                <p className="text-red-400 text-sm">{error}</p>
                <button
                  onClick={handleBackToConfig}
                  className="mt-2 text-sm text-red-400 underline"
                >
                  返回重新配置
                </button>
              </div>
            )}
          </div>
        )}

        {step === 'result' && displayedResult && (
          <LyricsResult
            result={{ ...displayedResult, segments }}
            onSegmentsChange={setSegments}
            onSave={handleSave}
          />
        )}
      </main>

      <HistoryPanel onSelect={handleHistorySelect} />
    </div>
  )
}
