import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/shared/components/feedback/Toast'
import IdeasPage from './IdeasPage'

const auth = vi.hoisted(() => ({ roles: ['teacher'], user: { id: 'teacher-1' } }))
const list = vi.hoisted(() => vi.fn())
vi.mock('@/app/providers/AuthProvider', () => ({ useAuth: () => auth }))
vi.mock('../api/ticketsApi', () => ({ listTickets: list, PAGE_SIZE: 12, createTicket: vi.fn(), respondTicket: vi.fn() }))
function show() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ToastProvider><IdeasPage /></ToastProvider></QueryClientProvider>)
}
beforeEach(() => { vi.clearAllMocks(); list.mockResolvedValue({ tickets: [], total: 0 }) })

it('requests only the signed-in teacher’s tickets and exposes creation', async () => {
  auth.roles = ['teacher']
  show()
  await waitFor(() => expect(list).toHaveBeenCalledWith({ userId: 'teacher-1', mine: true, status: 'all', page: 1 }))
  expect(screen.getByRole('button', { name: 'Novo chamado' })).toBeInTheDocument()
  expect(screen.queryByLabelText('Mostrar')).not.toBeInTheDocument()
  expect(await screen.findByText('Nenhum chamado por aqui.')).toBeInTheDocument()
})

it('lets administrators start with all tickets', async () => {
  auth.roles = ['admin']
  show()
  await waitFor(() => expect(list).toHaveBeenCalledWith(expect.objectContaining({ mine: false })))
  expect(screen.getByLabelText('Mostrar')).toHaveValue('all')
})
