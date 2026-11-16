import { expect, test } from '@playwright/test'
import { mockOwnerSession } from './helpers/mockSession'

test('month shows sessions on their dates and preserves daily actions', async ({ page }) => {
  await mockOwnerSession(page)
  const ranges: Array<{ p_start_date: string; p_end_date: string }> = []
  await page.route('**/rest/v1/rpc/list_agenda_sessions', async (route) => {
    const range = route.request().postDataJSON()
    ranges.push(range)
    const sessions = [
      { session_id: 'month-1', session_date: '2026-03-03', start_time: '09:00:00', class_name: 'Pintura criativa' },
      { session_id: 'month-2', session_date: '2026-03-03', start_time: '14:00:00', class_name: 'Cerâmica' },
      { session_id: 'month-3', session_date: '2026-03-24', start_time: '10:00:00', class_name: 'Desenho livre' },
    ].filter((row) => row.session_date >= range.p_start_date && row.session_date <= range.p_end_date)
      .map((row) => ({ ...row, class_id: 'class-month', end_time: '16:00:00', status: 'planned', attendance_state: 'pending', expected_students: 2, recorded_count: 0, absent_count: 0, present_count: 0, excused_count: 0 }))
    await route.fulfill({ json: sessions })
  })
  await page.goto('/login')
  await page.getByLabel('Email').fill('owner@example.com')
  await page.getByLabel('Senha', { exact: true }).fill('senha-segura')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Menu Principal' })).toBeVisible()
  await page.goto('/agenda')
  await expect(page.getByRole('button', { name: 'Mês', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('Ir para uma data').fill('2026-03-15')
  const calendar = page.getByRole('region', { name: 'Calendário de março de 2026' })
  await expect(calendar).toBeVisible()
  await expect(calendar.locator('.agenda-month-day')).toHaveCount(42)
  await expect(calendar.getByRole('button', { name: /09:00 Pintura criativa/ })).toBeVisible()
  expect(ranges).toContainEqual({ p_start_date: '2026-03-01', p_end_date: '2026-03-31' })
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/agenda-month-${width}.png`, fullPage: true })
  }
  await calendar.getByRole('button', { name: /terça-feira, 3 de março: 2 aulas/ }).click()
  await expect(page.getByRole('button', { name: 'Fazer chamada', exact: true })).toHaveCount(2)
  await page.getByRole('button', { name: 'Mês', exact: true }).click()
  await page.getByRole('button', { name: 'Proximo periodo' }).click()
  await expect(page.getByRole('region', { name: 'Calendário de abril de 2026' })).toBeVisible()
  await expect(page.locator('.agenda-month-event')).toHaveCount(0)
})
