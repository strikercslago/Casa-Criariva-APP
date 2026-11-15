import { getSupabaseClient } from '@/lib/supabase/client'
import { AppError } from '@/lib/errors/AppError'
import type { FeedbackTicketRow } from '@/lib/supabase/database.types'
import { ticketSchema, type TicketInput } from '../schemas/ticketSchema'

export const PAGE_SIZE = 12
export type Ticket = FeedbackTicketRow
export type TicketFilters = { page: number; status: Ticket['status'] | 'all'; mine: boolean; userId: string }

function client() {
  const value = getSupabaseClient()
  if (!value) throw new AppError('auth', 'Não foi possível conectar. Entre novamente e tente outra vez.')
  return value
}

function checkError(error: { code?: string; message: string } | null) {
  if (!error) return
  if (['42P01', 'PGRST205', 'PGRST202'].includes(error.code ?? '')) {
    throw new AppError('configuration', 'Este espaço ainda não foi habilitado. Avise a administração para concluir a ativação.')
  }
  if (error.code === '42501') throw new AppError('permission', 'Você não tem permissão para esta ação.')
  throw new AppError('network', 'Não foi possível concluir. Seu texto foi mantido; tente novamente.')
}

export async function listTickets(filters: TicketFilters) {
  let query = client().from('feedback_tickets').select('*', { count: 'exact' }).order('created_at', { ascending: false }).order('id')
  if (filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.mine) query = query.eq('created_by', filters.userId)
  const from = (filters.page - 1) * PAGE_SIZE
  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1).abortSignal(AbortSignal.timeout(15000))
  checkError(error)
  return { tickets: data ?? [], total: count ?? 0 }
}

export async function createTicket(id: string, input: TicketInput) {
  const values = ticketSchema.parse(input)
  const { data, error } = await client().rpc('create_feedback_ticket', {
    p_id: id, p_category: values.category, p_title: values.title, p_description: values.description,
  }).abortSignal(AbortSignal.timeout(15000)).single()
  checkError(error)
  if (!data) throw new AppError('unknown', 'Não recebemos a confirmação. Tente enviar novamente.')
  return data
}

export async function respondTicket(id: string, status: Ticket['status'], response: string) {
  const { data, error } = await client().rpc('respond_feedback_ticket', { p_id: id, p_status: status, p_response: response }).abortSignal(AbortSignal.timeout(15000)).single()
  checkError(error)
  if (!data) throw new AppError('not-found', 'Chamado não encontrado. Atualize a lista.')
  return data
}
