import { setupServer } from 'msw/node'
import { handlers } from './handlers'

// Create and export the MSW server for Node.js (Vitest)
export const server = setupServer(...handlers)

// Re-export handlers and state setters for convenience
export * from './handlers'
