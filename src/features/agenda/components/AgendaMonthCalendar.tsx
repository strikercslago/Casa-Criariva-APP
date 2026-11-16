import type { AgendaSession } from '../types/agendaTypes'
import { formatAgendaMonth, formatLongAgendaDate, getMonthDays, parseIsoDate } from '../utils/agendaDates'
import { attendanceStateLabels } from '../utils/agendaFormat'

type Props = {
  date: string
  today: string
  sessions: AgendaSession[]
  onOpenSession: (session: AgendaSession) => void
  onSelectDay: (date: string) => void
}

export function AgendaMonthCalendar({ date, today, sessions, onOpenSession, onSelectDay }: Props) {
  const byDay = new Map<string, AgendaSession[]>()
  for (const session of [...sessions].sort((a, b) => a.start_time.localeCompare(b.start_time) || a.class_name.localeCompare(b.class_name))) {
    const list = byDay.get(session.session_date) ?? []
    list.push(session)
    byDay.set(session.session_date, list)
  }
  return <section className="agenda-month" aria-label={`Calendário de ${formatAgendaMonth(date)}`}>
    <div className="agenda-month-weekdays" aria-hidden>
      {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day) => <span key={day}>{day}</span>)}
    </div>
    <div className="agenda-month-days">
      {getMonthDays(date).map((day) => {
        const inMonth = day.slice(0, 7) === date.slice(0, 7)
        const items = byDay.get(day) ?? []
        return <div key={day} className="agenda-month-day" data-outside={!inMonth} data-today={day === today}>
          <button type="button" className="agenda-month-date" aria-current={day === today ? 'date' : undefined}
            aria-label={`${formatLongAgendaDate(day)}${inMonth ? `: ${items.length} aulas` : ''}. Ver dia`} onClick={() => onSelectDay(day)}>
            {parseIsoDate(day).getDate()}
          </button>
          {inMonth ? <ul className="agenda-month-events">
            {items.map((session) => <li key={session.session_id}>
              <button type="button" className="agenda-month-event" data-status={session.attendance_state}
                aria-label={`${session.start_time.slice(0, 5)} ${session.class_name}. ${attendanceStateLabels[session.attendance_state]}. Ver detalhes`}
                onClick={() => onOpenSession(session)}>
                <span className="font-semibold tabular-nums">{session.start_time.slice(0, 5)}</span>
                <span>{session.class_name}</span>
                <span className="agenda-month-event-status">{attendanceStateLabels[session.attendance_state]}</span>
              </button>
            </li>)}
          </ul> : null}
        </div>
      })}
    </div>
    <p className="px-3 py-3 text-xs text-muted-foreground">Selecione uma aula para ver detalhes ou um dia para abrir a lista e fazer a chamada.</p>
  </section>
}
