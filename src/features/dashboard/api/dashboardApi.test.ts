import { describe, expect, it, vi } from 'vitest'
import { getDashboardAttention, getDashboardOperations, getDashboardToday } from './dashboardApi'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ rpc }) }))

describe('dashboard after module removal', () => {
  it('keeps operational alerts while hiding stock and retired destinations', async () => {
    const billing = { kind: 'overdue_billing', href: '/mensalidades?status=overdue' }
    const agenda = { kind: 'pending_attendance', href: '/agenda' }
    rpc.mockResolvedValue({ data: [billing, agenda,
      { kind: 'stock_low', href: null },
      { kind: 'legacy', href: '/materiais?status=low' },
      { kind: 'legacy_report', href: '/relatorios' },
    ], error: null })
    expect(await getDashboardAttention('2026-11-09')).toEqual([billing, agenda])
  })
  it('preserves today and monthly indicators through dashboard RPCs', async () => {
    rpc.mockResolvedValueOnce({ data: [{ sessions_count: 3 }], error: null })
    expect(await getDashboardToday('2026-11-09')).toEqual({ sessions_count: 3 })
    expect(rpc).toHaveBeenLastCalledWith('get_dashboard_today', { p_day: '2026-11-09' })
    rpc.mockResolvedValueOnce({ data: [{ active_students_count: 42 }], error: null })
    expect(await getDashboardOperations('2026-11-01')).toEqual({ active_students_count: 42 })
  })
})
