import { useQuery } from '@tanstack/react-query'
import { findStudentMatches } from '../api/studentsApi'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { getStudentStatusLabel } from '../utils/studentStatus'

export function StudentDuplicateNotice({ name }: { name: string }) {
  const search = useDebouncedValue(name, 350)
  const query = useQuery({ queryKey: ['students', 'duplicates', search], queryFn: () => findStudentMatches(search), enabled: search.trim().length >= 2 })
  if (!query.data?.length) return null
  return <div role="status" className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
    <p className="font-semibold">Já existe cadastro com este nome</p>
    <p className="mt-1">Confira antes de cadastrar novamente. Um aluno arquivado pode ser restaurado.</p>
    <ul className="mt-2 space-y-1">{query.data.map((student) => <li key={student.id}>{student.full_name} · {getStudentStatusLabel(student.status)}</li>)}</ul>
  </div>
}
