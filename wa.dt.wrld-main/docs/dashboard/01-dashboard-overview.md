# WhatsApp Dashboard Overview

## Purpose

Customer-centric HITL (Human-in-the-Loop) dashboard for WhatsApp conversations. Provides an Intercom/Crisp-style interface for agents to monitor and respond to messages in real-time.

**Package Location:** `packages/whatsapp-dashboard/`

---

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.x | UI framework |
| Vite | 6.x | Build tool and dev server (port 3002) |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.x | Utility-first styling |
| Zustand | 5.x | State management |
| Socket.io Client | 4.x | Real-time WebSocket updates |
| React Router | 7.x | Client-side routing |
| Vitest | 2.x | Unit testing framework |

---

## Layout Architecture

### Three-Column Layout

The main ChatsPage uses a responsive three-column layout:

```
┌────────────┬─────────────────────┬────────────┐
│  ChatList  │  ConversationThread │ContactPanel│
│   (320px)  │     (flexible)      │  (320px)   │
│            │                     │            │
│ - Contacts │  - Message history  │ - Profile  │
│ - Search   │  - Input composer   │ - Tags     │
│ - Filters  │  - Typing indicator │ - Notes    │
└────────────┴─────────────────────┴────────────┘
```

### Responsive Behavior

- **Desktop (≥1024px):** All three columns visible
- **Tablet (768-1023px):** ChatList + Thread, ContactPanel toggleable
- **Mobile (<768px):** Single column with navigation

---

## Screens & Routes

| Route | Page | Description | Access |
|-------|------|-------------|--------|
| `/` | Redirect | Redirects to `/chats` | All users |
| `/chats` | ChatsPage | Main HITL interface | Authenticated |
| `/login` | LoginPage | SSO login redirect | Public |
| `/sessions` | SessionsPage | WhatsApp session management | `tenant_admin` |
| `/settings` | SettingsPage | User preferences | Authenticated |
| `/contacts` | PlaceholderPage | Contact management (planned) | Authenticated |
| `/tags` | PlaceholderPage | Tag management (planned) | Authenticated |
| `/analytics` | PlaceholderPage | Analytics dashboard (planned) | `tenant_admin` |

---

## Key Components

### Layout Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `AppLayout` | `layouts/AppLayout.tsx` | Main layout with Sidebar |
| `Sidebar` | `components/Sidebar.tsx` | Navigation, session switcher, user menu |

### Chat Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `ChatList` | `components/ChatList.tsx` | Contact list with search/filters |
| `ChatListItem` | `components/ChatListItem.tsx` | Individual contact row |
| `ConversationThread` | `components/ConversationThread.tsx` | Message display area |
| `MessageBubble` | `components/MessageBubble.tsx` | Individual message |
| `MessageComposer` | `components/MessageComposer.tsx` | Input with send button |
| `ContactPanel` | `components/ContactPanel.tsx` | Contact details sidebar |

### UI Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `Avatar` | `components/ui/Avatar.tsx` | Profile image with fallback |
| `Badge` | `components/ui/Badge.tsx` | Status and tag badges |
| `Button` | `components/ui/Button.tsx` | Styled button variants |
| `StatusIndicator` | `components/ui/StatusIndicator.tsx` | Online/offline status |

---

## State Management

### Zustand Stores

| Store | File | Purpose |
|-------|------|---------|
| `chatStore` | `stores/chatStore.ts` | Conversations, messages, selection |
| `authStore` | `stores/authStore.ts` | User session, roles, authentication |
| `sessionStore` | `stores/sessionStore.ts` | WhatsApp session state |

### chatStore State Shape

```typescript
interface ChatState {
  chats: Chat[]                        // Chat list (each has identifier + platform)
  messages: Record<string, Message[]>  // keyed by "identifier:platform" composite key
  selectedChatId: string | null        // composite key: "identifier:platform"
  filter: 'all' | 'pending' | 'mine' | 'groups'
  searchQuery: string
  typingChats: Set<string>             // Set of "identifier:platform" keys
  isLoading: boolean
  error: string | null
}
```

**Composite Key Pattern:** The dashboard uses `identifier:platform` as a composite key (e.g., `"254712345678:c.us"`) for internal state keying. The `chatKey()` and `parseChatKey()` utilities in `types/index.ts` handle creation and parsing of these keys. This differs from the WhatsApp API's `identifier@platform` format (e.g., `"254712345678@c.us"`) which is only used at the wwebjs-api boundary.

---

## Real-Time Updates

### WebSocket Events

The dashboard connects to the backend via Socket.io for real-time updates:

```typescript
// Connection
socket.connect('ws://localhost:3001', { auth: { token } })

// Events received
socket.on('message:new', (message) => { ... })
socket.on('message:status', (update) => { ... })
socket.on('typing:start', ({ identifier, platform }) => { ... })
socket.on('typing:stop', ({ identifier, platform }) => { ... })
socket.on('session:status', (status) => { ... })
```

### Optimistic Updates

Messages sent from the dashboard use optimistic updates:
1. Add message to local state immediately (status: `pending`)
2. Send to API
3. Update status on success (`sent`) or failure (`failed`)

---

## Development

### Running the Dashboard

```bash
# From monorepo root
npm run dev:dashboard

# Or from package directory
cd packages/whatsapp-dashboard
npm run dev
```

Access at: http://localhost:3002

### Environment Variables

```bash
# packages/whatsapp-dashboard/.env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

### Building

```bash
npm run build
# Output: packages/whatsapp-dashboard/dist/
```

---

## Integration Points

### Backend API (`whatsapp-service`)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/service/users/list` | GET | Fetch contacts |
| `/service/users?identifier=X&platform=Y` | GET | Contact details |
| `/service/chats/messages?identifier=X&platform=Y` | GET | Message history |
| `/client/sendMessage/:sessionId` | POST | Send message (via wwebjs-api) |
| `/auth/me` | GET | Current user info |

### Session Management

The dashboard can manage multiple WhatsApp sessions:
- Session switcher in Sidebar
- Session status monitoring
- QR code display for new sessions (admin only)

---

## File Structure

```
packages/whatsapp-dashboard/
├── src/
│   ├── components/
│   │   ├── ui/              # Reusable UI primitives
│   │   ├── ChatList.tsx
│   │   ├── ConversationThread.tsx
│   │   ├── ContactPanel.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── MessageComposer.tsx
│   │   └── Sidebar.tsx
│   ├── layouts/
│   │   └── AppLayout.tsx
│   ├── pages/
│   │   ├── ChatsPage.tsx
│   │   ├── LoginPage.tsx
│   │   ├── SessionsPage.tsx
│   │   └── SettingsPage.tsx
│   ├── stores/
│   │   ├── authStore.ts
│   │   ├── chatStore.ts
│   │   └── sessionStore.ts
│   ├── types/
│   │   └── index.ts
│   ├── lib/
│   │   ├── api.ts           # API client
│   │   └── socket.ts        # WebSocket client
│   ├── test/
│   │   ├── setup.ts         # Test configuration
│   │   └── utils.tsx        # Test utilities
│   ├── App.tsx
│   └── main.tsx
├── __tests__/               # Test files
├── index.html
├── vite.config.ts
├── tailwind.config.js
└── package.json
```

---

## Related Documentation

- [02-authentication.md](02-authentication.md) - Auth system details
- [03-testing.md](03-testing.md) - Testing infrastructure
- [Admin UI](../admin/01-admin-ui-overview.md) - Backend admin pages
- [Service API](../whatsapp/03-service-api-reference.md) - Backend API reference
