import { describe, it, expect } from 'vitest'
import { segmentsToLrc, segmentsToPlainText, segmentsToSrt } from '../../src/utils/lrc'
import { LyricSegment } from '../../src/types'

const sampleSegments: LyricSegment[] = [
  { id: '0', start: 1.23, end: 5.67, text: '第一句歌词', confidence: 0.95, edited: false },
  { id: '1', start: 5.67, end: 10.0, text: '第二句歌词', confidence: 0.9, edited: false },
  { id: '2', start: 10.0, end: 15.0, text: '', confidence: 1, edited: false },
]

describe('segmentsToLrc', () => {
  it('converts segments to LRC format', () => {
    const lrc = segmentsToLrc(sampleSegments)
    expect(lrc).toContain('[00:01.23]第一句歌词')
    expect(lrc).toContain('[00:05.67]第二句歌词')
  })

  it('skips empty segments', () => {
    const lrc = segmentsToLrc(sampleSegments)
    expect(lrc).not.toContain('[00:10.00]')
    expect(lrc.split('\n').length).toBe(2)
  })

  it('returns empty string for empty input', () => {
    expect(segmentsToLrc([])).toBe('')
  })
})

describe('segmentsToPlainText', () => {
  it('converts segments to plain text', () => {
    const text = segmentsToPlainText(sampleSegments)
    expect(text).toBe('第一句歌词\n第二句歌词')
  })

  it('skips empty segments', () => {
    expect(segmentsToPlainText(sampleSegments).split('\n').length).toBe(2)
  })
})

describe('segmentsToSrt', () => {
  it('converts segments to SRT format', () => {
    const srt = segmentsToSrt(sampleSegments)
    expect(srt).toContain('00:00:01,230 --> 00:00:05,670')
    expect(srt).toContain('第一句歌词')
    expect(srt).toContain('第二句歌词')
  })

  it('skips empty segments', () => {
    const srt = segmentsToSrt(sampleSegments)
    // 空文本的 segment (id=2) 不应出现在 SRT 中
    expect(srt.split('\n\n').length).toBe(2)
  })

  it('returns empty string for empty input', () => {
    expect(segmentsToSrt([])).toBe('')
  })

  it('sorts by start time', () => {
    const unordered: LyricSegment[] = [
      { id: '1', start: 10, end: 15, text: 'B', confidence: 1, edited: false },
      { id: '0', start: 1, end: 5, text: 'A', confidence: 1, edited: false },
    ]
    const srt = segmentsToSrt(unordered)
    const aPos = srt.indexOf('A')
    const bPos = srt.indexOf('B')
    expect(aPos).toBeLessThan(bPos)
  })
})
