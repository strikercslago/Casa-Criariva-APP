import { AppError } from '@/lib/errors/AppError'
import { createTimeoutError } from '@/app/providers/authErrors'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { Json } from '@/lib/supabase/database.types'
import { withTimeout } from '@/shared/utils/withTimeout'
import type { DashboardToday, DashboardAttentionItem, DashboardOperations } from '../types/dashboardTypes'

const DASHBOARD_TIMEOUT_MS = 14_000

function getClient() {
  const supabase = getSupabaseClient()

  if (!supabase) {
    throw new AppError('auth', 'Supabase ainda nao esta configurado neste ambiente.')
  }

  return supabase
}

export async function getDashboardToday(day: string): Promise<DashboardToday> {
  const rows = await rpcRows<DashboardToday>('get_dashboard_today', { p_day: day })
  return rows[0] ?? emptyDashboardToday(day)
}

export async function getDashboardAttention(day: string): Promise<DashboardAttentionItem[]> {
  const items = await rpcRows<DashboardAttentionItem>('get_dashboard_attention', { p_day: day })
  return items.filter((item) => !item.kind.startsWith('stock_') && !/^\/(materiais|relatorios)(?:[/?#]|$)/.test(item.href ?? ''))
}

export async function getDashboardOperations(referenceMonth: string): Promise<DashboardOperations> {
  const rows = await rpcRows<DashboardOperations>('get_dashboard_operations', { p_reference_month: referenceMonth })
  return rows[0] ?? emptyDashboardOperations(referenceMonth)
}

async function rpcRows<TRow>(name: string, args: Record<string, unknown>): Promise<TRow[]> {
  const supabase = getClient()
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: Json | null; error: { message: string } | null }>
  const { data, error } = await withTimeout(
    rpc(name, args),
    DASHBOARD_TIMEOUT_MS,
    createTimeoutError,
  )

  if (error) {
    throw new AppError('unknown', error.message)
  }

  return (data ?? []) as TRow[]
}

function emptyDashboardToday(day: string): DashboardToday {
  return {
    day_date: day,
    events_today_count: 0,
    expected_students: 0,
    next_event_id: '',
    next_event_name: '',
    next_event_start: '',
    next_session_class_name: '',
    next_session_expected_students: 0,
    next_session_id: '',
    next_session_start: '',
    pending_sessions_count: 0,
    sessions_count: 0,
  }
}

function emptyDashboardOperations(referenceMonth: string): DashboardOperations {
  return {
    active_classes_count: 0,
    active_students_count: 0,
    archived_students_count: 0,
    attendance_absent_count: 0,
    attendance_excused_count: 0,
    attendance_pending_sessions: 0,
    attendance_present_count: 0,
    attendance_rate: 0,
    available_spots: 0,
    cash_in: 0,
    cash_out: 0,
    class_active_enrollments: 0,
    class_occupancy_rate: 0,
    class_total_capacity: 0,
    full_classes_count: 0,
    low_stock_count: 0,
    net_students_change: 0,
    new_students_count: 0,
    next_event_date: '',
    next_event_id: '',
    next_event_name: '',
    out_of_stock_count: 0,
    overdue_billing_amount: 0,
    overdue_billing_count: 0,
    payable_amount: 0,
    receivable_amount: 0,
    reference_month: referenceMonth,
    result_amount: 0,
    upcoming_events_count: 0,
  }
}
