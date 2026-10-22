import { beforeEach, describe, expect, it, vi } from 'vitest'
import { archiveStudent, restoreStudent, updateStudentStatus } from './studentsApi'
const mocks = vi.hoisted(() => ({ update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn() }))
vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: () => ({ from: () => mocks }) }))
describe('student lifecycle persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.update.mockReturnValue(mocks)
    mocks.eq.mockReturnValue(mocks)
    mocks.select.mockReturnValue(mocks)
    mocks.single.mockResolvedValue({ data: { id: 'student-1' }, error: null })
  })
  it.each(['active', 'inactive'] as const)('persists %s without an archive date', async (status) => {
    await updateStudentStatus('student-1', status)
    expect(mocks.update).toHaveBeenCalledWith({ status, archived_at: null })
    expect(mocks.eq).toHaveBeenCalledWith('id', 'student-1')
  })
  it('archives with a timestamp and restores with a cleared timestamp', async () => {
    await archiveStudent('student-1')
    expect(mocks.update).toHaveBeenLastCalledWith({ status: 'archived', archived_at: expect.any(String) })
    await restoreStudent('student-1')
    expect(mocks.update).toHaveBeenLastCalledWith({ status: 'active', archived_at: null })
  })
  it('reports denied writes instead of claiming success', async () => {
    mocks.single.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } })
    await expect(updateStudentStatus('student-1', 'inactive')).rejects.toMatchObject({ code: 'permission' })
  })
})
