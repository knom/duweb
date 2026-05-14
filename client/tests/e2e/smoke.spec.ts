import { expect, test, type Page } from '@playwright/test'
import { fulfillJson, mockNoSuggestions } from './helpers'

async function mockInitialJobs(page: Page) {
  await page.route('**/api/jobs', async (route) => {
    await fulfillJson(route, [
      {
        id: 'job-1',
        status: 'completed',
        rootPath: '/mnt/files',
        progress: {
          directoriesVisited: 12,
          filesVisited: 48,
          startedAt: '2026-05-14T10:00:00.000Z',
          endedAt: '2026-05-14T10:00:03.000Z',
        },
      },
    ])
  })

  await page.route('**/api/jobs/job-1', async (route) => {
    await fulfillJson(route, {
      id: 'job-1',
      status: 'completed',
      rootPath: '/mnt/files',
      progress: {
        directoriesVisited: 12,
        filesVisited: 48,
        startedAt: '2026-05-14T10:00:00.000Z',
        endedAt: '2026-05-14T10:00:03.000Z',
      },
      result: {
        name: 'files',
        path: '/mnt/files',
        sizeBytes: 1024,
        percentOfRoot: 100,
        children: [
          {
            name: 'docker-compose-services',
            path: '/mnt/files/docker-compose-services',
            sizeBytes: 512,
            percentOfRoot: 50,
            children: [],
          },
        ],
      },
    })
  })
}

test('loads the app shell and initial job details', async ({ page }) => {
  await mockInitialJobs(page)
  await mockNoSuggestions(page)

  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Disk Usage Web' })).toBeVisible()
  await expect(page.getByLabel('Scan path')).toHaveValue('/mnt/files')
  await expect(page.getByText('COMPLETED - dirs 12, files 48')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Scan' })).toBeVisible()
  await expect(page.getByText('docker-compose-services')).toBeVisible()
})
