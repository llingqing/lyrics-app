import { describe, it, expect } from 'vitest'
import { segmentsToLrc, lrcToSegments, segmentsToPlainText } from '../../src/utils/lrc'
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

describe('lrcToSegments', () => {
  it('parses LRC back to segments', () => {
    const lrc = '[00:01.23]第一句歌词\n[00:05.67]第二句歌词'
    const segments = lrcToSegments(lrc)
    expect(segments).toHaveLength(2)
    expect(segments[0].start).toBeCloseTo(1.23, 2)
    expect(segments[0].text).toBe('第一句歌词')
    expect(segments[1].start).toBeCloseTo(5.67, 2)
  })

  it('returns empty array for empty input', () => {
    expect(lrcToSegments('')).toEqual([])
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
