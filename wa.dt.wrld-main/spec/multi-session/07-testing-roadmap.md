# Phase C: Comprehensive Testing & Validation (Roadmap)

**Status**: ⏳ PENDING
**Estimated Time**: Days 12-14 (3 days)
**Branch**: feature/multi-session-testing
**Depends On**: Phases A4 + B complete
**Agent**: 03-test-scaffold, 06-integration-validator

---

## Overview

Phase C will implement comprehensive testing and validation for the multi-session architecture, ensuring reliability, security, and performance under real-world conditions.

## Goals

1. **Unit Test Coverage**
   - 80%+ coverage across all packages
   - Test all session management logic
   - Test recovery mechanisms
   - Test API endpoints

2. **Integration Testing**
   - End-to-end session lifecycle
   - WhatsApp → API → n8n → Response flows
   - Session isolation verification
   - Webhook delivery testing

3. **Load Testing**
   - 10+ concurrent sessions
   - High message volume
   - Recovery under load
   - Resource usage monitoring

4. **Security Testing**
   - Session isolation
   - API authentication
   - Webhook secret validation
   - XSS/injection prevention

5. **E2E Testing**
   - Frontend workflows
   - n8n workflows
   - Complete user journeys

---

## Test Categories

### 1. Unit Tests (Agent 03-test-scaffold)

#### WhatsApp n8n Service Tests

**`packages/whatsapp-service/src/bot/session/MultiSessionManager.test.ts`** (~200 lines)
```typescript
describe('MultiSessionManager', () => {
  let manager: MultiSessionManager;

  beforeEach(() => {
    manager = new MultiSessionManager({ maxSessions: 5 });
  });

  describe('Session Creation', () => {
    test('creates session successfully', async () => {
      const config = {
        sessionId: 'test-1',
        webhookUrl: 'https://example.com/webhook'
      };

      const session = await manager.createSession(config);

      expect(session).toBeDefined();
      expect(session.config.sessionId).toBe('test-1');
      expect(manager.listSessions()).toHaveLength(1);
    });

    test('enforces max session limit', async () => {
      // Create 5 sessions (max)
      for (let i = 0; i < 5; i++) {
        await manager.createSession({
          sessionId: `test-${i}`,
          webhookUrl: 'https://example.com/webhook'
        });
      }

      // 6th should fail
      await expect(
        manager.createSession({
          sessionId: 'test-6',
          webhookUrl: 'https://example.com/webhook'
        })
      ).rejects.toThrow('Maximum sessions');
    });

    test('prevents duplicate sessionId', async () => {
      const config = {
        sessionId: 'duplicate',
        webhookUrl: 'https://example.com/webhook'
      };

      await manager.createSession(config);

      await expect(
        manager.createSession(config)
      ).rejects.toThrow('already exists');
    });

    test('validates sessionId format', async () => {
      await expect(
        manager.createSession({
          sessionId: 'invalid session!',
          webhookUrl: 'https://example.com/webhook'
        })
      ).rejects.toThrow('alphanumeric');
    });
  });

  describe('Session Retrieval', () => {
    test('getSession returns existing session', async () => {
      await manager.createSession({
        sessionId: 'test',
        webhookUrl: 'https://example.com/webhook'
      });

      const session = manager.getSession('test');

      expect(session).toBeDefined();
      expect(session?.config.sessionId).toBe('test');
    });

    test('getSession returns undefined for non-existent', () => {
      const session = manager.getSession('nonexistent');
      expect(session).toBeUndefined();
    });

    test('listSessions returns all sessions', async () => {
      await manager.createSession({
        sessionId: 'test-1',
        webhookUrl: 'https://example.com/webhook'
      });
      await manager.createSession({
        sessionId: 'test-2',
        webhookUrl: 'https://example.com/webhook'
      });

      const sessions = manager.listSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions.map(s => s.sessionId)).toContain('test-1');
      expect(sessions.map(s => s.sessionId)).toContain('test-2');
    });
  });

  describe('Session Destruction', () => {
    test('destroySession removes session', async () => {
      await manager.createSession({
        sessionId: 'test',
        webhookUrl: 'https://example.com/webhook'
      });

      await manager.destroySession('test');

      expect(manager.getSession('test')).toBeUndefined();
      expect(manager.listSessions()).toHaveLength(0);
    });

    test('destroySession throws for non-existent session', async () => {
      await expect(
        manager.destroySession('nonexistent')
      ).rejects.toThrow('not found');
    });
  });

  describe('Session Restart', () => {
    test('restartSession recreates session with same config', async () => {
      const config = {
        sessionId: 'test',
        webhookUrl: 'https://example.com/webhook'
      };

      await manager.createSession(config);
      await manager.restartSession('test');

      const session = manager.getSession('test');
      expect(session).toBeDefined();
      expect(session?.config.webhookUrl).toBe(config.webhookUrl);
    });

    test('restartSession throws for non-existent session', async () => {
      await expect(
        manager.restartSession('nonexistent')
      ).rejects.toThrow('not found');
    });
  });

  describe('Graceful Shutdown', () => {
    test('shutdown destroys all sessions', async () => {
      await manager.createSession({
        sessionId: 'test-1',
        webhookUrl: 'https://example.com/webhook'
      });
      await manager.createSession({
        sessionId: 'test-2',
        webhookUrl: 'https://example.com/webhook'
      });

      await manager.shutdown();

      expect(manager.listSessions()).toHaveLength(0);
    });
  });
});
```

