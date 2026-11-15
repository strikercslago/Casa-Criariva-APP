import { ArrowRight, MoreHorizontal } from 'lucide-react'
import type { StudentListItem } from '../types/studentTypes'
import { StudentAvatar } from './StudentAvatar'
import { StudentStatusBadge } from './StudentStatusBadge'

export type StudentView = 'cards' | 'list'

function studentClassLabel(student: StudentListItem) {
  return (student.enrollments ?? []).filter((enrollment) => enrollment.status === 'active' && enrollment.class)
    .map(({ class: group }) => {
      if (!group) return ''
      const shifts = [...new Set(group.class_schedules.map(({ start_time }) => {
        const hour = Number(start_time.slice(0, 2))
        return hour < 12 ? 'Manhã' : hour < 18 ? 'Tarde' : 'Noite'
      }))]
      return [group.name, shifts.join(' / ')].filter(Boolean).join(' · ')
    }).join('; ') || 'Sem turma vinculada'
}

export function StudentDirectory({ students, view, onOpen, onActions, onPrefetch }: {
  students: StudentListItem[]
  view: StudentView
  onOpen: (id: string) => void
  onActions: (id: string) => void
  onPrefetch: (id: string) => void
}) {
  return <ul className={`student-directory student-directory--${view}`} aria-label="Alunos encontrados">
    {students.map((student, index) => <li className={`student-directory-item student-pastel-${index % 4}`} key={student.id}>
      <button type="button" className="student-directory-open" aria-label={`Abrir ${student.full_name}`}
        onClick={() => onOpen(student.id)} onFocus={() => onPrefetch(student.id)} onMouseEnter={() => onPrefetch(student.id)}>
        <StudentAvatar size="md" className={view === 'cards' ? 'h-16 w-16 text-lg' : ''} student={student} />
        <span className="student-directory-info">
          <span className="student-directory-name">{student.full_name}</span>
          <span className="student-directory-class">{studentClassLabel(student)}</span>
          <span className="mt-2 inline-flex"><StudentStatusBadge status={student.status} /></span>
        </span>
        {view === 'list' ? <ArrowRight className="h-4 w-4 shrink-0" aria-hidden /> : null}
      </button>
      <button type="button" className="student-directory-actions" aria-label={`Opções de ${student.full_name}`}
        aria-haspopup="dialog" onClick={() => onActions(student.id)}><MoreHorizontal className="h-5 w-5" aria-hidden /></button>
    </li>)}
  </ul>
}
