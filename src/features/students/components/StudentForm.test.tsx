import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { StudentForm } from './StudentForm'

describe('StudentForm', () => {
  it('preserves Y, accented letters and archived status while editing a name', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<StudentForm mode="edit" isSubmitting={false} onCancel={vi.fn()} onSubmit={onSubmit}
      student={{ id: 'test', full_name: 'Ignacio', status: 'archived', archived_at: '2026-01-01T00:00:00Z', birth_date: null, enrollment_date: '2026-01-01', notes: null, preferred_name: null, photo_path: null, created_by: null, created_at: '', updated_at: '' }} />)
    await user.clear(screen.getByLabelText(/^Nome completo/))
    await user.type(screen.getByLabelText(/^Nome completo/), 'Ygnacio David Ortuño')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ full_name: 'Ygnacio David Ortuño', status: 'archived' }))
  })
  it('shows friendly validation and submits normalized values', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(
      <StudentForm
        isSubmitting={false}
        mode="create"
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
    )

    await user.clear(screen.getByLabelText(/^Nome completo/))
    await user.click(screen.getByRole('button', { name: 'Cadastrar' }))
    expect(await screen.findByText('Informe o nome do aluno.')).toBeInTheDocument()

    await user.type(screen.getByLabelText(/^Nome completo/), '  Ana Beatriz  ')
    await user.type(screen.getByLabelText('Nome preferido'), 'Ana')
    await user.click(screen.getByRole('button', { name: 'Cadastrar' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        full_name: 'Ana Beatriz',
        preferred_name: 'Ana',
      }),
    )
  })
})
