import { LyricSegment } from '../../types'
import { formatTime } from '../../utils/format'

interface Props {
  segments: LyricSegment[]
  currentTime?: number
  onEdit: (id: string) => void
  onSeek: (time: number) => void
}

export default function TimelineView({ segments, currentTime, onEdit, onSeek }: Props) {
  return (
    <div className="flex flex-col gap-1">
      {segments.map(seg => {
        const isActive = currentTime != null && currentTime >= seg.start && currentTime <= seg.end
        return (
          <div
            key={seg.id}
            className={`
              flex items-start gap-3 px-3 py-2 rounded-lg transition-colors group
              ${isActive
                ? 'bg-blue-500/10 border border-blue-500/20'
                : 'hover:bg-gray-800/50'}
            `}
          >
            {/* ▶ seek button */}
            <button
              onClick={(e) => { e.stopPropagation(); onSeek(seg.start) }}
              className={`shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${
                isActive ? 'opacity-100' : ''
              }`}
              title="跳转到此时间"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24"
                fill={isActive ? '#60a5fa' : '#9ca3af'}>
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </button>

            {/* timestamp */}
            <span
              className={`text-xs font-mono mt-0.5 shrink-0 w-16 cursor-pointer ${
                isActive ? 'text-blue-400' : 'text-gray-500'
              }`}
              onClick={(e) => { e.stopPropagation(); onSeek(seg.start) }}
            >
              {formatTime(seg.start)}
            </span>

            {/* text */}
            <span
              className="flex-1 text-sm cursor-pointer"
              onClick={() => onEdit(seg.id)}
            >
              {seg.text}
            </span>

            {seg.edited && (
              <span className="text-xs text-amber-400 shrink-0 opacity-0 group-hover:opacity-100">
                已编辑
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
