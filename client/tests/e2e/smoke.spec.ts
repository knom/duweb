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
    })
  })

  await page.route('**/api/jobs/job-1/tree/root', async (route) => {
    await fulfillJson(route, {
      node: {
        id: 10,
        parentId: null,
        jobId: 'job-1',
        depth: 0,
        name: 'files',
        path: '/mnt/files',
        sizeBytes: 1024,
        percentOfRoot: 100,
        inaccessible: false,
        hasChildren: true,
      },
    })
  })

  await page.route('**/api/jobs/job-1/tree/nodes/10/children', async (route) => {
    await fulfillJson(route, {
      children: [
        {
          id: 11,
          parentId: 10,
          jobId: 'job-1',
          depth: 1,
          name: 'docker-compose-services',
          path: '/mnt/files/docker-compose-services',
          sizeBytes: 512,
          percentOfRoot: 50,
          inaccessible: false,
          hasChildren: false,
        },
      ],
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

test('prefetches deeper tree levels in background', async ({ page }) => {
  await mockNoSuggestions(page)

  let level2Fetched = false

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
    })
  })

  await page.route('**/api/jobs/job-1/tree/root', async (route) => {
    await fulfillJson(route, {
      node: {
        id: 10,
        parentId: null,
        jobId: 'job-1',
        depth: 0,
        name: 'files',
        path: '/mnt/files',
        sizeBytes: 1024,
        percentOfRoot: 100,
        inaccessible: false,
        hasChildren: true,
      },
    })
  })

  await page.route('**/api/jobs/job-1/tree/nodes/10/children', async (route) => {
    await fulfillJson(route, {
      children: [
        {
          id: 11,
          parentId: 10,
          jobId: 'job-1',
          depth: 1,
          name: 'parent-folder',
          path: '/mnt/files/parent-folder',
          sizeBytes: 900,
          percentOfRoot: 87.89,
          inaccessible: false,
          hasChildren: true,
        },
      ],
    })
  })

  await page.route('**/api/jobs/job-1/tree/nodes/11/children', async (route) => {
    level2Fetched = true
    await fulfillJson(route, {
      children: [
        {
          id: 12,
          parentId: 11,
          jobId: 'job-1',
          depth: 2,
          name: 'leaf',
          path: '/mnt/files/parent-folder/leaf',
          sizeBytes: 100,
          percentOfRoot: 9.77,
          inaccessible: false,
          hasChildren: false,
        },
      ],
    })
  })

  await page.goto('/')

  await expect
    .poll(() => level2Fetched, {
      timeout: 5000,
      message: 'expected automatic background prefetch to request second-level children',
    })
    .toBe(true)
})
