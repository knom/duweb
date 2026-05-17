import { expect, fulfillJson, mockNoSuggestions, test } from './helpers'

test('scan starts, polls, and finishes with completed status', async ({ page }) => {
  await page.route('**/api/jobs', async (route) => {
    await fulfillJson(route, [])
  })
  await mockNoSuggestions(page)

  await page.route('**/api/jobs/scan', async (route) => {
    await fulfillJson(route, {
      id: 'job-new',
      status: 'queued',
      rootPath: '/mnt/files',
      progress: {
        directoriesVisited: 0,
        filesVisited: 0,
        startedAt: '2026-05-14T10:00:00.000Z',
      },
    }, 202)
  })

  let pollCount = 0
  await page.route('**/api/jobs/job-new', async (route) => {
    pollCount += 1
    if (pollCount === 1) {
      await fulfillJson(route, {
        id: 'job-new',
        status: 'running',
        rootPath: '/mnt/files',
        progress: {
          directoriesVisited: 2,
          filesVisited: 5,
          startedAt: '2026-05-14T10:00:00.000Z',
        },
      })
      return
    }

    await fulfillJson(route, {
      id: 'job-new',
      status: 'completed',
      rootPath: '/mnt/files',
      progress: {
        directoriesVisited: 4,
        filesVisited: 10,
        startedAt: '2026-05-14T10:00:00.000Z',
        endedAt: '2026-05-14T10:00:02.000Z',
      },
    })
  })

  await page.route('**/api/jobs/job-new/tree/children-batch', async (route) => {
    await fulfillJson(route, { byParentId: {} })
  })

  await page.route('**/api/jobs/job-new/tree/root', async (route) => {
    await fulfillJson(route, {
      node: {
        id: 20,
        parentId: null,
        jobId: 'job-new',
        depth: 0,
        name: 'files',
        path: '/mnt/files',
        sizeBytes: 500,
        percentOfRoot: 100,
        inaccessible: false,
        hasChildren: false,
      },
    })
  })

  await page.goto('/')
  await page.getByLabel('Scan path').fill('/mnt/files')
  await page.getByRole('button', { name: 'Scan' }).click()

  await expect(page.locator('.border-amber-200').first()).toHaveText('queued')
  await expect(page.getByText(/^4 directories · 10 files/)).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.border-emerald-200').first()).toHaveText('completed')
})
