import { useState, useMemo } from 'react'
import { TranscriptionResult } from '../types'

// 纯展示组件：历史状态由 App 持有（useHistory 单实例），避免多实例状态不同步
interface Props {
  history: TranscriptionResult[]
  loading: boolean
  error: string | null
  onSelect: (result: TranscriptionResult) => void
  onDelete: (id: string) => void
}

export default function HistoryPanel({ history, loading, error, onSelect, onDelete }: Props) {
  const [filter, setFilter] = useState('')
  // 删除按钮 hover 才出现，容易误触，改成两步确认；移开鼠标即复位
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

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
            onMouseLeave={() => setConfirmingId(current => (current === item.id ? null : current))}
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
                if (confirmingId === item.id) {
                  setConfirmingId(null)
                  onDelete(item.id)
                } else {
                  setConfirmingId(item.id)
                }
              }}
              className={
                confirmingId === item.id
                  ? 'text-xs text-red-400 transition-all'
                  : 'text-xs text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all'
              }
            >
              {confirmingId === item.id ? '确认删除' : '删除'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}