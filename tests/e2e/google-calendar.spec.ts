import { expect, test, type Page } from '@playwright/test'
import { mockOwnerSession } from './helpers/mockSession'

test.skip(process.env.GOOGLE_CALENDAR_E2E !== '1', 'Requires a build with VITE_GOOGLE_CALENDAR_ENABLED=true and mocked Google transport.')

async function setup(page: Page, role = 'owner', connected = true) {
  await mockOwnerSession(page)
  await page.route('**/rest/v1/user_roles**', (route) => route.fulfill({ json: [{ role }] }))
  const events = [{ id: 'existing', etag: 'v1', summary: 'Reunião existente no Google', description: 'Já cadastrada', location: 'Escola', colorId: '9',
    start: { date: '2026-11-15' }, end: { date: '2026-11-16' }, htmlLink: 'https://calendar.google.com/calendar/event?eid=existing', recurringEventId: 'series1' }]
  const calls: Array<Record<string, unknown>> = []
  const state = { connected, conflict: false, status: 'connected' }
  await page.route('**/functions/v1/google-calendar', async (route) => {
    const body = route.request().postDataJSON()
    calls.push(body)
    if (body.action === 'status') return route.fulfill({ json: { generation: 'test-generation', status: state.connected ? state.status : 'disconnected',
      email: state.connected ? 'escola@example.test' : null, calendarId: state.connected ? 'school' : null, calendarName: state.connected ? 'Agenda da escola' : null,
      timeZone: 'America/Sao_Paulo', lastSyncedAt: '2026-11-15T12:00:00Z', revision: events.length, pending: false,
    } })
    if (body.action === 'events') return route.fulfill({ json: { events } })
    if (body.action === 'sync') return route.fulfill({ json: { pending: false } })
    if (body.action === 'calendars') return route.fulfill({ json: { calendars: [{ id: 'school', summary: 'Agenda da escola' }] } })
    if (body.action === 'select-calendar') return route.fulfill({ json: { selected: true } })
    if (body.action === 'connect') return route.fulfill({ json: { url: 'https://accounts.google.com/o/oauth2/v2/auth?state=test-only' } })
    if (body.action === 'create') {
      events.push({ id: 'new', etag: 'v2', summary: body.event.summary, description: body.event.description, location: body.event.location, colorId: body.event.colorId,
        start: { date: body.event.start }, end: { date: body.event.end }, htmlLink: 'https://calendar.google.com/calendar/event?eid=new', recurringEventId: 'series2' })
      return route.fulfill({ json: { event: events.at(-1) } })
    }
    if (body.action === 'update') {
      if (state.conflict) return route.fulfill({ status: 412, json: { error: 'Este compromisso mudou no Google. Atualize a agenda antes de editar novamente.', code: 'conflict' } })
      const event = events.find((item) => item.id === body.id)!
      Object.assign(event, { summary: body.event.summary, etag: 'v3' })
      return route.fulfill({ json: { event } })
    }
    if (body.action === 'delete') { events.splice(events.findIndex((event) => event.id === body.id), 1); return route.fulfill({ json: { event: null } }) }
    if (body.action === 'disconnect') { state.connected = false; return route.fulfill({ json: { disconnected: true } }) }
    return route.fulfill({ status: 400, json: { error: 'Unexpected action' } })
  })
  await page.goto('/login')
  await page.getByLabel('Email').fill('owner@example.com')
  await page.getByLabel('Senha', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Menu Principal' })).toBeVisible()
  await page.goto('/agenda')
  await page.getByRole('button', { name: 'Compromissos Google', exact: true }).click()
  return { events, state, calls }
}

test('creates all-day recurrence, preserves concurrent edits, deletes and disconnects', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const { calls, state } = await setup(page)
  await expect(page.getByText('Reunião existente no Google', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Novo compromisso', exact: true }).click()
  const form = page.getByRole('dialog', { name: 'Novo compromisso', exact: true })
  await form.getByLabel('Título', { exact: true }).fill('Oficina de pintura')
  await form.getByLabel('Dia inteiro', { exact: true }).check()
  await form.getByLabel('Início', { exact: true }).fill('2026-11-15')
  await form.getByLabel('Último dia').fill('2026-11-16')
  await form.getByLabel('Repetir').selectOption('weekly')
  await form.getByRole('button', { name: 'Salvar compromisso' }).click()
  await expect(form).not.toBeVisible()
  const creation = calls.find((item) => item.action === 'create')!
  expect(creation.event).toMatchObject({ allDay: true, start: '2026-11-15', end: '2026-11-17', recurrence: 'weekly' })
  expect(creation).toMatchObject({ expectedCalendarId: 'school', expectedGeneration: 'test-generation' })
  const card = page.getByRole('listitem').filter({ hasText: 'Oficina de pintura' })
  await card.getByRole('button', { name: 'Editar', exact: true }).click()
  const edit = page.getByRole('dialog', { name: 'Editar compromisso' })
  await edit.getByLabel('Título', { exact: true }).fill('Oficina revisada')
  state.conflict = true
  await edit.getByRole('button', { name: 'Salvar compromisso' }).click()
  await expect(edit.getByRole('alert')).toContainText('mudou no Google')
  await expect(edit.getByLabel('Título', { exact: true })).toHaveValue('Oficina revisada')
  await edit.getByRole('button', { name: 'Cancelar', exact: true }).click()
  state.conflict = false
  await card.getByRole('button', { name: 'Excluir', exact: true }).click()
  await page.getByRole('dialog', { name: 'Excluir compromisso' }).getByRole('button', { name: 'Confirmar', exact: true }).click()
  await expect(card).toHaveCount(0)
  expect(calls.find((item) => item.action === 'delete')).toMatchObject({ etag: 'v2' })
  await page.getByRole('button', { name: 'Desconectar Google Calendar', exact: true }).click()
  await page.getByRole('dialog', { name: 'Desconectar Google Calendar' }).getByRole('button', { name: 'Confirmar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Conectar Google Calendar', exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('teacher can view Google events but has no management actions', async ({ page }) => {
  await setup(page, 'teacher')
  await expect(page.getByText('Reunião existente no Google', { exact: true })).toBeVisible()
  for (const name of ['Novo compromisso', 'Editar', 'Excluir', 'Selecionar agenda', 'Reconectar Google Calendar']) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0)
  }
  await expect(page.getByRole('link', { name: 'Abrir no Google Calendar' })).toHaveAttribute('rel', 'noopener noreferrer')
})

test('daily weekly monthly views remain responsive', async ({ page }) => {
  await setup(page)
  for (const width of [360, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const name of ['Dia', 'Semana', 'Mês']) {
      await page.getByRole('button', { name, exact: true }).click()
      await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    }
    await expect(page.getByLabel('Calendário mensal')).toBeVisible()
    await page.screenshot({ path: `test-results/google-calendar-${width}.png`, fullPage: true })
  }
})

test('connect starts external OAuth without a password form in the app', async ({ page }) => {
  await setup(page, 'owner', false)
  await page.route('https://accounts.google.com/**', (route) => route.fulfill({ contentType: 'text/html', body: '<h1>Autorização Google simulada</h1>' }))
  await page.getByRole('button', { name: 'Conectar Google Calendar', exact: true }).click()
  await expect(page).toHaveURL(/https:\/\/accounts.google.com\/o\/oauth2\/v2\/auth/)
})
