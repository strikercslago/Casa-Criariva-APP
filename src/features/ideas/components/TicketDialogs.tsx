import { useRef, useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { getUserSafeErrorMessage } from '@/lib/errors/AppError'
import { Button } from '@/shared/components/ui/Button'
import { Badge } from '@/shared/components/ui/Badge'
import { Input } from '@/shared/components/ui/Input'
import { Select, Textarea } from '@/shared/components/ui/FormControls'
import { Overlay } from '@/shared/components/ui/Overlay'
import { useToast } from '@/shared/components/feedback/Toast'
import { createTicket, respondTicket, type Ticket } from '../api/ticketsApi'
import { categoryLabels, statusLabels, ticketSchema, type TicketInput } from '../schemas/ticketSchema'
import { formatTicketDate } from '../utils/ticketFormat'

export function NewTicket({ onClose, onSaved }: { onClose: () => void; onSaved: (ticket: Ticket) => void }) {
  const [values, setValues] = useState<TicketInput>({ category: 'suggestion', title: '', description: '' })
  const [validation, setValidation] = useState<string | null>(null)
  const requestId = useRef(crypto.randomUUID())
  const inFlight = useRef(false)
  const { notify } = useToast()
  const mutation = useMutation({ mutationFn: () => createTicket(requestId.current, values), retry: false })
  function close() {
    if (inFlight.current) return
    if ((values.title || values.description) && !window.confirm('Descartar o texto deste chamado?')) return
    onClose()
  }
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (inFlight.current) return
    const result = ticketSchema.safeParse(values)
    if (!result.success) { setValidation(result.error.issues[0].message); return }
    setValidation(null)
    inFlight.current = true
    try {
      const ticket = await mutation.mutateAsync()
      notify({ title: `Chamado #${ticket.number} registrado.`, tone: 'success' })
      onSaved(ticket)
    } catch { /* Keep the form and text available for retry. */ }
    finally { inFlight.current = false }
  }
  return <Overlay isOpen title="Novo chamado" onClose={close}>
    <form className="grid gap-4" onSubmit={(e) => void submit(e)}>
      <Select id="ticket-category" label="O que você quer registrar?" value={values.category} disabled={mutation.isPending} onChange={(e) => setValues({ ...values, category: e.target.value as TicketInput['category'] })}>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
      <Input id="ticket-title" label="Título" required maxLength={120} placeholder="Resuma sua ideia ou dificuldade" value={values.title} disabled={mutation.isPending} onChange={(e) => setValues({ ...values, title: e.target.value })} />
      <Textarea id="ticket-description" label="Conte mais" required maxLength={5000} rows={7} placeholder={values.category === 'bug' ? 'Em qual tela aconteceu? O que você tentou fazer e o que apareceu?' : 'O que poderia melhorar e como isso ajudaria no seu dia a dia?'} value={values.description} disabled={mutation.isPending} onChange={(e) => setValues({ ...values, description: e.target.value })} />
      <p className="text-xs text-muted-foreground">{values.description.length}/5.000 caracteres · Sua mensagem será vista pela administração.</p>
      {validation || mutation.isError ? <p role="alert" className="text-sm text-danger">{validation ?? getUserSafeErrorMessage(mutation.error)}</p> : null}
      <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" disabled={mutation.isPending} onClick={close}>Cancelar</Button><Button type="submit" isLoading={mutation.isPending}>Enviar chamado</Button></div>
    </form>
  </Overlay>
}

export function TicketDetail({ ticket, canManage, onClose, onSaved }: { ticket: Ticket; canManage: boolean; onClose: () => void; onSaved: (ticket: Ticket) => void }) {
  const [status, setStatus] = useState(ticket.status)
  const [response, setResponse] = useState(ticket.response)
  const { notify } = useToast()
  const mutation = useMutation({ mutationFn: () => respondTicket(ticket.id, status, response), onSuccess: (saved) => { onSaved(saved); notify({ title: 'Chamado atualizado.', tone: 'success' }) } })
  function close() {
    if (mutation.isPending) return
    if ((response !== ticket.response || status !== ticket.status) && !window.confirm('Descartar as alterações deste chamado?')) return
    onClose()
  }
  return <Overlay isOpen title={`Chamado #${ticket.number}`} onClose={close}>
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2"><Badge>{categoryLabels[ticket.category]}</Badge><StatusBadge status={ticket.status} /></div>
      <h2 className="break-words text-xl font-semibold">{ticket.title}</h2>
      <p className="text-xs text-muted-foreground">Enviado por {ticket.author_name} em {formatTicketDate(ticket.created_at)}</p>
      <p className="whitespace-pre-wrap break-words rounded-md bg-muted/50 p-3 text-sm leading-6">{ticket.description}</p>
      <section className="rounded-md border border-primary/20 bg-primary/5 p-3"><h3 className="font-semibold">Retorno da equipe</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm">{ticket.response || 'Ainda não há resposta. Acompanhe as novidades por aqui.'}</p><p className="mt-2 text-xs text-muted-foreground">Atualizado em {formatTicketDate(ticket.updated_at)}</p></section>
      {canManage ? <form className="grid gap-3 border-t border-border pt-4" onSubmit={(e) => { e.preventDefault(); if (!mutation.isPending) mutation.mutate() }}>
        <Select id="ticket-status" label="Atualizar situação" value={status} disabled={mutation.isPending} onChange={(e) => setStatus(e.target.value as Ticket['status'])}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
        <Textarea id="ticket-response" label="Resposta para o usuário" rows={4} maxLength={5000} value={response} disabled={mutation.isPending} onChange={(e) => setResponse(e.target.value)} />
        {mutation.isError ? <p role="alert" className="text-sm text-danger">{getUserSafeErrorMessage(mutation.error)}</p> : null}
        <Button type="submit" isLoading={mutation.isPending} disabled={status === ticket.status && response === ticket.response}>Salvar atualização</Button>
      </form> : null}
    </div>
  </Overlay>
}

export function StatusBadge({ status }: { status: Ticket['status'] }) {
  return <Badge tone={status === 'completed' ? 'success' : status === 'reviewing' ? 'warning' : status === 'planned' ? 'primary' : 'neutral'}>{statusLabels[status]}</Badge>
}
