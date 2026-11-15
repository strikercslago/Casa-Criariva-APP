import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0'
import { CalendarError, eventId, eventProjection, text, validateEvent, validatePeriod } from './domain.ts'
import type { GoogleEvent } from './domain.ts'
import { decrypt, digest, encrypt, randomSecret } from './crypto.ts'
import { GoogleCalendar, scopes, tokenRequest } from './google.ts'

function env(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new CalendarError(503, 'configuration', 'A integração Google Calendar ainda não foi configurada.')
  return value
}
type Connection = {
  generation: string; refresh_ciphertext: string | null; account_email: string | null; connected_by: string | null
  calendar_id: string | null; calendar_name: string | null; time_zone: string; sync_token: string | null
  page_token: string | null; sync_epoch: string; revision: number; last_synced_at: string | null
  next_sync_at: string; needs_sync: boolean; status: string; channel_id: string | null
  channel_resource_id: string | null; channel_token_hash: string | null; channel_expires_at: string | null
}
type CalendarListItem = { id: string; summary: string; accessRole: string; timeZone?: string }
type Page = { items?: GoogleEvent[]; nextPageToken?: string; nextSyncToken?: string }
const service = () => createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } })
type Service = ReturnType<typeof service>
function check(error: unknown) { if (error) throw new CalendarError(503, 'storage', 'Não foi possível acessar a integração. Tente novamente.') }
async function connection(db: Service): Promise<Connection> {
  const { data, error } = await db.from('google_calendar_connection').select('*').eq('id', 'school').single()
  check(error)
  return data as Connection
}
async function patch(db: Service, generation: string, values: Record<string, unknown>) {
  const { data, error } = await db.from('google_calendar_connection').update(values).eq('id', 'school').eq('generation', generation).select('id')
  check(error)
  if (!data?.length) throw new CalendarError(409, 'conflict', 'A conexão mudou. Atualize a página.')
}
async function withLease<T>(db: Service, action: (row: Connection, lease: string) => Promise<T>) {
  const lease = crypto.randomUUID()
  const { data, error } = await db.rpc('claim_google_calendar_lease', { p_lease: lease })
  check(error)
  if (!data) throw new CalendarError(409, 'busy', 'Há uma sincronização em andamento. Aguarde alguns instantes.')
  try { return await action(await connection(db), lease) }
  finally {
    await db.from('google_calendar_connection').update({ lease_id: null, lease_until: null }).eq('id', 'school').eq('lease_id', lease)
  }
}
async function authorizedActor(db: Service, userId: string, manage: boolean) {
  const { data: profile, error: profileError } = await db.from('profiles').select('is_active').eq('id', userId).maybeSingle()
  const { data: roles, error: roleError } = await db.from('user_roles').select('role').eq('user_id', userId)
  check(profileError ?? roleError)
  const allowed = manage ? ['owner', 'admin'] : ['owner', 'admin', 'teacher']
  if (!profile?.is_active || !roles?.some((row: { role: string }) => allowed.includes(row.role))) {
    throw new CalendarError(403, 'permission', 'Você não tem permissão para esta operação.')
  }
}
async function user(db: Service, request: Request, manage: boolean) {
  const bearer = request.headers.get('Authorization')
  if (!bearer?.startsWith('Bearer ')) throw new CalendarError(401, 'auth', 'Entre no aplicativo novamente.')
  const { data, error } = await db.auth.getUser(bearer.slice(7))
  if (error || !data.user) throw new CalendarError(401, 'auth', 'Entre no aplicativo novamente.')
  await authorizedActor(db, data.user.id, manage)
  return data.user.id
}
async function google(db: Service, row: Connection) {
  if (!row.refresh_ciphertext || !row.connected_by) throw new CalendarError(409, 'disconnected', 'Conecte uma conta Google primeiro.')
  await authorizedActor(db, row.connected_by, true)
  try {
    const tokens = await tokenRequest({ grant_type: 'refresh_token', client_id: env('GOOGLE_CALENDAR_CLIENT_ID'),
      client_secret: env('GOOGLE_CALENDAR_CLIENT_SECRET'),
      refresh_token: await decrypt(row.refresh_ciphertext, env('GOOGLE_CALENDAR_ENCRYPTION_KEY'), 'calendar-refresh'),
    })
    if (tokens.refresh_token) await patch(db, row.generation, {
      refresh_ciphertext: await encrypt(tokens.refresh_token, env('GOOGLE_CALENDAR_ENCRYPTION_KEY'), 'calendar-refresh'),
    })
    return new GoogleCalendar(tokens.access_token)
  } catch (error) {
    if (error instanceof CalendarError && error.code === 'reconnect') await patch(db, row.generation, { status: 'reconnect' })
    throw error
  }
}
function eventPath(row: Connection, id?: string) {
  if (!row.calendar_id) throw new CalendarError(409, 'calendar', 'Selecione uma agenda primeiro.')
  return `calendars/${encodeURIComponent(row.calendar_id)}/events${id ? `/${encodeURIComponent(id)}` : ''}`
}
function redirect(result: string) {
  return new Response(null, { status: 303, headers: { Location: `${env('GOOGLE_CALENDAR_APP_ORIGIN')}/agenda?google=${result}`, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } })
}
async function startOAuth(db: Service, actor: string) {
  const row = await connection(db)
  const state = randomSecret(), verifier = randomSecret()
  const { error } = await db.from('google_calendar_oauth_states').insert({
    state_hash: await digest(state), actor_id: actor, generation: row.generation,
    verifier_ciphertext: await encrypt(verifier, env('GOOGLE_CALENDAR_ENCRYPTION_KEY'), 'oauth-verifier'),
    expires_at: new Date(Date.now() + 10 * 60000).toISOString(),
  })
  check(error)
  const params = new URLSearchParams({ client_id: env('GOOGLE_CALENDAR_CLIENT_ID'), redirect_uri: env('GOOGLE_CALENDAR_REDIRECT_URI'),
    response_type: 'code', scope: scopes.join(' '), access_type: 'offline', prompt: 'consent', state,
    code_challenge: await digest(verifier), code_challenge_method: 'S256',
  })
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` }
}
async function callback(db: Service, url: URL) {
  const state = url.searchParams.get('state')
  if (!state || state.length > 200) throw new CalendarError(400, 'state', 'Autorização inválida ou expirada.')
  // DELETE RETURNING consumes the state atomically; callbacks cannot be replayed.
  const { data, error } = await db.from('google_calendar_oauth_states').delete().eq('state_hash', await digest(state))
    .gt('expires_at', new Date().toISOString()).select('*').maybeSingle()
  check(error)
  if (!data) throw new CalendarError(400, 'state', 'Autorização inválida ou expirada.')
  if (url.searchParams.has('error')) return redirect('cancelled')
  await authorizedActor(db, data.actor_id, true)
  return withLease(db, async (row) => {
    if (row.generation !== data.generation) throw new CalendarError(409, 'conflict', 'A conexão mudou durante a autorização. Tente novamente.')
    const tokens = await tokenRequest({ grant_type: 'authorization_code', code: text(url.searchParams.get('code'), 4096, true),
      client_id: env('GOOGLE_CALENDAR_CLIENT_ID'), client_secret: env('GOOGLE_CALENDAR_CLIENT_SECRET'),
      redirect_uri: env('GOOGLE_CALENDAR_REDIRECT_URI'),
      code_verifier: await decrypt(data.verifier_ciphertext, env('GOOGLE_CALENDAR_ENCRYPTION_KEY'), 'oauth-verifier'),
    })
    if (!tokens.refresh_token || !scopes.filter((scope) => scope.startsWith('https:')).every((scope) => tokens.scope?.split(' ').includes(scope))) {
      throw new CalendarError(400, 'scopes', 'Autorize o acesso às agendas e aos eventos para concluir a conexão.')
    }
    const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` }, signal: AbortSignal.timeout(10000) })
    const account = await response.json()
    if (!response.ok || !account.email_verified || typeof account.email !== 'string') throw new CalendarError(400, 'account', 'Não foi possível identificar a conta Google.')
    await patch(db, row.generation, {
      generation: crypto.randomUUID(), refresh_ciphertext: await encrypt(tokens.refresh_token, env('GOOGLE_CALENDAR_ENCRYPTION_KEY'), 'calendar-refresh'),
      account_email: account.email, connected_by: data.actor_id, calendar_id: null, calendar_name: null,
      sync_token: null, page_token: null, sync_epoch: crypto.randomUUID(), status: 'connected',
      last_synced_at: null, needs_sync: true, next_sync_at: new Date().toISOString(),
      channel_id: null, channel_resource_id: null, channel_token_hash: null, channel_expires_at: null,
    })
    return redirect('connected')
  })
}
async function calendars(api: GoogleCalendar) {
  const items: CalendarListItem[] = []
  let pageToken: string | undefined
  do {
    const params = new URLSearchParams({ minAccessRole: 'writer', maxResults: '250', ...(pageToken ? { pageToken } : {}) })
    const page = await api.request<{ items?: CalendarListItem[]; nextPageToken?: string }>(`users/me/calendarList?${params}`)
    items.push(...(page.items ?? [])); pageToken = page.nextPageToken
    if (items.length > 2000) throw new CalendarError(400, 'limit', 'Há muitas agendas nesta conta. Use uma conta dedicada à escola.')
  } while (pageToken)
  return items.map(({ id, summary, timeZone }) => ({ id, summary, timeZone }))
}
async function stopChannel(api: GoogleCalendar, row: Connection) {
  if (!row.channel_id || !row.channel_resource_id) return
  try { await api.request('channels/stop', { method: 'POST', body: JSON.stringify({ id: row.channel_id, resourceId: row.channel_resource_id }) }) }
  catch (error) { if (!(error instanceof CalendarError && [404, 410].includes(error.status))) throw error }
}
async function renewChannel(db: Service, row: Connection, api: GoogleCalendar) {
  const address = Deno.env.get('GOOGLE_CALENDAR_WEBHOOK_URL')
  if (!address || !row.calendar_id || (row.channel_expires_at && Date.parse(row.channel_expires_at) > Date.now() + 86400000)) return
  if (!address.startsWith('https://')) throw new CalendarError(503, 'configuration', 'O webhook requer HTTPS.')
  await stopChannel(api, row)
  const id = crypto.randomUUID(), token = randomSecret()
  await patch(db, row.generation, { channel_id: id, channel_token_hash: await digest(token), channel_resource_id: null, channel_expires_at: null })
  const channel = await api.request<{ resourceId: string; expiration: string }>(`${eventPath(row)}/watch`, {
    method: 'POST', body: JSON.stringify({ id, type: 'web_hook', address, token, expiration: String(Date.now() + 7 * 86400000), params: { ttl: '604800' } }),
  })
  await patch(db, row.generation, { channel_resource_id: channel.resourceId, channel_expires_at: new Date(Number(channel.expiration)).toISOString() })
}
async function sync(db: Service, row: Connection, lease: string, api: GoogleCalendar) {
  for (let pageIndex = 0; pageIndex < 3; pageIndex++) {
    const params = new URLSearchParams({ maxResults: '250', showDeleted: 'true', singleEvents: 'false',
      ...(row.sync_token ? { syncToken: row.sync_token } : {}), ...(row.page_token ? { pageToken: row.page_token } : {}),
    })
    let page: Page
    try { page = await api.request<Page>(`${eventPath(row)}?${params}`) }
    catch (error) {
      if (error instanceof CalendarError && error.status === 410) {
        await patch(db, row.generation, { sync_token: null, page_token: null, sync_epoch: crypto.randomUUID(), needs_sync: true })
        row = await connection(db)
        continue
      }
      throw error
    }
    const { error } = await db.rpc('apply_google_calendar_page', { p_lease: lease, p_generation: row.generation,
      p_events: (page.items ?? []).map(eventProjection), p_page_token: page.nextPageToken ?? null, p_sync_token: page.nextSyncToken ?? null,
    })
    check(error)
    row = await connection(db)
    if (!page.nextPageToken) break
  }
  await renewChannel(db, row, api)
  return { pending: Boolean(row.page_token), lastSyncedAt: row.last_synced_at }
}
async function webhook(db: Service, request: Request) {
  const row = await connection(db)
  const token = request.headers.get('X-Goog-Channel-Token') ?? ''
  if (!token || token.length > 200 || !row.channel_id || request.headers.get('X-Goog-Channel-ID') !== row.channel_id
    || await digest(token) !== row.channel_token_hash
    || (row.channel_resource_id && request.headers.get('X-Goog-Resource-ID') !== row.channel_resource_id)
    || (row.channel_expires_at && Date.parse(row.channel_expires_at) <= Date.now())) {
    throw new CalendarError(403, 'webhook', 'Notificação inválida.')
  }
  // Notifications contain no event data. The scheduled worker retrieves changes.
  await patch(db, row.generation, { needs_sync: true, next_sync_at: new Date().toISOString() })
  return new Response(null, { status: 204 })
}
async function dispatch(db: Service, action: string, body: Record<string, unknown>, actor: string) {
  if (action === 'connect') return startOAuth(db, actor)
  const row = await connection(db)
  if (action === 'status') return {
    generation: row.generation, status: row.status, email: row.account_email, calendarId: row.calendar_id, calendarName: row.calendar_name,
    timeZone: row.time_zone, lastSyncedAt: row.last_synced_at, pending: row.needs_sync, revision: row.revision,
  }
  if (action === 'calendars') return { calendars: await calendars(await google(db, row)) }
  if (action === 'events') {
    const period = validatePeriod(body.start, body.end)
    const params = new URLSearchParams({ ...period, singleEvents: 'true', orderBy: 'startTime', maxResults: '100',
      timeZone: row.time_zone, ...(body.pageToken ? { pageToken: text(body.pageToken, 4096, true) } : {}),
    })
    const page = await (await google(db, row)).request<Page>(`${eventPath(row)}?${params}`)
    return { events: (page.items ?? []).filter((event) => event.status !== 'cancelled').map(eventProjection), nextPageToken: page.nextPageToken }
  }
  return withLease(db, async (current, lease) => {
    if (action === 'disconnect') {
      if (current.refresh_ciphertext) {
        const token = await decrypt(current.refresh_ciphertext, env('GOOGLE_CALENDAR_ENCRYPTION_KEY'), 'calendar-refresh')
        const response = await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', body: new URLSearchParams({ token }), signal: AbortSignal.timeout(10000) })
        if (!response.ok && response.status !== 400) throw new CalendarError(502, 'revoke', 'Não foi possível revogar a conexão. Tente novamente.')
      }
      await patch(db, current.generation, { generation: crypto.randomUUID(), refresh_ciphertext: null, account_email: null,
        connected_by: null, calendar_id: null, calendar_name: null, status: 'disconnected', sync_token: null, page_token: null,
        channel_id: null, channel_resource_id: null, channel_token_hash: null, channel_expires_at: null, last_synced_at: null,
      })
      return { disconnected: true }
    }
    const api = await google(db, current)
    if (action === 'select-calendar') {
      const id = text(body.calendarId, 1024, true)
      const selected = (await calendars(api)).find((calendar) => calendar.id === id)
      if (!selected) throw new CalendarError(403, 'permission', 'Escolha uma agenda com permissão de edição.')
      await stopChannel(api, current)
      await patch(db, current.generation, { generation: crypto.randomUUID(), calendar_id: id, calendar_name: selected.summary,
        time_zone: selected.timeZone ?? 'America/Sao_Paulo', sync_token: null, page_token: null, sync_epoch: crypto.randomUUID(),
        revision: current.revision + 1, last_synced_at: null, needs_sync: true, next_sync_at: new Date().toISOString(),
        channel_id: null, channel_resource_id: null, channel_token_hash: null, channel_expires_at: null,
      })
      return { selected: true }
    }
    if (action === 'sync') return sync(db, current, lease, api)
    if (body.expectedCalendarId !== current.calendar_id || body.expectedGeneration !== current.generation) {
      throw new CalendarError(409, 'conflict', 'A agenda conectada mudou. Atualize a página antes de salvar.')
    }
    const id = action === 'create' ? eventId(body.requestId) : text(body.id, 1024, true)
    const etag = action === 'create' ? undefined : text(body.etag, 512, true)
    if (etag && /[\r\n]/.test(etag)) throw new CalendarError(400, 'validation', 'Versão inválida.')
    let event: GoogleEvent | null = null
    if (action === 'create') {
      const fields = validateEvent(body.event)
      const fingerprint = await digest(JSON.stringify(fields))
      try {
        event = await api.request<GoogleEvent>(eventPath(current), { method: 'POST', body: JSON.stringify({ ...fields, id, extendedProperties: { private: { appRequestHash: fingerprint } } }) })
      } catch (error) {
        if (!(error instanceof CalendarError && error.status === 409)) throw error
        const existing = await api.request<GoogleEvent & { extendedProperties?: { private?: { appRequestHash?: string } } }>(eventPath(current, id))
        if (existing.extendedProperties?.private?.appRequestHash !== fingerprint || existing.status === 'cancelled') throw new CalendarError(409, 'conflict', 'Este envio já foi utilizado com outros dados. Atualize a agenda.')
        event = existing
      }
    } else if (action === 'update') {
      event = await api.request<GoogleEvent>(eventPath(current, id), { method: 'PATCH', headers: { 'If-Match': etag! }, body: JSON.stringify(validateEvent(body.event)) })
    } else if (action === 'delete') {
      try { await api.request(eventPath(current, id), { method: 'DELETE', headers: { 'If-Match': etag! } }) }
      catch (error) { if (!(error instanceof CalendarError && [404, 410].includes(error.status))) throw error }
    } else throw new CalendarError(400, 'action', 'Operação inválida.')
    await patch(db, current.generation, { needs_sync: true, next_sync_at: new Date().toISOString(), revision: current.revision + 1 })
    return { event: event ? eventProjection(event) : null }
  })
}

