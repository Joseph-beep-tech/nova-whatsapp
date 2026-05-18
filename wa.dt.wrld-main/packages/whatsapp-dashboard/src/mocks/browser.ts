import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

// Create and export the MSW worker for browser (development)
export const worker = setupWorker(...handlers)

// Re-export handlers and state setters for convenience
export * from './handlers'
