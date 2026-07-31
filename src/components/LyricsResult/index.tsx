import { useState, useCallback, useRef } from 'react'
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

  const handleEdit = useCallback((id: string) => {
    setEditingId(id)
  }, [])

  const handleSaveEdit = useCallback((id: string, text: string) => {
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
        <button
          onClick={onSave}
          className="py-2 px-4 rounded-lg border border-gray-700 hover:border-gray-500 transition-colors text-sm"
        >
          保存到历史
        </button>
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
