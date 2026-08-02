const VALID_MODELS = new Set(['tiny', 'base', 'small', 'medium'])
const VALID_LANGUAGES = new Set(['auto', 'zh', 'en', 'ja', 'ko'])
const VALID_ENGINES = new Set(['local', 'cloud'])

export function validateInferenceConfig(config: unknown): string | null {
  if (!config || typeof config !== 'object') return 'Missing inference config'

  const c = config as Record<string, unknown>

  if (!c.filePath) return 'Missing filePath'
  if (typeof c.filePath !== 'string') return 'filePath must be a string'

  if (!VALID_ENGINES.has(c.engine as string)) {
    return 'Invalid engine: must be "local" or "cloud"'
  }

  if (!VALID_MODELS.has(c.modelName as string)) {
    return 'Invalid modelName: must be one of tiny, base, small, medium'
  }

  if (!VALID_LANGUAGES.has(c.language as string)) {
    return 'Invalid language: must be one of auto, zh, en, ja, ko'
  }

  if (c.engine === 'cloud' && (!c.cloudApiKey || typeof c.cloudApiKey !== 'string' || !c.cloudApiKey.trim())) {
    return 'cloudApiKey is required when engine is "cloud"'
  }

  return null
}

export function validateFilePath(path: unknown): string | null {
  if (!path) return 'Missing filePath'
  if (typeof path !== 'string') return 'filePath must be a string'
  if (/(?:^|\/)\.\.(?:$|\/)/.test(path)) return 'filePath contains illegal path traversal'
  return null
}

// Directories known to contain user-facing media files served via media:// protocol.
// We derive these from common OS temp + Electron userData patterns rather than
// importing electron to keep the function testable without electron mocking.
const MEDIA_DIR_PATTERNS = [
  /^\/tmp\//,                          // Linux/macOS tmpdir
  /^\/var\/folders\//,                 // macOS per-user tmpdir
  /^\/tmp\./,                          // BSD tmp snapshots
]

/**
 * Returns true when `filePath` is under a known safe directory.
 * This prevents the media:// protocol handler from serving arbitrary files.
 */
export function isAllowedMediaPath(filePath: string): boolean {
  if (!filePath) return false
  // Reuse existing traversal guard
  if (validateFilePath(filePath) !== null) return false
  return MEDIA_DIR_PATTERNS.some(p => p.test(filePath))
}