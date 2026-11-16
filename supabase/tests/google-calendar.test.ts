import { handler } from '../functions/google-calendar/handler.ts'
import { decrypt, digest, encrypt } from '../functions/google-calendar/crypto.ts'
import { GoogleCalendar, scopes } from '../functions/google-calendar/google.ts'
import { validateEvent } from '../functions/google-calendar/domain.ts'

function assert(value: unknown, message = 'Assertion failed'): asserts value { if (!value) throw new Error(message) }
const encryptionKey = btoa('01234567890123456789012345678901')
const actor = '11111111-1111-4111-8111-111111111111'
const generation = '22222222-2222-4222-8222-222222222222'
const configuration = {
  SUPABASE_URL: 'https://database.example.test', SUPABASE_SERVICE_ROLE_KEY: 'test-only-key',
  GOOGLE_CALENDAR_APP_ORIGIN: 'https://app.example.test', GOOGLE_CALENDAR_CLIENT_ID: 'client-id',
  GOOGLE_CALENDAR_CLIENT_SECRET: 'client-secret', GOOGLE_CALENDAR_ENCRYPTION_KEY: encryptionKey,
  GOOGLE_CALENDAR_REDIRECT_URI: 'https://database.example.test/functions/v1/google-calendar/callback',
  GOOGLE_CALENDAR_CRON_SECRET: 'test-cron-secret',
}
type Json = Record<string, unknown>
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
async function fixture(run: (context: { row: Json; states: Map<string, Json>; calls: Array<{ url: URL; options: RequestInit }>; setRole: (role: string) => void; setTokenError: () => void; setProvider: (callback: (url: URL, options: RequestInit) => Response) => void }) => Promise<void>) {
  for (const [name, value] of Object.entries(configuration)) Deno.env.set(name, value)
  Deno.env.delete('GOOGLE_CALENDAR_WEBHOOK_URL')
  const row: Json = { id: 'school', generation, refresh_ciphertext: await encrypt('refresh-secret', encryptionKey, 'calendar-refresh'), connected_by: actor,
    calendar_id: 'school-calendar', time_zone: 'America/Sao_Paulo', sync_token: 'old-sync', page_token: null, sync_epoch: generation, revision: 1, status: 'connected', needs_sync: true,
  }
  let role = 'owner'
  let tokenError = false
  const states = new Map<string, Json>()
  const calls: Array<{ url: URL; options: RequestInit }> = []
  let provider: (url: URL, options: RequestInit) => Response = () => response({ items: [], nextSyncToken: 'new-sync' })
  const originalFetch = globalThis.fetch
  globalThis.fetch = ((input: string | URL | Request, options: RequestInit = {}) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    calls.push({ url, options })
    const payload = typeof options.body === 'string' ? JSON.parse(options.body) : {}
    if (url.hostname === 'oauth2.googleapis.com' && tokenError) return Promise.resolve(response({ error: 'invalid_grant' }, 400))
    if (url.hostname === 'oauth2.googleapis.com') return Promise.resolve(response({ access_token: 'access-secret', refresh_token: 'refresh-secret', scope: scopes.join(' ') }))
    if (url.hostname === 'openidconnect.googleapis.com') return Promise.resolve(response({ email: 'school@example.test', email_verified: true }))
    if (url.hostname === 'www.googleapis.com') return Promise.resolve(provider(url, options))
    if (url.pathname.endsWith('/auth/v1/user')) return Promise.resolve(response({ id: actor }))
    if (url.pathname.endsWith('/profiles')) return Promise.resolve(response({ is_active: true }))
    if (url.pathname.endsWith('/user_roles')) return Promise.resolve(response([{ role: url.searchParams.get('user_id') === `eq.${actor}` ? role : 'owner' }]))
    if (url.pathname.endsWith('/google_calendar_connection')) {
      if (options.method === 'PATCH') { Object.assign(row, payload); return Promise.resolve(response([{ id: 'school' }])) }
      return Promise.resolve(response(row))
    }
    if (url.pathname.endsWith('/claim_google_calendar_lease')) return Promise.resolve(response(true))
    if (url.pathname.endsWith('/apply_google_calendar_page')) {
      row.page_token = payload.p_page_token; row.sync_token = payload.p_sync_token
      return Promise.resolve(response(null))
    }
    if (url.pathname.endsWith('/google_calendar_oauth_states')) {
      if (options.method === 'POST') { states.set(payload.state_hash, payload); return Promise.resolve(response(null, 201)) }
      const key = url.searchParams.get('state_hash')?.slice(3) ?? ''
      const state = states.get(key)
      states.delete(key)
      return Promise.resolve(response(state && Date.parse(String(state.expires_at)) > Date.now() ? state : null))
    }
    throw new Error(`Unmocked request: ${url.pathname}`)
  }) as typeof fetch
  try { await run({ row, states, calls, setRole: (value) => { role = value }, setTokenError: () => { tokenError = true }, setProvider: (value) => { provider = value } }) }
  finally { globalThis.fetch = originalFetch }
}
function request(action: string, body: Json = {}) {
  return handler(new Request('https://database.example.test/functions/v1/google-calendar', {
    method: 'POST', headers: { Authorization: 'Bearer test-jwt', Origin: configuration.GOOGLE_CALENDAR_APP_ORIGIN }, body: JSON.stringify({ action, expectedCalendarId: 'school-calendar', expectedGeneration: generation, ...body }),
  }))
}

