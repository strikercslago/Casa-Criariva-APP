import { expect, test } from '@playwright/test'

test('keeps dashboard indicators without removed modules', async ({ page }) => {
  const consoleErrors: string[] = []
  const rpcRequests: string[] = []
  const now = '2026-08-11T12:00:00.000Z'
  const userId = '11111111-1111-4111-8111-111111111111'
  await page.clock.setFixedTime(new Date(now))

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.route('https://baugbpqdgslfogggaqen.supabase.co/auth/v1/**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        access_token: 'mock-access-token',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        refresh_token: 'mock-refresh-token',
        token_type: 'bearer',
        user: {
          app_metadata: {},
          aud: 'authenticated',
          confirmed_at: now,
          created_at: now,
          email: 'owner@example.com',
          id: userId,
          role: 'authenticated',
          updated_at: now,
          user_metadata: {},
        },
      },
      status: 200,
    })
  })

  await page.route('https://baugbpqdgslfogggaqen.supabase.co/rest/v1/**', async (route) => {
    const url = new URL(route.request().url())

    if (url.pathname.endsWith('/profiles')) {
      await route.fulfill({ contentType: 'application/json', json: { avatar_url: null, created_at: now, full_name: 'Owner', id: userId, is_active: true, updated_at: now }, status: 200 })
      return
    }

    if (url.pathname.endsWith('/user_roles')) {
      await route.fulfill({ contentType: 'application/json', json: [{ role: 'owner' }], status: 200 })
      return
    }

    if (url.pathname.endsWith('/rpc/get_dashboard_today')) {
      rpcRequests.push('POST get_dashboard_today')
      await route.fulfill({ contentType: 'application/json', json: [{ day_date: '2026-08-11', events_today_count: 1, expected_students: 18, next_event_id: 'event-1', next_event_name: 'Oficina de Ferias', next_event_start: '15:00:00', next_session_class_name: 'Artes A', next_session_expected_students: 6, next_session_id: 'session-1', next_session_start: '14:00:00', pending_sessions_count: 1, sessions_count: 3 }], status: 200 })
      return
    }

    if (url.pathname.endsWith('/rpc/get_dashboard_attention')) {
      rpcRequests.push('POST get_dashboard_attention')
      await route.fulfill({ contentType: 'application/json', json: [
        { amount: 540, count_value: 3, description: '3 mensalidades em aberto.', href: '/mensalidades?status=overdue', kind: 'overdue_billing', priority: 10, title: 'Mensalidades vencidas' },
        { amount: null, count_value: 4, description: '4 materiais abaixo do minimo.', href: '/materiais?status=low', kind: 'stock_low', priority: 50, title: 'Materiais abaixo do minimo' },
      ], status: 200 })
      return
    }

    if (url.pathname.endsWith('/rpc/get_dashboard_operations')) {
      rpcRequests.push('POST get_dashboard_operations')
      await route.fulfill({ contentType: 'application/json', json: [dashboardOperations()], status: 200 })
      return
    }







    await route.fulfill({ contentType: 'application/json', json: [], status: 200 })
  })

  await page.goto('/login')
  await page.getByLabel('Email').fill('owner@example.com')
  await page.getByLabel('Senha').fill('senha-segura')
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page.getByRole('heading', { name: 'Menu Principal' })).toBeVisible()
  await page.getByRole('main').getByRole('link', { name: /Visão geral/ }).click()
  await expect(page.getByText('Hoje - 11/08/2026')).toBeVisible()
  await expect(page.getByText('14:00 - Artes A')).toBeVisible()
  await expect(page.getByRole('link', { name: /Mensalidades vencidas/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Materiais abaixo do minimo/ })).toHaveCount(0)
  await expect(page.getByText('R$ 540,00').first()).toBeVisible()
  await page.getByText('Resumo do mês', { exact: false }).click()
  await expect(page.getByText('R$ 1.000,00').first()).toBeVisible()
  await expect(page.getByText('R$ 400,00').first()).toBeVisible()
  await expect(page.getByText('R$ 600,00').first()).toBeVisible()
  await expect(page.getByText('42').first()).toBeVisible()

  await page.getByRole('link', { name: /Abrir Financeiro/ }).click()
  await expect(page.getByRole('heading', { name: 'Financeiro' })).toBeVisible()

  await page.goto('/visao-geral')
  await page.getByRole('link', { name: /Abrir Agenda/ }).click()
  await expect(page.getByRole('heading', { name: 'Agenda' })).toBeVisible()

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()

  expect(rpcRequests).toEqual(expect.arrayContaining([
    'POST get_dashboard_today',
    'POST get_dashboard_attention',
    'POST get_dashboard_operations',
  ]))
  expect(consoleErrors).toEqual([])
})

function dashboardOperations() {
  return {
    active_classes_count: 6,
    active_students_count: 42,
    archived_students_count: 1,
    attendance_absent_count: 2,
    attendance_excused_count: 1,
    attendance_pending_sessions: 1,
    attendance_present_count: 35,
    attendance_rate: 92.1,
    available_spots: 9,
    cash_in: 1000,
    cash_out: 400,
    class_active_enrollments: 37,
    class_occupancy_rate: 82.2,
    class_total_capacity: 45,
    full_classes_count: 1,
    low_stock_count: 4,
    net_students_change: 4,
    new_students_count: 5,
    next_event_date: '2026-08-17',
    next_event_id: 'event-1',
    next_event_name: 'Oficina de Ferias',
    out_of_stock_count: 2,
    overdue_billing_amount: 540,
    overdue_billing_count: 3,
    payable_amount: 100,
    receivable_amount: 300,
    reference_month: '2026-08-01',
    result_amount: 600,
    upcoming_events_count: 1,
  }
}
