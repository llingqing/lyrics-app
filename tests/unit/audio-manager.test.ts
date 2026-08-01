import { describe, it, expect } from 'vitest'
import { isFormatSupported } from '../../src/utils/format'

describe('isFormatSupported', () => {
  it('accepts mp3 files', () => {
    expect(isFormatSupported('/path/to/song.mp3')).toBe(true)
  })

  it('accepts wav files', () => {
    expect(isFormatSupported('/path/to/recording.wav')).toBe(true)
  })

  it('accepts flac files', () => {
    expect(isFormatSupported('/path/to/audio.flac')).toBe(true)
  })

  it('rejects unsupported formats', () => {
    expect(isFormatSupported('/path/to/video.mp4')).toBe(false)
    expect(isFormatSupported('/path/to/file.txt')).toBe(false)
  })

  it('is case insensitive', () => {
    expect(isFormatSupported('/path/to/SONG.MP3')).toBe(true)
  })
})
