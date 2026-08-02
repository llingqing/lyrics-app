import { describe, it, expect, beforeEach } from 'vitest'
import { registerMediaPath, isMediaPathAllowed, clearMediaPaths } from '../../electron/media-access'

beforeEach(() => {
  clearMediaPaths()
})

describe('media access registry', () => {
  it('denies any path before one is registered', () => {
    expect(isMediaPathAllowed('/home/me/Music/song.mp3')).toBe(false)
  })

  it('allows a path once registered', () => {
    registerMediaPath('/home/me/Music/song.mp3')
    expect(isMediaPathAllowed('/home/me/Music/song.mp3')).toBe(true)
  })

  it('keeps denying paths that were never registered', () => {
    registerMediaPath('/home/me/Music/song.mp3')
    expect(isMediaPathAllowed('/etc/passwd')).toBe(false)
    expect(isMediaPathAllowed('/home/me/.ssh/id_rsa')).toBe(false)
  })

  it('tracks several paths at once', () => {
    registerMediaPath('/home/me/a.mp3')
    registerMediaPath('/tmp/lyrics-input-1.wav')
    expect(isMediaPathAllowed('/home/me/a.mp3')).toBe(true)
    expect(isMediaPathAllowed('/tmp/lyrics-input-1.wav')).toBe(true)
  })

  it('rejects empty and non-string input', () => {
    registerMediaPath('/home/me/a.mp3')
    expect(isMediaPathAllowed('')).toBe(false)
    expect(isMediaPathAllowed(undefined as unknown as string)).toBe(false)
  })

  it('ignores attempts to register empty paths', () => {
    registerMediaPath('')
    expect(isMediaPathAllowed('')).toBe(false)
  })

  it('does not allow a traversal variant of a registered path', () => {
    registerMediaPath('/home/me/Music/song.mp3')
    expect(isMediaPathAllowed('/home/me/Music/../../../etc/passwd')).toBe(false)
  })
})