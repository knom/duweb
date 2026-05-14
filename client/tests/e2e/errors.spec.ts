import { expect, test } from '@playwright/test'
import { fulfillJson, mockNoSuggestions } from './helpers'

test('shows error when initial jobs load fails', async ({ page }) => {
  await page.route('**/api/jobs', async (route) => {
    await fulfillJson(route, { error: 'boom' }, 500)
  })
  await mockNoSuggestions(page)

  await page.goto('/')
  await expect(page.getByText('Unable to load jobs.')).toBeVisible()
})

test('shows backend validation error when scan start returns 400', async ({ page }) => {
  await page.route('**/api/jobs', async (route) => {
    await fulfillJson(route, [])
  })
  await page.route('**/api/jobs/scan', async (route) => {
    await fulfillJson(route, { error: 'Body must contain a non-empty path field.' }, 400)
  })
  await mockNoSuggestions(page)

  await page.goto('/')
  await page.getByLabel('Scan path').fill('/tmp')
  await page.getByRole('button', { name: 'Scan' }).click()

  await expect(page.getByText('Body must contain a non-empty path field.')).toBeVisible()
})
