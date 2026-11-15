import { AppError } from '@/lib/errors/AppError'
import { createTimeoutError } from '@/app/providers/authErrors'
import { getSupabaseClient } from '@/lib/supabase/client'
import { withTimeout } from '@/shared/utils/withTimeout'
import type {
  StudentFormValues,
} from '@/features/students/schemas/studentSchema'
import type {
  StudentListFilters,
  StudentListItem,
  StudentListResult,
  StudentRow,
  StudentStatus,
} from '@/features/students/types/studentTypes'
import { getRestoreStatus } from '@/features/students/utils/studentStatus'
import { mapStudentsError } from '@/features/students/utils/studentsErrors'

const STUDENTS_TIMEOUT_MS = 12_000

export async function findStudentMatches(name: string): Promise<StudentListItem[]> {
  const normalized = name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')
  if (normalized.length < 2) return []
  const result = await listStudents({ page: 1, pageSize: 100, search: name.trim(), status: 'all' }, 'name')
  return result.students.filter((student) => student.full_name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR') === normalized)
}
const STUDENT_LIST_SELECT = 'id, full_name, preferred_name, photo_path, birth_date, enrollment_date, status'
const STUDENT_DETAIL_SELECT =
  'id, full_name, preferred_name, photo_path, birth_date, enrollment_date, status, notes, created_by, created_at, updated_at, archived_at'

function getClient() {
  const supabase = getSupabaseClient()

  if (!supabase) {
    throw new AppError('auth', 'Supabase ainda nao esta configurado neste ambiente.')
  }

  return supabase
}

function toPayload(values: StudentFormValues) {
  return {
    birth_date: values.birth_date,
    enrollment_date: values.enrollment_date,
    full_name: values.full_name.trim(),
    notes: values.notes,
    preferred_name: values.preferred_name,
    status: values.status,
  }
}

export async function getStudentCounts() {
  const results = await Promise.all((['active', 'inactive', 'archived'] as const).map(async (status) => {
    const { count, error } = await withTimeout(
      getClient().from('students').select('id', { count: 'exact', head: true }).eq('status', status),
      STUDENTS_TIMEOUT_MS, createTimeoutError,
    )
    if (error) throw mapStudentsError(error)
    return count ?? 0
  }))
  return { active: results[0], inactive: results[1], archived: results[2], all: results.reduce((sum, count) => sum + count, 0) }
}

export async function listStudents(filters: StudentListFilters, searchScope: 'directory' | 'name' = 'directory'): Promise<StudentListResult> {
  const supabase = getClient()
  const from = (filters.page - 1) * filters.pageSize
  const to = from + filters.pageSize - 1
  const search = filters.search.trim()

  const listSelect: string = `${STUDENT_LIST_SELECT}, enrollments(status,class:classes(name,class_schedules(start_time)))${search && searchScope === 'directory' ? ', matching_classes:enrollments(class:classes!inner(id)), matching_guardians:student_guardians(guardian:guardians!inner(id))' : ''}`
  let query = supabase
    .from('students')
    .select(listSelect, { count: 'exact' })
    .order('full_name', { ascending: true })
    .order('id', { ascending: true })
    .range(from, to)

  if (filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }

  if (search.length > 0 && searchScope === 'name') {
    query = query.ilike('full_name', `%${search}%`)
  } else if (search.length > 0) {
    // Quote the root OR value so punctuation cannot become PostgREST filter syntax.
    const pattern = `%${search.replace(/[\\%_*]/g, '\\$&')}%`
    const quotedPattern = `"${pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    query = query
      .ilike('matching_classes.class.name', pattern)
      .eq('matching_classes.status', 'active')
      .ilike('matching_guardians.guardian.full_name', pattern)
      .or(`full_name.ilike.${quotedPattern},matching_classes.not.is.null,matching_guardians.not.is.null`)
  }

  const { data, error, count } = await withTimeout(query.returns<StudentListItem[]>(), STUDENTS_TIMEOUT_MS, createTimeoutError)

  if (error) {
    throw mapStudentsError(error)
  }

  const totalCount = count ?? 0

  return {
    students: (data ?? []) as StudentListItem[],
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / filters.pageSize)),
  }
}

export async function getStudent(id: string): Promise<StudentRow> {
  const supabase = getClient()

  const { data, error } = await withTimeout(
    supabase.from('students').select(STUDENT_DETAIL_SELECT).eq('id', id).maybeSingle(),
    STUDENTS_TIMEOUT_MS,
    createTimeoutError,
  )

  if (error) {
    throw mapStudentsError(error)
  }

  if (!data) {
    throw new AppError('not-found', 'Aluno nao encontrado.')
  }

  return data as StudentRow
}

export async function createStudent(values: StudentFormValues): Promise<StudentRow> {
  const supabase = getClient()

  const { data, error } = await withTimeout(
    supabase.from('students').insert(toPayload(values)).select(STUDENT_DETAIL_SELECT).single(),
    STUDENTS_TIMEOUT_MS,
    createTimeoutError,
  )

  if (error) {
    throw mapStudentsError(error)
  }

  return data as StudentRow
}

export async function updateStudent(id: string, values: StudentFormValues): Promise<StudentRow> {
  const supabase = getClient()

  const { data, error } = await withTimeout(
    supabase
      .from('students')
      .update(toPayload(values))
      .eq('id', id)
      .select(STUDENT_DETAIL_SELECT)
      .single(),
    STUDENTS_TIMEOUT_MS,
    createTimeoutError,
  )

  if (error) {
    throw mapStudentsError(error)
  }

  return data as StudentRow
}

export async function archiveStudent(id: string): Promise<StudentRow> {
  return updateStudentStatus(id, 'archived', new Date().toISOString())
}

export async function restoreStudent(id: string): Promise<StudentRow> {
  return updateStudentStatus(id, getRestoreStatus(), null)
}

export async function updateStudentStatus(
  id: string,
  status: StudentStatus,
  archivedAt: string | null = null,
): Promise<StudentRow> {
  const supabase = getClient()

  const { data, error } = await withTimeout(
    supabase
      .from('students')
      .update({ archived_at: archivedAt, status })
      .eq('id', id)
      .select(STUDENT_DETAIL_SELECT)
      .single(),
    STUDENTS_TIMEOUT_MS,
    createTimeoutError,
  )

  if (error) {
    throw mapStudentsError(error)
  }

  return data as StudentRow
}
