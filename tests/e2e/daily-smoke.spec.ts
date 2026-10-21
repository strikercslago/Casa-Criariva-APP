import { expect, test, type Page } from '@playwright/test'

import { mockOwnerSession } from './helpers/mockSession'

test('daily operational smoke covers critical routes and logout', async ({ page }) => {
  const consoleErrors: string[] = []

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })

  await mockOwnerSession(page)

  await page.goto('/login')
  await page.getByLabel('Email').fill('owner@example.com')
  await page.getByLabel('Senha').fill('senha-segura')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible()

  await expectRouteHeading(page, '/', 'Inicio')
  await expectRouteHeading(page, '/alunos', 'Alunos')
  await expectRouteHeading(page, '/agenda', 'Agenda')
  await expectRouteHeading(page, '/frequencia', 'Frequencia')
  await expectRouteHeading(page, '/mensalidades', 'Mensalidades')
  await expectRouteHeading(page, '/financeiro', 'Financeiro')

  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 820 })
    await expectRouteHeading(page, '/agenda', 'Agenda')
    await expect(page.getByRole('button', { name: 'Abrir menu' })).toBeVisible()
    await expectRouteHeading(page, '/mensalidades', 'Mensalidades')
  }

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
  expect(consoleErrors).toEqual([])
})

async function expectRouteHeading(page: Page, path: string, heading: string) {
  await page.goto(path)
  await expect(page.getByRole('heading', { name: heading })).toBeVisible()
}
