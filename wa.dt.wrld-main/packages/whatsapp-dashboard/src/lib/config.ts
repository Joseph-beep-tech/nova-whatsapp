/**
 * Dashboard configuration
 *
 * Environment variables:
 * - VITE_USE_MOCK_API: 'true' to use MSW mock handlers, 'false' for real API
 * - VITE_API_BASE_URL: Base URL for API calls (when not mocking)
 * - VITE_SESSION_ID: Default WhatsApp session ID
 */

// Check if running in test environment (Vitest sets this)
const isTestEnv = typeof import.meta.env.MODE === 'string' && import.meta.env.MODE === 'test'

// Mock API flag - defaults to true in development/test, false in production
export const USE_MOCK_API =
  isTestEnv ||
  import.meta.env.VITE_USE_MOCK_API === 'true' ||
  import.meta.env.VITE_USE_MOCK_API === true

// API base URL
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

// Default session ID
export const SESSION_ID = import.meta.env.VITE_SESSION_ID || 'mysession'

// Log configuration in development
if (import.meta.env.DEV && !isTestEnv) {
  console.log('[Config] Mock API:', USE_MOCK_API ? 'ENABLED' : 'DISABLED')
  if (!USE_MOCK_API) {
    console.log('[Config] API Base URL:', API_BASE_URL)
  }
}
