/**
 * Allowlist for the `media://` protocol.
 *
 * The renderer can ask media:// for any path, so the handler must not serve
 * files the user never opened. Rather than guessing at safe directories, the
 * main process records each path the user actually chose (via the file dialog
 * or drag-and-drop) and serves only those.
 */
const allowed = new Set<string>()

export function registerMediaPath(filePath: string): void {
  if (!filePath || typeof filePath !== 'string') return
  allowed.add(filePath)
}

export function isMediaPathAllowed(filePath: string): boolean {
  if (!filePath || typeof filePath !== 'string') return false
  return allowed.has(filePath)
}

/** Test seam — resets the registry between cases. */
export function clearMediaPaths(): void {
  allowed.clear()
}