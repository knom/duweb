import { expect, fulfillJson, mockNoSuggestions, test } from './helpers'

test('selects job and removes selected job', async ({ page }) => {
  await page.route('**/api/jobs', async (route) => {
    await fulfillJson(route, [
      {
        id: 'job-1',
        status: 'completed',
        rootPath: '/mnt/files',
        progress: { directoriesVisited: 2, filesVisited: 3, startedAt: '2026-05-14T10:00:00.000Z' },
      },
      {
        id: 'job-2',
        status: 'failed',
        rootPath: '/var/log',
        progress: { directoriesVisited: 1, filesVisited: 1, startedAt: '2026-05-14T11:00:00.000Z' },
      },
    ])
  })

  await mockNoSuggestions(page)

  await page.route('**/api/jobs/job-1', async (route) => {
    await fulfillJson(route, {
      id: 'job-1',
      status: 'completed',
      rootPath: '/mnt/files',
      progress: { directoriesVisited: 2, filesVisited: 3, startedAt: '2026-05-14T10:00:00.000Z' },
    })
  })

  await page.route('**/api/jobs/job-1/tree/root', async (route) => {
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not found' }) })
  })

  await page.route('**/api/jobs/job-2/rerun', async (route) => {
    await fulfillJson(route, { error: 'not used in this test' }, 500)
  })

  await page.route('**/api/jobs/job-2', async (route) => {
    if (route.request().method() === 'DELETE') {
      await route.fulfill({ status: 204, body: '' })
      return
    }
    await fulfillJson(route, {
      id: 'job-2',
      status: 'failed',
      rootPath: '/var/log',
      progress: { directoriesVisited: 1, filesVisited: 1, startedAt: '2026-05-14T11:00:00.000Z' },
      error: 'Scan failed',
    })
  })

  await page.goto('/')

  await page.getByRole('button', { name: '/var/log' }).click()
  await expect(page.getByLabel('Scan path')).toHaveValue('/var/log')

  await page.getByRole('button', { name: 'Remove' }).click()
  await expect(page.getByLabel('Scan path')).toHaveValue('/mnt/files')
})

