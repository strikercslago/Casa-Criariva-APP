import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import SettingsPage from './SettingsPage'

const settings = vi.hoisted(() => ({ organization_name: 'Casa Criativa', display_name: 'Casa Criativa', phone: '', email: '', timezone: 'America/Sao_Paulo', locale: 'pt-BR', currency_code: 'BRL', default_page_size: 20 }))
const update = vi.hoisted(() => vi.fn(async (draft) => ({ ...settings, ...draft })))
vi.mock('@/app/providers/AuthProvider', () => ({ useAuth: () => ({ roles: ['owner'] }) }))
vi.mock('../api/settingsApi', () => ({
  getApplicationSettings: async () => settings,
  updateApplicationSettings: update,
}))

it('keeps organization editing and navigation without exposing permissions or audit', async () => {
  const user = userEvent.setup()
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={['/configuracoes']}><SettingsPage /></MemoryRouter>
  </QueryClientProvider>)
  const name = await screen.findByLabelText('Nome')
  expect(screen.getByRole('link', { name: 'Seguranca' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Usuarios' })).toBeInTheDocument()
  expect(screen.queryByText(/Matriz de permissoes/)).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Auditoria' })).not.toBeInTheDocument()
  await user.clear(name)
  await user.type(name, 'Casa Criativa Escola')
  await user.click(screen.getByRole('button', { name: 'Salvar' }))
  expect(update).toHaveBeenCalledWith({ organization_name: 'Casa Criativa Escola' }, expect.anything())
})
