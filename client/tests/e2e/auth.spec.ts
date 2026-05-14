import { expect, test } from '@playwright/test'
import { fulfillJson, mockNoSuggestions } from './helpers'

test('shows auth error when scan start is unauthorized (401)', async ({ page }) => {
  await page.route('**/api/jobs', async (route) => {
    await fulfillJson(route, [])
  })
  await mockNoSuggestions(page)

  await page.route('**/api/jobs/scan', async (route) => {
    await fulfillJson(route, { error: 'Authentication required.' }, 401)
  })

  await page.goto('/')
  await page.getByLabel('Scan path').fill('/mnt/files')
  await page.getByRole('button', { name: 'Scan' }).click()

  await expect(page.getByText('Authentication required.')).toBeVisible()
})

test('shows forbidden error when user is not in required group (403)', async ({ page }) => {
  await page.route('**/api/jobs', async (route) => {
    await fulfillJson(route, [])
  })
  await mockNoSuggestions(page)

  await page.route('**/api/jobs/scan', async (route) => {
    await fulfillJson(route, { error: "Access requires membership in group 'diskusage-admins'." }, 403)
  })

  await page.goto('/')
  await page.getByLabel('Scan path').fill('/mnt/files')
  await page.getByRole('button', { name: 'Scan' }).click()

  await expect(page.getByText("Access requires membership in group 'diskusage-admins'.")).toBeVisible()
})
