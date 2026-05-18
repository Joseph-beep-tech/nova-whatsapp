import { http, HttpResponse, delay } from 'msw'

// Mutable state for tests
let isHealthy = true

// Helper to set health state for tests
export function setMockHealthy(healthy: boolean) {
  isHealthy = healthy
}

// Reset to default state
export function resetMockHealthState() {
  isHealthy = true
}

export const healthHandlers = [
  // GET /api/health - Health check endpoint
  http.get('/api/health', async () => {
    await delay(20)

    if (!isHealthy) {
      return HttpResponse.json(
        { status: 'unhealthy', error: 'Service unavailable' },
        { status: 503 }
      )
    }

    return HttpResponse.json({
      status: 'healthy',
      version: '0.1.0',
      uptime: 12345,
    })
  }),

  // GET /service/health - Alternative health endpoint
  http.get('/service/health', async () => {
    await delay(20)

    if (!isHealthy) {
      return HttpResponse.json(
        { status: 'unhealthy', error: 'Service unavailable' },
        { status: 503 }
      )
    }

    return HttpResponse.json({
      status: 'healthy',
      version: '0.1.0',
      services: {
        mongodb: 'connected',
        redis: 'connected',
        qdrant: 'connected',
      },
    })
  }),

  // GET /service/ping - Simple ping
  http.get('/service/ping', async () => {
    await delay(10)
    return HttpResponse.text('pong')
  }),
]