**`packages/whatsapp-service/src/bot/session/SessionRecovery.test.ts`** (~150 lines)
```typescript
describe('SessionRecovery', () => {
  let recovery: SessionRecovery;
  let manager: MultiSessionManager;

  beforeEach(() => {
    manager = new MultiSessionManager({ maxSessions: 10 });
    recovery = new SessionRecovery(manager);
  });

  describe('Backoff Strategies', () => {
    test('exponential backoff doubles delay', () => {
      const state = {
        sessionId: 'test',
        maxRetries: 5,
        currentRetries: 0,
        backoffStrategy: 'exponential' as const
      };

      expect(recovery.getBackoffDelay(state)).toBe(5000);

      state.currentRetries = 1;
      expect(recovery.getBackoffDelay(state)).toBe(10000);

      state.currentRetries = 2;
      expect(recovery.getBackoffDelay(state)).toBe(20000);
    });

    test('linear backoff increments delay', () => {
      const state = {
        sessionId: 'test',
        maxRetries: 5,
        currentRetries: 0,
        backoffStrategy: 'linear' as const
      };

      expect(recovery.getBackoffDelay(state)).toBe(5000);

      state.currentRetries = 1;
      expect(recovery.getBackoffDelay(state)).toBe(10000);

      state.currentRetries = 2;
      expect(recovery.getBackoffDelay(state)).toBe(15000);
    });

    test('fixed backoff maintains same delay', () => {
      const state = {
        sessionId: 'test',
        maxRetries: 5,
        currentRetries: 0,
        backoffStrategy: 'fixed' as const
      };

      expect(recovery.getBackoffDelay(state)).toBe(5000);

      state.currentRetries = 5;
      expect(recovery.getBackoffDelay(state)).toBe(5000);
    });
  });

  describe('Recovery Logic', () => {
    test('schedules retry after failure', async () => {
      const session = await manager.createSession({
        sessionId: 'test',
        webhookUrl: 'https://example.com/webhook',
        autoRestart: true,
        maxRetries: 3
      });

      recovery.registerSession(session);

      await recovery.handleSessionFailure('test');

      // Verify retry scheduled
      const state = recovery.getRecoveryState('test');
      expect(state?.currentRetries).toBe(1);
      expect(state?.nextRetryAt).toBeDefined();
    });

    test('stops retrying after max attempts', async () => {
      const session = await manager.createSession({
        sessionId: 'test',
        webhookUrl: 'https://example.com/webhook',
        autoRestart: true,
        maxRetries: 2
      });

      recovery.registerSession(session);

      // Fail 3 times (exceeds max of 2)
      await recovery.handleSessionFailure('test');
      await recovery.handleSessionFailure('test');
      await recovery.handleSessionFailure('test');

      // Should emit recovery_failed event
      expect(recovery.getRecoveryState('test')?.currentRetries).toBe(2);
    });

    test('resets retry counter on success', async () => {
      const session = await manager.createSession({
        sessionId: 'test',
        webhookUrl: 'https://example.com/webhook',
        autoRestart: true
      });

      recovery.registerSession(session);

      // Fail once
      await recovery.handleSessionFailure('test');
      expect(recovery.getRecoveryState('test')?.currentRetries).toBe(1);

      // Simulate successful restart
      recovery.onRecoverySuccess('test');

      expect(recovery.getRecoveryState('test')?.currentRetries).toBe(0);
    });
  });
});
```

