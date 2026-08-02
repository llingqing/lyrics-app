import { LyricSegment } from '../types'

function formatLrcTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  // LRC uses centiseconds (2 digits): hh:mm:ss → [mm:ss.cs]
  const cs = Math.round((seconds * 100) % 100)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

export function segmentsToLrc(segments: LyricSegment[]): string {
  const lines: string[] = []
  for (const seg of segments) {
    if (seg.text.trim()) {
      lines.push(`[${formatLrcTime(seg.start)}]${seg.text}`)
    }
  }
  return lines.join('\n')
}

function formatSrtTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.round((seconds * 1000) % 1000)
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

export function segmentsToSrt(segments: LyricSegment[]): string {
  // Clone and sort by start time so SRT order is always correct
  const sorted = [...segments].sort((a, b) => a.start - b.start)
  const blocks: string[] = []
  for (let i = 0; i < sorted.length; i++) {
    const seg = sorted[i]
    if (!seg.text.trim()) continue
    blocks.push(
      `${i + 1}\n${formatSrtTime(seg.start)} --> ${formatSrtTime(seg.end)}\n${seg.text}\n`
    )
  }
  return blocks.join('\n')
}

export function segmentsToPlainText(segments: LyricSegment[]): string {
  return segments
    .filter(s => s.text.trim())
    .map(s => s.text)
    .join('\n')
}
