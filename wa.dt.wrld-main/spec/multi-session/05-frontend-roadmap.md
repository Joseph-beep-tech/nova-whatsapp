# Phase A4: Frontend UI (Roadmap)

**Status**: ⏳ PENDING
**Estimated Time**: Days 7-8 (2 days)
**Branch**: feature/multi-session-frontend
**Depends On**: Phase A3 (004-phase-a3-integration.md)

---

## Overview

Phase A4 will build the web UI for managing multiple WhatsApp sessions, allowing users to create, monitor, and manage sessions through a browser interface. This phase builds on the API layer from Phase A2/A3.

## Goals

1. **Session Management UI**
   - List all active sessions with status
   - Create new sessions with configuration
   - Delete/destroy sessions
   - Restart failed sessions

2. **QR Code Display**
   - Display QR codes for authentication
   - Auto-refresh until authenticated
   - Session-specific QR routes

3. **Status Monitoring**
   - Real-time session status indicators
   - Authentication state display
   - Error message display
   - Last activity timestamps

4. **User Experience**
   - Responsive design (mobile-friendly)
   - Session-based authentication
   - Loading states
   - Error handling

---

## Files to Create

### Routes

#### `packages/whatsapp-frontend/src/routes/sessions.ts` (~200 lines)
Session management routes.

**Endpoints to Implement**:
```typescript
// GET /sessions - List all sessions
router.get('/', requireAuth, async (req, res) => {
  try {
    const response = await axios.get(`${WHATSAPP_SERVICE_URL}/session`, {
      headers: { 'X-API-Key': API_KEY }
    });

    res.render('sessions/list', {
      sessions: response.data.data.sessions,
      total: response.data.data.total
    });
  } catch (error) {
    res.render('sessions/list', {
      error: 'Failed to load sessions',
      sessions: [],
      total: 0
    });
  }
});

// GET /sessions/create - Create session form
router.get('/create', requireAuth, (req, res) => {
  res.render('sessions/create');
});

// POST /sessions/create - Handle session creation
router.post('/create', requireAuth, async (req, res) => {
  try {
    const { sessionId, webhookUrl, webhookSecret, autoRestart } = req.body;

    await axios.post(`${WHATSAPP_SERVICE_URL}/session`, {
      sessionId,
      webhookUrl,
      webhookSecret,
      autoRestart: autoRestart === 'on'
    }, {
      headers: { 'X-API-Key': API_KEY }
    });

    res.redirect('/sessions');
  } catch (error) {
    res.render('sessions/create', {
      error: error.response?.data?.error || 'Failed to create session'
    });
  }
});

// GET /sessions/:sessionId/qr - QR code display
router.get('/:sessionId/qr', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const response = await axios.get(
      `${WHATSAPP_SERVICE_URL}/session/${sessionId}/qr`,
      { headers: { 'X-API-Key': API_KEY } }
    );

    res.render('sessions/qr', {
      sessionId,
      qrImage: response.data.data.qrImage,
      status: response.data.data.status
    });
  } catch (error) {
    res.render('sessions/qr', {
      sessionId: req.params.sessionId,
      error: 'QR code not available'
    });
  }
});

// POST /sessions/:sessionId/destroy - Destroy session
router.post('/:sessionId/destroy', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;

    await axios.delete(`${WHATSAPP_SERVICE_URL}/session/${sessionId}`, {
      headers: { 'X-API-Key': API_KEY }
    });

    res.redirect('/sessions');
  } catch (error) {
    res.redirect('/sessions?error=destroy_failed');
  }
});

// POST /sessions/:sessionId/restart - Restart session
router.post('/:sessionId/restart', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;

    await axios.post(
      `${WHATSAPP_SERVICE_URL}/session/${sessionId}/restart`,
      {},
      { headers: { 'X-API-Key': API_KEY } }
    );

    res.redirect('/sessions');
  } catch (error) {
    res.redirect('/sessions?error=restart_failed');
  }
});

export default router;
```

