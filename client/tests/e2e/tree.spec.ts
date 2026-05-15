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
    })
  })

  await page.route('**/api/jobs/job-tree/tree/root', async (route) => {
    await fulfillJson(route, {
      node: {
        id: 1,
        parentId: null,
        jobId: 'job-tree',
        depth: 0,
        name: 'files',
        path: '/mnt/files',
        sizeBytes: 100,
        percentOfRoot: 100,
        inaccessible: false,
        hasChildren: true,
      },
    })
  })

  await page.route('**/api/jobs/job-tree/tree/nodes/1/children', async (route) => {
    await fulfillJson(route, {
      children: [
        {
          id: 2,
          parentId: 1,
          jobId: 'job-tree',
          depth: 1,
          name: 'alpha',
          path: '/mnt/files/alpha',
          sizeBytes: 70,
          percentOfRoot: 70,
          inaccessible: false,
          hasChildren: true,
        },
      ],
    })
  })

  await page.route('**/api/jobs/job-tree/tree/nodes/2/children', async (route) => {
    await fulfillJson(route, {
      children: [
        {
          id: 3,
          parentId: 2,
          jobId: 'job-tree',
          depth: 2,
          name: 'beta',
          path: '/mnt/files/alpha/beta',
          sizeBytes: 20,
          percentOfRoot: 20,
          inaccessible: false,
          hasChildren: false,
        },
      ],
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