Deno.test('OAuth consumes state, stores encrypted tokens, and rejects replay', () => fixture(async ({ row, calls }) => {
  const started = await (await request('connect')).json()
  const url = new URL(started.url)
  assert(url.searchParams.get('code_challenge_method') === 'S256')
  assert(url.searchParams.get('access_type') === 'offline')
  const callback = new Request(`${configuration.GOOGLE_CALENDAR_REDIRECT_URI}?state=${url.searchParams.get('state')}&code=authorization-code`)
  const first = await handler(callback)
  assert(first.headers.get('Location')?.endsWith('google=connected'))
  assert(row.refresh_ciphertext !== 'refresh-secret')
  assert(await decrypt(String(row.refresh_ciphertext), encryptionKey, 'calendar-refresh') === 'refresh-secret')
  const exchanges = calls.filter((call) => call.url.hostname === 'oauth2.googleapis.com').length
  const replay = await handler(callback)
  assert(replay.headers.get('Location')?.endsWith('google=error'))
  assert(calls.filter((call) => call.url.hostname === 'oauth2.googleapis.com').length === exchanges)
}))

Deno.test('teacher can read and create in the shared calendar but cannot administer it', () => fixture(async ({ setRole, calls, row, setProvider }) => {
  setRole('teacher')
  row.connected_by = '33333333-3333-4333-8333-333333333333'
  assert((await request('status')).status === 200)
  for (const action of ['connect', 'calendars', 'update', 'delete', 'disconnect', 'select-calendar', 'sync']) assert((await request(action)).status === 403)
  assert(!calls.some((call) => call.url.hostname.includes('googleapis')))
  setProvider((_url, options) => response({ id: 'created-event', ...JSON.parse(String(options.body)) }))
  const created = await request('create', { requestId: '44444444-4444-4444-8444-444444444444', event: { summary: 'Reunião da escola', start: '2026-11-16T09:00:00-03:00', end: '2026-11-16T10:00:00-03:00', timeZone: 'America/Sao_Paulo' } })
  assert(created.status === 200)
  assert(calls.some((call) => call.url.pathname === '/calendar/v3/calendars/school-calendar/events' && call.options.method === 'POST'))
  setRole('guardian')
  assert((await request('create')).status === 403)
}))

Deno.test('anonymous and invalid origin requests are rejected', () => fixture(async () => {
  const missing = await handler(new Request('https://database.example.test/functions/v1/google-calendar', { method: 'POST', body: '{"action":"status"}' }))
  assert(missing.status === 401)
  const wrongOrigin = await handler(new Request('https://database.example.test/functions/v1/google-calendar', { method: 'POST', headers: { Origin: 'https://attacker.example' }, body: '{"action":"status"}' }))
  assert(wrongOrigin.status === 403)
}))

Deno.test('incremental sync recovers from 410 without an old cursor', () => fixture(async ({ setProvider, calls }) => {
  let count = 0
  setProvider(() => ++count === 1 ? response({ error: {} }, 410) : response({ items: [{ id: 'event1', etag: 'v2', summary: 'Meeting', attendees: [{ email: 'private@example.test' }] }], nextSyncToken: 'fresh' }))
  assert((await request('sync')).status === 200)
  const reads = calls.filter((call) => call.url.hostname === 'www.googleapis.com')
  assert(reads[0].url.searchParams.get('syncToken') === 'old-sync')
  assert(!reads[1].url.searchParams.has('syncToken'))
  const saved = calls.find((call) => call.url.pathname.endsWith('/apply_google_calendar_page'))
  assert(saved && !String(saved.options.body).includes('private@example.test'))
}))

Deno.test('update and deletion send If-Match and report concurrent modifications', () => fixture(async ({ setProvider }) => {
  setProvider((_url, options) => {
    assert((options.headers as Record<string, string>)['If-Match'] === 'old-etag')
    return response({ error: {} }, 412)
  })
  for (const action of ['update', 'delete']) {
    const result = await request(action, { id: 'event1', etag: 'old-etag', event: { summary: 'Meeting', start: '2026-11-15T09:00:00-03:00', end: '2026-11-15T10:00:00-03:00', timeZone: 'America/Sao_Paulo' } })
    assert(result.status === 412)
    assert((await result.json()).code === 'conflict')
  }
}))

Deno.test('duplicate event creation reuses provider ID and validates payload fingerprint', () => fixture(async ({ setProvider }) => {
  let stored: Json | null = null
  setProvider((_url, options) => {
    if (options.method === 'POST') {
      if (stored) return response({ error: {} }, 409)
      stored = { ...JSON.parse(String(options.body)), etag: 'new-etag' }
      return response(stored)
    }
    return response(stored)
  })
  const payload = { requestId: '33333333-3333-4333-8333-333333333333', event: { summary: 'Meeting', start: '2026-11-15', end: '2026-11-16', allDay: true, timeZone: 'America/Sao_Paulo', recurrence: 'weekly' } }
  const first = await (await request('create', payload)).json()
  const second = await (await request('create', payload)).json()
  assert(first.event.id === second.event.id)
  assert((await request('create', { ...payload, event: { ...payload.event, summary: 'Changed' } })).status === 409)
}))

