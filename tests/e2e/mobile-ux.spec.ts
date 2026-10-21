import { expect, test, type Page } from '@playwright/test'
import { mockOwnerSession } from './helpers/mockSession'

const session = { session_id: 'session-mobile', class_id: 'class-mobile', schedule_id: 'schedule-mobile', class_name: 'Ateliê de pintura', session_date: '2026-10-21', start_time: '14:00:00', end_time: '15:30:00', status: 'planned', notes: null, attendance_state: 'pending', expected_students: 3, recorded_count: 0, present_count: 0, absent_count: 0, excused_count: 0 }
const students = ['Ana Beatriz de Oliveira', 'João Pedro Santos', 'Mariana Costa'].map((name, index) => ({ id: `student-${index}`, full_name: name, preferred_name: null, photo_path: null, status: 'active', birth_date: '2018-04-03', enrollment_date: '2026-02-01', notes: null }))

async function setup(page: Page) {
  await mockOwnerSession(page)
  let saved: Array<{ student_id: string; status: string; notes: string | null }> = []
  await page.route('**/rest/v1/**', async (route) => {
    const url = new URL(route.request().url())
    let json: unknown
    if (url.pathname.endsWith('/rpc/list_agenda_sessions')) json = [session]
    else if (url.pathname.endsWith('/rpc/get_session_attendance')) json = students.map((student) => ({ ...session, student_id: student.id, student_name: student.full_name, student_photo_path: null, preferred_name: null, session_status: 'planned', session_notes: null, attendance_notes: saved.find((row) => row.student_id === student.id)?.notes ?? null, attendance_status: saved.find((row) => row.student_id === student.id)?.status ?? null, recorded_at: null }))
    else if (url.pathname.endsWith('/rpc/save_session_attendance')) {
      saved = route.request().postDataJSON().payload.records
      json = session.session_id
    } else if (url.pathname.endsWith('/students')) {
      const name = url.searchParams.get('full_name')?.replace('ilike.%', '').replace(/%$/, '').toLowerCase()
      json = url.searchParams.has('id') ? students[0] : students.filter((student) => !name || student.full_name.toLowerCase().includes(name))
    } else { await route.fallback(); return }
    await route.fulfill({ json, headers: { 'access-control-expose-headers': 'content-range', 'content-range': `0-2/${Array.isArray(json) ? json.length : 1}` } })
  })
  await page.goto('/login')
  await page.getByLabel('Email').fill('owner@example.com')
  await page.getByLabel('Senha', { exact: true }).fill('senha-segura')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Inicio', exact: true })).toBeVisible()
  return () => saved
}

async function noOverflow(page: Page) {
  const horizontalScrollers = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('body *')).filter((element) => {
    const style = getComputedStyle(element)
    return element.getClientRects().length > 0 && !['INPUT', 'TEXTAREA'].includes(element.tagName) && ['auto', 'scroll'].includes(style.overflowX) && element.scrollWidth > element.clientWidth + 1
  }).map((element) => element.className))
  expect(horizontalScrollers).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
}