#### `packages/whatsapp-frontend/src/routes/api/sessions.ts` (~150 lines)
AJAX API endpoints for real-time updates.

**Endpoints to Implement**:
```typescript
// GET /api/sessions - JSON session list
router.get('/', requireAuth, async (req, res) => {
  try {
    const response = await axios.get(`${WHATSAPP_SERVICE_URL}/session`, {
      headers: { 'X-API-Key': API_KEY }
    });

    res.json(response.data);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sessions'
    });
  }
});

// GET /api/sessions/:sessionId/status - Poll session status
router.get('/:sessionId/status', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const response = await axios.get(
      `${WHATSAPP_SERVICE_URL}/session/${sessionId}/status`,
      { headers: { 'X-API-Key': API_KEY } }
    );

    res.json(response.data);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch session status'
    });
  }
});

// GET /api/sessions/:sessionId/qr - Poll QR code
router.get('/:sessionId/qr', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const response = await axios.get(
      `${WHATSAPP_SERVICE_URL}/session/${sessionId}/qr`,
      { headers: { 'X-API-Key': API_KEY } }
    );

    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error || 'Failed to fetch QR code'
    });
  }
});

export default router;
```

### Views

#### `packages/whatsapp-frontend/src/views/sessions/list.html` (~250 lines)
Session list page with status indicators.

**UI Components**:
```html
<!DOCTYPE html>
<html>
<head>
  <title>WhatsApp Sessions</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body class="bg-gray-50">
  <div class="container mx-auto p-6">
    <!-- Header -->
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold">WhatsApp Sessions</h1>
      <a href="/sessions/create" class="btn btn-primary">
        + Create Session
      </a>
    </div>

    <!-- Error Message -->
    {{#if error}}
    <div class="alert alert-error mb-4">
      {{error}}
    </div>
    {{/if}}

    <!-- Session Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {{#each sessions}}
      <div class="card session-card" data-session-id="{{sessionId}}">
        <!-- Session Header -->
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-semibold">{{sessionId}}</h3>
          <span class="status-badge status-{{status}}">{{status}}</span>
        </div>

        <!-- Session Details -->
        <div class="space-y-2 text-sm">
          {{#if authenticated}}
          <div class="flex items-center text-green-600">
            <svg class="w-4 h-4 mr-2"><!-- Check icon --></svg>
            <span>Authenticated: {{phoneNumber}}</span>
          </div>
          {{else}}
          <div class="flex items-center text-yellow-600">
            <svg class="w-4 h-4 mr-2"><!-- Warning icon --></svg>
            <span>Not authenticated</span>
          </div>
          {{/if}}

          <div class="text-gray-600">
            Created: {{formatDate createdAt}}
          </div>

          {{#if lastActivity}}
          <div class="text-gray-600">
            Last activity: {{formatTimeAgo lastActivity}}
          </div>
          {{/if}}

          {{#if lastError}}
          <div class="text-red-600">
            Error: {{lastError}}
          </div>
          {{/if}}
        </div>

        <!-- Actions -->
        <div class="mt-4 flex gap-2">
          {{#if (eq status 'qr_ready')}}
          <a href="/sessions/{{sessionId}}/qr" class="btn btn-sm btn-primary flex-1">
            View QR
          </a>
          {{/if}}

          {{#if (or (eq status 'failed') (eq status 'disconnected'))}}
          <form method="POST" action="/sessions/{{sessionId}}/restart" class="flex-1">
            <button type="submit" class="btn btn-sm btn-warning w-full">
              Restart
            </button>
          </form>
          {{/if}}

          <form method="POST" action="/sessions/{{sessionId}}/destroy"
                onsubmit="return confirm('Destroy session {{sessionId}}?')">
            <button type="submit" class="btn btn-sm btn-danger">
              Delete
            </button>
          </form>
        </div>
      </div>
      {{/each}}
    </div>

    <!-- Empty State -->
    {{#if (eq total 0)}}
    <div class="text-center py-12">
      <p class="text-gray-600 mb-4">No sessions yet</p>
      <a href="/sessions/create" class="btn btn-primary">
        Create Your First Session
      </a>
    </div>
    {{/if}}
  </div>

  <!-- Auto-refresh Script -->
  <script>
    // Poll session status every 5 seconds
    setInterval(async () => {
      const response = await fetch('/api/sessions');
      const data = await response.json();

      if (data.success) {
        data.data.sessions.forEach(session => {
          const card = document.querySelector(`[data-session-id="${session.sessionId}"]`);
          if (card) {
            updateSessionCard(card, session);
          }
        });
      }
    }, 5000);

    function updateSessionCard(card, session) {
      // Update status badge
      const badge = card.querySelector('.status-badge');
      badge.className = `status-badge status-${session.status}`;
      badge.textContent = session.status;

      // Update authentication status
      // Update last activity
      // etc.
    }
  </script>
</body>
</html>
```

