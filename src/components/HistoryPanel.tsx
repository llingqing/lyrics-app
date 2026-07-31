import { TranscriptionResult } from '../types'
import { useHistory } from '../hooks/useHistory'

interface Props {
  onSelect: (result: TranscriptionResult) => void
}

export default function HistoryPanel({ onSelect }: Props) {
  const { history, loading, deleteFromHistory } = useHistory()

  return (
    <div className="border-t border-gray-800 pt-6 mt-6">
      <h3 className="text-sm font-medium text-gray-400 px-8 mb-3">历史记录</h3>

      {loading && <p className="px-8 text-sm text-gray-500">加载中...</p>}

      {!loading && history.length === 0 && (
        <p className="px-8 text-sm text-gray-500">暂无历史记录</p>
      )}

      <div className="flex flex-col">
        {history.map(item => (
          <div
            key={item.id}
            className="flex items-center gap-3 px-8 py-2.5 hover:bg-gray-800/50 cursor-pointer group transition-colors"
            onClick={() => onSelect(item)}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{item.audioFileName}</p>
              <p className="text-xs text-gray-500">
                {new Date(item.createdAt).toLocaleString('zh-CN')}
                {' · '}
                {item.modelName} · {item.language.toUpperCase()}
              </p>
            </div>
            <button
              onClick={e => {
                e.stopPropagation()
                deleteFromHistory(item.id)
              }}
              className="text-xs text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
            >
              删除
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
