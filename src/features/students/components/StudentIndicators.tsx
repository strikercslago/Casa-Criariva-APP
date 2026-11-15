import { useQuery } from '@tanstack/react-query'
import { Archive, UserCheck, UserMinus, Users } from 'lucide-react'
import { getStudentCounts } from '../api/studentsApi'
import { studentsKeys } from '../hooks/studentsKeys'

const indicators = [
  { key: 'all', label: 'Total', Icon: Users },
  { key: 'active', label: 'Ativos', Icon: UserCheck },
  { key: 'inactive', label: 'Inativos', Icon: UserMinus },
  { key: 'archived', label: 'Arquivados', Icon: Archive },
] as const

export function StudentIndicators() {
  const counts = useQuery({ queryKey: studentsKeys.counts(), queryFn: getStudentCounts, staleTime: 90_000 })
  return <section aria-label="Resumo dos alunos">
    <dl className="student-indicators">{indicators.map(({ key, label, Icon }, index) => <div className={`student-indicator student-indicator-${index}`} key={key}>
      <dt><Icon className="mx-auto mb-1 h-5 w-5" aria-hidden /><span>{label}</span></dt>
      <dd>{counts.data?.[key] ?? '—'}</dd>
    </div>)}</dl>
    {counts.isError ? <p className="mt-2 text-sm text-muted-foreground">Não foi possível carregar os indicadores. <button className="underline" onClick={() => void counts.refetch()}>Tentar novamente</button></p> : null}
  </section>
}