#### `packages/whatsapp-frontend/src/views/sessions/create.html` (~150 lines)
Create session form.

**Form Fields**:
```html
<!DOCTYPE html>
<html>
<head>
  <title>Create Session</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body class="bg-gray-50">
  <div class="container mx-auto p-6 max-w-2xl">
    <h1 class="text-3xl font-bold mb-6">Create WhatsApp Session</h1>

    {{#if error}}
    <div class="alert alert-error mb-4">
      {{error}}
    </div>
    {{/if}}

    <form method="POST" action="/sessions/create" class="card">
      <!-- Session ID -->
      <div class="form-group">
        <label for="sessionId" class="label">Session ID *</label>
        <input
          type="text"
          id="sessionId"
          name="sessionId"
          class="input"
          pattern="[a-zA-Z0-9_-]+"
          minlength="3"
          maxlength="50"
          required
          placeholder="e.g., client-a"
        />
        <p class="help-text">
          Alphanumeric only (with - and _ allowed). 3-50 characters.
        </p>
      </div>

      <!-- Webhook URL -->
      <div class="form-group">
        <label for="webhookUrl" class="label">Webhook URL *</label>
        <input
          type="url"
          id="webhookUrl"
          name="webhookUrl"
          class="input"
          required
          placeholder="https://flow.dater.world/webhook/client-a"
        />
        <p class="help-text">
          n8n webhook URL to receive WhatsApp events
        </p>
      </div>

      <!-- Webhook Secret -->
      <div class="form-group">
        <label for="webhookSecret" class="label">Webhook Secret</label>
        <input
          type="password"
          id="webhookSecret"
          name="webhookSecret"
          class="input"
          placeholder="Optional security token"
        />
        <p class="help-text">
          Optional. Include X-Webhook-Secret header in webhook calls.
        </p>
      </div>

      <!-- Auto Restart -->
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" name="autoRestart" checked />
          <span>Auto-restart on failure</span>
        </label>
        <p class="help-text">
          Automatically restart session if connection fails
        </p>
      </div>

      <!-- Actions -->
      <div class="flex gap-2 mt-6">
        <button type="submit" class="btn btn-primary flex-1">
          Create Session
        </button>
        <a href="/sessions" class="btn btn-secondary">
          Cancel
        </a>
      </div>
    </form>
  </div>
</body>
</html>
```

#### `packages/whatsapp-frontend/src/views/sessions/qr.html` (~120 lines)
QR code display with auto-refresh.

