import { useState } from 'react'
import { LyricSegment } from '../../types'
import { formatTime } from '../../utils/format'

interface Props {
  segment: LyricSegment
  onSave: (id: string, text: string) => void
  onCancel: () => void
}

export default function LyricsEditor({ segment, onSave, onCancel }: Props) {
  const [text, setText] = useState(segment.text)

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl border border-gray-700 p-6 w-96 max-w-[90vw]">
        <h3 className="text-sm text-gray-400 mb-2">
          编辑歌词 · {formatTime(segment.start)}
        </h3>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-200 focus:outline-none focus:border-blue-400 min-h-[80px] resize-none"
          autoFocus
          onKeyDown={e => {
            if (e.key === 'Escape') onCancel()
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              onSave(segment.id, text)
            }
          }}
        />
        <div className="flex gap-2 mt-3 justify-end">
          <button
            onClick={onCancel}
            className="py-1.5 px-4 rounded-lg border border-gray-700 hover:border-gray-500 text-sm transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => onSave(segment.id, text)}
            className="py-1.5 px-4 rounded-lg bg-blue-500 hover:bg-blue-600 text-sm transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
