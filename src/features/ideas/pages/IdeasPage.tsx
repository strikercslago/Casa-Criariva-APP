import { MessageCircle as PageIcon } from 'lucide-react'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Lightbulb, Plus, RefreshCw } from 'lucide-react'
import { useAuth } from '@/app/providers/AuthProvider'
import { getUserSafeErrorMessage } from '@/lib/errors/AppError'
import { PageHeader } from '@/shared/components/navigation/PageHeader'
import { Button } from '@/shared/components/ui/Button'
import { Select } from '@/shared/components/ui/FormControls'
import { Pagination } from '@/shared/components/ui/Pagination'
import { EmptyState } from '@/shared/components/feedback/EmptyState'
import { ErrorState } from '@/shared/components/feedback/ErrorState'
import { RouteSkeleton } from '@/shared/components/feedback/RouteSkeleton'
import { listTickets, PAGE_SIZE, type Ticket } from '../api/ticketsApi'
import { categoryLabels, statusLabels } from '../schemas/ticketSchema'
import { NewTicket, TicketDetail, StatusBadge } from '../components/TicketDialogs'
import { formatTicketDate } from '../utils/ticketFormat'

export default function IdeasPage() {
  const { roles, user } = useAuth()
  const canManage = roles.some((role) => role === 'owner' || role === 'admin')
  const [mine, setMine] = useState(false)
  const [status, setStatus] = useState<Ticket['status'] | 'all'>('all')
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<Ticket | null>(null)
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['feedback', user?.id, { mine: !canManage || mine, status, page }],
    queryFn: () => listTickets({ mine: !canManage || mine, status, page, userId: user!.id }),
    enabled: Boolean(user),
  })
  function refresh() { void queryClient.invalidateQueries({ queryKey: ['feedback'] }) }
  return <div className="space-y-5">
    <PageHeader icon={PageIcon} title="Ideias e chamados" description="Sua experiência ajuda a melhorar a Casa Criativa." actions={<Button leftIcon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setCreating(true)}>Novo chamado</Button>} />
    <div className="flex gap-3 rounded-md border border-primary/20 bg-primary/5 p-4">
      <Lightbulb className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden />
      <div><p className="font-semibold">Uma ideia, uma dificuldade ou algo que podemos melhorar?</p><p className="mt-1 text-sm text-muted-foreground">Conte em suas palavras. Depois, acompanhe a situação e a resposta da equipe por aqui.</p></div>
    </div>
    <div className="flex flex-wrap items-end gap-3 ui-surface rounded-md border border-border bg-surface p-3">
      {canManage ? <Select id="ticket-scope" label="Mostrar" value={mine ? 'mine' : 'all'} onChange={(e) => { setMine(e.target.value === 'mine'); setPage(1) }}><option value="all">Todos os chamados</option><option value="mine">Meus chamados</option></Select> : <p className="py-2 text-sm font-semibold">Meus chamados</p>}
      <Select id="ticket-filter" label="Situação" value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1) }}><option value="all">Todas</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
      <Button className="sm:ml-auto" variant="secondary" isLoading={query.isFetching} leftIcon={<RefreshCw className="h-4 w-4" aria-hidden />} onClick={() => void query.refetch()}>Atualizar</Button>
    </div>
    {query.isLoading ? <RouteSkeleton /> : query.isError ? <ErrorState title="Não foi possível carregar os chamados." description={getUserSafeErrorMessage(query.error)} onRetry={() => void query.refetch()} /> : <>
      {!query.data?.tickets.length ? <EmptyState title="Nenhum chamado por aqui." description={status === 'all' ? 'Use Novo chamado para enviar sua primeira sugestão ou relatar um problema.' : 'Não há chamados nesta situação. Experimente outro filtro.'} /> : <div className="grid gap-3 md:grid-cols-2">
        {query.data.tickets.map((ticket) => <button type="button" key={ticket.id} onClick={() => setSelected(ticket)} className="ui-surface rounded-md border border-border bg-surface p-4 text-left shadow-subtle transition-colors hover:border-primary/40">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-muted-foreground">Chamado #{ticket.number} · {categoryLabels[ticket.category]}</span><StatusBadge status={ticket.status} /></div>
          <h2 className="mt-3 break-words font-semibold">{ticket.title}</h2>
          <p className="mt-2 line-clamp-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{ticket.description}</p>
          <p className="mt-4 text-xs text-muted-foreground">{canManage ? `${ticket.author_name} · ` : ''}{formatTicketDate(ticket.created_at)}</p>
          <p className="mt-2 text-sm font-medium text-primary">{ticket.response ? 'Ver resposta da equipe →' : 'Acompanhar chamado →'}</p>
        </button>)}
      </div>}
      {(query.data?.total ?? 0) > PAGE_SIZE || page > 1 ? <Pagination page={page} totalPages={Math.max(page, Math.ceil((query.data?.total ?? 0) / PAGE_SIZE))} onPrevious={() => setPage(page - 1)} onNext={() => setPage(page + 1)} /> : null}
    </>}
    {creating ? <NewTicket onClose={() => setCreating(false)} onSaved={(ticket) => { setCreating(false); setSelected(ticket); setPage(1); setStatus('all'); refresh() }} /> : null}
    {selected ? <TicketDetail key={selected.id} ticket={selected} canManage={canManage} onClose={() => setSelected(null)} onSaved={(ticket) => { setSelected(ticket); refresh() }} /> : null}
  </div>
}
