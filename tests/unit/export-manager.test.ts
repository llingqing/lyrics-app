import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, readFileSync, unlinkSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { exportTxt, exportLrc } from '../../electron/export-manager'
import { LyricSegment } from '../../src/types'

const segments: LyricSegment[] = [
  { id: '0', start: 1.23, end: 5.67, text: '测试歌词第一句', confidence: 0.9, edited: false },
  { id: '1', start: 5.67, end: 10.0, text: '测试歌词第二句', confidence: 0.85, edited: false },
]

describe('exportTxt', () => {
  let tmpFile: string

  beforeEach(() => {
    tmpFile = join(tmpdir(), `test-${randomUUID()}.txt`)
  })

  afterEach(() => {
    try { unlinkSync(tmpFile) } catch {}
  })

  it('writes plain text file', () => {
    exportTxt(segments, tmpFile)
    expect(existsSync(tmpFile)).toBe(true)
    const content = readFileSync(tmpFile, 'utf-8')
    expect(content).toBe('测试歌词第一句\n测试歌词第二句')
  })
})

describe('exportLrc', () => {
  let tmpFile: string

  beforeEach(() => {
    tmpFile = join(tmpdir(), `test-${randomUUID()}.lrc`)
  })

  afterEach(() => {
    try { unlinkSync(tmpFile) } catch {}
  })

  it('writes LRC file', () => {
    exportLrc(segments, tmpFile)
    expect(existsSync(tmpFile)).toBe(true)
    const content = readFileSync(tmpFile, 'utf-8')
    expect(content).toContain('[00:01.23]测试歌词第一句')
    expect(content).toContain('[00:05.67]测试歌词第二句')
  })
})
