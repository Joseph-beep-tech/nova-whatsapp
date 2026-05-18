# WhatsApp Bot Architecture & Integration Guide

## System Overview

This WhatsApp bot implementation provides a production-ready automation platform integrating WhatsApp Web.js with n8n workflow automation. The system follows TypeScript TDD principles and supports advanced entity routing and conversation threading.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              WhatsApp Web Platform                           │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              │ WhatsApp Web Protocol
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        WhatsApp Bot Service                                  │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────────┐ │
│  │  WhatsApp       │    │  Entity Router   │    │  Webhook Manager        │ │
│  │  Client         │◄──►│  & Filters       │◄──►│  (Multiple n8n hooks)  │ │
│  │  (Puppeteer)    │    │                  │    │                         │ │
│  └─────────────────┘    └──────────────────┘    └─────────────────────────┘ │
│                                   │                         │               │
│  ┌─────────────────┐              │              ┌─────────────────────────┐ │
│  │  Session        │              │              │  Authentication         │ │
│  │  Manager        │              │              │  (API Keys & Basic)     │ │
│  │  (Redis)        │              │              │                         │ │
│  └─────────────────┘              │              └─────────────────────────┘ │
└────────────────────────────────────┼───────────────────────────────────────────┘
                                     │ HTTP Webhooks
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              n8n Workflow Platform                           │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌───────────────┐ │
│  │  WhatsApp Bot Trigger   │  │  WhatsApp Bot Action    │  │  Custom       │ │
│  │  (Entity & Thread       │  │  (Send Messages &       │  │  Workflow     │ │
│  │   Routing)              │  │   Media)                │  │  Logic        │ │
│  └─────────────────────────┘  └─────────────────────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Entity Routing System

### Core Concepts

The system implements advanced entity routing to handle different conversation contexts:

- **User Routing**: `userId: "1234567890"` - Messages from specific users
- **Group Routing**: `groupId: "group123@g.us"` - Messages from specific groups  
- **Contextual Routing**: `groupId.userId` - Messages from specific users within specific groups
- **Thread Routing**: `messageId` - Replies to specific messages (conversation threading)

### Entity Types

```typescript
interface IEntityRoute {
  type: 'user' | 'group' | 'thread' | 'broadcast';
  id: string;
  parentId?: string; // for group.user or thread relationships
  context?: {
    groupId?: string;
    threadId?: string;
    conversationDepth?: number;
  };
}
```

### Routing Examples

1. **Individual User Messages**
   ```json
   {
     "entityRoute": {
       "type": "user",
       "id": "1234567890@c.us"
     }
   }
   ```

2. **Group-Specific Messages**
   ```json
   {
     "entityRoute": {
       "type": "group", 
       "id": "group123@g.us"
     }
   }
   ```

3. **User in Group Context**
   ```json
   {
     "entityRoute": {
       "type": "user",
       "id": "1234567890@c.us",
       "parentId": "group123@g.us",
       "context": {
         "groupId": "group123@g.us"
       }
     }
   }
   ```

4. **Conversation Threading**
   ```json
   {
     "entityRoute": {
       "type": "thread",
       "id": "messageABC123",
       "context": {
         "threadId": "messageABC123",
         "conversationDepth": 2
       }
     }
   }
   ```

## Message Flow Architecture

### 1. Inbound Message Processing

```
WhatsApp Message → Client Event → Message Handler → Entity Router → Filter Engine → Webhook Dispatch
```

**Message Handler** (`src/bot/handlers/MessageHandler.ts`):
- Processes raw WhatsApp messages
- Extracts entity context (user, group, thread)
- Applies conversation tracking
- Enriches message with metadata

**Entity Router**:
- Determines routing context based on message origin
- Applies entity-specific filters
- Routes to appropriate webhook endpoints
- Maintains conversation state

### 2. Webhook Processing Flow

```
HTTP Webhook → Authentication → Entity Filtering → n8n Trigger Node → Workflow Execution
```