#### Frontend Tests

**`packages/whatsapp-frontend/tests/unit/SessionsController.test.ts`** (~120 lines)
```typescript
describe('SessionsController', () => {
  let controller: SessionsController;
  let mockAxios: jest.Mocked<typeof axios>;

  beforeEach(() => {
    mockAxios = axios as jest.Mocked<typeof axios>;
    controller = new SessionsController();
  });

  test('listSessions fetches from API', async () => {
    mockAxios.get.mockResolvedValue({
      data: {
        success: true,
        data: {
          sessions: [
            { sessionId: 'test-1', status: 'authenticated' },
            { sessionId: 'test-2', status: 'qr_ready' }
          ]
        }
      }
    });

    const sessions = await controller.listSessions();

    expect(sessions).toHaveLength(2);
    expect(mockAxios.get).toHaveBeenCalledWith(
      expect.stringContaining('/session'),
      expect.objectContaining({
        headers: { 'X-API-Key': expect.any(String) }
      })
    );
  });

  test('createSession sends correct payload', async () => {
    mockAxios.post.mockResolvedValue({
      data: {
        success: true,
        data: { sessionId: 'new-session' }
      }
    });

    await controller.createSession({
      sessionId: 'new-session',
      webhookUrl: 'https://example.com/webhook'
    });

    expect(mockAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/session'),
      {
        sessionId: 'new-session',
        webhookUrl: 'https://example.com/webhook'
      },
      expect.any(Object)
    );
  });

  test('getQRCode fetches QR data', async () => {
    mockAxios.get.mockResolvedValue({
      data: {
        success: true,
        data: {
          qrCode: '2@...',
          qrImage: 'data:image/png;base64,...',
          status: 'qr_ready'
        }
      }
    });

    const qrData = await controller.getQRCode('test');

    expect(qrData.qrCode).toBe('2@...');
    expect(qrData.status).toBe('qr_ready');
  });
});
```

### 2. Integration Tests

