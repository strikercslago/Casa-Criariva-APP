import { createDateFormatter, createNumberFormatter } from '@/app/config/localization'
import { parseIsoDate } from '@/features/billing/utils/billingDates'

export function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  return createDateFormatter().format(parseIsoDate(value.slice(0, 10)))
}

export function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'Sem base'
  return `${createNumberFormatter({ maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(Number(value))}%`
}

export function formatTime(value: string | null | undefined) {
  if (!value) return '-'
  return value.slice(0, 5)
}
