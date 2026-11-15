import { expect, type Page } from '@playwright/test'

/** The same section is a select on mobile and a button on larger screens. */
export async function selectSection(page: Page, label: string) {
  const select = page.getByRole('combobox', { name: 'Selecionar seção' })
  const button = page.getByRole('button', { name: label, exact: true })
  await expect(select.or(button).filter({ visible: true }).first()).toBeVisible()
  if (await select.isVisible()) await select.selectOption({ label })
  else await button.click()
}