**`packages/whatsapp-service/tests/integration/session-lifecycle.test.ts`** (~250 lines)
```typescript
describe('Session Lifecycle Integration', () => {
  let app: Express;
  let manager: MultiSessionManager;

  beforeAll(async () => {
    app = createTestApp();
    manager = getMultiSessionManager();
  });

  afterEach(async () => {
    // Clean up all sessions
    const sessions = manager.listSessions();
    for (const session of sessions) {
      await manager.destroySession(session.sessionId);
    }
  });

  test('complete session lifecycle', async () => {
    // 1. Create session via API
    const createResponse = await request(app)
      .post('/session')
      .set('X-API-Key', API_KEY)
      .send({
        sessionId: 'integration-test',
        webhookUrl: 'https://example.com/webhook'
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.sessionId).toBe('integration-test');

    // 2. Verify session exists
    const getResponse = await request(app)
      .get('/session/integration-test')
      .set('X-API-Key', API_KEY);

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.data.status).toBe('initializing');

    // 3. Simulate QR ready
    const session = manager.getSession('integration-test');
    session?.client.emit('qr', '2@test-qr-code');

    // 4. Get QR code
    const qrResponse = await request(app)
      .get('/session/integration-test/qr')
      .set('X-API-Key', API_KEY);

    expect(qrResponse.status).toBe(200);
    expect(qrResponse.body.data.qrCode).toBeDefined();

    // 5. Simulate authentication
    session?.client.emit('ready');

    // 6. Verify authenticated status
    const statusResponse = await request(app)
      .get('/session/integration-test/status')
      .set('X-API-Key', API_KEY);

    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body.data.authenticated).toBe(true);

    // 7. Send message
    const sendResponse = await request(app)
      .post('/session/integration-test/send')
      .set('X-API-Key', API_KEY)
      .send({
        to: '1234567890@c.us',
        message: 'Test message'
      });

    expect(sendResponse.status).toBe(200);

    // 8. Destroy session
    const destroyResponse = await request(app)
      .delete('/session/integration-test')
      .set('X-API-Key', API_KEY);

    expect(destroyResponse.status).toBe(200);

    // 9. Verify session destroyed
    const finalGetResponse = await request(app)
      .get('/session/integration-test')
      .set('X-API-Key', API_KEY);

    expect(finalGetResponse.status).toBe(404);
  });

  test('session isolation', async () => {
    // Create two sessions
    await request(app)
      .post('/session')
      .set('X-API-Key', API_KEY)
      .send({
        sessionId: 'session-a',
        webhookUrl: 'https://example.com/webhook-a'
      });

    await request(app)
      .post('/session')
      .set('X-API-Key', API_KEY)
      .send({
        sessionId: 'session-b',
        webhookUrl: 'https://example.com/webhook-b'
      });

    // Authenticate both
    manager.getSession('session-a')?.client.emit('ready');
    manager.getSession('session-b')?.client.emit('ready');

    // Send message from session-a
    const mockWebhookA = jest.fn();
    nock('https://example.com')
      .post('/webhook-a')
      .reply(200, mockWebhookA);

    const sessionA = manager.getSession('session-a');
    sessionA?.client.emit('message', createMockMessage());

    // Verify only webhook-a called
    await waitFor(() => expect(mockWebhookA).toHaveBeenCalled());

    // Send message from session-b
    const mockWebhookB = jest.fn();
    nock('https://example.com')
      .post('/webhook-b')
      .reply(200, mockWebhookB);

    const sessionB = manager.getSession('session-b');
    sessionB?.client.emit('message', createMockMessage());

    // Verify only webhook-b called
    await waitFor(() => expect(mockWebhookB).toHaveBeenCalled());
  });
});
```

### 3. Load Testing

