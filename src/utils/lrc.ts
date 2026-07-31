import { LyricSegment } from '../types'
import { formatTime } from './format'

export function segmentsToLrc(segments: LyricSegment[]): string {
  const lines: string[] = []
  for (const seg of segments) {
    if (seg.text.trim()) {
      lines.push(`[${formatTime(seg.start)}]${seg.text}`)
    }
  }
  return lines.join('\n')
}

export function lrcToSegments(lrc: string): LyricSegment[] {
  const lines = lrc.split('\n')
  const segments: LyricSegment[] = []
  const tagRegex = /\[(\d{2}):(\d{2})\.(\d{2})\]/
  const timestamps: Array<{ time: number; text: string }> = []

  for (const line of lines) {
    const match = line.match(tagRegex)
    if (match) {
      const mins = parseInt(match[1], 10)
      const secs = parseInt(match[2], 10)
      const ms = parseInt(match[3], 10)
      const time = mins * 60 + secs + ms / 100
      const text = line.replace(tagRegex, '').trim()
      if (text) {
        timestamps.push({ time, text })
      }
    }
  }

  timestamps.sort((a, b) => a.time - b.time)

  for (let i = 0; i < timestamps.length; i++) {
    const { time, text } = timestamps[i]
    const end = i < timestamps.length - 1 ? timestamps[i + 1].time : time + 5
    segments.push({
      id: `seg-${i}`,
      start: time,
      end,
      text,
      confidence: 1,
      edited: false,
    })
  }

  return segments
}

export function segmentsToPlainText(segments: LyricSegment[]): string {
  return segments
    .filter(s => s.text.trim())
    .map(s => s.text)
    .join('\n')
}
