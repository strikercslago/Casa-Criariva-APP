import { describe, expect, it } from 'vitest'
import { addDays, formatAgendaRange, formatTimeRange, getWeekRange, getMonthRange, getMonthDays, moveMonth } from './agendaDates'

describe('agendaDates', () => {
  it('handles leap months, six-week grids and year navigation', () => {
    expect(getMonthRange('2024-02-15')).toEqual({ startDate: '2024-02-01', endDate: '2024-02-29' })
    const days = getMonthDays('2026-03-15')
    expect(days).toHaveLength(42)
    expect(days[0]).toBe('2026-02-23')
    expect(days[41]).toBe('2026-04-05')
    expect(moveMonth('2026-12-31', 1)).toBe('2027-01-01')
    expect(moveMonth('2026-01-31', -1)).toBe('2025-12-01')
  })
  it('navigates dates and computes ISO week ranges', () => {
    expect(addDays('2026-08-11', 1)).toBe('2026-08-12')
    expect(getWeekRange('2026-08-11')).toEqual({ endDate: '2026-08-16', startDate: '2026-08-10' })
  })

  it('formats date ranges and time ranges', () => {
    expect(formatAgendaRange('2026-08-11', '2026-08-11')).toContain('11 de agosto')
    expect(formatAgendaRange('2026-08-10', '2026-08-16')).toContain('a')
    expect(formatTimeRange('14:00:00', '15:30:00')).toBe('14:00 - 15:30')
  })
})
