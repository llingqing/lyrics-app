import { describe, it, expect } from 'vitest'
import { errorMessage } from '../../src/utils/error'

describe('errorMessage', () => {
  it('extracts message from an Error', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom')
  })

  it('returns a string thrown directly', () => {
    expect(errorMessage('plain failure')).toBe('plain failure')
  })

  it('falls back for non-Error objects', () => {
    expect(errorMessage({ code: 500 })).toBe('[object Object]')
  })

  it('handles null and undefined', () => {
    expect(errorMessage(null)).toBe('null')
    expect(errorMessage(undefined)).toBe('undefined')
  })

  it('reads message from Error-like objects', () => {
    expect(errorMessage({ message: 'duck typed' })).toBe('duck typed')
  })
})