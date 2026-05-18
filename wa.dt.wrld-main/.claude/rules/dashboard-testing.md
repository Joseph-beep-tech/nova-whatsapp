# Dashboard Testing Rules

## Mock API Flag Check

**IMPORTANT**: Before running tests or making test-related changes to the dashboard, check the mock API configuration.

### When to Check

Check the `VITE_USE_MOCK_API` flag when:
1. User asks to run tests
2. User asks to test a feature
3. User reports test failures
4. Working on test files in `packages/whatsapp-dashboard/`

### How to Check

1. Read the environment file:
   ```bash
   cat packages/whatsapp-dashboard/.env.local 2>/dev/null || echo "No .env.local file"
   ```

2. Look for `VITE_USE_MOCK_API=true` or `VITE_USE_MOCK_API=false`

### Decision Flow

**If `VITE_USE_MOCK_API=true` (or not set):**
- Tests run against MSW mock handlers
- No backend required
- Deterministic, fast tests

**If `VITE_USE_MOCK_API=false`:**
- Tests run against real API
- Backend must be running on port 3001
- Tests may be flaky if backend state varies

### Ask User When

Ask the user which mode they want when:

1. **Flag is set to `false` but backend might not be running:**
   > "Mock API is disabled (`VITE_USE_MOCK_API=false`). Should I:
   > 1. Run tests against the real backend (must be running on localhost:3001)
   > 2. Enable mock mode for isolated testing
   >
   > Which approach do you prefer?"

2. **Running E2E tests and flag status is unclear:**
   > "For E2E tests, should I:
   > 1. Use mock API (faster, no backend needed)
   > 2. Test against real backend (requires `npm run dev:service`)
   >
   > Which mode?"

3. **User reports test failures:**
   > "Tests are failing. Current mode: [mock/real]. Want me to:
   > 1. Debug with current mode
   > 2. Switch to [other mode] and retry
   > 3. Check if backend is running (if real mode)"

### Toggling Mock Mode

To enable mock mode:
```bash
echo "VITE_USE_MOCK_API=true" > packages/whatsapp-dashboard/.env.local
```

To disable mock mode (use real API):
```bash
echo "VITE_USE_MOCK_API=false" > packages/whatsapp-dashboard/.env.local
```

### Test Commands Reference

```bash
# Unit tests (always use MSW in test environment)
npm test -w packages/whatsapp-dashboard

# E2E tests (respects VITE_USE_MOCK_API)
npm run test:e2e -w packages/whatsapp-dashboard

# Start backend for real API testing
npm run dev:service
```

## Mock Data Location

Mock data files are in `packages/whatsapp-dashboard/src/mocks/`:

| File | Contains |
|------|----------|
| `data/users.ts` | Auth users, auth states |
| `data/chats.ts` | Chats, messages, contacts |
| `data/sessions.ts` | WhatsApp session states |
| `handlers/*.ts` | API endpoint handlers |

## Adding New Mock Handlers

When adding new API endpoints:

1. Create handler in appropriate file under `src/mocks/handlers/`
2. Add state setter functions for test control
3. Export from `handlers/index.ts`
4. Document the endpoint in `docs/dashboard/03-testing-strategy.md`
