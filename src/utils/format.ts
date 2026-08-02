export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  // Round to avoid floating-point errors (e.g. 100.88 % 1 → 0.87999…)
  const ms = Math.round((seconds * 1000) % 1000)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

const SUPPORTED_FORMATS = new Set(['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma', '.opus'])

/**
 * Lowercased file extension including the leading dot, or '' if there is none.
 * Hand-rolled rather than using node's `path.extname` because this module is
 * imported by the renderer, where node builtins are not available.
 */
function fileExtension(filePath: string): string {
  const lastSep = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  const base = filePath.slice(lastSep + 1)
  const dot = base.lastIndexOf('.')
  // dot > 0 so dotfiles like ".mp3" count as having no extension
  return dot > 0 ? base.slice(dot).toLowerCase() : ''
}

export function isFormatSupported(filePath: string): boolean {
  return SUPPORTED_FORMATS.has(fileExtension(filePath))
}
