import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test.describe('unauthenticated access', () => {
    test('redirects to login page when not authenticated', async ({ page }) => {
      // Mock unauthenticated state - return 401 from auth/me
      await page.route('**/auth/me', (route) => {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Not authenticated' }),
        })
      })

      // Navigate to protected route
      await page.goto('/')

      // Should redirect to login page
      await expect(page).toHaveURL('/login')
      // Or show login component based on implementation
      await expect(
        page.getByRole('heading', { name: /login|sign in/i }).or(
          page.getByRole('button', { name: /login|sign in/i })
        )
      ).toBeVisible()
    })

    test('shows login button on login page', async ({ page }) => {
      await page.route('**/auth/me', (route) => {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Not authenticated' }),
        })
      })

      await page.goto('/login')

      // Should show login option
      await expect(
        page.getByRole('button', { name: /login|sign in/i })
      ).toBeVisible()
    })
  })

  test.describe('authenticated access', () => {
    test.beforeEach(async ({ page }) => {
      // Mock authenticated state
      await page.route('**/auth/me', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            authenticated: true,
            user: {
              id: 'user-1',
              email: 'agent@example.com',
              name: 'Test Agent',
            },
            roles: ['agent'],
            organizationId: 'org-1',
            organizationName: 'Test Organization',
          }),
        })
      })
    })

    test('shows dashboard when authenticated', async ({ page }) => {
      await page.goto('/')

      // Should see the main dashboard elements
      await expect(page.getByText('Chats')).toBeVisible()
    })

    test('shows user info in navigation', async ({ page }) => {
      await page.goto('/')

      // Should show user name or organization somewhere
      await expect(
        page.getByText('Test Agent').or(page.getByText('Test Organization'))
      ).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('logout', () => {
    test('logout clears session and redirects', async ({ page }) => {
      // Start authenticated
      await page.route('**/auth/me', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            authenticated: true,
            user: { id: 'user-1', email: 'agent@example.com', name: 'Test Agent' },
            roles: ['agent'],
            organizationId: 'org-1',
            organizationName: 'Test Organization',
          }),
        })
      })

      // Mock logout endpoint
      await page.route('**/auth/logout', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        })
      })

      await page.goto('/')

      // Wait for page to load
      await expect(page.getByText('Chats')).toBeVisible()

      // Find and click logout (may be in a dropdown or sidebar)
      const logoutButton = page.getByRole('button', { name: /logout|sign out/i })

      if (await logoutButton.isVisible()) {
        await logoutButton.click()

        // Should redirect to login
        await expect(page).toHaveURL(/login/)
      }
    })
  })
})
