import { useQuery } from '@tanstack/react-query'
import { getDashboardToday, getDashboardAttention, getDashboardOperations } from '../api/dashboardApi'
import { dashboardKeys } from './dashboardKeys'

const DASHBOARD_TODAY_STALE_MS = 60_000
const DASHBOARD_SUMMARY_STALE_MS = 120_000

export function useDashboardToday(date: string, enabled = true) {
  return useQuery({
    enabled,
    queryFn: () => getDashboardToday(date),
    queryKey: dashboardKeys.today(date),
    staleTime: DASHBOARD_TODAY_STALE_MS,
  })
}

export function useDashboardAttention(date: string, enabled = true) {
  return useQuery({
    enabled,
    queryFn: () => getDashboardAttention(date),
    queryKey: dashboardKeys.attention(date),
    staleTime: DASHBOARD_TODAY_STALE_MS,
  })
}

export function useDashboardOperations(referenceMonth: string, enabled = true) {
  return useQuery({
    enabled,
    queryFn: () => getDashboardOperations(referenceMonth),
    queryKey: dashboardKeys.operations(referenceMonth),
    staleTime: DASHBOARD_SUMMARY_STALE_MS,
  })
}
