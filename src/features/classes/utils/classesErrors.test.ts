import { expect, it } from 'vitest'
import { mapClassesError } from './classesErrors'

function conflict(constraint: string) {
  return mapClassesError({ name: 'PostgrestError', code: '23505', message: `duplicate key value violates unique constraint "${constraint}"`, details: '', hint: '' })
}

it('identifies actual duplicate enrollments', () => {
  expect(conflict('enrollments_active_student_class_uidx').message).toContain('matricula ativa')
})

it('does not blame a student for a schedule occurrence conflict', () => {
  const error = conflict('class_sessions_manual_occurrence_uidx')
  expect(error.message).toContain('aulas já registradas')
  expect(error.message).not.toContain('aluno')
})

it('does not guess the cause of an unidentified uniqueness violation', () => {
  expect(conflict('other_constraint').message).toContain('registro existente')
  expect(conflict('other_constraint').message).not.toContain('matricula')
})