**`packages/whatsapp-service/tests/load/concurrent-sessions.test.ts`** (~150 lines)
```typescript
describe('Load Testing', () => {
  test('handles 10 concurrent sessions', async () => {
    const sessions: Promise<any>[] = [];

    // Create 10 sessions concurrently
    for (let i = 0; i < 10; i++) {
      sessions.push(
        request(app)
          .post('/session')
          .set('X-API-Key', API_KEY)
          .send({
            sessionId: `load-test-${i}`,
            webhookUrl: `https://example.com/webhook-${i}`
          })
      );
    }

    const results = await Promise.all(sessions);

    // All should succeed
    results.forEach(result => {
      expect(result.status).toBe(201);
    });

    // Verify all sessions created
    const listResponse = await request(app)
      .get('/session')
      .set('X-API-Key', API_KEY);

    expect(listResponse.body.data.total).toBe(10);
  });

  test('handles high message volume', async () => {
    // Create session
    await request(app)
      .post('/session')
      .set('X-API-Key', API_KEY)
      .send({
        sessionId: 'load-test',
        webhookUrl: 'https://example.com/webhook'
      });

    // Authenticate
    manager.getSession('load-test')?.client.emit('ready');

    // Send 100 messages concurrently
    const messages: Promise<any>[] = [];
    for (let i = 0; i < 100; i++) {
      messages.push(
        request(app)
          .post('/session/load-test/send')
          .set('X-API-Key', API_KEY)
          .send({
            to: '1234567890@c.us',
            message: `Test message ${i}`
          })
      );
    }

    const results = await Promise.all(messages);

    // All should succeed or have graceful errors
    const successCount = results.filter(r => r.status === 200).length;
    expect(successCount).toBeGreaterThan(90); // 90%+ success rate
  });
});
```

### 4. Security Testing

**`packages/whatsapp-service/tests/security/session-security.test.ts`** (~200 lines)
```typescript
describe('Security Testing', () => {
  test('API key required for all endpoints', async () => {
    const endpoints = [
      { method: 'get', path: '/session' },
      { method: 'post', path: '/session' },
      { method: 'get', path: '/session/test' },
      { method: 'delete', path: '/session/test' }
    ];

    for (const endpoint of endpoints) {
      const response = await request(app)[endpoint.method](endpoint.path);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('API key');
    }
  });

  test('sessionId XSS prevention', async () => {
    const response = await request(app)
      .post('/session')
      .set('X-API-Key', API_KEY)
      .send({
        sessionId: '<script>alert("xss")</script>',
        webhookUrl: 'https://example.com/webhook'
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('alphanumeric');
  });

  test('webhook URL validation', async () => {
    const response = await request(app)
      .post('/session')
      .set('X-API-Key', API_KEY)
      .send({
        sessionId: 'test',
        webhookUrl: 'javascript:alert("xss")'
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('valid URL');
  });

  test('session isolation prevents cross-session access', async () => {
    // Create two sessions
    await request(app)
      .post('/session')
      .set('X-API-Key', API_KEY)
      .send({
        sessionId: 'session-a',
        webhookUrl: 'https://example.com/webhook-a'
      });

    await request(app)
      .post('/session')
      .set('X-API-Key', API_KEY)
      .send({
        sessionId: 'session-b',
        webhookUrl: 'https://example.com/webhook-b'
      });

    // Try to access session-a's data from session-b
    // This should not be possible
    const sessionA = manager.getSession('session-a');
    const sessionB = manager.getSession('session-b');

    expect(sessionA?.config.webhookUrl).not.toBe(sessionB?.config.webhookUrl);
    expect(sessionA?.client).not.toBe(sessionB?.client);
  });
});
```

### 5. E2E Testing (Playwright)

**`packages/whatsapp-frontend/tests/e2e/session-management.spec.ts`** (~180 lines)
```typescript
import { test, expect } from '@playwright/test';

test.describe('Session Management E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[name=username]', 'admin');
    await page.fill('[name=password]', 'password');
    await page.click('button[type=submit]');
    await expect(page).toHaveURL('/sessions');
  });

  test('create and view session', async ({ page }) => {
    // Navigate to create form
    await page.click('a[href="/sessions/create"]');
    await expect(page).toHaveURL('/sessions/create');

    // Fill form
    await page.fill('[name=sessionId]', 'e2e-test');
    await page.fill('[name=webhookUrl]', 'https://example.com/webhook');
    await page.fill('[name=webhookSecret]', 'secret123');
    await page.check('[name=autoRestart]');

    // Submit
    await page.click('button[type=submit]');
    await expect(page).toHaveURL('/sessions');

    // Verify session appears in list
    await expect(page.locator('[data-session-id="e2e-test"]')).toBeVisible();
    await expect(page.locator('[data-session-id="e2e-test"] .status-badge')).toContainText('initializing');
  });

  test('QR code workflow', async ({ page }) => {
    // Create session first
    await page.goto('/sessions/create');
    await page.fill('[name=sessionId]', 'qr-test');
    await page.fill('[name=webhookUrl]', 'https://example.com/webhook');
    await page.click('button[type=submit]');

    // Wait for QR ready status
    await page.waitForSelector('[data-session-id="qr-test"] .status-qr_ready', { timeout: 10000 });

    // Click View QR
    await page.click('[data-session-id="qr-test"] a:has-text("View QR")');
    await expect(page).toHaveURL('/sessions/qr-test/qr');

    // Verify QR image visible
    await expect(page.locator('#qr-image')).toBeVisible();

    // Verify auto-refresh (status should update)
    // Simulate authentication in backend
    // ...

    // After authentication, should redirect back to sessions
    await expect(page).toHaveURL('/sessions', { timeout: 30000 });
  });

  test('destroy session', async ({ page }) => {
    // Create session
    await page.goto('/sessions/create');
    await page.fill('[name=sessionId]', 'delete-test');
    await page.fill('[name=webhookUrl]', 'https://example.com/webhook');
    await page.click('button[type=submit]');

    // Verify session exists
    await expect(page.locator('[data-session-id="delete-test"]')).toBeVisible();

    // Delete session
    page.on('dialog', dialog => dialog.accept()); // Accept confirmation
    await page.click('[data-session-id="delete-test"] button:has-text("Delete")');

    // Verify session removed
    await expect(page.locator('[data-session-id="delete-test"]')).not.toBeVisible();
  });

  test('restart session', async ({ page }) => {
    // Create session
    await page.goto('/sessions/create');
    await page.fill('[name=sessionId]', 'restart-test');
    await page.fill('[name=webhookUrl]', 'https://example.com/webhook');
    await page.click('button[type=submit]');

    // Simulate failure (set status to failed via backend)
    // ...

    // Wait for failed status
    await page.waitForSelector('[data-session-id="restart-test"] .status-failed');

    // Restart session
    await page.click('[data-session-id="restart-test"] button:has-text("Restart")');

    // Verify status changes back to initializing
    await expect(page.locator('[data-session-id="restart-test"] .status-badge')).toContainText('initializing');
  });
});
```

---

## Agent Execution Plan

### Test Generation (Agent 03-test-scaffold)
```bash
cd /Users/kago/space/dater.local/wa-chatbot-local

