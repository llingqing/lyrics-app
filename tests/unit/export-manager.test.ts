import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, readFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { exportToFile } from '../../electron/export-manager'
import { LyricSegment } from '../../src/types'

const segments: LyricSegment[] = [
  { id: '0', start: 1.23, end: 5.67, text: '测试歌词第一句', confidence: 0.9, edited: false },
  { id: '1', start: 5.67, end: 10.0, text: '测试歌词第二句', confidence: 0.85, edited: false },
]

describe('exportToFile', () => {
  let tmpFile: string

  beforeEach(() => {
    tmpFile = join(tmpdir(), `test-${randomUUID()}`)
  })

  afterEach(() => {
    try { unlinkSync(tmpFile + '.txt') } catch {}
    try { unlinkSync(tmpFile + '.lrc') } catch {}
    try { unlinkSync(tmpFile + '.srt') } catch {}
  })

  it('writes plain text file', () => {
    const path = tmpFile + '.txt'
    exportToFile(segments, path, 'txt')
    expect(existsSync(path)).toBe(true)
    const content = readFileSync(path, 'utf-8')
    expect(content).toBe('测试歌词第一句\n测试歌词第二句')
  })

  it('writes LRC file', () => {
    const path = tmpFile + '.lrc'
    exportToFile(segments, path, 'lrc')
    expect(existsSync(path)).toBe(true)
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('[00:01.23]测试歌词第一句')
    expect(content).toContain('[00:05.67]测试歌词第二句')
  })

  it('writes SRT file', () => {
    const path = tmpFile + '.srt'
    exportToFile(segments, path, 'srt')
    expect(existsSync(path)).toBe(true)
    const content = readFileSync(path, 'utf-8')
    expect(content).toContain('00:00:01,230 --> 00:00:05,670')
    expect(content).toContain('测试歌词第一句')
    expect(content).toContain('测试歌词第二句')
  })
})