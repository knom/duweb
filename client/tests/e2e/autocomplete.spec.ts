import { expect, fulfillJson, test } from './helpers'

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
