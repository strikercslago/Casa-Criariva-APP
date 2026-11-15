import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { ToastProvider } from '@/shared/components/feedback/Toast'
import { AppError } from '@/lib/errors/AppError'
import { NewTicket, TicketDetail } from './TicketDialogs'
import type { Ticket } from '../api/ticketsApi'

const api = vi.hoisted(() => ({ createTicket: vi.fn(), respondTicket: vi.fn() }))
vi.mock('../api/ticketsApi', () => api)
const ticket: Ticket = { id: 'ticket-1', number: 12, author_name: 'Professor teste', created_by: 'user-1', category: 'bug', title: 'Falha ao abrir agenda', description: 'Ao abrir a agenda a tela fica vazia.', status: 'open', response: '', updated_by: null, created_at: '2026-11-09T12:00:00Z', updated_at: '2026-11-09T12:00:00Z' }
function show(ui: ReactNode) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}><ToastProvider>{ui}</ToastProvider></QueryClientProvider>)
}
beforeEach(() => vi.clearAllMocks())

it('keeps text on failure and reuses the request ID when retrying', async () => {
  api.createTicket.mockRejectedValueOnce(new AppError('network', 'Falha de conexão.')).mockResolvedValueOnce(ticket)
  const onSaved = vi.fn()
  const user = userEvent.setup()
  show(<NewTicket onClose={vi.fn()} onSaved={onSaved} />)
  await user.selectOptions(screen.getByLabelText('O que você quer registrar?'), 'bug')
  await user.type(screen.getByLabelText('Título'), ticket.title)
  await user.type(screen.getByLabelText('Conte mais'), ticket.description)
  await user.click(screen.getByRole('button', { name: 'Enviar chamado' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Falha de conexão.')
  expect(screen.getByLabelText('Conte mais')).toHaveValue(ticket.description)
  expect(onSaved).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Enviar chamado' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(ticket))
  expect(api.createTicket.mock.calls[0][0]).toBe(api.createTicket.mock.calls[1][0])
})

it('rejects whitespace-only descriptions before submitting', async () => {
  const user = userEvent.setup()
  show(<NewTicket onClose={vi.fn()} onSaved={vi.fn()} />)
  await user.type(screen.getByLabelText('Título'), 'Minha ideia')
  await user.type(screen.getByLabelText('Conte mais'), '           ')
  await user.click(screen.getByRole('button', { name: 'Enviar chamado' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('pelo menos 10')
  expect(api.createTicket).not.toHaveBeenCalled()
})

it('shows the response to teachers without management controls', () => {
  show(<TicketDetail ticket={{ ...ticket, response: 'Estamos verificando.', status: 'reviewing' }} canManage={false} onClose={vi.fn()} onSaved={vi.fn()} />)
  expect(screen.getByText('Estamos verificando.')).toBeInTheDocument()
  expect(screen.queryByLabelText('Atualizar situação')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Salvar atualização' })).not.toBeInTheDocument()
})

it('lets administrators save a response and status', async () => {
  const saved = { ...ticket, response: 'Problema corrigido.', status: 'completed' }
  api.respondTicket.mockResolvedValue(saved)
  const onSaved = vi.fn()
  const user = userEvent.setup()
  show(<TicketDetail ticket={ticket} canManage onClose={vi.fn()} onSaved={onSaved} />)
  await user.selectOptions(screen.getByLabelText('Atualizar situação'), 'completed')
  await user.type(screen.getByLabelText('Resposta para o usuário'), 'Problema corrigido.')
  await user.click(screen.getByRole('button', { name: 'Salvar atualização' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved))
  expect(api.respondTicket).toHaveBeenCalledWith(ticket.id, 'completed', 'Problema corrigido.')
})
