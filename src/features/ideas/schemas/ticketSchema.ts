import { z } from 'zod'

export const ticketSchema = z.object({
  title: z.string().trim().min(3, 'Escreva um título com pelo menos 3 caracteres.').max(120, 'Use até 120 caracteres.'),
  category: z.enum(['suggestion', 'bug', 'improvement']),
  description: z.string().trim().min(10, 'Conte um pouco mais: use pelo menos 10 caracteres.').max(5000, 'Use até 5.000 caracteres.'),
})
export type TicketInput = z.infer<typeof ticketSchema>
export const categoryLabels = { suggestion: 'Sugestão', bug: 'Problema / erro', improvement: 'Melhoria' } as const
export const statusLabels = { open: 'Aberto', reviewing: 'Em análise', planned: 'Planejado', completed: 'Concluído', declined: 'Não previsto' } as const
