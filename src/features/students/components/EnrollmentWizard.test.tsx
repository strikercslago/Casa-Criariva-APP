import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { ToastProvider } from '@/shared/components/feedback/Toast'
import { EnrollmentWizard } from './EnrollmentWizard'

const complete = vi.hoisted(() => vi.fn())
vi.mock('@/app/providers/AuthProvider', () => ({ useAuth: () => ({ roles: ['teacher'] }) }))
vi.mock('../api/studentsApi', () => ({ findStudentMatches: async () => [] }))
vi.mock('../hooks/useStudent360', () => ({
  useClassesForEnrollment: () => ({ data: [] }),
  useCompleteStudentEnrollment: () => ({ mutateAsync: complete, isPending: false }),
  useGuardianCandidates: () => ({ data: [] }),
}))

it('limits teacher registration to student data and reuses the request ID after a failed response', async () => {
  complete.mockRejectedValueOnce(new Error('Lost response')).mockResolvedValueOnce({ studentId: 'existing-student' })
  const user = userEvent.setup()
  const completed = vi.fn()
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ToastProvider>
    <EnrollmentWizard isOpen onClose={vi.fn()} onCompleted={completed} />
  </ToastProvider></QueryClientProvider>)
  await user.type(screen.getByLabelText(/^Nome completo/), 'Yasmin Ortuño')
  await user.click(screen.getByRole('button', { name: 'Proximo' }))
  await user.click(screen.getByRole('button', { name: 'Concluir matricula' }))
  await waitFor(() => expect(complete).toHaveBeenCalledTimes(1))
  expect(await screen.findByText(/Nao foi possivel concluir a matricula/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Concluir matricula' }))
  await waitFor(() => expect(completed).toHaveBeenCalledWith('existing-student'))
  expect(complete.mock.calls[1][0].requestId).toBe(complete.mock.calls[0][0].requestId)
  expect(complete.mock.calls[0][0].values).toMatchObject({ guardians: [], billing: { enabled: false }, class_step: { mode: 'none' }, student: { full_name: 'Yasmin Ortuño' } })
})
