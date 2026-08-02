import { useState, useCallback, useRef, useEffect } from 'react'
import { TranscriptionResult, LyricSegment, AudioInfo } from '../../types'
import TimelineView from './TimelineView'
import LyricsEditor from './LyricsEditor'
import ExportPanel from './ExportPanel'
import AudioPlayer, { AudioPlayerHandle } from '../AudioPlayer'

interface Props {
  result: TranscriptionResult
  audioInfo: AudioInfo | null
  onSegmentsChange: (segments: LyricSegment[]) => void
  onSave: () => void
}

export default function LyricsResult({ result, audioInfo, onSegmentsChange, onSave }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [segments, setSegments] = useState<LyricSegment[]>(result.segments)
  const [currentTime, setCurrentTime] = useState<number | undefined>(undefined)
  const playerRef = useRef<AudioPlayerHandle>(null)
  const audioPath = audioInfo?.originalPath || audioInfo?.filePath || ''

  // Undo / Redo — kept in state, not refs, so `canUndo`/`canRedo` stay
  // correct during render without forcing an extra re-render.
  const [undoStack, setUndoStack] = useState<LyricSegment[][]>([])
  const [redoStack, setRedoStack] = useState<LyricSegment[][]>([])

  function pushUndo(snapshot: LyricSegment[]) {
    setUndoStack(prev => [...prev, snapshot])
    setRedoStack([]) // clear redo on new action
  }

  const undo = useCallback(() => {
    if (undoStack.length === 0) return
    const prev = undoStack[undoStack.length - 1]
    setUndoStack(s => s.slice(0, -1))
    setRedoStack(s => [...s, segments])
    setSegments(prev)
    onSegmentsChange(prev)
  }, [segments, undoStack, onSegmentsChange])

  const redo = useCallback(() => {
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    setRedoStack(s => s.slice(0, -1))
    setUndoStack(s => [...s, segments])
    setSegments(next)
    onSegmentsChange(next)
  }, [segments, redoStack, onSegmentsChange])

  // Ctrl+Z / Ctrl+Shift+Z
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (e.ctrlKey && e.key === 'Z') {
        // Ctrl+Shift+Z (firefox/chrome sends capital Z for shift)
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo])

  // Reorder handler
  const handleReorder = useCallback((fromIndex: number, toIndex: number) => {
    pushUndo([...segments])
    const updated = [...segments]
    const [moved] = updated.splice(fromIndex, 1)
    updated.splice(toIndex, 0, moved)
    // Reassign IDs to keep them in visual order
    updated.forEach((s, i) => { s.id = `seg-${i}` })
    setSegments(updated)
    onSegmentsChange(updated)
  }, [segments, onSegmentsChange])

  const handleEdit = useCallback((id: string) => {
    setEditingId(id)
  }, [])

  const handleSaveEdit = useCallback((id: string, text: string) => {
    pushUndo([...segments])
    const updated = segments.map(s =>
      s.id === id ? { ...s, text, edited: true } : s
    )
    setSegments(updated)
    setEditingId(null)
    onSegmentsChange(updated)
  }, [segments, onSegmentsChange])

  const handleCancelEdit = useCallback(() => {
    setEditingId(null)
  }, [])

  const handleSeek = useCallback((time: number) => {
    playerRef.current?.seekTo(time)
  }, [])

  const editingSegment = editingId ? segments.find(s => s.id === editingId) : null
  const canUndo = undoStack.length > 0
  const canRedo = redoStack.length > 0

  return (
    <div className="flex flex-col gap-6 p-8 max-w-2xl mx-auto">
      {/* 头部信息 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">识别结果</h2>
          <p className="text-sm text-gray-400 mt-1">
            {result.audioFileName} · {result.language.toUpperCase()} · {result.modelName}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="py-2 px-3 rounded-lg border border-gray-700 hover:border-gray-500 transition-colors text-sm disabled:opacity-30 disabled:cursor-not-allowed"
            title="撤销 (Ctrl+Z)"
          >
            ↩
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="py-2 px-3 rounded-lg border border-gray-700 hover:border-gray-500 transition-colors text-sm disabled:opacity-30 disabled:cursor-not-allowed"
            title="重做 (Ctrl+Shift+Z)"
          >
            ↪
          </button>
          <button
            onClick={onSave}
            className="py-2 px-4 rounded-lg border border-gray-700 hover:border-gray-500 transition-colors text-sm"
          >
            保存到历史
          </button>
        </div>
      </div>

      {/* 音频播放器 */}
      {audioPath && (
        <AudioPlayer
          ref={playerRef}
          audioPath={audioPath}
          duration={audioInfo?.duration || result.segments[result.segments.length - 1]?.end || 0}
          waveform={audioInfo?.waveform}
          onTimeUpdate={setCurrentTime}
        />
      )}

      {/* 时间轴歌词 */}
      <div className="border border-gray-700 rounded-xl overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-700 bg-gray-800/50">
          <span className="text-xs text-gray-400 font-medium">时间轴</span>
        </div>
        <div className="p-2 max-h-96 overflow-y-auto">
          <TimelineView
            segments={segments}
            currentTime={currentTime}
            onEdit={handleEdit}
            onSeek={handleSeek}
            onReorder={handleReorder}
          />
        </div>
      </div>

      {/* 导出区域 */}
      <div className="border border-gray-700 rounded-xl p-4">
        <ExportPanel segments={segments} />
      </div>

      {/* 编辑弹窗 */}
      {editingSegment && (
        <LyricsEditor
          segment={editingSegment}
          onSave={handleSaveEdit}
          onCancel={handleCancelEdit}
        />
      )}
    </div>
  )
}