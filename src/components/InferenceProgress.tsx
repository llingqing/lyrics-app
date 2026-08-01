import { InferenceProgress as IProgress } from '../types'

interface Props {
  progress: IProgress | null
  onCancel: () => void
}

function stageText(p: IProgress | null): string {
  if (!p) return '准备中...'
  if (p.engine === 'cloud') {
    if (p.percent < 10) return '正在上传音频...'
    if (p.percent < 85) return '正在等待识别结果...'
    if (p.percent < 100) return '正在解析结果...'
    return '完成!'
  }
  // local inference
  if (p.percent < 10) return '正在加载模型...'
  if (p.percent < 90) return '正在识别歌词...'
  if (p.percent < 100) return '正在生成结果...'
  return '完成!'
}

export default function InferenceProgress({ progress, onCancel }: Props) {
  const percent = progress?.percent || 0
  const isCloud = progress?.engine === 'cloud'
  const showPulse = isCloud && percent > 0 && percent < 80

  return (
    <div className="flex flex-col items-center gap-6 p-8 max-w-md mx-auto">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">正在识别歌词...</h2>
        <p className="text-sm text-gray-400">{stageText(progress)}</p>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            showPulse ? 'bg-blue-400 animate-pulse' : 'bg-blue-500'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className="text-sm text-gray-500 font-mono">{percent}%</p>

      {/* Partial text from local inference */}
      {progress?.partialText && (
        <div className="w-full p-4 rounded-lg bg-gray-800/50 border border-gray-700 max-h-32 overflow-y-auto">
          <p className="text-sm text-gray-300 whitespace-pre-wrap">{progress.partialText}</p>
        </div>
      )}

      <button
        onClick={onCancel}
        className="py-2 px-6 rounded-lg border border-gray-700 hover:border-red-500 hover:text-red-400 transition-colors text-sm"
      >
        取消
      </button>
    </div>
  )
}