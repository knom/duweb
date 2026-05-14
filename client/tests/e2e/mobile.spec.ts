import { expect, test } from '@playwright/test'
import { fulfillJson, mockNoSuggestions } from './helpers'

test('mobile sidebar opens from hamburger and closes via overlay/select', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  await page.route('**/api/jobs', async (route) => {
    await fulfillJson(route, [
      {
        id: 'job-mobile',
        status: 'completed',
        rootPath: '/mnt/files',
        progress: { directoriesVisited: 1, filesVisited: 2, startedAt: '2026-05-14T10:00:00.000Z' },
      },
    ])
  })

  await page.route('**/api/jobs/job-mobile', async (route) => {
    await fulfillJson(route, {
      id: 'job-mobile',
      status: 'completed',
      rootPath: '/mnt/files',
      progress: { directoriesVisited: 1, filesVisited: 2, startedAt: '2026-05-14T10:00:00.000Z' },
      result: { name: 'files', path: '/mnt/files', sizeBytes: 1, percentOfRoot: 100, children: [] },
    })
  })

  await mockNoSuggestions(page)
  await page.goto('/')

  const openBtn = page.getByRole('button', { name: 'Open jobs sidebar' })
  await openBtn.click()
  await expect(page.getByRole('button', { name: 'Close sidebar overlay' })).toBeVisible()

  await page.getByRole('button', { name: 'Close sidebar overlay' }).click()
  await expect(page.getByRole('button', { name: 'Close sidebar overlay' })).toHaveCount(0)

  await openBtn.click()
  await page.getByRole('button', { name: '/mnt/files' }).click()
  await expect(page.getByRole('button', { name: 'Close sidebar overlay' })).toHaveCount(0)
})
