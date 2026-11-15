import { createClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSupabaseClient } from '@/lib/supabase/client'
import { getStudentCounts, listStudents } from './studentsApi'

vi.mock('@/lib/supabase/client', () => ({ getSupabaseClient: vi.fn() }))
const fetchMock = vi.fn()

const client = createClient('https://directory.example.test', 'test-public-key', {
    auth: { persistSession: false, autoRefreshToken: false, storageKey: crypto.randomUUID() },
    global: { fetch: fetchMock },
  })

beforeEach(() => {
  fetchMock.mockReset()
  vi.mocked(getSupabaseClient).mockReturnValue(client as ReturnType<typeof getSupabaseClient>)
})

describe('student directory queries', () => {
  it('paginates on the server and searches names, active classes and guardians in one request', async () => {
    fetchMock.mockResolvedValue(new Response('[]', { headers: { 'content-range': '20-39/41', 'content-type': 'application/json' } }))
    const result = await listStudents({ page: 2, pageSize: 20, search: 'Artes', status: 'inactive' })
    const url = new URL(fetchMock.mock.calls[0][0])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(url.searchParams.get('offset')).toBe('20')
    expect(url.searchParams.get('limit')).toBe('20')
    expect(url.searchParams.get('status')).toBe('eq.inactive')
    expect(url.searchParams.get('matching_classes.class.name')).toBe('ilike.%Artes%')
    expect(url.searchParams.get('matching_classes.status')).toBe('eq.active')
    expect(url.searchParams.get('matching_guardians.guardian.full_name')).toBe('ilike.%Artes%')
    expect(url.searchParams.get('or')).toBe('(full_name.ilike."%Artes%",matching_classes.not.is.null,matching_guardians.not.is.null)')
    expect(result.totalPages).toBe(3)
    expect(result.totalCount).toBe(41)
  })

  it('keeps punctuation inside the quoted search value', async () => {
    fetchMock.mockResolvedValue(new Response('[]', { headers: { 'content-type': 'application/json' } }))
    await listStudents({ page: 1, pageSize: 20, search: 'Ana, ("Y")', status: 'all' })
    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.searchParams.get('or')).toContain('full_name.ilike."%Ana, (\\"Y\\")%"')
    expect(url.searchParams.has('status')).toBe(false)
  })

  it('counts all statuses without downloading student records', async () => {
    fetchMock.mockImplementation(async (input: string) => {
      const status = new URL(input).searchParams.get('status')
      return new Response(null, { headers: { 'content-range': `*/${status === 'eq.active' ? 34 : status === 'eq.inactive' ? 3 : 2}` } })
    })
    await expect(getStudentCounts()).resolves.toEqual({ all: 39, active: 34, inactive: 3, archived: 2 })
    expect(fetchMock.mock.calls.every(([, options]) => options.method === 'HEAD')).toBe(true)
  })

  it('reports a failed count instead of showing a misleading zero', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ code: '42501', message: 'permission denied' }), { status: 403 }))
    await expect(getStudentCounts()).rejects.toBeDefined()
  })
})