**QR Display**:
```html
<!DOCTYPE html>
<html>
<head>
  <title>QR Code - {{sessionId}}</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body class="bg-gray-50">
  <div class="container mx-auto p-6 max-w-2xl">
    <div class="flex items-center mb-6">
      <a href="/sessions" class="btn btn-secondary mr-4">← Back</a>
      <h1 class="text-3xl font-bold">QR Code: {{sessionId}}</h1>
    </div>

    <div class="card text-center">
      {{#if error}}
      <div class="alert alert-error mb-4">
        {{error}}
      </div>
      {{else}}
      <!-- QR Code Image -->
      <div id="qr-container" class="mb-4">
        <img
          id="qr-image"
          src="{{qrImage}}"
          alt="QR Code"
          class="mx-auto w-64 h-64"
        />
      </div>

      <!-- Status -->
      <div id="status-container" class="mb-4">
        <span class="status-badge status-{{status}}">{{status}}</span>
      </div>

      <!-- Instructions -->
      <div class="text-gray-600">
        <p class="mb-2">Scan this QR code with WhatsApp to authenticate</p>
        <p class="text-sm">1. Open WhatsApp on your phone</p>
        <p class="text-sm">2. Tap Menu → Linked Devices</p>
        <p class="text-sm">3. Tap "Link a Device"</p>
        <p class="text-sm">4. Scan this QR code</p>
      </div>
      {{/if}}
    </div>
  </div>

  <!-- Auto-refresh Script -->
  <script>
    let pollInterval;

    async function pollQRCode() {
      try {
        const response = await fetch('/api/sessions/{{sessionId}}/qr');
        const data = await response.json();

        if (data.success) {
          // Update QR image
          document.getElementById('qr-image').src = data.data.qrImage;

          // Update status
          const statusBadge = document.querySelector('.status-badge');
          statusBadge.className = `status-badge status-${data.data.status}`;
          statusBadge.textContent = data.data.status;

          // If authenticated, redirect to session list
          if (data.data.status === 'authenticated') {
            clearInterval(pollInterval);
            window.location.href = '/sessions';
          }
        } else if (response.status === 400) {
          // QR code not available (authenticated or error)
          clearInterval(pollInterval);
          window.location.href = '/sessions';
        }
      } catch (error) {
        console.error('Failed to poll QR code:', error);
      }
    }

    // Poll every 2 seconds
    pollInterval = setInterval(pollQRCode, 2000);

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      clearInterval(pollInterval);
    });
  </script>
</body>
</html>
```

### Controllers

#### `packages/whatsapp-frontend/src/controllers/SessionsController.ts` (~180 lines)
Controller with business logic for session management.

**Methods to Implement**:
```typescript
export class SessionsController {
  private serviceUrl: string;
  private apiKey: string;

  constructor() {
    this.serviceUrl = process.env.WHATSAPP_SERVICE_URL || 'http://localhost:3000';
    this.apiKey = process.env.API_KEY || '';
  }

  async listSessions(): Promise<SessionState[]> {
    const response = await axios.get(`${this.serviceUrl}/session`, {
      headers: { 'X-API-Key': this.apiKey }
    });

    return response.data.data.sessions;
  }

  async createSession(config: CreateSessionRequest): Promise<SessionState> {
    const response = await axios.post(`${this.serviceUrl}/session`, config, {
      headers: { 'X-API-Key': this.apiKey }
    });

    return response.data.data;
  }

  async getSession(sessionId: string): Promise<SessionState> {
    const response = await axios.get(`${this.serviceUrl}/session/${sessionId}`, {
      headers: { 'X-API-Key': this.apiKey }
    });

    return response.data.data;
  }

  async destroySession(sessionId: string): Promise<void> {
    await axios.delete(`${this.serviceUrl}/session/${sessionId}`, {
      headers: { 'X-API-Key': this.apiKey }
    });
  }

  async restartSession(sessionId: string): Promise<void> {
    await axios.post(
      `${this.serviceUrl}/session/${sessionId}/restart`,
      {},
      { headers: { 'X-API-Key': this.apiKey } }
    );
  }

  async getQRCode(sessionId: string): Promise<{ qrCode: string; qrImage: string; status: string }> {
    const response = await axios.get(`${this.serviceUrl}/session/${sessionId}/qr`, {
      headers: { 'X-API-Key': this.apiKey }
    });

    return response.data.data;
  }

  async getSessionStatus(sessionId: string): Promise<SessionStatus> {
    const response = await axios.get(`${this.serviceUrl}/session/${sessionId}/status`, {
      headers: { 'X-API-Key': this.apiKey }
    });

    return response.data.data;
  }
}
```

