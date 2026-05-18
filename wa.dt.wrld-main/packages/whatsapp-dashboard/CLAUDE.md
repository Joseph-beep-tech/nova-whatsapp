# CLAUDE.md - WhatsApp Dashboard Package

Package-specific guidance for Claude Code when working in `packages/whatsapp-dashboard/`.

## Package Overview

**Customer-centric HITL (Human-in-the-Loop) dashboard** for following and intercepting WhatsApp conversations. Inspired by Intercom/Crisp-style interfaces.

**Version**: 0.1.0
**Architecture**: React 18 + Vite + TypeScript + Tailwind CSS + Zustand

---

## Quick Commands

```bash
npm run dev          # Start dev server (port 3002)
npm run build        # Build for production
npm run preview      # Preview production build
npm run type-check   # Type check only
npm run lint         # Run ESLint
npm run lint:fix     # Auto-fix lint issues

# Testing
npm test             # Run unit tests (163 tests)
npm run test:watch   # TDD mode
npm run test:coverage # Coverage report
npm run test:e2e     # Playwright E2E tests
npm run test:e2e:ui  # Playwright interactive mode
```

---

## Directory Structure

```
src/
├── main.tsx                    # React entry point
├── App.tsx                     # Router and routes
├── index.css                   # Tailwind imports + custom styles
├── components/
│   ├── common/                 # Reusable UI components
│   │   ├── Avatar.tsx
│   │   ├── Badge.tsx
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   └── StatusIndicator.tsx
│   ├── layout/                 # App shell and navigation
│   │   ├── AppShell.tsx
│   │   └── Sidebar.tsx
│   ├── chat/                   # Chat interface components
│   │   ├── ChatList.tsx        # Left panel - conversation list
│   │   ├── ChatCard.tsx        # Individual chat preview
│   │   ├── ConversationThread.tsx  # Center panel - message thread
│   │   ├── MessageBubble.tsx   # Message display
│   │   └── MessageInput.tsx    # Reply/note input
│   └── contact/                # Contact panel components
│       ├── ContactPanel.tsx    # Right panel - contact info
│       ├── ContactInfo.tsx     # Contact details display
│       ├── Labels.tsx          # Label management
│       └── Notes.tsx           # Internal notes
├── pages/                      # Route pages
│   ├── ChatsPage.tsx           # Main HITL interface
│   └── SettingsPage.tsx        # Settings & session status
├── stores/                     # Zustand state management
│   ├── chatStore.ts            # Chat/message state
│   └── sessionStore.ts         # Session/connection state
├── hooks/                      # Custom React hooks
├── lib/                        # Utilities
│   ├── api.ts                  # API client
│   └── socket.ts               # WebSocket client
└── types/                      # TypeScript types
    └── index.ts                # All type definitions
```

---

## Architecture

### State Management (Zustand)

Two main stores:

**chatStore** - Chat and message state:
- `chats[]` - List of conversations
- `messages{}` - Messages by composite key (`identifier:platform`)
- `selectedChatId` - Currently active chat
- `filter` - Active filter (all/pending/mine/groups)
- `typingChats` - Set of chat IDs with typing indicators

**sessionStore** - Session and connection state:
- `status` - WhatsApp session status
- `socketConnected` - WebSocket connection state

### API Client (`lib/api.ts`)

Provides typed API methods:
- `chatApi` - Chat operations (list, get, updateStatus, assign)
- `messageApi` - Message operations (list, send, sendNote)
- `contactApi` - Contact operations (get, update, notes)
- `sessionApi` - Session status and QR code

### WebSocket Client (`lib/socket.ts`)

Handles real-time updates:
- `message:new` - New incoming message
- `message:update` - Message status/reaction updates
- `typing:start/stop` - Typing indicators
- `chat:update` - Chat status changes
- `session:status` - Connection status

---

## Component Patterns

### Three-Column Layout

