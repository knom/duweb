import { expect, test } from '@playwright/test'
import { fulfillJson, mockNoSuggestions } from './helpers'

test('shows level options based on tree depth and supports collapse interaction', async ({ page }) => {
  await page.route('**/api/jobs', async (route) => {
    await fulfillJson(route, [
      {
        id: 'job-tree',
        status: 'completed',
        rootPath: '/mnt/files',
        progress: { directoriesVisited: 4, filesVisited: 6, startedAt: '2026-05-14T10:00:00.000Z' },
      },
    ])
  })

  await page.route('**/api/jobs/job-tree', async (route) => {
    await fulfillJson(route, {
      id: 'job-tree',
      status: 'completed',
      rootPath: '/mnt/files',
      progress: { directoriesVisited: 4, filesVisited: 6, startedAt: '2026-05-14T10:00:00.000Z' },
      result: {
        name: 'files',
        path: '/mnt/files',
        sizeBytes: 100,
        percentOfRoot: 100,
        children: [
          {
            name: 'alpha',
            path: '/mnt/files/alpha',
            sizeBytes: 70,
            percentOfRoot: 70,
            children: [
              {
                name: 'beta',
                path: '/mnt/files/alpha/beta',
                sizeBytes: 20,
                percentOfRoot: 20,
                children: [],
              },
            ],
          },
        ],
      },
    })
  })

  await mockNoSuggestions(page)
  await page.goto('/')

  const levelSelect = page.locator('#collapse-level')
  await expect(levelSelect).toContainText('Level 1')
  await expect(levelSelect).toContainText('Level 2')
  await expect(levelSelect).not.toContainText('Level 3')

  await expect(page.getByText('beta')).toBeVisible()
  await page.getByRole('button', { name: 'Collapse', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Expand directory' }).first()).toBeVisible()
})
