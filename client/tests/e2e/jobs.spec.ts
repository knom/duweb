import { expect, test } from '@playwright/test'
import { fulfillJson, mockNoSuggestions } from './helpers'

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
      result: { name: 'files', path: '/mnt/files', sizeBytes: 1, percentOfRoot: 100, children: [] },
    })
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
    await fulfillJson(route, { error: 'not used in this test' }, 500)
  })

  await page.route('**/api/jobs/job-2', async (route) => {
    if (route.request().method() === 'DELETE') {
      await route.fulfill({ status: 204, body: '' })
      return
    }
    await route.continue()
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

  await expect(page.getByText('QUEUED - dirs 0, files 0')).toBeVisible()
  await expect(page.getByLabel('Scan path')).toHaveValue('/var/log')
})
