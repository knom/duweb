import { expect, test } from '@playwright/test'
import { fulfillJson, mockAuthMe, mockNoSuggestions } from './helpers'

test('shows auth error when scan start is unauthorized (401)', async ({ page }) => {
  await page.route('**/api/jobs', async (route) => {
    await fulfillJson(route, [])
  })
  await mockAuthMe(page, { requireAuth: false, identity: { groups: [] } })
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
  await mockAuthMe(page, { requireAuth: false, identity: { groups: [] } })
  await mockNoSuggestions(page)

  await page.route('**/api/jobs/scan', async (route) => {
    await fulfillJson(route, { error: "Access requires membership in group 'diskusage-admins'." }, 403)
  })

  await page.goto('/')
  await page.getByLabel('Scan path').fill('/mnt/files')
  await page.getByRole('button', { name: 'Scan' }).click()

  await expect(page.getByText("Access requires membership in group 'diskusage-admins'.")).toBeVisible()
})

test('shows authenticated username chip when auth is required', async ({ page }) => {
  await page.route('**/api/jobs', async (route) => {
    await fulfillJson(route, [])
  })
  await mockNoSuggestions(page)
  await mockAuthMe(page, {
    requireAuth: true,
    identity: { username: 'alice', groups: ['diskusage-admins'] },
  })

  await page.goto('/')

  await expect(page.getByLabel('Authenticated user')).toBeVisible()
  await expect(page.getByText('alice')).toBeVisible()
})

test('hides authenticated username chip when auth is not required', async ({ page }) => {
  await page.route('**/api/jobs', async (route) => {
    await fulfillJson(route, [])
  })
  await mockNoSuggestions(page)
  await mockAuthMe(page, {
    requireAuth: false,
    identity: { username: 'alice', groups: ['diskusage-admins'] },
  })

  await page.goto('/')

  await expect(page.getByLabel('Authenticated user')).toHaveCount(0)
})
