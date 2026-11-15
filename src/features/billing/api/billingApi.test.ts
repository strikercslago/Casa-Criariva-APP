import { beforeEach, expect, it, vi } from 'vitest'
import { registerPayment } from './billingApi'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ rpc }) }))
const input = { monthlyFeeId: 'fee-1', amount: 100, paidAt: '2026-11-15T12:00:00Z', paymentMethod: 'pix' as const }
beforeEach(() => vi.clearAllMocks())

it.each([null, [], [{ payment_id: '', monthly_fee_id: 'fee-1' }]])('does not report payment success without a receipt: %j', async (data) => {
  rpc.mockResolvedValue({ data, error: null })
  await expect(registerPayment(input)).rejects.toMatchObject({ code: 'unknown', message: expect.stringContaining('Confira') })
  expect(rpc).toHaveBeenCalledTimes(1)
})

it('returns the confirmed payment unchanged', async () => {
  const receipt = { payment_id: 'payment-1', monthly_fee_id: 'fee-1', amount_paid: 100, balance: 80, computed_status: 'partial' }
  rpc.mockResolvedValue({ data: [receipt], error: null })
  await expect(registerPayment(input)).resolves.toEqual(receipt)
  expect(rpc).toHaveBeenCalledTimes(1)
})

it('preserves permission failures without retrying the payment', async () => {
  rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } })
  await expect(registerPayment(input)).rejects.toMatchObject({ code: 'permission' })
  expect(rpc).toHaveBeenCalledTimes(1)
})
