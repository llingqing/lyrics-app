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

  it('rejects paths with no extension', () => {
    expect(isFormatSupported('/path/to/song')).toBe(false)
    expect(isFormatSupported('song')).toBe(false)
  })

  it('rejects dotfiles with no extension', () => {
    expect(isFormatSupported('/path/to/.mp3')).toBe(false)
  })

  it('ignores dots in directory names', () => {
    expect(isFormatSupported('/my.music/song')).toBe(false)
    expect(isFormatSupported('/my.music/song.wav')).toBe(true)
  })

  it('handles windows-style separators', () => {
    expect(isFormatSupported('C:\\Users\\me\\song.mp3')).toBe(true)
    expect(isFormatSupported('C:\\my.music\\song')).toBe(false)
  })

  it('handles names with multiple dots', () => {
    expect(isFormatSupported('/path/my.song.v2.flac')).toBe(true)
  })
})
