import { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { SearchInput } from '@/shared/components/ui/SearchInput'
import { cn } from '@/shared/utils/cn'
import type { StudentStatusFilter } from '@/features/students/types/studentTypes'
import { studentStatusOptions } from '@/features/students/utils/studentStatus'

type StudentFiltersProps = {
  search: string
  status: StudentStatusFilter
  onSearchChange: (value: string) => void
  onStatusChange: (value: StudentStatusFilter) => void
}

export function StudentFilters({
  search,
  status,
  onSearchChange,
  onStatusChange,
}: StudentFiltersProps) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2"><div className="min-w-0 flex-1">
        <SearchInput
          label="Buscar aluno"
          name="student-search"
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar por nome, turma ou responsável"
          value={search}
        />
      </div><button type="button" className="student-filter-toggle" aria-label="Filtros de alunos" aria-expanded={expanded} aria-controls="student-status-filters" onClick={() => setExpanded(!expanded)}><SlidersHorizontal className="h-5 w-5" aria-hidden /></button></div>

      <div id="student-status-filters" className={cn(expanded ? 'grid' : 'hidden', 'min-w-0 grid-cols-2 gap-2 sm:grid-cols-4')} role="tablist" aria-label="Filtro de status">
        {studentStatusOptions.map((option) => (
          <button
            aria-selected={status === option.value}
            className={cn(
              'min-h-12 min-w-0 rounded border px-3 text-sm font-medium transition-colors',
              status === option.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
            key={option.value}
            onClick={() => onStatusChange(option.value)}
            role="tab"
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
      {!expanded && status !== 'all' ? <p className="text-sm text-purple-800">Filtro: {studentStatusOptions.find((option) => option.value === status)?.label}</p> : null}
    </div>
  )
}
