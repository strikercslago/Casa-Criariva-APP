import { expect, test, type Page } from '@playwright/test'
import { mockOwnerSession } from './helpers/mockSession'

async function signIn(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill('owner@example.com')
  await page.getByLabel('Senha', { exact: true }).fill('senha-segura')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Menu Principal', exact: true })).toBeVisible()
}

for (const width of [360, 390, 430, 768, 1440]) {
  test(`main menu layout and real navigation at ${width}px`, async ({ page }) => {
    test.setTimeout(90_000)
    await page.setViewportSize({ width, height: 900 })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
    await mockOwnerSession(page)
    await signIn(page)
    const grid = page.getByRole('navigation', { name: 'Módulos da escola' })
    await expect(grid.getByRole('link')).toHaveCount(10)
    const boxes = await grid.getByRole('link').evaluateAll((links) => links.map((link) => { const { x, y, width, height } = link.getBoundingClientRect(); return { x, y, width, height } }))
    expect(boxes.filter((box) => box.y === boxes[0].y)).toHaveLength(width < 768 ? 2 : width < 1280 ? 3 : 4)
    expect(new Set(boxes.map((box) => Math.round(box.width))).size).toBe(1)
    expect(new Set(boxes.map((box) => Math.round(box.height))).size).toBe(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(page.getByRole('button', { name: 'Abrir menu' })).toHaveCount(0)
    await page.screenshot({ path: `test-results/menu-${width}.png`, fullPage: true })
    if (width < 1024) {
      await page.getByRole('main').getByRole('link', { name: /Visão geral/ }).scrollIntoViewIfNeeded()
      const lastLink = await page.getByRole('main').getByRole('link', { name: /Visão geral/ }).boundingBox()
      const bar = await page.getByRole('navigation', { name: 'Atalhos principais' }).boundingBox()
      expect(lastLink!.y + lastLink!.height).toBeLessThanOrEqual(bar!.y)
    }
    const destinations = ['/agenda', '/alunos', '/responsaveis', '/turmas', '/frequencia', '/mensalidades', '/financeiro', '/eventos', '/ideias', '/configuracoes']
    for (const path of destinations) {
      await grid.locator(`a[href="${path}"]`).click()
      await expect(page).toHaveURL(new RegExp(`${path}$`))
      await expect(page.locator('main h1')).toBeVisible()
      await page.goto('/')
      await expect(grid).toBeVisible()
    }
    await page.reload()
    await expect(grid.getByRole('link')).toHaveCount(10)
    expect(errors).toEqual([])
  })
}

for (const role of ['teacher', 'admin']) {
  test(`${role} retains module restrictions in menu and direct routes`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await mockOwnerSession(page)
    await page.route('**/rest/v1/user_roles*', (route) => route.fulfill({ json: [{ role }] }))
    await signIn(page)
    const grid = page.getByRole('navigation', { name: 'Módulos da escola' })
    await expect(grid.getByRole('link')).toHaveCount(role === 'teacher' ? 6 : 9)
    await expect(grid.getByRole('link', { name: 'Financeiro' })).toHaveCount(0)
    await expect(grid.getByRole('link', { name: 'Ideias e chamados' })).toBeVisible()
    await page.goto('/financeiro')
    await expect(page.getByRole('heading', { name: 'Acesso nao autorizado' })).toBeVisible()
  })
}