```
┌────────────┬─────────────────┬────────────┐
│  ChatList  │ ConversationThread │ ContactPanel │
│  (320px)   │   (flexible)    │   (320px)  │
└────────────┴─────────────────┴────────────┘
```

### Message Types

- **Inbound** (customer) - Left-aligned, white background
- **Outbound** (bot/agent) - Right-aligned, teal background
- **Note** (internal) - Centered, yellow background

### Status Indicators

```typescript
type SessionStatus = 'connected' | 'disconnected' | 'qr_required' | 'loading'
type ChatStatus = 'open' | 'pending' | 'resolved' | 'archived'
type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
```

---

## Styling

Uses Tailwind CSS with custom extensions:

**Colors:**
- `whatsapp-teal` (#008069) - Primary actions
- `whatsapp-light` (#25D366) - Badges, highlights
- `surface-*` - Neutral grays

**Custom classes:**
- `.bubble-incoming` - Customer message style
- `.bubble-outgoing` - Agent/bot message style
- `.scrollbar-hide` - Hide scrollbars
- `.truncate-2` - Two-line text truncation

---

## API Integration

The dashboard expects these backend endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chats` | GET | List conversations |
| `/api/chats/:id/messages` | GET | Message history |
| `/api/chats/:id/send` | POST | Send message (agent) |
| `/api/chats/:id/notes` | POST | Add internal note |
| `/api/contacts/:id` | GET/PUT | Contact info |
| `/api/session/status/:id` | GET | Session status |

All endpoints proxied through Vite to `/service/*` on the backend.

---

## Testing

### Mock API Configuration

The `VITE_USE_MOCK_API` environment variable controls whether MSW mock handlers intercept API calls:

```bash
# .env.local
VITE_USE_MOCK_API=true   # Use mock handlers (default)
VITE_USE_MOCK_API=false  # Use real backend API
```

| Mode | Use When |
|------|----------|
| `true` | Local dev without backend, unit tests, CI |
| `false` | Integration testing with real backend |

### Test Structure

```
src/
├── test/
│   ├── setup.ts        # MSW server lifecycle, global mocks
│   └── utils.tsx       # Custom render, mock helpers
├── mocks/
│   ├── data/           # Mock datasets (users, chats, sessions)
│   ├── handlers/       # API endpoint handlers
│   ├── server.ts       # MSW server (Vitest)
│   └── browser.ts      # MSW worker (dev mode)
└── **/__tests__/       # Test files adjacent to source
```

### Writing Tests

```typescript
import { render, setMockChats } from '@/test/utils'

it('renders chat list', async () => {
  setMockChats(testChats)  // Override mock state
  render(<ChatList />)
  await waitFor(() => expect(screen.getByText('Chat')).toBeInTheDocument())
})
```

See [docs/dashboard/03-testing-strategy.md](../../docs/dashboard/03-testing-strategy.md) for full documentation.

---

## Development Notes

### Type Safety

- **No `any`** except for socket.io library type workarounds (documented with eslint-disable)
- Use types from `src/types/index.ts`
- API responses typed with `ApiResponse<T>`

### Adding Features

1. **New component**: Create in appropriate `components/` subdirectory
2. **New page**: Add to `pages/`, register route in `App.tsx`
3. **New API call**: Add to `lib/api.ts` with proper typing
4. **New socket event**: Add to `SocketEventMap` in `lib/socket.ts`
5. **New API mock**: Add handler in `src/mocks/handlers/`, export from index

---

## Related Documentation

- [Main CLAUDE.md](../../CLAUDE.md) - Monorepo overview
- [whatsapp-service/CLAUDE.md](../whatsapp-service/CLAUDE.md) - Backend service
- [docs/whatsapp/02-api-reference.md](../../docs/whatsapp/02-api-reference.md) - API reference
- [docs/dashboard/03-testing-strategy.md](../../docs/dashboard/03-testing-strategy.md) - Testing guide
