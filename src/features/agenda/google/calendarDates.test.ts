import { describe, expect, it } from 'vitest'
import { dateTimeInZone, periodFor, safeCalendarLink, zonedToIso } from './calendarDates'

describe('Google calendar dates', () => {
  it('uses the calendar zone instead of the browser zone', () => {
    expect(zonedToIso('2026-11-15T09:00', 'America/Sao_Paulo')).toBe('2026-11-15T12:00:00Z')
    expect(dateTimeInZone('2026-11-15T12:00:00Z', 'America/Sao_Paulo')).toBe('2026-11-15T09:00')
  })
  it('rejects nonexistent and ambiguous daylight-saving times', () => {
    expect(() => zonedToIso('2026-03-08T02:30', 'America/New_York')).toThrow()
    expect(() => zonedToIso('2026-11-01T01:30', 'America/New_York')).toThrow()
  })
  it('calculates exclusive day/week/month periods across year boundaries', () => {
    expect(periodFor('2026-12-31', 'day')).toEqual({ start: '2026-12-31', end: '2027-01-01' })
    expect(periodFor('2026-12-31', 'week')).toEqual({ start: '2026-12-28', end: '2027-01-04' })
    const month = periodFor('2026-11-15', 'month')
    expect((Date.parse(month.end) - Date.parse(month.start)) / 86400000).toBe(42)
  })
  it('opens only HTTPS Google calendar links', () => {
    expect(safeCalendarLink('javascript:alert(1)')).toBeUndefined()
    expect(safeCalendarLink('https://calendar.google.com.attacker.test/')).toBeUndefined()
    expect(safeCalendarLink('https://calendar.google.com/calendar/event?id=123')).toBeDefined()
  })
})
