import { AppError } from '@/lib/errors/AppError'

const permanentCodes = new Set([
  '42501', '23502', '23503', '23505', '23514', '22P02',
  'PGRST116', 'PGRST202', 'PGRST205', '42P01',
])

/** Applies to reads only. Mutations must opt into retry with proven idempotency. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false
  if (error instanceof AppError && ['auth', 'permission', 'validation', 'not-found', 'configuration'].includes(error.code)) return false
  if (typeof error === 'object' && error !== null) {
    if ('code' in error && permanentCodes.has(String(error.code))) return false
    if ('name' in error && error.name === 'AbortError') return false
    if ('status' in error) {
      const status = Number(error.status)
      if (status >= 400 && status < 500 && status !== 408 && status !== 429) return false
    }
  }
  return true
}
