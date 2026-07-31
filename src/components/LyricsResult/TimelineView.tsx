import { LyricSegment } from '../../types'
import { formatTime } from '../../utils/format'

interface Props {
  segments: LyricSegment[]
  currentTime?: number
  onEdit: (id: string) => void
}

export default function TimelineView({ segments, currentTime, onEdit }: Props) {
  return (
    <div className="flex flex-col gap-1">
      {segments.map(seg => (
        <div
          key={seg.id}
          className={`
            flex items-start gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer
            hover:bg-gray-800/50 group
            ${currentTime != null && currentTime >= seg.start && currentTime <= seg.end
              ? 'bg-blue-500/10 border border-blue-500/20'
              : ''}
          `}
          onClick={() => onEdit(seg.id)}
        >
          <span className="text-xs text-gray-500 font-mono mt-0.5 shrink-0 w-16">
            {formatTime(seg.start)}
          </span>
          <span className="flex-1 text-sm">{seg.text}</span>
          {seg.edited && (
            <span className="text-xs text-amber-400 shrink-0 opacity-0 group-hover:opacity-100">
              已编辑
            </span>
          )}
          <span className="text-xs text-gray-600 shrink-0 opacity-0 group-hover:opacity-100">
            点击编辑
          </span>
        </div>
      ))}
    </div>
  )
}
