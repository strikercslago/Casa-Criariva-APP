import { expect, it } from 'vitest'
import { sanitizeAuthError } from './authDiagnostics'

it('retains diagnostic metadata without copying error messages or credentials', () => {
  const details = sanitizeAuthError({
    name: 'AuthApiError', code: 'invalid_credentials', status: 400,
    message: 'email=private@example.com access_token=secret',
    password: 'secret', headers: { Authorization: 'Bearer secret' },
  })
  expect(details).toEqual({ name: 'AuthApiError', code: 'invalid_credentials', status: 400, hasMessage: true })
  expect(JSON.stringify(details)).not.toContain('private@example.com')
  expect(JSON.stringify(details)).not.toContain('secret')
})

it('does not forward raw string errors to diagnostic logs', () => {
  expect(sanitizeAuthError('private@example.com: secret')).toEqual({ hasMessage: true })
  expect(sanitizeAuthError(null)).toEqual({})
})
