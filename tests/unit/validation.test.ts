import { describe, it, expect } from 'vitest'
import { validateInferenceConfig, validateFilePath } from '../../src/utils/validation'

// ─── InferenceConfig validation ────────────────────────────

describe('validateInferenceConfig', () => {
  const validConfig = {
    filePath: '/tmp/test.wav',
    modelName: 'base' as const,
    engine: 'local' as const,
    language: 'auto' as const,
  }

  it('returns null for a valid local config', () => {
    expect(validateInferenceConfig(validConfig)).toBeNull()
  })

  it('returns null for a valid cloud config with API key', () => {
    expect(validateInferenceConfig({
      ...validConfig,
      engine: 'cloud' as const,
      cloudApiKey: 'sk-test123',
    })).toBeNull()
  })

  it('rejects null/undefined config', () => {
    expect(validateInferenceConfig(null)).toBe('Missing inference config')
    expect(validateInferenceConfig(undefined)).toBe('Missing inference config')
  })

  it('rejects non-object config', () => {
    expect(validateInferenceConfig('hello')).toBe('Missing inference config')
    expect(validateInferenceConfig(42)).toBe('Missing inference config')
  })

  it('rejects missing filePath', () => {
    expect(validateInferenceConfig({ ...validConfig, filePath: '' })).toBe('Missing filePath')
    expect(validateInferenceConfig({ ...validConfig, filePath: undefined as any })).toBe('Missing filePath')
  })

  it('rejects non-string filePath', () => {
    expect(validateInferenceConfig({ ...validConfig, filePath: 123 })).toBe('filePath must be a string')
  })

  it('rejects invalid engine', () => {
    expect(validateInferenceConfig({ ...validConfig, engine: 'remote' as any }))
      .toBe('Invalid engine: must be "local" or "cloud"')
  })

  it('rejects invalid modelName', () => {
    expect(validateInferenceConfig({ ...validConfig, modelName: 'large' as any }))
      .toBe('Invalid modelName: must be one of tiny, base, small, medium')
  })

  it('rejects invalid language', () => {
    expect(validateInferenceConfig({ ...validConfig, language: 'fr' as any }))
      .toBe('Invalid language: must be one of auto, zh, en, ja, ko')
  })

  it('rejects cloud engine without API key', () => {
    expect(validateInferenceConfig({ ...validConfig, engine: 'cloud' as const, cloudApiKey: '' }))
      .toBe('cloudApiKey is required when engine is "cloud"')
    expect(validateInferenceConfig({ ...validConfig, engine: 'cloud' as const, cloudApiKey: undefined }))
      .toBe('cloudApiKey is required when engine is "cloud"')
  })
})

// ─── FilePath validation ────────────────────────────────────

describe('validateFilePath', () => {
  it('returns null for a valid path', () => {
    expect(validateFilePath('/home/user/test.wav')).toBeNull()
    expect(validateFilePath('C:\\Users\\test.wav')).toBeNull()
  })

  it('rejects missing/empty path', () => {
    expect(validateFilePath('')).toBe('Missing filePath')
    expect(validateFilePath(null as any)).toBe('Missing filePath')
    expect(validateFilePath(undefined as any)).toBe('Missing filePath')
  })

  it('rejects non-string path', () => {
    expect(validateFilePath(42 as any)).toBe('filePath must be a string')
    expect(validateFilePath({} as any)).toBe('filePath must be a string')
  })

  it('rejects directory traversal attempts', () => {
    expect(validateFilePath('/etc/../../../passwd')).toBe('filePath contains illegal path traversal')
    expect(validateFilePath('foo/../../bar')).toBe('filePath contains illegal path traversal')
  })
})