import { InferenceProgress as IProgress } from '../types'

interface Props {
  progress: IProgress | null
  onCancel: () => void
}

export default function InferenceProgress({ progress, onCancel }: Props) {
  return (
    <div className="flex flex-col items-center gap-6 p-8 max-w-md mx-auto">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">正在识别歌词...</h2>
        <p className="text-sm text-gray-400">
          {progress ? `${progress.percent}%` : '准备中...'}
        </p>
      </div>

      {/* 进度条 */}
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-300"
          style={{ width: `${progress?.percent || 0}%` }}
        />
      </div>

      {/* 中间结果预览 */}
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