Deno.test('webhook requires channel secret and never trusts notification contents', () => fixture(async ({ row }) => {
  row.channel_id = generation; row.channel_token_hash = await digest('channel-secret'); row.channel_resource_id = 'resource-id'
  const url = 'https://database.example.test/functions/v1/google-calendar/webhook'
  assert((await handler(new Request(url, { method: 'POST' }))).status === 403)
  const valid = await handler(new Request(url, { method: 'POST', headers: { 'X-Goog-Channel-ID': generation, 'X-Goog-Channel-Token': 'channel-secret', 'X-Goog-Resource-ID': 'resource-id' }, body: 'ignored event body' }))
  assert(valid.status === 204 && row.needs_sync === true)
}))

Deno.test('scheduler rejects requests without its dedicated secret', () => fixture(async () => {
  assert((await handler(new Request('https://database.example.test/functions/v1/google-calendar/maintenance', { method: 'POST' }))).status === 403)
}))

Deno.test('AES-GCM rejects token tampering and different purposes', async () => {
  const cipher = await encrypt('token', encryptionKey, 'refresh')
  assert(await decrypt(cipher, encryptionKey, 'refresh') === 'token')
  for (const [value, context] of [[cipher, 'state'], [cipher.slice(0, -4) + 'AAAA', 'refresh']]) {
    let rejected = false
    try { await decrypt(value, encryptionKey, context) } catch { rejected = true }
    assert(rejected)
  }
})

Deno.test('validates all-day exclusive end and supported recurrence', () => {
  const valid = { summary: 'Workshop', allDay: true, start: '2026-11-15', end: '2026-11-16', timeZone: 'America/Sao_Paulo', recurrence: 'weekly' }
  assert(validateEvent(valid).recurrence?.[0] === 'RRULE:FREQ=WEEKLY')
  for (const bad of [{ ...valid, end: valid.start }, { ...valid, timeZone: 'Invalid/Zone' }, { ...valid, recurrence: 'custom' }]) {
    let rejected = false
    try { validateEvent(bad) } catch { rejected = true }
    assert(rejected)
  }
})

Deno.test('revoked refresh token marks connection for reconnection', () => fixture(async ({ setTokenError, row }) => {
  setTokenError()
  const result = await request('events', { start: '2026-11-15T00:00:00Z', end: '2026-11-16T00:00:00Z' })
  assert(result.status === 401)
  assert(row.status === 'reconnect')
  assert(!(await result.text()).includes('refresh-secret'))
}))

Deno.test('transient API errors retry with bounded backoff; permission errors do not retry', async () => {
  const delays: number[] = []
  let calls = 0
  const api = new GoogleCalendar('test', (() => {
    calls++
    if (calls === 1) throw new TypeError('network down')
    return Promise.resolve(calls === 2 ? response({ error: {} }, 503) : response({ items: [] }))
  }) as typeof fetch, (ms) => { delays.push(ms); return Promise.resolve() })
  await api.request('calendars/test/events')
  assert(calls === 3 && delays.length === 2 && delays.every((ms) => ms <= 5000))
  calls = 0
  const denied = new GoogleCalendar('test', (() => { calls++; return Promise.resolve(response({ error: {} }, 403)) }) as typeof fetch)
  try { await denied.request('calendars/test/events') } catch { /* Expected denial. */ }
  assert(calls === 1)
})

Deno.test('renewal replaces an expiring channel with a new authenticated subscription', () => fixture(async ({ row, setProvider }) => {
  Deno.env.set('GOOGLE_CALENDAR_WEBHOOK_URL', 'https://database.example.test/functions/v1/google-calendar/webhook')
  row.channel_id = generation; row.channel_resource_id = 'old-resource'; row.channel_expires_at = new Date().toISOString()
  let stopped = false, watched = false
  setProvider((url, options) => {
    if (url.pathname.endsWith('/channels/stop')) { stopped = true; return response(null) }
    if (url.pathname.endsWith('/watch')) {
      const payload = JSON.parse(String(options.body))
      assert(payload.token.length > 32 && payload.address.startsWith('https://'))
      watched = true
      return response({ resourceId: 'new-resource', expiration: String(Date.now() + 7 * 86400000) })
    }
    return response({ items: [], nextSyncToken: 'new-sync' })
  })
  assert((await request('sync')).status === 200)
  assert(stopped && watched && row.channel_resource_id === 'new-resource')
}))

Deno.test('old forms cannot create an event after the connected calendar changes', () => fixture(async ({ calls }) => {
  const result = await request('create', { expectedCalendarId: 'different-calendar' })
  assert(result.status === 409)
  assert(!calls.some((call) => call.url.hostname === 'www.googleapis.com'))
}))
