import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, readFile, readdir, writeFile, utimes, mkdir } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { saveHistoryEntry, loadHistoryEntries, deleteHistoryEntry } from '../../electron/history-store'
import { TranscriptionResult } from '../../src/types'

function makeResult(id: string): TranscriptionResult {
  return {
    id,
    audioFileName: `${id}.mp3`,
    modelName: 'base',
    engine: 'local',
    language: 'zh',
    createdAt: '2026-01-01T00:00:00.000Z',
    segments: [{ id: 'seg-0', start: 0, end: 5, text: '一句', confidence: 0.9, edited: false }],
  }
}

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'history-store-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('saveHistoryEntry', () => {
  it('writes the entry as <id>.json, creating the directory if needed', async () => {
    const nested = join(dir, 'history')
    await saveHistoryEntry(nested, makeResult('r1'), 100)
    const saved = JSON.parse(await readFile(join(nested, 'r1.json'), 'utf-8'))
    expect(saved.id).toBe('r1')
    expect(saved.audioFileName).toBe('r1.mp3')
  })

  it('prunes the oldest entries by mtime when a new entry exceeds the max', async () => {
    await mkdir(dir, { recursive: true })
    for (const [i, id] of ['a', 'b', 'c'].entries()) {
      const f = join(dir, `${id}.json`)
      await writeFile(f, JSON.stringify(makeResult(id)))
      const t = new Date(2026, 0, 1 + i) // a 最旧，c 最新
      await utimes(f, t, t)
    }

    await saveHistoryEntry(dir, makeResult('d'), 3)

    const files = (await readdir(dir)).sort()
    expect(files).toEqual(['b.json', 'c.json', 'd.json']) // 只淘汰最旧的 a
  })

  it('does not prune anything when overwriting an existing entry, even above the max', async () => {
    await mkdir(dir, { recursive: true })
    for (const id of ['a', 'b', 'c', 'd']) {
      await writeFile(join(dir, `${id}.json`), JSON.stringify(makeResult(id)))
    }

    // 覆盖已有记录（编辑写回的路径）：即使数量超限也不触发清理扫描
    await saveHistoryEntry(dir, makeResult('b'), 3)

    const files = (await readdir(dir)).sort()
    expect(files).toEqual(['a.json', 'b.json', 'c.json', 'd.json'])
  })
})

describe('loadHistoryEntries', () => {
  it('returns an empty list when the directory does not exist', async () => {
    expect(await loadHistoryEntries(join(dir, 'missing'), 100)).toEqual([])
  })

  it('returns entries sorted by createdAt, newest first, capped at max', async () => {
    await mkdir(dir, { recursive: true })
    const dates = { a: '2026-01-01', b: '2026-03-01', c: '2026-02-01' }
    for (const [id, day] of Object.entries(dates)) {
      const entry = { ...makeResult(id), createdAt: `${day}T00:00:00.000Z` }
      await writeFile(join(dir, `${id}.json`), JSON.stringify(entry))
    }

    const entries = await loadHistoryEntries(dir, 2)
    expect(entries.map(e => e.id)).toEqual(['b', 'c'])
  })

  it('skips corrupt JSON files instead of failing the whole load', async () => {
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'good.json'), JSON.stringify(makeResult('good')))
    await writeFile(join(dir, 'bad.json'), '{oops')

    const entries = await loadHistoryEntries(dir, 100)
    expect(entries.map(e => e.id)).toEqual(['good'])
  })
})

describe('deleteHistoryEntry', () => {
  it('removes the entry file', async () => {
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'r1.json'), JSON.stringify(makeResult('r1')))
    await deleteHistoryEntry(dir, 'r1')
    expect(await readdir(dir)).toEqual([])
  })

  it('is a no-op when the entry does not exist', async () => {
    await mkdir(dir, { recursive: true })
    await expect(deleteHistoryEntry(dir, 'nope')).resolves.toBeUndefined()
  })
})
