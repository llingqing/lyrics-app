import { useState } from 'react'
import { AudioInfo, InferenceConfig } from '../types'
import { useModels } from '../hooks/useModels'

interface Props {
  audioInfo: AudioInfo
  onStart: (config: InferenceConfig) => void
  onBack: () => void
}

const MODELS = [
  { value: 'tiny' as const, label: 'Tiny', desc: '~150MB, 最快', size: '150 MB' },
  { value: 'base' as const, label: 'Base', desc: '~290MB, 推荐', size: '290 MB' },
  { value: 'small' as const, label: 'Small', desc: '~950MB, 更准确', size: '950 MB' },
  { value: 'medium' as const, label: 'Medium', desc: '~1.5GB, 最准确', size: '1.5 GB' },
]

const LANGUAGES = [
  { value: 'auto' as const, label: '自动检测' },
  { value: 'zh' as const, label: '中文' },
  { value: 'en' as const, label: 'English' },
  { value: 'ja' as const, label: '日本語' },
  { value: 'ko' as const, label: '한국어' },
]

export default function ConfigPanel({ audioInfo, onStart, onBack }: Props) {
  const [modelName, setModelName] = useState<InferenceConfig['modelName']>('base')
  const [engine, setEngine] = useState<InferenceConfig['engine']>('local')
  const [language, setLanguage] = useState<InferenceConfig['language']>('auto')
  const [apiKey, setApiKey] = useState('')
  const { available, downloading, download } = useModels()

  const handleStart = () => {
    onStart({
      filePath: audioInfo.filePath,
      modelName,
      engine,
      language,
      cloudApiKey: engine === 'cloud' ? apiKey : undefined,
    })
  }

  const canStart = engine === 'cloud' || available[modelName]

  return (
    <div className="flex flex-col gap-6 p-8 max-w-lg mx-auto">
      <h2 className="text-xl font-semibold">识别配置</h2>

      {/* 引擎选择 */}
      <div>
        <label className="text-sm text-gray-400 mb-2 block">识别引擎</label>
        <div className="flex gap-2">
          {(['local', 'cloud'] as const).map(e => (
            <button
              key={e}
              className={`flex-1 py-2 px-4 rounded-lg border text-sm transition-colors ${
                engine === e
                  ? 'border-blue-400 bg-blue-400/10 text-blue-400'
                  : 'border-gray-700 hover:border-gray-500'
              }`}
              onClick={() => setEngine(e)}
            >
              {e === 'local' ? '🖥️ 本地模型' : '☁️ 云端 API'}
            </button>
          ))}
        </div>
      </div>

      {/* 本地：模型选择 */}
      {engine === 'local' && (
        <div>
          <label className="text-sm text-gray-400 mb-2 block">模型大小</label>
          <div className="grid grid-cols-2 gap-2">
            {MODELS.map(m => {
              const isDownloaded = available[m.value]
              const dlPercent = downloading[m.value]
              const isDownloading = dlPercent !== undefined && dlPercent < 100

              return (
                <button
                  key={m.value}
                  className={`p-3 rounded-lg border text-left transition-colors relative overflow-hidden ${
                    modelName === m.value
                      ? 'border-blue-400 bg-blue-400/10'
                      : 'border-gray-700 hover:border-gray-500'
                  }`}
                  onClick={() => {
                    if (isDownloading) return
                    if (!isDownloaded) {
                      download(m.value)
                    }
                    setModelName(m.value)
                  }}
                >
                  {/* 下载进度条背景 */}
                  {isDownloading && (
                    <div
                      className="absolute inset-0 bg-blue-500/10 transition-all duration-300"
                      style={{ width: `${dlPercent}%` }}
                    />
                  )}
                  <div className="relative z-10">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{m.label}</span>
                      {isDownloaded && <span className="text-green-400 text-xs">✓</span>}
                      {isDownloading && (
                        <span className="text-blue-400 text-xs">{dlPercent}%</span>
                      )}
                      {!isDownloaded && !isDownloading && (
                        <span className="text-gray-500 text-xs">↓</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">
                      {isDownloading ? '下载中...' : isDownloaded ? m.desc : `点击下载 · ${m.desc}`}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 语言选择 */}
      <div>
        <label className="text-sm text-gray-400 mb-2 block">语言</label>
        <div className="flex gap-2 flex-wrap">
          {LANGUAGES.map(l => (
            <button
              key={l.value}
              className={`py-1.5 px-3 rounded-lg border text-sm transition-colors ${
                language === l.value
                  ? 'border-blue-400 bg-blue-400/10 text-blue-400'
                  : 'border-gray-700 hover:border-gray-500'
              }`}
              onClick={() => setLanguage(l.value)}
            >
              {l.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-600 mt-1.5">
          多语言歌曲建议选"自动检测"，whisper 会以主要语言为主进行识别
        </p>
      </div>

      {/* 云端 API Key */}
      {engine === 'cloud' && (
        <div>
          <label className="text-sm text-gray-400 mb-2 block">OpenAI API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-200 focus:outline-none focus:border-blue-400"
          />
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-3 mt-4">
        <button
          onClick={onBack}
          className="py-2 px-6 rounded-lg border border-gray-700 hover:border-gray-500 transition-colors"
        >
          返回
        </button>
        <button
          onClick={handleStart}
          disabled={!canStart}
          className={`flex-1 py-2 px-6 rounded-lg font-medium transition-colors ${
            canStart
              ? 'bg-blue-500 hover:bg-blue-600'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          {canStart ? '开始识别' : '请先下载模型'}
        </button>
      </div>
    </div>
  )
}
