import { useCallback, useState, useRef, useEffect, DragEvent } from 'react'
import { AudioInfo } from '../types'
import { useAudio } from '../hooks/useAudio'

interface Props {
  onLoaded: (info: AudioInfo) => void
}

export default function AudioUploader({ onLoaded }: Props) {
  const { audioInfo, loading, error, selectFile, loadFile } = useAudio()
  const [isDragging, setIsDragging] = useState(false)

  const handleSelect = useCallback(async () => {
    await selectFile()
  }, [selectFile])

  const prevInfo = useRef<AudioInfo | null>(null)
  useEffect(() => {
    if (audioInfo && audioInfo !== prevInfo.current) {
      prevInfo.current = audioInfo
      onLoaded(audioInfo)
    }
  }, [audioInfo, onLoaded])

  return (
    <div className="flex flex-col items-center gap-6 p-8">
      <div
        className={`
          w-full max-w-lg border-2 border-dashed rounded-xl p-12 text-center
          transition-colors cursor-pointer
          ${isDragging ? 'border-blue-400 bg-blue-400/10' : 'border-gray-600 hover:border-gray-500'}
          ${loading ? 'opacity-50 pointer-events-none' : ''}
        `}
        onClick={handleSelect}
        onDragOver={(e: DragEvent) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e: DragEvent) => {
          e.preventDefault()
          setIsDragging(false)
          interface ElectronFile extends File {
  path: string
}

// ... (rest of the component)

          const file = e.dataTransfer.files[0] as ElectronFile
          if (file) {
            loadFile(file.path)
          }
        }}
      >
        {audioInfo ? (
          <div>
            <p className="text-lg font-semibold">{audioInfo.fileName}</p>
            <p className="text-sm text-gray-400 mt-1">
              时长{' '}
              {Math.floor(audioInfo.duration / 60)}:
              {String(Math.floor(audioInfo.duration % 60)).padStart(2, '0')}
              {' · '}
              {audioInfo.format.toUpperCase()}
            </p>
            {audioInfo.waveform && (
              <div className="flex items-end gap-px h-8 mt-3 justify-center">
                {audioInfo.waveform.filter((_, i) => i % 2 === 0).map((v, i) => (
                  <div
                    key={i}
                    className="w-1 bg-blue-400 rounded-sm"
                    style={{ height: `${Math.max(4, v * 100)}%` }}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <p className="text-gray-400">
              拖拽音频文件到此处，或<span className="text-blue-400">点击选择</span>
            </p>
            <p className="text-xs text-gray-500 mt-2">
              支持 MP3, WAV, FLAC, AAC, OGG
            </p>
          </div>
        )}
      </div>

      {loading && <p className="text-blue-400">正在解析音频文件...</p>}
      {error && <p className="text-red-400">{error}</p>}
    </div>
  )
}
