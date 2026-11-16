import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, Plus, RefreshCw } from 'lucide-react'
import { useAuth } from '@/app/providers/AuthProvider'
import { Button } from '@/shared/components/ui/Button'
import { IconButton } from '@/shared/components/ui/IconButton'
import { Overlay } from '@/shared/components/ui/Overlay'
import { PageHeader } from '@/shared/components/navigation/PageHeader'
import { getUserSafeErrorMessage } from '@/lib/errors/AppError'
import { calendarRequest, googleCalendarEnabled } from './calendarApi'
import type { CalendarEvent, CalendarStatus, EventPage } from './calendarTypes'
import { categories } from './calendarTypes'
import { dateTimeInZone, periodFor, safeCalendarLink, zonedToIso } from './calendarDates'
import type { CalendarView } from './calendarDates'
import { GoogleEventForm } from './GoogleEventForm'
import { addDays, formatLongAgendaDate, parseIsoDate, toIsoDate } from '../utils/agendaDates'

const rootKey = ['google-calendar'] as const
export default function GoogleCalendarPanel() {
  const { roles } = useAuth()
  const manage = roles.some((role) => role === 'owner' || role === 'admin')
  const canCreate = manage || roles.includes('teacher')
  const client = useQueryClient()
  const status = useQuery({ queryKey: [...rootKey, 'status'], queryFn: () => calendarRequest<CalendarStatus>('status'),
    enabled: googleCalendarEnabled, retry: false, staleTime: 30000,
    refetchInterval: (query) => query.state.data?.calendarId ? 60000 : false,
  })
  const zone = status.data?.timeZone ?? 'America/Sao_Paulo'
  const today = dateTimeInZone(new Date().toISOString(), zone).slice(0, 10)
  const [date, setDate] = useState(today)
  const [view, setView] = useState<CalendarView>('day')
  const [showCalendars, setShowCalendars] = useState(false)
  const [calendarId, setCalendarId] = useState('')
  const [editing, setEditing] = useState<CalendarEvent | null | undefined>(undefined)
  const [confirmation, setConfirmation] = useState<CalendarEvent | 'disconnect' | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const range = useMemo(() => periodFor(date, view), [date, view])
  const events = useInfiniteQuery({
    queryKey: [...rootKey, 'events', status.data?.calendarId, status.data?.revision, range, zone],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => calendarRequest<EventPage>('events', {
      start: zonedToIso(`${range.start}T00:00`, zone), end: zonedToIso(`${range.end}T00:00`, zone), pageToken: pageParam,
    }), getNextPageParam: (page) => page.nextPageToken,
    enabled: Boolean(googleCalendarEnabled && status.data?.calendarId && status.data.status !== 'reconnect'),
    staleTime: 60000, retry: false,
  })
  const calendars = useQuery({ queryKey: [...rootKey, 'calendars'], queryFn: () => calendarRequest<{ calendars: Array<{ id: string; summary: string }> }>('calendars'),
    enabled: showCalendars && manage, staleTime: 60000, retry: false,
  })
  const items = events.data?.pages.flatMap((page) => page.events) ?? []
  async function refresh() {
    await client.invalidateQueries({ queryKey: rootKey })
  }
  async function action(name: string, payload: Record<string, unknown> = {}) {
    setPending(true); setError('')
    try {
      const result = await calendarRequest<{ url?: string }>(name, { expectedCalendarId: status.data?.calendarId, expectedGeneration: status.data?.generation, ...payload })
      if (name === 'connect' && result.url) {
        const url = new URL(result.url)
        if (url.origin !== 'https://accounts.google.com') throw new Error('Endereço de autorização inválido.')
        window.location.assign(url.href)
        return
      }
      setConfirmation(null)
      if (name === 'select-calendar') setShowCalendars(false)
      await refresh()
    } catch (cause) { setError(getUserSafeErrorMessage(cause)) }
    finally { setPending(false) }
  }
  function move(direction: number) {
    if (view === 'month') {
      const current = parseIsoDate(date)
      setDate(toIsoDate(new Date(current.getFullYear(), current.getMonth() + direction, 1)))
    } else setDate(addDays(date, direction * (view === 'week' ? 7 : 1)))
  }
  const callbackResult = new URLSearchParams(window.location.search).get('google')
  return <div className="space-y-4">
    <PageHeader icon={CalendarDays} title="Agenda" description="Compromissos da escola conectados ao Google Calendar." />
    {!googleCalendarEnabled ? <p className="rounded-xl border border-border bg-surface p-4">A conexão com Google Calendar está em preparação. As aulas e a frequência continuam disponíveis na aba Aulas.</p> : <>
      {callbackResult === 'error' || callbackResult === 'cancelled' ? <p role="alert" className="rounded bg-muted p-3">{callbackResult === 'cancelled' ? 'A autorização foi cancelada.' : 'Não foi possível concluir a conexão. Tente conectar novamente.'}</p> : null}
      <section className="space-y-3 rounded-xl border border-border bg-surface p-4" aria-label="Conexão Google Calendar">
        {status.isLoading ? <p role="status">Verificando conexão…</p> : null}
        {status.data ? <>
          <p className="break-words font-semibold">{status.data.calendarName ?? (status.data.email ? 'Selecione a agenda da escola' : 'Google Calendar não conectado')}</p>
          {manage && status.data.email ? <p className="break-all text-sm text-muted-foreground">{status.data.email}</p> : null}
          <p className="text-sm text-muted-foreground" role="status">{status.data.status === 'reconnect' ? 'A autorização expirou ou foi revogada. Reconecte a conta.' : status.data.pending && status.data.calendarId ? 'Sincronização pendente.' : status.data.lastSyncedAt ? `Última sincronização: ${new Date(status.data.lastSyncedAt).toLocaleString('pt-BR', { timeZone: zone })}` : 'Nenhuma sincronização concluída.'}</p>
          {manage ? <div className="flex flex-wrap gap-2">
            <Button disabled={pending} onClick={() => void action('connect')}>{status.data.email ? 'Reconectar Google Calendar' : 'Conectar Google Calendar'}</Button>
            {status.data.email ? <><Button variant="secondary" onClick={() => setShowCalendars(!showCalendars)}>Selecionar agenda</Button><Button variant="ghost" onClick={() => setConfirmation('disconnect')}>Desconectar Google Calendar</Button></> : null}
          </div> : !status.data.calendarId ? <p className="text-sm">A administração da escola pode conectar a agenda.</p> : null}
          {manage ? <p className="text-sm text-muted-foreground">Use uma agenda institucional: seus compromissos serão visíveis aos professores, administradores e proprietário da escola.</p> : null}
        </> : null}
        {showCalendars ? <div className="flex flex-wrap items-end gap-2">
          <label className="grid min-w-0 flex-1 gap-1 text-sm">Agenda do Google<select className="h-12 w-full rounded border border-border bg-surface px-2" value={calendarId} onChange={(e) => setCalendarId(e.target.value)}><option value="">Selecione uma agenda</option>{calendars.data?.calendars.map((item) => <option key={item.id} value={item.id}>{item.summary}</option>)}</select></label>
          <Button disabled={!calendarId || pending || calendars.isFetching} onClick={() => void action('select-calendar', { calendarId })}>Usar agenda</Button>
          {calendars.isLoading ? <p role="status">Carregando agendas…</p> : null}
          {calendars.isError ? <p role="alert">{getUserSafeErrorMessage(calendars.error)}</p> : null}
        </div> : null}
      </section>
      {status.isError ? <div role="alert"><p>{getUserSafeErrorMessage(status.error)}</p><Button variant="secondary" onClick={() => void status.refetch()}>Tentar novamente</Button></div> : null}
      {error ? <p role="alert" className="rounded bg-muted p-3 text-sm">{error}</p> : null}
      {status.data?.calendarId && status.data.status !== 'reconnect' ? <>
        <section className="space-y-3 rounded-xl border border-border bg-surface p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="secondary" leftIcon={<RefreshCw className="h-4 w-4" />} isLoading={pending || events.isFetching} onClick={() => manage ? void action('sync') : void refresh()}>Atualizar compromissos</Button>
            {canCreate ? <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setEditing(null)}>Novo compromisso</Button> : null}
          </div>
          <div className="grid grid-cols-[48px_minmax(0,1fr)_48px] gap-2">
            <IconButton label="Período anterior do Google" onClick={() => move(-1)}><ChevronLeft className="h-4 w-4" /></IconButton>
            <input aria-label="Data dos compromissos" className="min-w-0 rounded border border-border bg-surface px-2" type="date" value={date} onChange={(e) => { if (e.target.value) setDate(e.target.value) }} />
            <IconButton label="Próximo período do Google" onClick={() => move(1)}><ChevronRight className="h-4 w-4" /></IconButton>
          </div>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Período dos compromissos">
            <Button variant="ghost" onClick={() => setDate(today)}>Hoje</Button>
            {(['day', 'week', 'month'] as const).map((mode, index) => <Button key={mode} aria-pressed={view === mode} variant={view === mode ? 'primary' : 'secondary'} onClick={() => setView(mode)}>{['Dia', 'Semana', 'Mês'][index]}</Button>)}
          </div>
          <p className="text-sm text-muted-foreground">Horários em {zone}.</p>
          {view === 'month' ? <div className="grid grid-cols-7 gap-1" aria-label="Calendário mensal">
            {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((label, index) => <span key={index} className="text-center text-xs">{label}</span>)}
            {Array.from({ length: Math.round((Date.parse(range.end) - Date.parse(range.start)) / 86400000) }, (_, index) => {
              const day = addDays(range.start, index)
              return <button type="button" key={day} aria-label={formatLongAgendaDate(day)} aria-current={day === today ? 'date' : undefined}
                className={`min-h-11 rounded text-sm ${day === today ? 'bg-primary font-bold text-white' : 'bg-muted/50'}`}
                onClick={() => { setDate(day); setView('day') }}>{Number(day.slice(-2))}</button>
            })}
          </div> : null}
        </section>
        {events.isLoading ? <p role="status">Carregando compromissos…</p> : null}
        {events.isError ? <div role="alert"><p>{getUserSafeErrorMessage(events.error)}</p><Button variant="secondary" onClick={() => void events.refetch()}>Tentar carregar compromissos</Button></div> : null}
        {!events.isLoading && !events.isError && items.length === 0 ? <p className="rounded-xl border border-border bg-surface p-5">Nenhum compromisso neste período.</p> : null}
        <ul className="grid gap-3">{items.map((event) => {
          const category = categories.find((item) => item.id === event.colorId)
          const link = safeCalendarLink(event.htmlLink)
          const start = event.start?.date ?? (event.start?.dateTime ? dateTimeInZone(event.start.dateTime, zone).replace('T', ' · ') : '')
          const end = event.end?.date ? addDays(event.end.date, -1) : event.end?.dateTime ? dateTimeInZone(event.end.dateTime, zone).replace('T', ' · ') : ''
          return <li key={event.id} className="min-w-0 space-y-2 rounded-xl border border-border border-l-4 bg-surface p-4 shadow-subtle" style={{ borderLeftColor: category?.color ?? '#7e22b6' }}>
            <p className="text-xs font-semibold text-muted-foreground">{category?.label ?? 'Compromisso'}{event.recurringEventId ? ' · Recorrente' : ''}</p>
            <h2 className="break-words font-semibold">{event.summary || 'Sem título'}</h2>
            <p className="text-sm">{start}{end && end !== start ? ` até ${end}` : ''}{event.start?.date ? ' · Dia inteiro' : ''}</p>
            {event.location ? <p className="break-words text-sm">{event.location}</p> : null}
            {event.description ? <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{event.description}</p> : null}
            <div className="flex flex-wrap items-center gap-2">
              {manage ? <><Button variant="secondary" onClick={() => setEditing(event)}>Editar</Button><Button variant="ghost" onClick={() => setConfirmation(event)}>Excluir</Button></> : null}
              {link ? <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm text-primary">Abrir no Google Calendar<ExternalLink className="h-4 w-4" aria-hidden /></a> : null}
            </div>
          </li>
        })}</ul>
        {events.hasNextPage ? <Button variant="secondary" isLoading={events.isFetchingNextPage} onClick={() => void events.fetchNextPage()}>Carregar mais compromissos</Button> : null}
      </> : null}
    </>}
    {editing !== undefined ? <GoogleEventForm calendarId={status.data?.calendarId ?? ''} generation={status.data?.generation ?? ''} event={editing} date={date} timeZone={zone} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); void refresh() }} /> : null}
    <Overlay isOpen={confirmation !== null} onClose={() => { if (!pending) setConfirmation(null) }} title={confirmation === 'disconnect' ? 'Desconectar Google Calendar' : 'Excluir compromisso'}>
      <div className="space-y-4"><p>{confirmation === 'disconnect' ? 'Revogar a conexão da escola? Os eventos continuarão no Google e os registros de aulas serão preservados.' : 'Excluir este compromisso também no Google Calendar? Se for recorrente, somente esta ocorrência será excluída.'}</p>
        <div className="flex flex-wrap justify-end gap-2"><Button disabled={pending} variant="secondary" onClick={() => setConfirmation(null)}>Cancelar</Button><Button variant="danger" isLoading={pending} onClick={() => {
          if (confirmation === 'disconnect') void action('disconnect')
          else if (confirmation) void action('delete', { id: confirmation.id, etag: confirmation.etag })
        }}>Confirmar</Button></div>
        {error ? <p role="alert">{error}</p> : null}
      </div>
    </Overlay>
  </div>
}
