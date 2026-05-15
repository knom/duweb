import type { Page, Route } from '@playwright/test'

export function fulfillJson(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

export async function mockNoSuggestions(page: Page) {
  await page.route('**/api/paths/suggest**', async (route) => {
    await fulfillJson(route, { suggestions: [] })
  })
}

export async function mockAuthMe(
  page: Page,
  payload: { requireAuth: boolean; identity?: { username?: string; groups?: string[] } },
) {
  await page.route('**/api/auth/me', async (route) => {
    await fulfillJson(route, payload)
  })
}
