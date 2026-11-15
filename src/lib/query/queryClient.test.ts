import { describe, expect, it } from 'vitest'
import { AppError } from '@/lib/errors/AppError'
import { queryClient } from './queryClient'

function retry(error: unknown, failures = 0) {
  const policy = queryClient.getDefaultOptions().queries!.retry
  if (typeof policy !== 'function') throw new Error('Expected a retry policy')
  return policy(failures, error as Error)
}

describe('query retry policy', () => {
  it.each(['auth', 'permission', 'validation', 'not-found', 'configuration'] as const)('does not repeat %s errors', (code) => {
    expect(retry(new AppError(code, 'Permanent failure'))).toBe(false)
  })
  it('does not retry PostgREST authorization and constraint failures', () => {
    for (const code of ['42501', '23505', '23514', '22P02', 'PGRST116', 'PGRST202', 'PGRST205']) {
      expect(retry({ code, message: 'failure' })).toBe(false)
    }
  })
  it('retries temporary errors with a bounded number of attempts', () => {
    expect(retry(new AppError('network', 'Offline'))).toBe(true)
    expect(retry(new Response(null, { status: 503 }))).toBe(true)
    expect(retry(new Response(null, { status: 429 }))).toBe(true)
    expect(retry(new Error('Network'), 2)).toBe(false)
  })
  it('does not automatically repeat mutations', () => {
    expect(queryClient.getDefaultOptions().mutations!.retry).toBe(false)
  })
})
