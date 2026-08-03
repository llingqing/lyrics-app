import { useRef, useState, useImperativeHandle, forwardRef, useMemo } from 'react'
import { formatTime } from '../utils/format'

interface Props {
  audioPath: string
  duration: number
  waveform?: number[]
  onTimeUpdate: (time: number) => void
}

export interface AudioPlayerHandle {
  seekTo: (time: number) => void
}

const AudioPlayer = forwardRef<AudioPlayerHandle, Props>(
  ({ audioPath, duration, waveform, onTimeUpdate }, ref) => {
    const audioRef = useRef<HTMLAudioElement>(null)
    const [playing, setPlaying] = useState(false)
    const [ended, setEnded] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)

    // 进度更新靠 <audio> 原生 timeupdate（浏览器约 4Hz），歌词高亮和进度条
    // 用不到 60fps 的精度，rAF 循环会让整个结果区每帧重渲染一次
    const handleTimeUpdate = () => {
      const a = audioRef.current
      if (!a) return
      setCurrentTime(a.currentTime)
      onTimeUpdate(a.currentTime)
    }

    useImperativeHandle(ref, () => ({
      seekTo: (time: number) => {
        const a = audioRef.current
        if (!a) return
        a.currentTime = time
        setCurrentTime(time)
        setEnded(false)
        onTimeUpdate(time)
      },
    }))

    const togglePlay = () => {
      const a = audioRef.current
      if (!a) return
      if (a.paused || a.ended) {
        if (a.ended) {
          a.currentTime = 0
          setCurrentTime(0)
          setEnded(false)
        }
        a.play().then(() => setPlaying(true)).catch(err => {
          console.error('[AudioPlayer] play() failed:', err?.message || err)
        })
      } else {
        a.pause()
        setPlaying(false)
      }
    }

    const handleWaveClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!duration) return
      const rect = e.currentTarget.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const a = audioRef.current
      if (!a) return
      a.currentTime = ratio * duration
      setCurrentTime(a.currentTime)
      setEnded(false)
      onTimeUpdate(a.currentTime)
    }

    const progressRatio = duration > 0 ? currentTime / duration : 0
    // 兜底波形是随机的，useMemo 固定住，否则每次重渲染都重新随机、条形跳动
    const waveformBars = useMemo(
      () => waveform || Array.from({ length: 100 }, () => Math.random() * 0.6 + 0.2),
      [waveform],
    )

    return (
      <div className="border border-gray-700 rounded-xl p-4 bg-gray-800/30">
        <audio
          ref={audioRef}
          src={`media://${audioPath}`}
          preload="auto"
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => { setPlaying(false); setEnded(true) }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />

        {/* Controls row */}
        <div className="flex items-center gap-4 mb-3">
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-600 flex items-center justify-center transition-colors shrink-0"
          >
            {playing && !ended ? (
              <svg className="w-4 h-4" fill="white" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg className="w-4 h-4 ml-0.5" fill="white" viewBox="0 0 24 24">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}
          </button>

          <span className="text-sm text-gray-300 font-mono w-20">
            {formatTime(currentTime)}
          </span>

          <span className="text-xs text-gray-500">/</span>

          <span className="text-sm text-gray-500 font-mono">
            {formatTime(duration)}
          </span>

          {/* Waveform with playhead */}
          <div
            className="flex-1 h-10 flex items-end gap-px cursor-pointer relative"
            onClick={handleWaveClick}
          >
            {waveformBars.map((amp, i) => {
              const barRatio = i / waveformBars.length
              const played = barRatio <= progressRatio
              const barH = Math.max(2, amp * 40)
              return (
                <div
                  key={i}
                  className="flex-1 rounded-t transition-colors duration-75"
                  style={{
                    height: `${barH}px`,
                    backgroundColor: played ? '#3b82f6' : '#4b5563',
                  }}
                />
              )
            })}
          </div>
        </div>
      </div>
    )
  }
)

AudioPlayer.displayName = 'AudioPlayer'
export default AudioPlayer
