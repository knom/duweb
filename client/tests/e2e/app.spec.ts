import { expect, test, type Page, type Route } from '@playwright/test'

function fulfillJson(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

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
  await page.route('**/api/paths/suggest**', async (route) => {
    await fulfillJson(route, { suggestions: [] })
  })

  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Disk Usage Web' })).toBeVisible()
  await expect(page.getByLabel('Scan path')).toHaveValue('/mnt/files')
  await expect(page.getByText('COMPLETED - dirs 12, files 48')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Scan' })).toBeVisible()
  await expect(page.getByText('docker-compose-services')).toBeVisible()
})

test('autocomplete works for repeated selections without refocus', async ({ page }) => {
  await page.route('**/api/jobs', async (route) => {
    await fulfillJson(route, [])
  })

  await page.route('**/api/paths/suggest**', async (route) => {
    const url = new URL(route.request().url())
    const query = url.searchParams.get('q') ?? ''

    const suggestions =
      query === '/mnt/f'
        ? ['/mnt/files/']
        : query === '/mnt/files/d'
          ? ['/mnt/files/docker-compose-services/']
          : []

    await fulfillJson(route, { suggestions })
  })

  await page.goto('/')

  const input = page.getByLabel('Scan path')
  await input.click()
  await input.fill('/mnt/f')

  await expect(page.getByRole('button', { name: '/mnt/files/' })).toBeVisible()
  await page.getByRole('button', { name: '/mnt/files/' }).click()
  await expect(input).toHaveValue('/mnt/files/')

  await input.type('d')
  await expect(page.getByRole('button', { name: '/mnt/files/docker-compose-services/' })).toBeVisible()
  await page.getByRole('button', { name: '/mnt/files/docker-compose-services/' }).click()

  await expect(input).toHaveValue('/mnt/files/docker-compose-services/')
})