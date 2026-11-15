import { useQueryClient } from '@tanstack/react-query'
import { Plus, RefreshCw, LayoutGrid, List, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getUserSafeErrorMessage } from '@/lib/errors/AppError'
import { EmptyState } from '@/shared/components/feedback/EmptyState'
import { ErrorState } from '@/shared/components/feedback/ErrorState'
import { PageHeader } from '@/shared/components/navigation/PageHeader'
import { Button } from '@/shared/components/ui/Button'
import { Pagination } from '@/shared/components/ui/Pagination'
import { EnrollmentWizard } from '@/features/students/components/EnrollmentWizard'
import { StudentDetailDrawer } from '@/features/students/components/StudentDetailDrawer'
import { StudentFilters } from '@/features/students/components/StudentFilters'
import { StudentDirectory, type StudentView } from '@/features/students/components/StudentDirectory'
import { StudentIndicators } from '@/features/students/components/StudentIndicators'
import { StudentsSkeleton } from '@/features/students/components/StudentsSkeleton'
import { getStudent } from '@/features/students/api/studentsApi'
import { useDebouncedValue } from '@/features/students/hooks/useDebouncedValue'
import { useStudentsList } from '@/features/students/hooks/useStudents'
import { studentsKeys } from '@/features/students/hooks/studentsKeys'
import type { StudentStatusFilter } from '@/features/students/types/studentTypes'

const PAGE_SIZE = 20

export default function StudentsPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [view, setView] = useState<StudentView>(() => {
    try { return sessionStorage.getItem('students-view') === 'list' ? 'list' : 'cards' } catch { return 'cards' }
  })
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StudentStatusFilter>('all')
  const [page, setPage] = useState(1)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const debouncedSearch = useDebouncedValue(search, 320)
  const selectedStudentId = searchParams.get('aluno')

  const filters = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      search: debouncedSearch,
      status,
    }),
    [debouncedSearch, page, status],
  )
  const studentsQuery = useStudentsList(filters)
  const totalCount = studentsQuery.data?.totalCount ?? 0
  const totalPages = studentsQuery.data?.totalPages ?? 1
  const students = studentsQuery.data?.students ?? []
  const isInitialLoading = studentsQuery.isLoading && !studentsQuery.data
  const hasSearch = debouncedSearch.trim().length > 0
  const hasFilters = hasSearch || status !== 'all'

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(1)
  }

  function handleStatusChange(value: StudentStatusFilter) {
    setStatus(value)
    setPage(1)
  }

  function handleOpenStudent(id: string) {
    setSearchParams({ aluno: id })
  }

  function handlePrefetchStudent(id: string) {
    void queryClient.prefetchQuery({
      queryFn: () => getStudent(id),
      queryKey: studentsKeys.detail(id),
      staleTime: 90_000,
    })
  }

  function handleCloseStudent() {
    setSearchParams({})
  }

  function handleEnrollmentCompleted(studentId: string) {
    setPage(1)
    setSearchParams({ aluno: studentId })
  }

  return (
    <div className="students-page space-y-4">
      <div className="student-heading"><Users aria-hidden className="student-heading-icon" /><PageHeader
        compact
        title="Alunos"
        description="Visualize seus alunos de forma prática."
        actions={
          <Button leftIcon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setIsCreateOpen(true)}>
            Novo aluno
          </Button>
        }
      /></div>

      <StudentIndicators />

      <StudentFilters
        onSearchChange={handleSearchChange}
        onStatusChange={handleStatusChange}
        search={search}
        status={status}
      />
      <div className="student-view-switch" role="group" aria-label="Visualização dos alunos">
        {([{ value: 'cards', label: 'Cartões', Icon: LayoutGrid }, { value: 'list', label: 'Lista', Icon: List }] as const).map(({ value, label, Icon }) => (
          <button key={value} type="button" aria-pressed={view === value} onClick={() => {
            setView(value)
            try { sessionStorage.setItem('students-view', value) } catch { /* Session storage may be unavailable. */ }
          }}><Icon className="h-4 w-4" aria-hidden />{label}</button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground" aria-live="polite">
        <span>{studentsQuery.isFetching ? 'Atualizando…' : `${totalCount} ${totalCount === 1 ? 'aluno encontrado' : 'alunos encontrados'}`}</span>
        <Button variant="ghost" leftIcon={<RefreshCw className="h-4 w-4" aria-hidden />} isLoading={studentsQuery.isFetching} onClick={() => {
          void studentsQuery.refetch()
          void queryClient.invalidateQueries({ queryKey: studentsKeys.counts() })
        }}>Atualizar</Button>
      </div>

      {isInitialLoading ? <StudentsSkeleton /> : null}

      {studentsQuery.isError ? (
        <ErrorState
          title="Nao foi possivel carregar alunos."
          description={getUserSafeErrorMessage(studentsQuery.error)}
          onRetry={() => void studentsQuery.refetch()}
        />
      ) : null}

      {!isInitialLoading && !studentsQuery.isError && students.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'Nenhum aluno encontrado para essa busca.' : 'Nenhum aluno cadastrado ainda.'}
          description={
            hasFilters
              ? 'Ajuste a busca ou o filtro de status para ver outros alunos.'
              : 'Cadastre o primeiro aluno para iniciar o modulo com dados reais.'
          }
          action={
            hasFilters ? null : (
              <Button leftIcon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setIsCreateOpen(true)}>
                Cadastrar primeiro aluno
              </Button>
            )
          }
        />
      ) : null}

      {!isInitialLoading && !studentsQuery.isError && students.length > 0 ? (
        <div className="space-y-3">
          <StudentDirectory view={view} students={students} onOpen={handleOpenStudent}
            onPrefetch={handlePrefetchStudent} onActions={(id) => setSearchParams({ aluno: id, opcoes: '1' })} />
          <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-3 shadow-subtle sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Pagina {page} de {totalPages}, {totalCount} aluno{totalCount === 1 ? '' : 's'}.
            </p>
            <Pagination
              onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
              onPrevious={() => setPage((current) => Math.max(1, current - 1))}
              page={page}
              totalPages={totalPages}
            />
          </div>
        </div>
      ) : null}

      <EnrollmentWizard
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCompleted={handleEnrollmentCompleted}
      />

      <StudentDetailDrawer onClose={handleCloseStudent} studentId={selectedStudentId} showActions={searchParams.get('opcoes') === '1'} />
    </div>
  )
}
