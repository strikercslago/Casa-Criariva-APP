import { useState } from 'react'
import { Button } from '@/shared/components/ui/Button'
import { Overlay } from '@/shared/components/ui/Overlay'
import type { CalendarEvent, EventDraft } from './calendarTypes'
import { categories } from './calendarTypes'
import { dateTimeInZone, zonedToIso } from './calendarDates'
import { addDays } from '../utils/agendaDates'
import { calendarRequest } from './calendarApi'
import { getUserSafeErrorMessage } from '@/lib/errors/AppError'

export function GoogleEventForm({ event, date, timeZone, calendarId, generation, onClose, onSaved }: {
  event: CalendarEvent | null; calendarId: string; generation: string; date: string; timeZone: string; onClose: () => void; onSaved: () => void
}) {
  const [target] = useState(() => ({ expectedCalendarId: calendarId, expectedGeneration: generation }))
  const [requestId] = useState(() => crypto.randomUUID())
  const [draft, setDraft] = useState<EventDraft>(() => ({ summary: event?.summary ?? '', description: event?.description ?? '', location: event?.location ?? '',
    allDay: Boolean(event?.start?.date), timeZone, colorId: event?.colorId ?? '8', recurrence: event ? undefined : '',
    start: event?.start?.date ?? (event?.start?.dateTime ? dateTimeInZone(event.start.dateTime, timeZone) : `${date}T09:00`),
    end: event?.end?.date ? addDays(event.end.date, -1) : event?.end?.dateTime ? dateTimeInZone(event.end.dateTime, timeZone) : `${date}T10:00`,
  }))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const fieldClass = 'w-full rounded border border-border bg-surface p-3 text-base'
  async function save() {
    setPending(true); setError('')
    try {
      const payload = { ...draft,
        start: draft.allDay ? draft.start : zonedToIso(draft.start, timeZone),
        end: draft.allDay ? addDays(draft.end, 1) : zonedToIso(draft.end, timeZone),
      }
      await calendarRequest(event ? 'update' : 'create', { ...target, event: payload, requestId, id: event?.id, etag: event?.etag })
      onSaved()
    } catch (cause) { setError(getUserSafeErrorMessage(cause)) }
    finally { setPending(false) }
  }
  return <Overlay isOpen onClose={() => { if (!pending) onClose() }} title={event ? 'Editar compromisso' : 'Novo compromisso'}>
    <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void save() }}>
      <p className="text-sm text-muted-foreground">Agenda da escola · {timeZone}. Evite incluir dados pessoais de alunos e responsáveis.</p>
      {event?.recurringEventId ? <p className="rounded bg-muted p-3 text-sm">Você está editando somente esta ocorrência. Para alterar a série, abra o Google Calendar.</p> : null}
      <label className="grid gap-1">Título<input required maxLength={250} className={fieldClass} value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} /></label>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={draft.allDay} onChange={(e) => setDraft({ ...draft, allDay: e.target.checked,
        start: e.target.checked ? draft.start.slice(0, 10) : `${draft.start}T09:00`, end: e.target.checked ? draft.end.slice(0, 10) : `${draft.end}T10:00` })} />Dia inteiro</label>
      <label className="grid gap-1">Início<input required className={fieldClass} type={draft.allDay ? 'date' : 'datetime-local'} value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} /></label>
      <label className="grid gap-1">{draft.allDay ? 'Último dia' : 'Fim'}<input required className={fieldClass} type={draft.allDay ? 'date' : 'datetime-local'} value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} /></label>
      <label className="grid gap-1">Local<input maxLength={500} className={fieldClass} value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} /></label>
      <label className="grid gap-1">Descrição<textarea maxLength={5000} className={fieldClass} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
      <label className="grid gap-1">Categoria<select className={fieldClass} value={draft.colorId} onChange={(e) => setDraft({ ...draft, colorId: e.target.value })}>
        {!categories.some((category) => category.id === draft.colorId) ? <option value={draft.colorId}>Cor do Google</option> : null}
        {categories.map((category) => <option value={category.id} key={category.id}>{category.label}</option>)}
      </select></label>
      {!event ? <label className="grid gap-1">Repetir<select className={fieldClass} value={draft.recurrence} onChange={(e) => setDraft({ ...draft, recurrence: e.target.value })}>
        <option value="">Não repetir</option><option value="daily">Diariamente</option><option value="weekly">Semanalmente</option><option value="monthly">Mensalmente</option>
      </select></label> : null}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
      <div className="flex flex-wrap justify-end gap-2"><Button disabled={pending} variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" isLoading={pending}>Salvar compromisso</Button></div>
    </form>
  </Overlay>
}
