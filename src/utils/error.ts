/**
 * Extracts a human-readable message from a caught value.
 * `catch` bindings are `unknown` under strict TypeScript — anything can be
 * thrown, so narrow before reading `.message`.
 */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  if (e && typeof e === 'object' && 'message' in e) {
    return String((e as { message: unknown }).message)
  }
  return String(e)
}