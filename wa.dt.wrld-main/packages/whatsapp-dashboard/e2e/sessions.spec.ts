import { test, expect } from '@playwright/test'

// Mock session data
const mockSessions = [
  {
    sessionId: 'mysession',
    status: 'connected',
    phone: '+254748085137',
    pushName: 'SOMO Bot',
    lastSeen: new Date().toISOString(),
  },
  {
    sessionId: 'testsession',
    status: 'disconnected',
    lastSeen: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
  {
    sessionId: 'devsession',
    status: 'qr_required',
    qrCode: 'data:image/png;base64,mockqrcode',
  },
]

test.describe('Sessions Page', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authenticated state
    await page.route('**/auth/me', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          authenticated: true,
          user: { id: 'user-1', email: 'admin@example.com', name: 'Test Admin' },
          roles: ['tenant_admin', 'agent'],
          organizationId: 'org-1',
          organizationName: 'Test Organization',
        }),
      })
    })

    // Mock session status API
    await page.route('**/api/session/status/*', (route) => {
      const url = route.request().url()
      const sessionId = url.split('/').pop()
      const session = mockSessions.find((s) => s.sessionId === sessionId) || mockSessions[0]
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: session }),
      })
    })

    // Mock sessions list API
    await page.route('**/api/sessions', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockSessions }),
      })
    })
  })

  test.describe('session status display', () => {
    test('shows connected status with green indicator', async ({ page }) => {
      await page.goto('/settings')

      // Should display connected session
      await expect(page.getByText('mysession')).toBeVisible()

      // Connected status indicator (look for status text or green indicator)
      await expect(
        page.getByText(/connected/i).or(page.locator('.bg-green-500, .text-green-500'))
      ).toBeVisible()
    })

    test('shows disconnected status with red/gray indicator', async ({ page }) => {
      // Override route for a disconnected session
      await page.route('**/api/session/status/testsession', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              sessionId: 'testsession',
              status: 'disconnected',
              lastSeen: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
            },
          }),
        })
      })

      await page.goto('/settings')

      // Look for disconnected status
      await expect(
        page.getByText(/disconnected/i).or(page.locator('.bg-red-500, .text-red-500, .bg-gray-500'))
      ).toBeVisible()
    })
  })

  test.describe('QR code display', () => {
    test('shows QR code when status is qr_required', async ({ page }) => {
      // Override to return QR required status
      await page.route('**/api/session/status/mysession', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              sessionId: 'mysession',
              status: 'qr_required',
              qrCode: 'data:image/png;base64,mockqrcode',
            },
          }),
        })
      })

      await page.goto('/settings')

      // Should show QR required message or QR code image
      await expect(
        page.getByText(/qr|scan/i).or(page.locator('img[src*="qr"]'))
      ).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('session info', () => {
    test('displays phone number for connected session', async ({ page }) => {
      await page.goto('/settings')

      // Should show phone number
      await expect(page.getByText('+254748085137')).toBeVisible()
    })

    test('displays push name (bot name)', async ({ page }) => {
      await page.goto('/settings')

      // Should show bot name
      await expect(page.getByText('SOMO Bot')).toBeVisible()
    })
  })
})
