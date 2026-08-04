import { useState, useCallback, useRef, useEffect } from 'react'
import AudioUploader from './components/AudioUploader'
import ConfigPanel from './components/ConfigPanel'
import InferenceProgress from './components/InferenceProgress'
import LyricsResult from './components/LyricsResult'
import HistoryPanel from './components/HistoryPanel'
import ModelManager from './components/ModelManager'
import ErrorBoundary from './components/ErrorBoundary'
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

  const { progress, result, error, isRunning, start, cancel, reset } = useInference(config)
  const {
    history,
    loading: historyLoading,
    error: historyError,
    saveToHistory,
    saveToHistoryDebounced,
    flushPendingSave,
    deleteFromHistory,
  } = useHistory()

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
      saveToHistory(result) // 识别完成即自动存档
    }
  }, [result, saveToHistory])

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

  // 编辑（改词/排序/撤销重做）落到当前记录上，防抖后写回历史
  const handleSegmentsChange = useCallback(
    (segs: LyricSegment[]) => {
      setSegments(segs)
      if (displayedResult) {
        saveToHistoryDebounced({ ...displayedResult, segments: segs })
      }
    },
    [displayedResult, saveToHistoryDebounced],
  )

  const handleBackToUpload = useCallback(() => {
    if (isRunning) cancel() // 推理还在跑就先取消，防止过后结果事件把界面拽回结果页
    flushPendingSave()
    setStep('upload')
    setAudioInfo(null)
    setConfig(null)
    setSegments([])
    setDisplayedResult(null)
    reset()
  }, [reset, flushPendingSave, isRunning, cancel])

  const handleBackToConfig = useCallback(() => {
    setStep('config')
  }, [])

  const handleHistorySelect = useCallback(
    (historyResult: TranscriptionResult) => {
      flushPendingSave() // 上一条的待写编辑先落盘再切换
      setSegments(historyResult.segments)
      setDisplayedResult(historyResult)
      setAudioInfo(null) // 历史记录未存音频路径，清掉播放器避免配上别的文件的音频
      setStep('result')
    },
    [flushPendingSave],
  )

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
          <ErrorBoundary>
            <AudioUploader onLoaded={handleAudioLoaded} />
            <ModelManager />
          </ErrorBoundary>
        )}

        {step === 'config' && audioInfo && (
          <ErrorBoundary>
            <ConfigPanel
              audioInfo={audioInfo}
              onStart={handleStartInference}
              onBack={handleBackToUpload}
            />
          </ErrorBoundary>
        )}

        {step === 'inference' && (
          <ErrorBoundary>
            <div className="flex flex-col items-center gap-4 pt-12">
              <InferenceProgress progress={progress} onCancel={cancel} />
              {error && !result && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 max-w-md flex flex-col gap-2">
                  <p className="text-red-400 text-sm">{error}</p>
                  <div className="flex gap-3 mt-1">
                    <button
                      onClick={() => start()}
                      className="px-3 py-1 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 text-sm hover:bg-blue-500/30 transition-colors"
                    >
                      ↩ 重试
                    </button>
                    <button
                      onClick={handleBackToConfig}
                      className="text-sm text-gray-400 underline hover:text-gray-300"
                    >
                      返回重新配置
                    </button>
                  </div>
                </div>
              )}
            </div>
          </ErrorBoundary>
        )}

        {step === 'result' && displayedResult && (
          <ErrorBoundary>
            <LyricsResult
              key={displayedResult.id} // 切换到另一条记录时重挂载，重置内部歌词/撤销栈
              result={{ ...displayedResult, segments }}
              audioInfo={audioInfo}
              onSegmentsChange={handleSegmentsChange}
            />
          </ErrorBoundary>
        )}
      </main>

      <HistoryPanel
        history={history}
        loading={historyLoading}
        error={historyError}
        onSelect={handleHistorySelect}
        onDelete={deleteFromHistory}
      />
    </div>
  )
}