# Generate tests for whatsapp-service
orchestrator update \
  --package whatsapp-service \
  --agents "03" \
  --task "Generate comprehensive test suite for multi-session"

# Generates:
# - Unit tests for all session classes
# - Integration tests for API endpoints
# - Load tests for concurrent sessions
# - Security tests

# Generate tests for whatsapp-frontend
orchestrator update \
  --package whatsapp-frontend \
  --agents "03" \
  --task "Generate E2E and integration tests for session UI"

# Generates:
# - E2E tests (Playwright)
# - Integration tests
# - Unit tests for controllers
```

### Validation (Agent 06-integration-validator)
```bash
# Run complete validation suite
orchestrator validate \
  --agents "06" \
  --commit-range HEAD~10..HEAD

# Performs:
# - TypeScript compilation check
# - Linting
# - Unit test execution
# - Integration test execution
# - Docker build test
# - Security scanning
# - Health check verification
```

---

## Metrics & Goals

**Test Coverage Goals**:
- whatsapp-service: 85%+
- whatsapp-frontend: 80%+
- whatsapp-n8n-nodes: 75%+

**Performance Goals**:
- 10 concurrent sessions: < 1s response time
- 100 messages/second: 95%+ success rate
- Session creation: < 2s
- QR generation: < 1s

**Security Goals**:
- 100% API endpoints require authentication
- Zero XSS vulnerabilities
- Complete session isolation
- Webhook secret validation

**Time Estimate**: 3 days
- Day 12: Unit tests + integration tests
- Day 13: Load testing + security testing
- Day 14: E2E tests + validation

---

## Success Criteria

✅ **Test Coverage**:
- 80%+ overall coverage
- All critical paths tested
- Edge cases covered

✅ **Performance**:
- 10+ concurrent sessions work
- High message volume supported
- Recovery mechanisms validated

✅ **Security**:
- Session isolation verified
- Authentication enforced
- Input validation complete

✅ **E2E**:
- All user workflows tested
- n8n integration verified
- Frontend fully functional

✅ **Validation**:
- TypeScript compiles
- Linting passes
- Docker builds successfully
- Health checks pass

---

## References

- **Depends On**:
  - [005-phase-a4-frontend-roadmap.md](005-phase-a4-frontend-roadmap.md)
  - [006-phase-b-n8n-roadmap.md](006-phase-b-n8n-roadmap.md)
- **Agent System**:
  - [.claude/agents/03-test-scaffold.md](../.claude/agents/03-test-scaffold.md)
  - [.claude/agents/06-integration-validator.md](../.claude/agents/06-integration-validator.md)
- **Implementation Plan**: [MULTI_SESSION_PLAN.md](../../MULTI_SESSION_PLAN.md)

---

**Status**: ⏳ Ready to implement after A4 + B
**Blocking**: Phases A4 and B must complete
**Pattern**: Comprehensive testing, validation-driven
