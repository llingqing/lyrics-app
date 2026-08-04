// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { trackTempFile, releaseTempFile, cleanupTempFiles } from '../../electron/temp-files'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'temp-files-'))
})

afterEach(async () => {
  cleanupTempFiles()
  await rm(dir, { recursive: true, force: true })
})

describe('temp file tracking', () => {
  it('releaseTempFile deletes a tracked file', async () => {
    const file = join(dir, 'a.wav')
    await writeFile(file, 'x')
    trackTempFile(file)

    releaseTempFile(file)

    expect(existsSync(file)).toBe(false)
  })

  it('cleanupTempFiles deletes everything still tracked', async () => {
    const a = join(dir, 'a.wav')
    const b = join(dir, 'b.wav')
    await writeFile(a, 'x')
    await writeFile(b, 'x')
    trackTempFile(a)
    trackTempFile(b)
    releaseTempFile(a) // 已单独释放的不受影响

    cleanupTempFiles()

    expect(existsSync(a)).toBe(false)
    expect(existsSync(b)).toBe(false)
  })

  it('ignores files that are already gone', () => {
    const ghost = join(dir, 'ghost.wav')
    trackTempFile(ghost)

    expect(() => releaseTempFile(ghost)).not.toThrow()
    expect(() => cleanupTempFiles()).not.toThrow()
  })
})
