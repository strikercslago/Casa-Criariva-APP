import { ArrowRight } from 'lucide-react'
import { IconButton } from '@/shared/components/ui/IconButton'
import { Table, Td, Th } from '@/shared/components/ui/Table'
import type { StudentListItem } from '@/features/students/types/studentTypes'
import { formatStudentDate } from '@/features/students/utils/studentDates'
import { StudentAvatar } from './StudentAvatar'
import { StudentStatusBadge } from './StudentStatusBadge'

type StudentsListProps = {
  students: StudentListItem[]
  onOpenStudent: (id: string) => void
  onPrefetchStudent?: (id: string) => void
}

export function StudentsList({ students, onOpenStudent, onPrefetchStudent }: StudentsListProps) {
  return (
    <>
      <div className="hidden md:block">
        <Table>
          <thead>
            <tr>
              <Th>Aluno</Th>
              <Th>Matricula</Th>
              <Th>Nascimento</Th>
              <Th>Status</Th>
              <Th className="w-16 text-right">Abrir</Th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr
                className="transition-colors hover:bg-muted/60"
                key={student.id}
                onMouseEnter={() => onPrefetchStudent?.(student.id)}
              >
                <Td className="text-foreground">
                  <div className="flex items-center gap-3">
                    <StudentAvatar size="sm" student={student} />
                    <div className="min-w-0">
                      <button
                        className="text-left font-medium text-foreground hover:text-primary"
                        onFocus={() => onPrefetchStudent?.(student.id)}
                        onClick={() => onOpenStudent(student.id)}
                        type="button"
                      >
                        {student.full_name}
                      </button>
                      {student.preferred_name ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Nome preferido: {student.preferred_name}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </Td>
                <Td>{formatStudentDate(student.enrollment_date)}</Td>
                <Td>{formatStudentDate(student.birth_date)}</Td>
                <Td>
                  <StudentStatusBadge status={student.status} />
                </Td>
                <Td className="text-right">
                  <IconButton
                    className="ml-auto h-9 w-9"
                    label={`Abrir ${student.full_name}`}
                    onFocus={() => onPrefetchStudent?.(student.id)}
                    onClick={() => onOpenStudent(student.id)}
                  >
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </IconButton>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      <div className="grid gap-2 md:hidden">
        {students.map((student) => (
          <button key={student.id} type="button" aria-label={`Abrir ${student.full_name}`}
            className="flex w-full items-center gap-3 rounded-md border border-border bg-surface p-4 text-left shadow-subtle transition-colors active:bg-muted"
            onFocus={() => onPrefetchStudent?.(student.id)} onClick={() => onOpenStudent(student.id)}>
            <StudentAvatar size="md" student={student} />
            <span className="min-w-0 flex-1">
              <span className="block break-words text-base font-semibold text-foreground">{student.full_name}</span>
              {student.preferred_name ? <span className="mt-0.5 block text-sm text-muted-foreground">{student.preferred_name}</span> : null}
              <span className="mt-2 inline-flex"><StudentStatusBadge status={student.status} /></span>
            </span>
            <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        ))}
      </div>
    </>
  )
}