export async function handler(request: Request) {
  let origin = ''
  try { origin = env('GOOGLE_CALENDAR_APP_ORIGIN') } catch { /* Configuration error is returned below. */ }
  const cors = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin', 'Cache-Control': 'no-store' }
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
  const url = new URL(request.url)
  try {
    if (!origin) throw new CalendarError(503, 'configuration', 'A integração Google Calendar ainda não foi configurada.')
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    const db = service()
    if (request.method === 'GET' && url.pathname.endsWith('/callback')) return await callback(db, url)
    if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)
    if (url.pathname.endsWith('/webhook')) return await webhook(db, request)
    if (url.pathname.endsWith('/maintenance')) {
      const secret = request.headers.get('X-Calendar-Cron')
      if (!secret || await digest(secret) !== await digest(env('GOOGLE_CALENDAR_CRON_SECRET'))) throw new CalendarError(403, 'auth', 'Acesso negado.')
      const result = await withLease(db, async (row, lease) => {
        if (!row.refresh_ciphertext || !row.calendar_id || row.status === 'reconnect') return { skipped: true }
        const api = await google(db, row)
        if (row.needs_sync || Date.parse(row.next_sync_at) <= Date.now()) return sync(db, row, lease, api)
        await renewChannel(db, row, api)
        return { skipped: true }
      })
      const { error } = await db.from('google_calendar_oauth_states').delete().lt('expires_at', new Date().toISOString())
      check(error)
      return json(result)
    }
    if (request.headers.get('Origin') && request.headers.get('Origin') !== origin) throw new CalendarError(403, 'origin', 'Origem não autorizada.')
    if (Number(request.headers.get('Content-Length')) > 20000) throw new CalendarError(413, 'size', 'Solicitação muito grande.')
    const raw = await request.text()
    if (raw.length > 20000) throw new CalendarError(413, 'size', 'Solicitação muito grande.')
    const body = JSON.parse(raw) as Record<string, unknown>
    const action = text(body.action, 30, true)
    const actor = await user(db, request, !['status', 'events'].includes(action))
    return json(await dispatch(db, action, body, actor))
  } catch (error) {
    // Do not serialize provider responses, authorization codes or credentials into logs/errors.
    if (request.method === 'GET' && url.pathname.endsWith('/callback') && origin) return redirect('error')
    return json({ error: error instanceof CalendarError ? error.message : 'A integração está temporariamente indisponível.',
      code: error instanceof CalendarError ? error.code : 'unavailable' }, error instanceof CalendarError ? error.status : 503)
  }
}
