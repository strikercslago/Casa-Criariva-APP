import { AppError } from '@/lib/errors/AppError'
import { addDays, getWeekRange, parseIsoDate, toIsoDate } from '../utils/agendaDates'

export type CalendarView = 'day' | 'week' | 'month'
export function periodFor(date: string, view: CalendarView) {
  if (view === 'day') return { start: date, end: addDays(date, 1) }
  if (view === 'week') { const week = getWeekRange(date); return { start: week.startDate, end: addDays(week.endDate, 1) } }
  const day = parseIsoDate(date)
  const first = toIsoDate(new Date(day.getFullYear(), day.getMonth(), 1))
  const last = toIsoDate(new Date(day.getFullYear(), day.getMonth() + 1, 0))
  return { start: getWeekRange(first).startDate, end: addDays(getWeekRange(last).endDate, 1) }
}
export function dateTimeInZone(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso))
  const part = (name: string) => parts.find((item) => item.type === name)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`
}
// Resolve a wall-clock time in the selected calendar's IANA zone without assuming the browser zone.
export function zonedToIso(local: string, timeZone: string) {
  const nominal = Date.parse(`${local}:00Z`)
  if (!Number.isFinite(nominal)) throw new AppError('validation', 'Data ou horário inválido.')
  let instant = nominal
  for (let i = 0; i < 3; i++) {
    const wall = Date.parse(`${dateTimeInZone(new Date(instant).toISOString(), timeZone)}:00Z`)
    instant += nominal - wall
  }
  const candidates = [instant - 3600000, instant, instant + 3600000].filter((value) => dateTimeInZone(new Date(value).toISOString(), timeZone) === local)
  if (candidates.length !== 1) throw new AppError('validation', 'Este horário é inexistente ou ambíguo pela mudança de fuso. Escolha outro horário.')
  return new Date(instant).toISOString().replace('.000Z', 'Z')
}
export function safeCalendarLink(value: string | undefined) {
  if (!value) return undefined
  try { const url = new URL(value); return url.protocol === 'https:' && ['calendar.google.com', 'www.google.com'].includes(url.hostname) ? url.href : undefined } catch { return undefined }
}