test('rerun selected job creates a new queued job', async ({ page }) => {
  await page.route('**/api/jobs', async (route) => {
    await fulfillJson(route, [
      {
        id: 'job-2',
        status: 'failed',
        rootPath: '/var/log',
        progress: { directoriesVisited: 1, filesVisited: 1, startedAt: '2026-05-14T11:00:00.000Z' },
      },
    ])
  })

  await page.route('**/api/jobs/job-2', async (route) => {
    await fulfillJson(route, {
      id: 'job-2',
      status: 'failed',
      rootPath: '/var/log',
      progress: { directoriesVisited: 1, filesVisited: 1, startedAt: '2026-05-14T11:00:00.000Z' },
      error: 'Scan failed',
    })
  })

  await page.route('**/api/jobs/job-2/rerun', async (route) => {
    await fulfillJson(route, {
      id: 'job-3',
      status: 'queued',
      rootPath: '/var/log',
      progress: { directoriesVisited: 0, filesVisited: 0, startedAt: '2026-05-14T12:00:00.000Z' },
    }, 202)
  })

  await mockNoSuggestions(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Rerun' }).click()

  await expect(page.locator('.border-amber-200').first()).toHaveText('queued')
  await expect(page.getByLabel('Scan path')).toHaveValue('/var/log')
})

test('search filters by path only and ignores job id', async ({ page }) => {
  await page.route('**/api/jobs', async (route) => {
    await fulfillJson(route, [
      {
        id: 'job-alpha-123',
        status: 'completed',
        rootPath: '/mnt/files',
        progress: { directoriesVisited: 2, filesVisited: 3, startedAt: '2026-05-14T10:00:00.000Z' },
      },
      {
        id: 'job-beta-456',
        status: 'failed',
        rootPath: '/var/log',
        progress: { directoriesVisited: 1, filesVisited: 1, startedAt: '2026-05-14T11:00:00.000Z' },
      },
    ])
  })

  await page.route('**/api/jobs/job-alpha-123', async (route) => {
    await fulfillJson(route, {
      id: 'job-alpha-123',
      status: 'completed',
      rootPath: '/mnt/files',
      progress: { directoriesVisited: 2, filesVisited: 3, startedAt: '2026-05-14T10:00:00.000Z' },
    })
  })

  await page.route('**/api/jobs/job-alpha-123/tree/root', async (route) => {
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not found' }) })
  })

  await mockNoSuggestions(page)
  await page.goto('/')

  const searchInput = page.getByPlaceholder('Search by path')

  await searchInput.fill('job-alpha-123')
  await expect(page.getByText('No jobs match this filter.')).toBeVisible()

  await searchInput.fill('/var')
  await expect(page.getByRole('button', { name: '/var/log' })).toBeVisible()
  await expect(page.getByRole('button', { name: '/mnt/files' })).toHaveCount(0)
})

test('shows runtime only for non-running states in list and tree description', async ({ page }) => {
  await page.route('**/api/jobs', async (route) => {
    await fulfillJson(route, [
      {
        id: 'job-running',
        status: 'running',
        rootPath: '/mnt/running',
        runtimeMs: 12_000,
        progress: { directoriesVisited: 3, filesVisited: 8, startedAt: '2026-05-14T10:00:00.000Z' },
      },
      {
        id: 'job-completed',
        status: 'completed',
        rootPath: '/mnt/completed',
        runtimeMs: 65_000,
        progress: {
          directoriesVisited: 5,
          filesVisited: 12,
          startedAt: '2026-05-14T09:00:00.000Z',
          endedAt: '2026-05-14T09:01:05.000Z',
        },
      },
    ])
  })

  await page.route('**/api/jobs/job-running', async (route) => {
    await fulfillJson(route, {
      id: 'job-running',
      status: 'running',
      rootPath: '/mnt/running',
      runtimeMs: 12_000,
      progress: { directoriesVisited: 3, filesVisited: 8, startedAt: '2026-05-14T10:00:00.000Z' },
    })
  })

  await page.route('**/api/jobs/job-completed', async (route) => {
    await fulfillJson(route, {
      id: 'job-completed',
      status: 'completed',
      rootPath: '/mnt/completed',
      runtimeMs: 65_000,
      progress: {
        directoriesVisited: 5,
        filesVisited: 12,
        startedAt: '2026-05-14T09:00:00.000Z',
        endedAt: '2026-05-14T09:01:05.000Z',
      },
    })
  })

  await page.route('**/api/jobs/job-completed/tree/root', async (route) => {
    await fulfillJson(route, {
      node: {
        id: 1,
        parentId: null,
        jobId: 'job-completed',
        depth: 1,
        name: 'completed',
        path: '/mnt/completed',
        sizeBytes: 1024,
        percentOfRoot: 100,
        inaccessible: false,
        hasChildren: false,
      },
    })
  })

  await page.route('**/api/jobs/job-completed/tree/children-batch', async (route) => {
    await fulfillJson(route, { byParentId: { '1': [] } })
  })

  await mockNoSuggestions(page)

  await page.goto('/')

  const runningRow = page.getByRole('button', { name: '/mnt/running' })
  const completedRow = page.getByRole('button', { name: '/mnt/completed' })

  await expect(runningRow.locator('div[aria-hidden="true"]')).toContainText('Runtime:')
  await expect(completedRow.locator('div[aria-hidden="false"]')).toContainText('Runtime: 1m 5s')
  await expect(page.getByText(/^3 directories · 8 files$/)).toBeVisible()

  await completedRow.click()

  await expect(page.getByText(/^5 directories · 12 files · Runtime 1m 5s$/)).toBeVisible()
})
