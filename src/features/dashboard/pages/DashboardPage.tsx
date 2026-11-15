import { AlertTriangle, ArrowRight, CalendarDays, CreditCard, GraduationCap, RefreshCw, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/shared/components/navigation/PageHeader'
import { useAuth } from '@/app/providers/AuthProvider'
import { Badge } from '@/shared/components/ui/Badge'
import { Button } from '@/shared/components/ui/Button'
import { Card } from '@/shared/components/ui/Card'
import { getCurrentReferenceMonth, formatReferenceMonth } from '@/features/finance/utils/financeDates'
import { formatMoney } from '@/features/finance/utils/financeFormat'
import { toIsoDate } from '@/features/billing/utils/billingDates'
import { useDashboardAttention, useDashboardOperations, useDashboardToday } from '@/features/dashboard/hooks/useDashboard'
import { formatDate, formatPercent, formatTime } from '@/features/dashboard/utils/dashboardFormat'

const today = toIsoDate(new Date())
const referenceMonth = getCurrentReferenceMonth()

export default function DashboardPage() {
  const auth = useAuth()
  const isTeacherOnly = auth.roles.includes('teacher') && !auth.roles.includes('admin') && !auth.roles.includes('owner')
  const todayQuery = useDashboardToday(today, !isTeacherOnly)
  const attentionQuery = useDashboardAttention(today, !isTeacherOnly)
  const operationsQuery = useDashboardOperations(referenceMonth, !isTeacherOnly)
  const todayData = todayQuery.data
  const attention = attentionQuery.data ?? []
  const operations = operationsQuery.data

  if (isTeacherOnly) {
    return <TeacherDashboard />
  }

  return (
    <div className="space-y-5">
      <PageHeader
        actions={
          <Button
            isLoading={todayQuery.isFetching || attentionQuery.isFetching || operationsQuery.isFetching}
            leftIcon={<RefreshCw className="h-4 w-4" aria-hidden />}
            onClick={() => {
              void todayQuery.refetch()
              void attentionQuery.refetch()
              void operationsQuery.refetch()
            }}
            variant="secondary"
          >
            Atualizar
          </Button>
        }
        description="Acompanhe o dia e o que precisa da sua atenção."
        title="Inicio"
      />

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]" aria-label="Prioridade operacional">
        <Card className="border-primary/25">
          <SectionHeader icon={<CalendarDays className="h-5 w-5" aria-hidden />} title={`Hoje - ${formatDate(today)}`} />
          {todayQuery.isLoading ? <BlockSkeleton /> : (
            <div className="mt-4 grid gap-4">
              <dl className="compact-metrics">
                <Metric label="Aulas" value={todayData?.sessions_count ?? 0} />
                <Metric label="Alunos" value={todayData?.expected_students ?? 0} />
                <Metric label="Pendentes" tone={(todayData?.pending_sessions_count ?? 0) > 0 ? 'warning' : undefined} value={todayData?.pending_sessions_count ?? 0} />
              </dl>
              <div className="space-y-3">
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary">Próxima aula</p>
                  {todayData?.next_session_class_name ? (
                    <div className="mt-2">
                      <p className="text-base font-semibold text-foreground">{formatTime(todayData.next_session_start)} - {todayData.next_session_class_name}</p>
                      <p className="text-sm text-muted-foreground">{todayData.next_session_expected_students} alunos esperados</p>
                    </div>
                  ) : <p className="mt-2 text-sm text-muted-foreground">Nenhuma aula prevista.</p>}
                </div>
                <div className="rounded border border-border bg-background p-3">
                  <p className="text-sm text-muted-foreground">Evento hoje</p>
                  {todayData?.next_event_name ? <p className="mt-2 font-semibold text-foreground">{formatTime(todayData.next_event_start)} - {todayData.next_event_name}</p> : <p className="mt-2 text-sm text-muted-foreground">Nenhum evento hoje.</p>}
                </div>
                <LinkButton to="/agenda">Abrir Agenda</LinkButton>
              </div>
            </div>
          )}
        </Card>

        <Card>
          <SectionHeader icon={<AlertTriangle className="h-5 w-5" aria-hidden />} title="Precisa de atencao" />
          {attentionQuery.isLoading ? <BlockSkeleton /> : attention.length ? (
            <div className="mt-4 grid gap-2">
              {attention.map((item) => (
                <Link className="rounded border border-border bg-background p-3 transition-colors hover:border-primary/40 hover:bg-primary/5" key={item.kind} to={item.href || '/'}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{item.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                    </div>
                    {item.amount ? <Badge tone="danger">{formatMoney(item.amount)}</Badge> : <Badge tone={item.kind === 'full_classes' ? 'primary' : 'warning'}>{item.count_value}</Badge>}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded border border-border bg-background p-3 text-sm text-muted-foreground">Nada critico para hoje.</p>
          )}
        </Card>
      </section>

      <details className="rounded-md border border-border bg-surface p-4"><summary className="cursor-pointer text-base font-semibold">Resumo do mês <span className="ml-1 text-xs font-normal text-muted-foreground">{formatReferenceMonth(referenceMonth)}</span></summary><div className="mt-4 space-y-4">
      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]" aria-label="Resumo gerencial">
        <Card>
          <SectionHeader icon={<CreditCard className="h-5 w-5" aria-hidden />} title={`Financeiro - ${formatReferenceMonth(referenceMonth)}`} />
          {operationsQuery.isLoading ? <BlockSkeleton /> : (
            <div className="mt-4 space-y-4">
              <div className="metric-grid">
                <Metric label="Entradas recebidas" tone="success" value={formatMoney(operations?.cash_in ?? 0)} />
                <Metric label="Saidas pagas" tone="danger" value={formatMoney(operations?.cash_out ?? 0)} />
                <Metric label="Resultado de caixa" value={formatMoney(operations?.result_amount ?? 0)} />
                <Metric label="A receber" value={formatMoney(operations?.receivable_amount ?? 0)} />
                <Metric label="A pagar" value={formatMoney(operations?.payable_amount ?? 0)} />
                <Metric label="Mensalidades vencidas" tone={(operations?.overdue_billing_count ?? 0) > 0 ? 'warning' : undefined} value={formatMoney(operations?.overdue_billing_amount ?? 0)} />
              </div>
              <LinkButton to="/financeiro">Abrir Financeiro</LinkButton>
            </div>
          )}
        </Card>

        <Card>
          <SectionHeader icon={<Users className="h-5 w-5" aria-hidden />} title="Alunos e turmas" />
          {operationsQuery.isLoading ? <BlockSkeleton /> : (
            <div className="mt-4 space-y-4">
              <div className="metric-grid">
                <Metric label="Alunos ativos" value={operations?.active_students_count ?? 0} />
                <Metric label="Novos no mes" value={operations?.new_students_count ?? 0} />
                <Metric label="Saidas no mes" value={operations?.archived_students_count ?? 0} />
                <Metric label="Variacao liquida" value={signedNumber(operations?.net_students_change ?? 0)} />
              </div>
              <div className="metric-grid">
                <Metric label="Turmas ativas" value={operations?.active_classes_count ?? 0} />
                <Metric label="Ocupacao global" value={formatPercent(operations?.class_occupancy_rate)} />
                <Metric label="Turmas lotadas" value={operations?.full_classes_count ?? 0} />
                <Metric label="Vagas disponiveis" value={operations?.available_spots ?? 0} />
              </div>
              <div className="flex flex-wrap gap-2">
                <LinkButton to="/alunos">Abrir Alunos</LinkButton>
                <LinkButton to="/turmas">Abrir Turmas</LinkButton>
              </div>
            </div>
          )}
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Operacao do mes">
        <MiniSection
          icon={<GraduationCap className="h-5 w-5" aria-hidden />}
          isLoading={operationsQuery.isLoading}
          metrics={[
            ['Frequencia media', formatPercent(operations?.attendance_rate)],
            ['Presencas', operations?.attendance_present_count ?? 0],
            ['Faltas', operations?.attendance_absent_count ?? 0],
            ['Justificadas', operations?.attendance_excused_count ?? 0],
            ['Aulas pendentes', operations?.attendance_pending_sessions ?? 0],
          ]}
          title="Frequencia"
          to="/agenda"
        />
        <MiniSection
          icon={<CalendarDays className="h-5 w-5" aria-hidden />}
          isLoading={operationsQuery.isLoading}
          metrics={[
            ['Eventos proximos', operations?.upcoming_events_count ?? 0],
            ['Proximo evento', operations?.next_event_name || 'Nenhum'],
            ['Data', operations?.next_event_date ? formatDate(operations.next_event_date) : '-'],
          ]}
          title="Eventos"
          to="/eventos"
        />
      </section>

      </div></details>
    </div>
  )
}

function TeacherDashboard() {
  return (
    <div className="space-y-5">
      <PageHeader
        description="Visao operacional para acompanhar aulas, turmas e chamadas."
        title="Inicio"
      />
      <section className="grid gap-4 md:grid-cols-3" aria-label="Atalhos operacionais">
        <Card>
          <SectionHeader icon={<CalendarDays className="h-5 w-5" aria-hidden />} title="Agenda" />
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Acompanhe aulas previstas e rotina do dia.</p>
          <LinkButton to="/agenda">Abrir Agenda</LinkButton>
        </Card>
        <Card>
          <SectionHeader icon={<Users className="h-5 w-5" aria-hidden />} title="Turmas" />
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Consulte turmas e informacoes operacionais.</p>
          <LinkButton to="/turmas">Abrir Turmas</LinkButton>
        </Card>
        <Card>
          <SectionHeader icon={<GraduationCap className="h-5 w-5" aria-hidden />} title="Frequencia" />
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Registre presencas, faltas e justificativas.</p>
          <LinkButton to="/frequencia">Abrir Frequencia</LinkButton>
        </Card>
      </section>
    </div>
  )
}

function SectionHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return <div className="flex items-center gap-2 text-foreground">{icon}<h2 className="text-base font-semibold">{title}</h2></div>
}

function Metric({ label, tone, value }: { label: string; tone?: 'danger' | 'success' | 'warning'; value: ReactNode }) {
  const toneClass = tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-amber-700' : 'text-foreground'
  return <div className="metric-tile"><dt>{label}</dt><dd className={toneClass}>{value}</dd></div>
}

function LinkButton({ to, children }: { children: ReactNode; to: string }) {
  return <Link className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded border border-border bg-surface px-3 text-sm font-medium text-foreground shadow-subtle transition-colors hover:bg-muted" to={to}>{children}<ArrowRight className="h-4 w-4" aria-hidden /></Link>
}

function MiniSection({ icon, isLoading, metrics, title, to }: { icon: ReactNode; isLoading: boolean; metrics: Array<[string, ReactNode]>; title: string; to: string }) {
  return (
    <Card>
      <SectionHeader icon={icon} title={title} />
      {isLoading ? <BlockSkeleton /> : (
        <div className="mt-4 space-y-3">
          <dl className="metric-grid">
            {metrics.map(([label, value]) => <Metric key={label} label={label} value={value} />)}
          </dl>
          <LinkButton to={to}>Abrir</LinkButton>
        </div>
      )}
    </Card>
  )
}

function BlockSkeleton() {
  return <div className="mt-4 grid gap-2"><div className="h-14 rounded bg-muted" /><div className="h-14 rounded bg-muted" /><div className="h-10 rounded bg-muted" /></div>
}

function signedNumber(value: number) {
  return value > 0 ? `+${value}` : String(value)
}
