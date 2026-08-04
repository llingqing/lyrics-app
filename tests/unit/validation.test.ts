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

  it('accepts the large local models', () => {
    expect(validateInferenceConfig({ ...validConfig, modelName: 'large-v3-turbo' })).toBeNull()
    expect(validateInferenceConfig({ ...validConfig, modelName: 'large-v3' })).toBeNull()
  })

  it('accepts a cloud config with custom base URL and model', () => {
    expect(validateInferenceConfig({
      ...validConfig,
      engine: 'cloud' as const,
      cloudApiKey: 'sk-test123',
      cloudBaseUrl: 'https://api.groq.com/openai/v1',
      cloudModel: 'whisper-large-v3-turbo',
    })).toBeNull()
  })

  it('rejects a cloud base URL that is not an http(s) URL', () => {
    const base = { ...validConfig, engine: 'cloud' as const, cloudApiKey: 'sk-test123' }
    expect(validateInferenceConfig({ ...base, cloudBaseUrl: 'not-a-url' }))
      .toBe('cloudBaseUrl must be an http(s) URL')
    expect(validateInferenceConfig({ ...base, cloudBaseUrl: 'file:///etc/passwd' }))
      .toBe('cloudBaseUrl must be an http(s) URL')
  })

  it('rejects a blank cloud model name', () => {
    expect(validateInferenceConfig({
      ...validConfig,
      engine: 'cloud' as const,
      cloudApiKey: 'sk-test123',
      cloudModel: '   ',
    })).toBe('cloudModel must be a non-empty string')
  })

  it('accepts a boolean useGpu and rejects other types', () => {
    expect(validateInferenceConfig({ ...validConfig, useGpu: true })).toBeNull()
    expect(validateInferenceConfig({ ...validConfig, useGpu: false })).toBeNull()
    expect(validateInferenceConfig({ ...validConfig, useGpu: 'yes' }))
      .toBe('useGpu must be a boolean')
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
      .toBe('Invalid modelName: must be one of tiny, base, small, medium, large-v3-turbo, large-v3')
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
