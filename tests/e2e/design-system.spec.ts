import { expect, test } from '@playwright/test'
import { mockOwnerSession } from './helpers/mockSession'

// Exercise every module at phone and desktop sizes using isolated API fixtures.
for (const width of [390, 1440]) {
  test(`shared design remains usable across modules at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await mockOwnerSession(page)
    await page.goto('/login')
    await page.getByLabel('Email').fill('owner@example.com')
    await page.getByLabel('Senha', { exact: true }).fill('senha-segura')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Menu Principal' })).toBeVisible()
    for (const path of ['agenda', 'responsaveis', 'turmas', 'frequencia', 'mensalidades', 'financeiro', 'eventos', 'ideias', 'configuracoes', 'configuracoes/seguranca', 'configuracoes/usuarios', 'visao-geral']) {
      await page.goto(`/${path}`)
      await expect(page.locator('.page-heading h1').first()).toBeVisible()
      await expect(page.locator('.page-heading-icon').first()).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await page.screenshot({ path: `test-results/design-${path.replaceAll('/', '-')}-${width}.png`, fullPage: true })
    }
  })
}
