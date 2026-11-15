import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUserSafeErrorMessage } from '@/lib/errors/AppError'
import { EmptyState } from '@/shared/components/feedback/EmptyState'
import { ErrorState } from '@/shared/components/feedback/ErrorState'
import { PageHeader } from '@/shared/components/navigation/PageHeader'
import { Button } from '@/shared/components/ui/Button'
import { IconButton } from '@/shared/components/ui/IconButton'
import { TabButton, Tabs } from '@/shared/components/ui/Tabs'
import { AgendaSessionList } from '@/features/agenda/components/AgendaSessionList'
import { AttendanceDrawer } from '@/features/agenda/components/AttendanceDrawer'
import { useAgendaSessions } from '@/features/agenda/hooks/useAgenda'
import type { AgendaSession } from '@/features/agenda/types/agendaTypes'
import {
  addDays,
  formatAgendaRange,
  formatLongAgendaDate,
  getWeekRange,
  parseIsoDate,
  toIsoDate,
} from '@/features/agenda/utils/agendaDates'

type AgendaViewMode = 'day' | 'week'

export default function ClassAgendaPage() {
  const navigate = useNavigate()
  const today = useMemo(() => toIsoDate(new Date()), [])
  const [selectedDate, setSelectedDate] = useState(today)
  const [viewMode, setViewMode] = useState<AgendaViewMode>('day')
  const [selectedSession, setSelectedSession] = useState<AgendaSession | null>(null)
  const range = viewMode === 'day' ? { endDate: selectedDate, startDate: selectedDate } : getWeekRange(selectedDate)
  const sessionsQuery = useAgendaSessions(range)
  const sessions = sessionsQuery.data ?? []
  const pendingCount = sessions.filter((session) => session.attendance_state === 'pending').length
  const recordedCount = sessions.filter((session) => session.attendance_state === 'recorded').length

  function moveDate(direction: -1 | 1) {
    setSelectedDate((current) => addDays(current, viewMode === 'day' ? direction : direction * 7))
  }

  return (
    <div className="space-y-5">
      <PageHeader
        compact
        actions={
          <Button
            isLoading={sessionsQuery.isFetching}
            leftIcon={<RefreshCw className="h-4 w-4" aria-hidden />}
            onClick={() => void sessionsQuery.refetch()}
            variant="secondary"
          >
            Atualizar
          </Button>
        }
        description="Seu dia na Casa Criativa, aula por aula."
        title="Agenda"
      />

      <section className="grid gap-3 rounded-md border border-border bg-surface p-4 shadow-subtle">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CalendarDays className="h-4 w-4" aria-hidden />
              {viewMode === 'day' ? (selectedDate === today ? 'Sua agenda de hoje' : 'Agenda do dia') : 'Sua semana'}
            </p>
            <h2 className="mt-1 text-base font-semibold text-foreground">
              {viewMode === 'day' ? formatLongAgendaDate(selectedDate) : formatAgendaRange(range.startDate, range.endDate)}
            </h2>
          </div>

        </div>
        <div className="grid grid-cols-[48px_minmax(0,1fr)_48px] items-center gap-2">
          <IconButton label="Periodo anterior" onClick={() => moveDate(-1)}><ChevronLeft className="h-4 w-4" aria-hidden /></IconButton>
          <input aria-label="Ir para uma data" className="h-12 w-full min-w-0 rounded border border-border bg-surface px-2 text-center text-foreground" type="date" value={selectedDate} onChange={(event) => { if (event.target.value) setSelectedDate(event.target.value) }} />
          <IconButton label="Proximo periodo" onClick={() => moveDate(1)}><ChevronRight className="h-4 w-4" aria-hidden /></IconButton>
        </div>

        <div className="grid grid-cols-7 gap-1" aria-label="Dias da semana">
          {Array.from({ length: 7 }, (_, index) => {
            const date = addDays(getWeekRange(selectedDate).startDate, index)
            const active = date === selectedDate
            return <button key={date} type="button" aria-label={formatLongAgendaDate(date)} aria-pressed={active}
              onClick={() => { setSelectedDate(date); setViewMode('day') }}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-sm transition-colors ${active ? 'bg-primary font-semibold text-white shadow-subtle' : 'text-muted-foreground hover:bg-muted'}`}>
              <span className="text-[11px]">{['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'][index]}</span>
              <span className="text-lg font-semibold">{parseIsoDate(date).getDate()}</span>
              <span className={`h-1 w-1 rounded-full ${date === today ? (active ? 'bg-white' : 'bg-primary') : 'bg-transparent'}`} />
            </button>
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button onClick={() => setSelectedDate(today)} variant="ghost">Hoje</Button>
          <Tabs><TabButton isActive={viewMode === 'day'} onClick={() => setViewMode('day')}>Dia</TabButton><TabButton isActive={viewMode === 'week'} onClick={() => setViewMode('week')}>Semana</TabButton></Tabs>
        </div>

        <dl className="compact-metrics" aria-busy={sessionsQuery.isFetching}>
          <SummaryItem label="Aulas" value={sessionsQuery.isFetching ? '—' : String(sessions.length)} />
          <SummaryItem label="Pendentes" value={sessionsQuery.isFetching ? '—' : String(pendingCount)} />
          <SummaryItem label="Concluídas" value={sessionsQuery.isFetching ? '—' : String(recordedCount)} />
        </dl>
      </section>

      {(sessionsQuery.isLoading && !sessionsQuery.data) || sessionsQuery.isPlaceholderData ? <AgendaSkeleton /> : null}

      {sessionsQuery.isError ? (
        <ErrorState
          title="Nao foi possivel carregar a agenda."
          description={getUserSafeErrorMessage(sessionsQuery.error)}
          onRetry={() => void sessionsQuery.refetch()}
        />
      ) : null}

      {!sessionsQuery.isLoading && !sessionsQuery.isPlaceholderData && !sessionsQuery.isError && sessions.length === 0 ? (
        <EmptyState
          title="Nenhuma aula neste periodo."
          description="Escolha outra data ou confira os horários cadastrados nas turmas."
        />
      ) : null}

      {!sessionsQuery.isError && !sessionsQuery.isPlaceholderData && sessions.length > 0 ? (
        <AgendaSessionList
          onTakeAttendance={(session) => navigate(`/frequencia?session=${encodeURIComponent(session.session_id)}&date=${session.session_date}`)}
          onOpenSession={(sessionId) => {
            setSelectedSession(sessions.find((session) => session.session_id === sessionId) ?? null)
          }}
          sessions={groupSessionsForView(sessions)}
          showDates={viewMode === 'week'}
        />
      ) : null}

      <AttendanceDrawer
        onClose={() => setSelectedSession(null)}
        sessionId={selectedSession?.session_id ?? null}
        sessionSummary={selectedSession}
      />
    </div>
  )
}

function groupSessionsForView(sessions: AgendaSession[]) {
  return sessions.slice().sort((first, second) => {
    const dateOrder = first.session_date.localeCompare(second.session_date)
    if (dateOrder !== 0) {
      return dateOrder
    }

    return first.start_time.localeCompare(second.start_time) || first.class_name.localeCompare(second.class_name)
  })
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-tile">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  )
}

function AgendaSkeleton() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 4 }, (_, index) => (
        <div className="h-24 rounded-md border border-border bg-surface shadow-subtle" key={index} />
      ))}
    </div>
  )
}
