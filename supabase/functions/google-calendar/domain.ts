export class CalendarError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message) }
}

export type GoogleEvent = {
  id: string; etag: string; status?: string; summary?: string; description?: string; location?: string
  start?: { date?: string; dateTime?: string; timeZone?: string }
  end?: { date?: string; dateTime?: string; timeZone?: string }
  htmlLink?: string; colorId?: string; recurrence?: string[]; recurringEventId?: string
  originalStartTime?: { date?: string; dateTime?: string; timeZone?: string }
}

// Store/render only calendar fields. Attendees, contacts and conference credentials are excluded.
export function eventProjection(event: GoogleEvent): GoogleEvent {
  return Object.fromEntries(['id', 'etag', 'status', 'summary', 'description', 'location', 'start', 'end',
    'htmlLink', 'colorId', 'recurrence', 'recurringEventId', 'originalStartTime']
    .filter((key) => event[key as keyof GoogleEvent] !== undefined)
    .map((key) => [key, event[key as keyof GoogleEvent]])) as GoogleEvent
}

export function text(value: unknown, max: number, required = false): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    throw new CalendarError(400, 'validation', 'Revise os campos do compromisso.')
  }
  return value.trim()
}

export function validateEvent(value: unknown) {
  if (!value || typeof value !== 'object') throw new CalendarError(400, 'validation', 'Compromisso inválido.')
  const input = value as Record<string, unknown>
  const summary = text(input.summary, 250, true)
  const description = text(input.description ?? '', 5000)
  const location = text(input.location ?? '', 500)
  const timeZone = text(input.timeZone, 100, true)
  try { new Intl.DateTimeFormat('en', { timeZone }).format() } catch {
    throw new CalendarError(400, 'validation', 'Fuso horário inválido.')
  }
  const start = text(input.start, 50, true)
  const end = text(input.end, 50, true)
  const allDay = input.allDay === true
  const datePattern = allDay ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/
  const validDate = (value: string) => {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number)
    const normalized = new Date(Date.UTC(year, month - 1, day))
    return normalized.getUTCFullYear() === year && normalized.getUTCMonth() === month - 1 && normalized.getUTCDate() === day
  }
  if (!datePattern.test(start) || !datePattern.test(end) || !validDate(start) || !validDate(end) || !Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) || Date.parse(end) <= Date.parse(start)) {
    throw new CalendarError(400, 'validation', 'O fim deve ser posterior ao início; informe datas e horários válidos.')
  }
  const recurrence = input.recurrence
  if (recurrence !== undefined && recurrence !== '' && !['daily', 'weekly', 'monthly'].includes(String(recurrence))) {
    throw new CalendarError(400, 'validation', 'Recorrência não suportada.')
  }
  const colorId = input.colorId === undefined ? undefined : text(input.colorId, 2)
  if (colorId && !/^(?:[1-9]|10|11)$/.test(colorId)) throw new CalendarError(400, 'validation', 'Categoria inválida.')
  return {
    summary, description, location, ...(colorId ? { colorId } : {}),
    start: allDay ? { date: start } : { dateTime: start, timeZone },
    end: allDay ? { date: end } : { dateTime: end, timeZone },
    // Omitted recurrence preserves an existing complex Google rule when editing an occurrence.
    ...(recurrence === undefined ? {} : { recurrence: recurrence ? [`RRULE:FREQ=${String(recurrence).toUpperCase()}`] : [] }),
  }
}

export function validatePeriod(start: unknown, end: unknown) {
  const from = text(start, 40, true), to = text(end, 40, true)
  const difference = Date.parse(to) - Date.parse(from)
  if (!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(from) || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(to)
    || !Number.isFinite(difference) || difference <= 0 || difference > 43 * 86400000) {
    throw new CalendarError(400, 'validation', 'Escolha um período de até 43 dias.')
  }
  return { timeMin: from, timeMax: to }
}

export function eventId(requestId: unknown) {
  const id = text(requestId, 36, true).toLowerCase()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) {
    throw new CalendarError(400, 'validation', 'Identificador do envio inválido.')
  }
  return `cc${id.replaceAll('-', '')}`
}
