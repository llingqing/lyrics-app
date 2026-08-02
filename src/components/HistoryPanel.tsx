import { useState, useMemo } from 'react'
import { TranscriptionResult } from '../types'
import { useHistory } from '../hooks/useHistory'

interface Props {
  onSelect: (result: TranscriptionResult) => void
}

export default function HistoryPanel({ onSelect }: Props) {
  const { history, loading, error, deleteFromHistory } = useHistory()
  const [filter, setFilter] = useState('')

  const filtered = useMemo(() => {
    if (!filter.trim()) return history
    const q = filter.toLowerCase()
    return history.filter(
      item =>
        item.audioFileName.toLowerCase().includes(q) ||
        item.language.toLowerCase().includes(q) ||
        item.modelName.toLowerCase().includes(q),
    )
  }, [history, filter])

  return (
    <div className="border-t border-gray-800 pt-6 mt-6">
      <div className="flex items-center justify-between px-8 mb-3">
        <h3 className="text-sm font-medium text-gray-400">历史记录</h3>
        {history.length > 0 && (
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="搜索..."
            className="w-40 px-2 py-1 text-xs rounded border border-gray-700 bg-gray-800 text-gray-300 focus:outline-none focus:border-blue-400 placeholder-gray-600"
          />
        )}
      </div>

      {loading && <p className="px-8 text-sm text-gray-500">加载中...</p>}

      {error && !loading && <p className="px-8 text-sm text-red-400">{error}</p>}

      {!loading && !error && history.length === 0 && (
        <p className="px-8 text-sm text-gray-500">暂无历史记录</p>
      )}

      {!loading && !error && history.length > 0 && filtered.length === 0 && (
        <p className="px-8 text-sm text-gray-500">无匹配记录</p>
      )}

      <div className="flex flex-col">
        {filtered.map(item => (
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