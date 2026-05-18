import { test, expect } from '@playwright/test'

// Mock data for tests
const mockChats = [
  {
    id: '1',
    chatId: '254712345678@c.us',
    contactName: 'John Mwangi',
    contactPhone: '+254712345678',
    lastMessage: 'Hello, I need help with SOMO registration',
    lastMessageTime: new Date().toISOString(),
    unreadCount: 2,
    status: 'open',
    isGroup: false,
    tags: ['SOMO'],
  },
  {
    id: '2',
    chatId: '254798765432@c.us',
    contactName: 'Mary Wanjiku',
    contactPhone: '+254798765432',
    lastMessage: 'Thank you for the assistance!',
    lastMessageTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    unreadCount: 0,
    status: 'resolved',
    isGroup: false,
    tags: ['SOMO', 'VIP'],
    assignedTo: 'Agent 1',
  },
  {
    id: '3',
    chatId: '254755555555@g.us',
    contactName: 'SOMO Kenya Group',
    contactPhone: '+254755555555',
    lastMessage: 'Welcome to the group!',
    lastMessageTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    unreadCount: 5,
    status: 'pending',
    isGroup: true,
    tags: ['SOMO'],
  },
]

const mockMessages = [
  {
    id: 'm1',
    chatId: '254712345678@c.us',
    content: 'Hello, I need help with SOMO registration',
    contentType: 'text',
    timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    sender: { type: 'customer', name: 'John Mwangi' },
    status: 'read',
    isFromMe: false,
  },
  {
    id: 'm2',
    chatId: '254712345678@c.us',
    content: 'Hi John! Welcome to SOMO. I can help you with registration.',
    contentType: 'text',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    sender: { type: 'bot', name: 'SOMO Bot' },
    status: 'delivered',
    isFromMe: true,
  },
]

test.describe('Chat List', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authenticated state
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

    // Mock chat list API
    await page.route('**/api/chats*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockChats,
          pagination: { page: 1, limit: 50, total: mockChats.length, hasMore: false },
        }),
      })
    })

    // Mock messages API
    await page.route('**/api/chats/*/messages*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockMessages,
          pagination: { page: 1, limit: 50, total: mockMessages.length, hasMore: false },
        }),
      })
    })
  })

  test.describe('rendering', () => {
    test('displays all chats', async ({ page }) => {
      await page.goto('/')

      // Wait for chats to load
      await expect(page.getByText('John Mwangi')).toBeVisible()
      await expect(page.getByText('Mary Wanjiku')).toBeVisible()
      await expect(page.getByText('SOMO Kenya Group')).toBeVisible()
    })

    test('displays unread count badges', async ({ page }) => {
      await page.goto('/')

      // John has 2 unread
      await expect(page.getByText('John Mwangi')).toBeVisible()
      // Should see unread badge
      await expect(page.getByText('2')).toBeVisible()
    })

    test('displays filter tabs', async ({ page }) => {
      await page.goto('/')

      await expect(page.getByRole('button', { name: 'All' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Pending' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Groups' })).toBeVisible()
    })
  })

  test.describe('filtering', () => {
    test('filters chats by Pending', async ({ page }) => {
      await page.goto('/')

      // Wait for initial load
      await expect(page.getByText('John Mwangi')).toBeVisible()

      // Click Pending filter
      await page.getByRole('button', { name: 'Pending' }).click()

      // Only pending chat should be visible
      await expect(page.getByText('SOMO Kenya Group')).toBeVisible()
      await expect(page.getByText('John Mwangi')).not.toBeVisible()
    })

    test('filters chats by Groups', async ({ page }) => {
      await page.goto('/')

      await expect(page.getByText('John Mwangi')).toBeVisible()

      // Click Groups filter
      await page.getByRole('button', { name: 'Groups' }).click()

      // Only group chat should be visible
      await expect(page.getByText('SOMO Kenya Group')).toBeVisible()
      await expect(page.getByText('John Mwangi')).not.toBeVisible()
      await expect(page.getByText('Mary Wanjiku')).not.toBeVisible()
    })
  })

  test.describe('search', () => {
    test('searches chats by name', async ({ page }) => {
      await page.goto('/')

      await expect(page.getByText('John Mwangi')).toBeVisible()

      // Type in search
      await page.getByPlaceholder('Search chats...').fill('John')

      // Only John should be visible
      await expect(page.getByText('John Mwangi')).toBeVisible()
      await expect(page.getByText('Mary Wanjiku')).not.toBeVisible()
    })

    test('shows empty state when no results', async ({ page }) => {
      await page.goto('/')

      await expect(page.getByText('John Mwangi')).toBeVisible()

      // Search for non-existent
      await page.getByPlaceholder('Search chats...').fill('xyz123nonexistent')

      // Should show empty state
      await expect(page.getByText('No chats found')).toBeVisible()
    })
  })

  test.describe('selection', () => {
    test('clicking chat shows messages', async ({ page }) => {
      await page.goto('/')

      // Wait for chats to load
      await expect(page.getByText('John Mwangi')).toBeVisible()

      // Click on John's chat
      await page.getByText('John Mwangi').click()

      // Should show messages (wait for message content)
      await expect(
        page.getByText('Hello, I need help with SOMO registration')
      ).toBeVisible({ timeout: 10000 })
    })

    test('selected chat is highlighted', async ({ page }) => {
      await page.goto('/')

      await expect(page.getByText('John Mwangi')).toBeVisible()

      // Click on John's chat
      await page.getByText('John Mwangi').click()

      // The button containing John's name should have selection styling
      const chatButton = page.getByText('John Mwangi').locator('xpath=ancestor::button')
      await expect(chatButton).toHaveClass(/bg-surface-100/)
    })
  })
})

test.describe('Conversation View', () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth
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

    // Mock chats
    await page.route('**/api/chats*', (route) => {
      if (!route.request().url().includes('/messages')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: mockChats,
          }),
        })
      } else {
        route.continue()
      }
    })

    // Mock messages
    await page.route('**/api/chats/*/messages*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: mockMessages,
        }),
      })
    })
  })

  test('displays message bubbles correctly', async ({ page }) => {
    await page.goto('/')

    // Select a chat
    await page.getByText('John Mwangi').click()

    // Check incoming message (customer)
    const incomingMessage = page.getByText('Hello, I need help with SOMO registration')
    await expect(incomingMessage).toBeVisible()

    // Check outgoing message (bot)
    const outgoingMessage = page.getByText('Hi John! Welcome to SOMO')
    await expect(outgoingMessage).toBeVisible()
  })

  test('shows message timestamps', async ({ page }) => {
    await page.goto('/')

    await page.getByText('John Mwangi').click()

    // Messages should have timestamps (HH:mm format)
    await expect(page.locator('text=/\\d{2}:\\d{2}/')).toBeVisible()
  })
})
