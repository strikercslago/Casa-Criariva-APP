import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  archiveStudent,
  createStudent,
  getStudent,
  listStudents,
  restoreStudent,
  updateStudent,
  updateStudentStatus,
} from '@/features/students/api/studentsApi'
import { studentsKeys } from '@/features/students/hooks/studentsKeys'
import { dashboardKeys } from '@/features/dashboard/hooks/dashboardKeys'
import type { StudentFormValues } from '@/features/students/schemas/studentSchema'
import type { StudentListFilters, StudentRow } from '@/features/students/types/studentTypes'

const STUDENTS_STALE_TIME_MS = 90_000

export function useStudentsList(filters: StudentListFilters) {
  return useQuery({
    queryKey: studentsKeys.list(filters),
    queryFn: () => listStudents(filters),
    placeholderData: keepPreviousData,
    staleTime: STUDENTS_STALE_TIME_MS,
  })
}

export function useStudentDetail(id: string | null) {
  return useQuery({
    queryKey: id ? studentsKeys.detail(id) : studentsKeys.detail('none'),
    queryFn: () => getStudent(id ?? ''),
    enabled: Boolean(id),
    staleTime: STUDENTS_STALE_TIME_MS,
  })
}

export function useCreateStudent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createStudent,
    onSuccess: (student) => {
      queryClient.setQueryData(studentsKeys.detail(student.id), student)
      void queryClient.invalidateQueries({ queryKey: studentsKeys.lists() })
      void queryClient.invalidateQueries({ queryKey: studentsKeys.counts() })
    },
  })
}

export function useUpdateStudent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: StudentFormValues }) =>
      updateStudent(id, values),
    onSuccess: (student) => updateStudentsCache(queryClient, student),
  })
}

export function useArchiveStudent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: archiveStudent,
    onSuccess: (student) => updateStudentsCache(queryClient, student),
  })
}

export function useRestoreStudent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: restoreStudent,
    onSuccess: (student) => updateStudentsCache(queryClient, student),
  })
}

export function useChangeStudentStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'inactive' }) => updateStudentStatus(id, status),
    onSuccess: (student) => updateStudentsCache(queryClient, student),
  })
}

function updateStudentsCache(queryClient: ReturnType<typeof useQueryClient>, student: StudentRow) {
  queryClient.setQueryData(studentsKeys.detail(student.id), student)
  void queryClient.invalidateQueries({ queryKey: studentsKeys.lists() })
  void queryClient.invalidateQueries({ queryKey: studentsKeys.counts() })
  void queryClient.invalidateQueries({ queryKey: dashboardKeys.operationsRoot() })
}
