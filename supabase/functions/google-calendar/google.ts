import { CalendarError } from './domain.ts'

export const scopes = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.calendarlist.readonly', 'https://www.googleapis.com/auth/calendar.events']
export type TokenResponse = { access_token: string; refresh_token?: string; scope?: string }

export async function tokenRequest(values: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', body: new URLSearchParams(values), signal: AbortSignal.timeout(10000),
  })
  const body = await response.json()
  if (!response.ok) throw new CalendarError(response.status === 400 ? 401 : 502, body.error === 'invalid_grant' ? 'reconnect' : 'google', 'Reconecte sua conta Google ou tente novamente mais tarde.')
  if (typeof body.access_token !== 'string') throw new CalendarError(502, 'google', 'Resposta de autorização inválida.')
  return body
}

export class GoogleCalendar {
  constructor(private accessToken: string, private transport: typeof fetch = fetch, private pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))) {}
  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      let response: Response
      try {
        response = await this.transport(`https://www.googleapis.com/calendar/v3/${path}`, {
          ...options, signal: AbortSignal.timeout(10000),
          headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json', ...options.headers },
        })
      } catch {
        if (attempt < 2) { await this.pause(300 * 2 ** attempt + Math.random() * 200); continue }
        throw new CalendarError(503, 'network', 'Falha de conexão com o Google. Confira a agenda antes de tentar novamente.')
      }
      const body = response.status === 204 ? null : await response.json().catch(() => null)
      const reason = body?.error?.errors?.[0]?.reason
      const temporary = response.status === 429 || response.status >= 500 || (response.status === 403 && ['rateLimitExceeded', 'userRateLimitExceeded'].includes(reason))
      // Inserts have a deterministic ID; edits/deletes carry If-Match. Never retry unguarded writes.
      if (temporary && attempt < 2) {
        const retryAfter = Number(response.headers.get('Retry-After')) || 0
        await this.pause(Math.min(5000, Math.max(retryAfter * 1000, 300 * 2 ** attempt + Math.random() * 200)))
        continue
      }
      if (!response.ok) {
        const message = response.status === 412 ? 'Este compromisso mudou no Google. Atualize a agenda antes de editar novamente.'
          : response.status === 401 ? 'A conexão expirou. Reconecte o Google Calendar.'
          : response.status === 403 ? 'A conta Google não permite esta operação nesta agenda.' : 'Não foi possível concluir a operação no Google Calendar.'
        throw new CalendarError(response.status, response.status === 412 ? 'conflict' : response.status === 401 ? 'reconnect' : 'google', message)
      }
      return body as T
    }
    throw new CalendarError(503, 'google', 'Google Calendar temporariamente indisponível.')
  }
}