for (const width of [280, 305, 320, 390, 430, 1280]) {
  test(`mobile flows at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    const saved = await setup(page)
    await page.addStyleTag({ content: 'html { overflow-y: scroll; scrollbar-gutter: stable; }' })
    await page.goto('/agenda')
    await expect(page.getByText('Ateliê de pintura')).toBeVisible()
    await noOverflow(page)
    if (width < 1024) await expect(page.getByRole('navigation', { name: 'Atalhos principais' })).toBeVisible()
    await page.screenshot({ path: `test-results/mobile-agenda-${width}.png`, fullPage: true })
    await page.getByRole('button', { name: 'Fazer chamada', exact: true }).click()
    await expect(page).toHaveURL(/frequencia\?session=session-mobile&date=2026-10-21/)
    await expect(page.getByRole('heading', { name: students[0].full_name })).toBeVisible()
    await page.getByRole('button', { name: 'Marcar todos presentes', exact: true }).click()
    await page.getByRole('button', { name: 'Falta', exact: true }).first().click()
    await expect(page.getByRole('button', { name: 'Falta', exact: true }).first()).toHaveAttribute('aria-pressed', 'true')
    await noOverflow(page)
    await page.getByRole('button', { name: 'Salvar chamada', exact: true }).click()
    await expect(page.getByText('Frequencia salva.', { exact: true })).toBeVisible()
    expect(saved().map((record) => record.status)).toEqual(['absent', 'present', 'present'])
    await page.screenshot({ path: `test-results/mobile-chamada-${width}.png`, fullPage: true })
    await page.goto('/alunos')
    await expect(page.getByRole('button', { name: `Abrir ${students[0].full_name}` }).filter({ visible: true })).toBeVisible()
    await noOverflow(page)
    await page.screenshot({ path: `test-results/mobile-alunos-${width}.png`, fullPage: true })
    await page.getByLabel('Buscar aluno').fill('Mariana')
    await expect(page.getByRole('button', { name: 'Abrir Mariana Costa' }).filter({ visible: true })).toBeVisible()
    await expect(page.getByRole('button', { name: `Abrir ${students[0].full_name}` })).toHaveCount(0)
    if (width < 1024) {
      await page.getByRole('button', { name: 'Mais', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Explorar Casa Criativa' })
      await expect(dialog).toBeVisible()
      await dialog.getByRole('link', { name: 'Turmas', exact: true }).click()
      await expect(dialog).not.toBeVisible()
      await expect(page).toHaveURL(/turmas/)
    }
  })
}

test('preserves unsaved attendance when navigation is dismissed', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await setup(page)
  await page.goto('/frequencia?session=session-mobile&date=2026-10-21')
  await page.getByRole('button', { name: 'Presente', exact: true }).first().click()
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('navigation', { name: 'Atalhos principais' }).getByRole('link', { name: 'Alunos', exact: true }).click()
  await expect(page).toHaveURL(/frequencia/)
  await expect(page.getByRole('button', { name: 'Presente', exact: true }).first()).toHaveAttribute('aria-pressed', 'true')
})

test('mobile menu traps focus and restores its trigger', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await setup(page)
  const trigger = page.getByRole('button', { name: 'Mais', exact: true })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name: 'Explorar Casa Criativa' })
  await expect(dialog).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(dialog.getByRole('button', { name: 'Sair', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(dialog.getByRole('button', { name: 'Fechar', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(trigger).toBeFocused()
})

test('agenda handles empty and failed requests', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await setup(page)
  await page.route('**/rest/v1/rpc/list_agenda_sessions', (route) => route.fulfill({ json: [] }))
  await page.goto('/agenda')
  await expect(page.getByText('Nenhuma aula neste periodo.')).toBeVisible()
  await noOverflow(page)
  await page.route('**/rest/v1/rpc/list_agenda_sessions', (route) => route.fulfill({ status: 403, json: { message: 'Permission denied' } }))
  await page.getByRole('button', { name: 'Atualizar', exact: true }).click()
  await expect(page.getByText('Nao foi possivel carregar a agenda.')).toBeVisible()
})

for (const width of [305, 390, 768, 1280]) {
  test(`all modules use the mobile design system at ${width}px`, async ({ page }) => {
    test.setTimeout(90_000)
    await page.setViewportSize({ width, height: 844 })
    const runtimeErrors: string[] = []
    page.on('pageerror', (error) => runtimeErrors.push(error.message))
    await setup(page)
    await page.route('**/functions/v1/**', (route) => route.fulfill({ json: { users: [] } }))
    await page.route('**/rest/v1/rpc/get_application_settings', (route) => route.fulfill({ json: { organization_name: 'Casa Criativa', display_name: 'Casa Criativa', phone: '', email: '', timezone: 'America/Sao_Paulo', locale: 'pt-BR', currency_code: 'BRL', default_class_duration_minutes: 60, default_due_day: 10, default_page_size: 20, low_stock_threshold: 5, updated_at: '2026-10-21T12:00:00Z' } }))
    for (const path of ['/', '/agenda', '/alunos', '/responsaveis', '/turmas', '/frequencia', '/mensalidades', '/financeiro', '/eventos', '/materiais', '/relatorios', '/ideias', '/configuracoes', '/configuracoes/seguranca', '/configuracoes/usuarios', '/configuracoes/auditoria']) {
      await page.goto(path)
      await expect(page.locator('h1').first()).toBeVisible()
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
      await noOverflow(page)
      if (width === 305 || width === 390) await page.screenshot({ path: `test-results/design-${path.replaceAll('/', '-') || 'inicio'}-${width}.png`, fullPage: true })
    }
    await page.goto('/alunos')
    await page.getByRole('button', { name: 'Novo aluno', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Matricula completa' })).toBeVisible()
    await noOverflow(page)
    if (width < 640) await expect(page.getByText('Etapa 1 de 5', { exact: false })).toBeVisible()
    await page.screenshot({ path: `test-results/design-matricula-${width}.png`, fullPage: true })
    expect(runtimeErrors).toEqual([])
  })
}

test('student totals and action labels stay on one line at 305px', async ({ page }) => {
  await page.setViewportSize({ width: 305, height: 844 })
  await setup(page)
  await page.route('**/rest/v1/students?**', (route) => route.fulfill({ json: students, headers: { 'access-control-expose-headers': 'content-range', 'content-range': '0-2/36' } }))
  await page.goto('/alunos')
  const total = page.locator('.list-count .whitespace-nowrap')
  await expect(total).toHaveText('36')
  expect((await total.boundingBox())!.height).toBeLessThanOrEqual(30)
  const refreshText = page.getByRole('button', { name: 'Atualizar', exact: true }).locator('span')
  expect((await refreshText.boundingBox())!.height).toBeLessThan(25)
  await noOverflow(page)
  await page.screenshot({ path: 'test-results/design-alunos-36-305.png', fullPage: true })
  await page.goto('/relatorios')
  await page.getByLabel('Selecionar seção').selectOption({ label: 'Financeiro' })
  await expect(page).toHaveURL(/tipo=financial/)
  await noOverflow(page)
})
