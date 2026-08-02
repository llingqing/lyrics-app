import { describe, it, expect } from 'vitest'
import { formatTime, formatDuration } from '../../src/utils/format'

describe('formatTime', () => {
  it('formats zero seconds', () => {
    expect(formatTime(0)).toBe('00:00.000')
  })

  it('formats seconds only', () => {
    expect(formatTime(5)).toBe('00:05.000')
  })

  it('formats minutes and seconds', () => {
    expect(formatTime(65)).toBe('01:05.000')
  })

  it('formats hours', () => {
    expect(formatTime(3661)).toBe('61:01.000')
  })

  it('handles milliseconds', () => {
    expect(formatTime(1.5)).toBe('00:01.500')
  })

  it('handles floating point near boundaries', () => {
    expect(formatTime(100.88)).toBe('01:40.880')
  })
})

describe('formatDuration', () => {
  it('formats short duration', () => {
    expect(formatDuration(30)).toBe('0:30')
  })

  it('formats minutes', () => {
    expect(formatDuration(125)).toBe('2:05')
  })

  it('formats zero', () => {
    expect(formatDuration(0)).toBe('0:00')
  })
})