**Authentication Layers**:
- Bearer token authentication for webhook endpoints
- Basic authentication for QR code access
- Webhook signature validation (HMAC-SHA256)

### 3. Outbound Message Processing

```
n8n Action Node → API Authentication → Message Validation → WhatsApp Client → Message Delivery
```

## Component Architecture

### Core Services

#### WhatsApp Bot Service (`src/bot/index.ts`)
```typescript
class WhatsAppBot {
  private client: Client | null = null;
  private messageHandler: MessageHandler;
  private groupHandler: GroupHandler;
  private entityRouter: EntityRouter;
  private webhookManager: WebhookManager;
  
  // Authentication middleware
  private authenticateApiKey();
  private authenticateBasicAuth();
  
  // Core functionality
  public async sendMessage(data: SendMessageData);
  public async sendMedia(data: SendMediaData);
  public async getGroups();
  private async notifyN8N(event: string, data: Record<string, unknown>);
}
```

#### Message Handler (`src/bot/handlers/MessageHandler.ts`)
```typescript
class MessageHandler {
  async handle(
    message: Message, 
    client: Client, 
    notifyN8N: Function
  ): Promise<void>;
  
  private extractEntityContext(message: Message): IEntityRoute;
  private trackConversation(message: Message): IConversationContext;
  private enrichMessageData(message: Message): IMessageData;
}
```

#### Entity Router (Planned)
```typescript
class EntityRouter {
  route(event: IWhatsAppEvent, routes: IEntityRoute[]): IEntityRoute[];
  filter(event: IWhatsAppEvent, config: IFilterConfig): boolean;
  trackThread(messageId: string, quotedMessageId?: string): IThreadContext;
}
```

### n8n Integration Components

#### WhatsApp Bot Trigger Node
```typescript
class WhatsAppBotTrigger implements INodeType {
  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData>;
  
  private validateWebhookSignature(body: any, signature: string, secret: string): boolean;
  private shouldProcessEvent(event: IWhatsAppEvent, config: ITriggerConfig): boolean;
  private processEvent(event: IWhatsAppEvent, config: ITriggerConfig): Promise<IDataObject>;
}
```

#### WhatsApp Bot Action Node
```typescript
class WhatsAppBot implements INodeType {
  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
  
  private async sendMessage(credentials: ICredentials, data: ISendMessageData);
  private async sendMedia(credentials: ICredentials, data: ISendMediaData);
  private async getGroups(credentials: ICredentials);
}
```

## Configuration System

### Environment Configuration
```typescript
interface BotConfig {
  whatsapp: WhatsAppConfig;
  api: ApiConfig;
  auth: AuthConfig;
  redis: RedisConfig;
  logging: LoggingConfig;
  features: FeatureConfig;
  media: MediaConfig;
  monitoring: MonitoringConfig;
  entityRouting: EntityRoutingConfig; // New
}
```

### Entity Routing Configuration
```typescript
interface EntityRoutingConfig {
  enableThreading: boolean;
  threadExpirationHours: number;
  maxConversationDepth: number;
  entityFilters: IEntityFilter[];
  webhookRoutes: IWebhookRoute[];
}
```

## Security Architecture

### Authentication Layers

1. **API Key Authentication** (Bearer tokens)
   - Used for webhook endpoints (`/webhook`)
   - Required for n8n → Bot service communication
   - Configurable via `API_KEY` environment variable

2. **Basic Authentication** (Username/Password)
   - Used for QR code access (`/qr`)
   - Optional, configured via `QR_AUTH_USERNAME`/`QR_AUTH_PASSWORD`

3. **Webhook Signature Validation** (HMAC-SHA256)
   - Optional webhook payload verification
   - Prevents webhook spoofing attacks
   - Configured per webhook registration

### Network Security

- SSL/TLS termination via nginx-proxy
- Docker network isolation
- Rate limiting on all API endpoints
- CORS configuration for allowed origins

## Data Flow & Types

