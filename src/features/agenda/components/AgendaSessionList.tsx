import { ArrowRight, CheckCircle2, CircleAlert, UsersRound, XCircle } from 'lucide-react'
import { Badge } from '@/shared/components/ui/Badge'
import { Button } from '@/shared/components/ui/Button'
import type { AgendaSession } from '@/features/agenda/types/agendaTypes'
import { attendanceStateLabels, getSessionCompletionLabel } from '@/features/agenda/utils/agendaFormat'
import { formatShortAgendaDate, formatTimeRange } from '@/features/agenda/utils/agendaDates'

type AgendaSessionListProps = {
  onOpenSession: (sessionId: string) => void
  sessions: AgendaSession[]
  showDates: boolean
  onTakeAttendance?: (session: AgendaSession) => void
}

export function AgendaSessionList({ onOpenSession, onTakeAttendance, sessions, showDates }: AgendaSessionListProps) {
  return (
    <div className="grid gap-3">
      {sessions.map((session) => (
        <article
          className="record-card ui-surface rounded-md border border-border border-l-4 border-l-primary bg-surface p-4 shadow-subtle transition-colors hover:bg-muted/40"
          key={session.session_id}
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(120px,auto)_1fr_minmax(190px,auto)_auto] lg:items-center">
            <div>
              {showDates ? <p className="text-xs font-semibold uppercase text-muted-foreground">{formatShortAgendaDate(session.session_date)}</p> : null}
              <p className="mt-1 text-lg font-semibold text-foreground">{formatTimeRange(session.start_time, session.end_time)}</p>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="break-words text-base font-semibold text-foreground">{session.class_name}</h2>
                <SessionStateBadge state={session.attendance_state} />
              </div>
              <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                <UsersRound className="h-4 w-4" aria-hidden />
                {session.expected_students} aluno{session.expected_students === 1 ? '' : 's'} esperado{session.expected_students === 1 ? '' : 's'}
              </p>
            </div>

            <div className={session.recorded_count === 0 ? 'hidden text-sm lg:block' : 'text-sm'}>
              <p className="font-medium text-foreground">
                {getSessionCompletionLabel(session.expected_students, session.recorded_count)}
              </p>
              <p className="mt-1 text-muted-foreground">
                {session.present_count} presentes, {session.absent_count} faltas, {session.excused_count} justificadas
              </p>
            </div>

            <div className="flex gap-2">
            {onTakeAttendance ? <Button className="flex-1" disabled={session.status === 'cancelled'} onClick={() => onTakeAttendance(session)}>
              {session.attendance_state === 'recorded' ? 'Ver chamada' : 'Fazer chamada'}
            </Button> : null}
            <Button
              disabled={session.status === 'cancelled'}
              onClick={() => onOpenSession(session.session_id)}
              rightIcon={onTakeAttendance ? undefined : <ArrowRight className="h-4 w-4" aria-hidden />}
              variant="secondary"
            >
              {onTakeAttendance ? 'Detalhes' : 'Abrir aula'}
            </Button>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}

function SessionStateBadge({ state }: { state: AgendaSession['attendance_state'] }) {
  if (state === 'recorded') {
    return (
      <Badge tone="success">
        <CheckCircle2 className="mr-1 h-3.5 w-3.5" aria-hidden />
        {attendanceStateLabels[state]}
      </Badge>
    )
  }

  if (state === 'cancelled') {
    return (
      <Badge tone="danger">
        <XCircle className="mr-1 h-3.5 w-3.5" aria-hidden />
        {attendanceStateLabels[state]}
      </Badge>
    )
  }

  return (
    <Badge tone={state === 'pending' ? 'warning' : 'neutral'}>
      <CircleAlert className="mr-1 h-3.5 w-3.5" aria-hidden />
      {attendanceStateLabels[state]}
    </Badge>
  )
}