### Styles

#### `packages/whatsapp-frontend/src/public/styles/sessions.css` (~100 lines)
Session-specific styles.

**CSS Classes**:
```css
/* Session Cards */
.session-card {
  transition: transform 0.2s;
}

.session-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

/* Status Badges */
.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.status-initializing {
  background: #fef3c7;
  color: #92400e;
}

.status-qr_ready {
  background: #dbeafe;
  color: #1e40af;
}

.status-authenticated {
  background: #d1fae5;
  color: #065f46;
}

.status-disconnected {
  background: #fee2e2;
  color: #991b1b;
}

.status-failed {
  background: #fecaca;
  color: #7f1d1d;
}

.status-destroyed {
  background: #e5e7eb;
  color: #1f2937;
}

/* Loading States */
.loading {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.75s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* QR Code */
#qr-image {
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1rem;
}
```

---

## Files to Modify

### Main App

#### `packages/whatsapp-frontend/src/app.ts` (10 lines added)
Register session routes.

**Changes**:
```typescript
// BEFORE
import loginRoutes from './routes/login';
import qrRoutes from './routes/qr';
import logoutRoutes from './routes/logout';

app.use('/login', loginRoutes);
app.use('/qr', qrRoutes);
app.use('/logout', logoutRoutes);

// AFTER
import loginRoutes from './routes/login';
import qrRoutes from './routes/qr';
import logoutRoutes from './routes/logout';
import sessionRoutes from './routes/sessions';  // ← NEW
import apiSessionRoutes from './routes/api/sessions';  // ← NEW

app.use('/login', loginRoutes);
app.use('/qr', qrRoutes);
app.use('/logout', logoutRoutes);
app.use('/sessions', sessionRoutes);  // ← NEW
app.use('/api/sessions', apiSessionRoutes);  // ← NEW
```

#### `packages/whatsapp-frontend/src/views/layout.html` (5 lines added)
Add navigation link to sessions.

**Changes**:
```html
<!-- BEFORE -->
<nav>
  <a href="/qr">QR Code</a>
  <a href="/logout">Logout</a>
</nav>

<!-- AFTER -->
<nav>
  <a href="/sessions">Sessions</a>  <!-- ← NEW -->
  <a href="/qr">QR Code</a>
  <a href="/logout">Logout</a>
</nav>
```

---

## Agent Execution Plan

### Parallel Tracks

**Track 1: Routes & Controllers** (Agent 04-api-builder)
```bash
cd /Users/kago/space/dater.local/wa-chatbot-local
orchestrator update \
  --package whatsapp-frontend \
  --agents "04" \
  --commit-range HEAD~5..HEAD \
  --task "Create session management routes and controllers"

# Creates:
# - src/routes/sessions.ts
# - src/routes/api/sessions.ts
# - src/controllers/SessionsController.ts
```

**Track 2: Views** (Manual or Agent 01)
```bash
# Manually create HTML views with Tailwind CSS
# OR use agent 01 for scaffolding

# Creates:
# - src/views/sessions/list.html
# - src/views/sessions/create.html
# - src/views/sessions/qr.html
# - src/public/styles/sessions.css
```

**Track 3: Tests** (Agent 03-test-scaffold)
```bash
orchestrator update \
  --package whatsapp-frontend \
  --agents "03" \
  --task "Generate tests for session management"

# Creates:
# - tests/unit/SessionsController.test.ts
# - tests/integration/sessions.routes.test.ts
# - tests/e2e/session-management.spec.ts
```