### Webhook Event Payloads

#### Message Received Event
```typescript
interface IMessageEvent extends IWhatsAppEvent {
  eventType: 'message_received';
  data: {
    message: IWhatsAppMessage;
    contact: IWhatsAppContact;
    group?: IWhatsAppGroup;
    media?: IWhatsAppMedia;
    location?: IWhatsAppLocation;
    quotedMessage?: IWhatsAppMessage;
    entityRoute: IEntityRoute; // New
    threadContext?: IThreadContext; // New
  };
}
```

#### Group Event
```typescript
interface IGroupEvent extends IWhatsAppEvent {
  eventType: 'group_join' | 'group_leave' | 'group_update';
  data: {
    groupId: string;
    group: IWhatsAppGroup;
    participants: IWhatsAppGroupParticipant[];
    action: string;
    author: string;
    entityRoute: IEntityRoute; // New
  };
}
```

### Conversation Threading

```typescript
interface IThreadContext {
  threadId: string;
  rootMessageId: string;
  parentMessageId?: string;
  depth: number;
  participants: string[];
  lastActivity: Date;
  isExpired: boolean;
}
```

## Deployment Architecture

### Docker Network Integration
```yaml
# docker-compose.yml
services:
  whatsapp-bot:
    networks:
      - whatsapp-network  # Internal bot services
      - proxy             # nginx-proxy for SSL
      - n8n_default       # Integration with n8n
```

### Process Management
- **PM2**: Process monitoring and cluster management
- **systemd**: Service lifecycle management
- **Redis**: Session persistence and caching
- **Winston**: Structured logging with rotation

## Performance & Scaling

### Horizontal Scaling Considerations
- Multiple bot instances with Redis session sharing
- Load balancing for webhook endpoints
- n8n workflow distribution across instances
- Database connection pooling

### Optimization Strategies
- Message queue for high-volume processing
- Media file caching and CDN integration
- Database query optimization
- Connection pooling and keep-alive

## Testing Strategy

### TDD Implementation
```typescript
// Example test structure
describe('MessageHandler', () => {
  describe('Entity Routing', () => {
    it('should route user messages correctly');
    it('should handle group context routing');
    it('should track conversation threads');
    it('should apply entity filters properly');
  });
});
```

### Integration Testing
- End-to-end webhook flow testing
- n8n node integration testing
- WhatsApp client mock testing
- Authentication flow testing

## Monitoring & Observability

### Health Checks
- `/health` endpoint with comprehensive status
- WhatsApp client connection monitoring
- Redis connection health
- n8n webhook connectivity

### Logging Strategy
```typescript
// Structured logging with correlation IDs
logger.info('Message processed', {
  messageId: 'msg123',
  entityRoute: 'user:1234567890@c.us',
  threadId: 'thread456',
  processingTime: '45ms'
});
```

### Metrics Collection
- Message processing rates
- Webhook delivery success rates
- Entity routing performance
- Memory and CPU usage patterns

## Development Guidelines

### TypeScript Best Practices
- Strict type checking enabled
- Comprehensive interface definitions
- Proper error handling with typed exceptions
- JSDoc comments for public APIs

### TDD Workflow
1. Write failing tests first
2. Implement minimum viable code
3. Refactor with confidence
4. Maintain high test coverage (>90%)

### Code Organization
```
src/
├── bot/
│   ├── handlers/           # Message processing logic
│   ├── utils/             # Shared utilities
│   ├── services/          # Business logic services
│   └── index.ts           # Main bot service
├── shared/
│   ├── config.ts          # Configuration management
│   └── constants.ts       # Application constants
├── types/
│   └── WhatsApp.ts        # Type definitions
└── tests/
    ├── integration/       # Integration tests
    └── unit/             # Unit tests
```

This architecture provides a robust, scalable foundation for WhatsApp automation with sophisticated entity routing, conversation threading, and seamless n8n integration while maintaining type safety and comprehensive testing coverage.