### Sequential Integration
After parallel tracks complete:
```bash
# Manual integration
# 1. Update app.ts to register routes
# 2. Update layout.html for navigation
# 3. Test end-to-end flow
# 4. Fix any issues
```

---

## Testing Strategy

### Unit Tests
```typescript
describe('SessionsController', () => {
  test('listSessions returns all sessions', async () => {
    const controller = new SessionsController();
    const sessions = await controller.listSessions();
    expect(Array.isArray(sessions)).toBe(true);
  });

  test('createSession validates input', async () => {
    const controller = new SessionsController();
    await expect(
      controller.createSession({ sessionId: 'invalid session!' })
    ).rejects.toThrow();
  });
});
```

### Integration Tests
```typescript
describe('Session Routes', () => {
  test('GET /sessions requires authentication', async () => {
    const response = await request(app).get('/sessions');
    expect(response.status).toBe(302);
    expect(response.header.location).toBe('/login');
  });

  test('POST /sessions/create creates session', async () => {
    const agent = request.agent(app);
    await agent.post('/login').send({ username: 'admin', password: 'pass' });

    const response = await agent.post('/sessions/create').send({
      sessionId: 'test-session',
      webhookUrl: 'https://example.com/webhook'
    });

    expect(response.status).toBe(302);
    expect(response.header.location).toBe('/sessions');
  });
});
```

### E2E Tests (Playwright)
```typescript
test('complete session creation flow', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('[name=username]', 'admin');
  await page.fill('[name=password]', 'pass');
  await page.click('button[type=submit]');

  // Navigate to sessions
  await page.click('a[href="/sessions"]');
  await expect(page).toHaveURL('/sessions');

  // Create session
  await page.click('a[href="/sessions/create"]');
  await page.fill('[name=sessionId]', 'e2e-test');
  await page.fill('[name=webhookUrl]', 'https://example.com/webhook');
  await page.click('button[type=submit]');

  // Verify session created
  await expect(page.locator('[data-session-id="e2e-test"]')).toBeVisible();

  // View QR code
  await page.click('[data-session-id="e2e-test"] a:has-text("View QR")');
  await expect(page.locator('#qr-image')).toBeVisible();
});
```

---

## Metrics & Goals

**Lines of Code (Estimated)**:
- Routes: 350 lines
- Controllers: 180 lines
- Views: 520 lines
- Styles: 100 lines
- Tests: 400 lines
- **Total**: ~1,550 lines

**Time Estimate**: 2 days
- Day 7: Routes, controllers, basic views
- Day 8: Polish, testing, integration

**Success Criteria**:
- ✅ Users can list all sessions
- ✅ Users can create new sessions
- ✅ Users can view QR codes with auto-refresh
- ✅ Users can destroy/restart sessions
- ✅ Real-time status updates (polling)
- ✅ Responsive design (mobile-friendly)
- ✅ 80%+ test coverage

---

## Next Phase

### Phase B (n8n Integration)
After A4 completes, Phase B can begin:
- Add sessionId to n8n credentials
- Update WhatsApp Bot node to use sessions
- Create session selector UI in n8n
- Update trigger node for multi-session

**Phase B can run IN PARALLEL with Phase A4**:
- Different packages (whatsapp-n8n-nodes vs whatsapp-frontend)
- No file conflicts
- Independent development

---

## References

- **Depends On**: [004-phase-a3-integration.md](004-phase-a3-integration.md)
- **API Documentation**: [003-phase-a2-api.md](003-phase-a2-api.md)
- **Type Definitions**: [001-phase-a1-types.md](001-phase-a1-types.md)
- **Agent System**: [.claude/agents/README.md](../.claude/agents/README.md)
- **Implementation Plan**: [MULTI_SESSION_PLAN.md](../../MULTI_SESSION_PLAN.md)

---

**Status**: ⏳ Ready to implement
**Blocking**: None - Phase A3 complete
**Parallel Opportunity**: Phase B can start simultaneously
