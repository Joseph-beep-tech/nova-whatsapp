# Phase B: n8n Multi-Session Integration (Roadmap)

**Status**: ⏳ PENDING
**Estimated Time**: Days 9-11 (3 days)
**Branch**: feature/multi-session-n8n
**Depends On**: Phase A2 API (003-phase-a2-api.md)
**Can Run Parallel With**: Phase A4 (Frontend)

---

## Overview

Phase B will integrate multi-session support into the n8n community nodes, allowing n8n workflows to interact with specific WhatsApp sessions, enabling true multi-tenant automation.

## Goals

1. **Credential Enhancement**
   - Add sessionId field to credentials
   - Support session selection in UI
   - Maintain backward compatibility

2. **Action Node Updates**
   - Send messages using specific session
   - Manage sessions from n8n
   - Query session status

3. **Trigger Node Updates**
   - Filter events by sessionId
   - Support multi-session webhooks
   - Route events to correct workflows

4. **Workflow Examples**
   - Multi-tenant message routing
   - Per-session automation
   - Session management workflows

---

## Files to Modify

### Credentials

#### `packages/whatsapp-n8n-nodes/credentials/WhatsAppBotApi.credentials.ts` (50 lines modified)
Add session support to credentials.

**Changes**:
```typescript
// BEFORE
export class WhatsAppBotApi implements ICredentialType {
  name = 'whatsAppBotApi';
  displayName = 'WhatsApp Bot API';
  properties: INodeProperties[] = [
    {
      displayName: 'Server URL',
      name: 'serverUrl',
      type: 'string',
      default: '',
      required: true,
      placeholder: 'https://wa.dater.world'
    },
    {
      displayName: 'API Token',
      name: 'apiToken',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true
    }
  ];

  async test(credentials: ICredentialDataDecryptedObject): Promise<boolean> {
    const url = `${credentials.serverUrl}/health`;
    const response = await axios.get(url);
    return response.status === 200;
  }
}

// AFTER
export class WhatsAppBotApi implements ICredentialType {
  name = 'whatsAppBotApi';
  displayName = 'WhatsApp Bot API';
  properties: INodeProperties[] = [
    {
      displayName: 'Server URL',
      name: 'serverUrl',
      type: 'string',
      default: '',
      required: true,
      placeholder: 'https://wa.dater.world'
    },
    {
      displayName: 'API Token',
      name: 'apiToken',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true
    },
    // ← NEW: Session support
    {
      displayName: 'Enable Multi-Session',
      name: 'enableMultiSession',
      type: 'boolean',
      default: false,
      description: 'Whether to use multi-session support'
    },
    {
      displayName: 'Session ID',
      name: 'sessionId',
      type: 'string',
      displayOptions: {
        show: {
          enableMultiSession: [true]
        }
      },
      default: 'default',
      required: false,
      placeholder: 'client-a',
      description: 'The WhatsApp session to use for this workflow'
    },
    {
      displayName: 'Auto-Create Session',
      name: 'autoCreateSession',
      type: 'boolean',
      displayOptions: {
        show: {
          enableMultiSession: [true]
        }
      },
      default: false,
      description: 'Automatically create session if it doesn\'t exist'
    }
  ];

  async test(credentials: ICredentialDataDecryptedObject): Promise<boolean> {
    // Test connection
    const healthUrl = `${credentials.serverUrl}/health`;
    const healthResponse = await axios.get(healthUrl);

    if (healthResponse.status !== 200) {
      return false;
    }

    // If multi-session enabled, verify session exists
    if (credentials.enableMultiSession && credentials.sessionId) {
      try {
        const sessionUrl = `${credentials.serverUrl}/session/${credentials.sessionId}`;
        const sessionResponse = await axios.get(sessionUrl, {
          headers: { 'X-API-Key': credentials.apiToken }
        });

        return sessionResponse.status === 200;
      } catch (error) {
        // Session doesn't exist
        if (credentials.autoCreateSession) {
          // Auto-create not implemented in test
          return true;
        }
        return false;
      }
    }

    return true;
  }
}
```

### Action Node

#### `packages/whatsapp-n8n-nodes/nodes/WhatsAppBot/WhatsAppBot.node.ts` (200 lines modified)
Update action node to support sessions.

**New Operations**:
```typescript
// Add to operations list
{
  name: 'Session',
  value: 'session',
  description: 'Manage WhatsApp sessions',
  action: 'Manage session'
}
```

**Session Operations**:
```typescript
// When operation = 'session'
const sessionOperations: INodeProperties[] = [
  {
    displayName: 'Operation',
    name: 'sessionOperation',
    type: 'options',
    displayOptions: {
      show: {
        resource: ['message'],
        operation: ['session']
      }
    },
    options: [
      {
        name: 'Create',
        value: 'create',
        description: 'Create a new session',
        action: 'Create a session'
      },
      {
        name: 'Get',
        value: 'get',
        description: 'Get session details',
        action: 'Get a session'
      },
      {
        name: 'List',
        value: 'list',
        description: 'List all sessions',
        action: 'List sessions'
      },
      {
        name: 'Delete',
        value: 'delete',
        description: 'Delete a session',
        action: 'Delete a session'
      },
      {
        name: 'Restart',
        value: 'restart',
        description: 'Restart a session',
        action: 'Restart a session'
      },
      {
        name: 'Get QR',
        value: 'getQR',
        description: 'Get QR code for authentication',
        action: 'Get QR code'
      },
      {
        name: 'Get Status',
        value: 'getStatus',
        description: 'Get session status',
        action: 'Get session status'
      }
    ],
    default: 'list'
  }
];
```

**Execute Method Changes**:
```typescript
// BEFORE
async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();
  const returnData: INodeExecutionData[] = [];
  const credentials = await this.getCredentials('whatsAppBotApi');

  for (let i = 0; i < items.length; i++) {
    const operation = this.getNodeParameter('operation', i) as string;

    if (operation === 'sendMessage') {
      const to = this.getNodeParameter('to', i) as string;
      const message = this.getNodeParameter('message', i) as string;

      const response = await axios.post(
        `${credentials.serverUrl}/webhook`,
        {
          action: 'send_message',
          to,
          message
        },
        {
          headers: { 'X-API-Key': credentials.apiToken }
        }
      );

      returnData.push({ json: response.data });
    }
  }

  return [returnData];
}

// AFTER
async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
  const items = this.getInputData();
  const returnData: INodeExecutionData[] = [];
  const credentials = await this.getCredentials('whatsAppBotApi');

  // Get session ID from credentials or node parameter
  const sessionId = credentials.enableMultiSession
    ? (this.getNodeParameter('sessionId', 0, credentials.sessionId) as string)
    : 'default';

  for (let i = 0; i < items.length; i++) {
    const operation = this.getNodeParameter('operation', i) as string;

    if (operation === 'sendMessage') {
      const to = this.getNodeParameter('to', i) as string;
      const message = this.getNodeParameter('message', i) as string;

      // Use session-aware endpoint
      const response = await axios.post(
        `${credentials.serverUrl}/session/${sessionId}/send`,
        {
          to,
          message
        },
        {
          headers: { 'X-API-Key': credentials.apiToken }
        }
      );

      returnData.push({ json: response.data });
    }

    if (operation === 'session') {
      const sessionOperation = this.getNodeParameter('sessionOperation', i) as string;

      switch (sessionOperation) {
        case 'create': {
          const newSessionId = this.getNodeParameter('newSessionId', i) as string;
          const webhookUrl = this.getNodeParameter('webhookUrl', i) as string;

          const response = await axios.post(
            `${credentials.serverUrl}/session`,
            {
              sessionId: newSessionId,
              webhookUrl,
              autoRestart: this.getNodeParameter('autoRestart', i, true)
            },
            {
              headers: { 'X-API-Key': credentials.apiToken }
            }
          );

          returnData.push({ json: response.data });
          break;
        }

        case 'list': {
          const response = await axios.get(
            `${credentials.serverUrl}/session`,
            {
              headers: { 'X-API-Key': credentials.apiToken }
            }
          );

          returnData.push({ json: response.data });
          break;
        }

        case 'get': {
          const targetSessionId = this.getNodeParameter('targetSessionId', i) as string;

          const response = await axios.get(
            `${credentials.serverUrl}/session/${targetSessionId}`,
            {
              headers: { 'X-API-Key': credentials.apiToken }
            }
          );

          returnData.push({ json: response.data });
          break;
        }

        case 'delete': {
          const targetSessionId = this.getNodeParameter('targetSessionId', i) as string;

          const response = await axios.delete(
            `${credentials.serverUrl}/session/${targetSessionId}`,
            {
              headers: { 'X-API-Key': credentials.apiToken }
            }
          );

          returnData.push({ json: response.data });
          break;
        }

        case 'restart': {
          const targetSessionId = this.getNodeParameter('targetSessionId', i) as string;

          const response = await axios.post(
            `${credentials.serverUrl}/session/${targetSessionId}/restart`,
            {},
            {
              headers: { 'X-API-Key': credentials.apiToken }
            }
          );

          returnData.push({ json: response.data });
          break;
        }

        case 'getQR': {
          const targetSessionId = this.getNodeParameter('targetSessionId', i) as string;

          const response = await axios.get(
            `${credentials.serverUrl}/session/${targetSessionId}/qr`,
            {
              headers: { 'X-API-Key': credentials.apiToken }
            }
          );

          returnData.push({ json: response.data });
          break;
        }

        case 'getStatus': {
          const targetSessionId = this.getNodeParameter('targetSessionId', i) as string;

          const response = await axios.get(
            `${credentials.serverUrl}/session/${targetSessionId}/status`,
            {
              headers: { 'X-API-Key': credentials.apiToken }
            }
          );

          returnData.push({ json: response.data });
          break;
        }
      }
    }
  }

  return [returnData];
}
```

### Trigger Node

#### `packages/whatsapp-n8n-nodes/nodes/WhatsAppBotTrigger/WhatsAppBotTrigger.node.ts` (80 lines modified)
Update trigger node to filter by session.

**New Properties**:
```typescript
// Add to properties
{
  displayName: 'Filter by Session',
  name: 'filterBySession',
  type: 'boolean',
  default: false,
  description: 'Whether to only receive events from specific session'
},
{
  displayName: 'Session ID',
  name: 'sessionId',
  type: 'string',
  displayOptions: {
    show: {
      filterBySession: [true]
    }
  },
  default: '',
  placeholder: 'client-a',
  description: 'Only trigger for events from this session'
}
```

**Webhook Handler Changes**:
```typescript
// BEFORE
async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
  const bodyData = this.getBodyData();
  const event = bodyData.event as string;

  // Filter by event type
  const eventTypes = this.getNodeParameter('events') as string[];
  if (!eventTypes.includes(event)) {
    return {
      workflowData: []
    };
  }

  return {
    workflowData: [[{ json: bodyData }]]
  };
}

// AFTER
async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
  const bodyData = this.getBodyData();
  const event = bodyData.event as string;
  const sessionId = bodyData.sessionId as string;

  // Filter by session ID
  const filterBySession = this.getNodeParameter('filterBySession') as boolean;
  if (filterBySession) {
    const targetSessionId = this.getNodeParameter('sessionId') as string;
    if (sessionId !== targetSessionId) {
      return {
        workflowData: []
      };
    }
  }

  // Filter by event type
  const eventTypes = this.getNodeParameter('events') as string[];
  if (!eventTypes.includes(event)) {
    return {
      workflowData: []
    };
  }

  return {
    workflowData: [[{ json: bodyData }]]
  };
}
```

---

## Files to Create

### Workflow Examples

#### `packages/whatsapp-n8n-nodes/examples/multi-session-routing.json` (~150 lines)
Example workflow for multi-session message routing.

**Workflow Structure**:
```json
{
  "name": "Multi-Session Message Router",
  "nodes": [
    {
      "name": "WhatsApp Trigger",
      "type": "n8n-nodes-base.whatsAppBotTrigger",
      "parameters": {
        "events": ["message"],
        "filterBySession": false
      }
    },
    {
      "name": "Route by Session",
      "type": "n8n-nodes-base.switch",
      "parameters": {
        "rules": [
          {
            "conditions": [
              {
                "field": "{{ $json.sessionId }}",
                "operation": "equals",
                "value": "client-a"
              }
            ],
            "output": 0
          },
          {
            "conditions": [
              {
                "field": "{{ $json.sessionId }}",
                "operation": "equals",
                "value": "client-b"
              }
            ],
            "output": 1
          }
        ]
      }
    },
    {
      "name": "Client A Response",
      "type": "n8n-nodes-base.whatsAppBot",
      "parameters": {
        "operation": "sendMessage",
        "sessionId": "client-a",
        "to": "{{ $json.data.from }}",
        "message": "Hello from Client A!"
      }
    },
    {
      "name": "Client B Response",
      "type": "n8n-nodes-base.whatsAppBot",
      "parameters": {
        "operation": "sendMessage",
        "sessionId": "client-b",
        "to": "{{ $json.data.from }}",
        "message": "Hello from Client B!"
      }
    }
  ]
}
```

#### `packages/whatsapp-n8n-nodes/examples/session-management.json` (~200 lines)
Example workflow for session lifecycle management.

**Workflow Structure**:
```json
{
  "name": "Session Management Dashboard",
  "nodes": [
    {
      "name": "Schedule",
      "type": "n8n-nodes-base.cron",
      "parameters": {
        "cronExpression": "*/5 * * * *"
      }
    },
    {
      "name": "List Sessions",
      "type": "n8n-nodes-base.whatsAppBot",
      "parameters": {
        "operation": "session",
        "sessionOperation": "list"
      }
    },
    {
      "name": "Check Health",
      "type": "n8n-nodes-base.function",
      "parameters": {
        "functionCode": "const sessions = $input.first().json.data.sessions;\nconst unhealthy = sessions.filter(s => s.status === 'failed' || s.status === 'disconnected');\nreturn unhealthy.map(s => ({ json: s }));"
      }
    },
    {
      "name": "Restart Failed Sessions",
      "type": "n8n-nodes-base.whatsAppBot",
      "parameters": {
        "operation": "session",
        "sessionOperation": "restart",
        "targetSessionId": "={{ $json.sessionId }}"
      }
    },
    {
      "name": "Send Alert",
      "type": "n8n-nodes-base.emailSend",
      "parameters": {
        "subject": "Session {{ $json.sessionId }} restarted",
        "text": "Session was in {{ $json.status }} state and has been restarted."
      }
    }
  ]
}
```

#### `packages/whatsapp-n8n-nodes/examples/per-session-automation.json` (~180 lines)
Example workflow with session-specific logic.

**Workflow Structure**:
```json
{
  "name": "Per-Session Business Logic",
  "nodes": [
    {
      "name": "WhatsApp Trigger",
      "type": "n8n-nodes-base.whatsAppBotTrigger",
      "parameters": {
        "events": ["message"],
        "filterBySession": true,
        "sessionId": "client-a"
      }
    },
    {
      "name": "Get Customer Data",
      "type": "n8n-nodes-base.postgres",
      "parameters": {
        "query": "SELECT * FROM customers WHERE session_id = '{{ $json.sessionId }}' AND phone = '{{ $json.data.from }}'"
      }
    },
    {
      "name": "Process Order",
      "type": "n8n-nodes-base.function",
      "parameters": {
        "functionCode": "// Custom business logic per session\nconst customer = $input.first().json;\nconst message = $('WhatsApp Trigger').first().json.data.body;\n\n// Process based on session configuration\nif (customer.subscription_tier === 'premium') {\n  // Premium logic\n} else {\n  // Standard logic\n}\n\nreturn [{ json: { response: 'Processed!' } }];"
      }
    },
    {
      "name": "Send Response",
      "type": "n8n-nodes-base.whatsAppBot",
      "parameters": {
        "operation": "sendMessage",
        "sessionId": "client-a",
        "to": "={{ $('WhatsApp Trigger').first().json.data.from }}",
        "message": "={{ $json.response }}"
      }
    }
  ]
}
```

### Documentation

#### `packages/whatsapp-n8n-nodes/docs/MULTI_SESSION_GUIDE.md` (~300 lines)
Complete guide for using multi-session features.

**Content Outline**:
```markdown
# Multi-Session Guide

## Overview
- What is multi-session support?
- Use cases (multi-tenant, multiple brands, etc.)
- Architecture overview

## Setup
- Configuring credentials
- Enabling multi-session
- Creating sessions

## Credentials
- Session ID field
- Auto-create session option
- Testing credentials

## Action Node
- Session management operations
- Sending messages with sessions
- Managing session lifecycle

## Trigger Node
- Filtering by session ID
- Multi-session webhooks
- Event routing strategies

## Workflow Examples
- Multi-tenant message routing
- Session health monitoring
- Per-session automation

## Best Practices
- Session naming conventions
- Webhook URL patterns
- Error handling
- Monitoring and alerts

## Troubleshooting
- Session not found errors
- Authentication issues
- Webhook routing problems

## Migration Guide
- Upgrading from single-session
- Backward compatibility
- Rollback strategy
```

---

## Testing Strategy

### Unit Tests
```typescript
// WhatsAppBot.node.test.ts
describe('WhatsAppBot Node', () => {
  test('sends message using specified session', async () => {
    const node = new WhatsAppBot();
    const credentials = {
      serverUrl: 'http://localhost:3000',
      apiToken: 'test-key',
      enableMultiSession: true,
      sessionId: 'test-session'
    };

    const result = await node.execute(/* mock context */);

    expect(result[0][0].json.sessionId).toBe('test-session');
  });

  test('creates new session', async () => {
    const node = new WhatsAppBot();

    // Test session creation operation
    const result = await node.execute(/* mock context with sessionOperation=create */);

    expect(result[0][0].json.success).toBe(true);
  });

  test('lists all sessions', async () => {
    const node = new WhatsAppBot();

    const result = await node.execute(/* mock context with sessionOperation=list */);

    expect(Array.isArray(result[0][0].json.data.sessions)).toBe(true);
  });
});

// WhatsAppBotTrigger.node.test.ts
describe('WhatsAppBotTrigger Node', () => {
  test('filters events by session ID', async () => {
    const trigger = new WhatsAppBotTrigger();

    const webhookData = {
      sessionId: 'client-a',
      event: 'message',
      data: { body: 'Test' }
    };

    const result = await trigger.webhook(/* mock context with filterBySession=true, sessionId=client-a */);

    expect(result.workflowData).toHaveLength(1);
  });

  test('ignores events from other sessions', async () => {
    const trigger = new WhatsAppBotTrigger();

    const webhookData = {
      sessionId: 'client-b',
      event: 'message',
      data: { body: 'Test' }
    };

    const result = await trigger.webhook(/* mock context with filterBySession=true, sessionId=client-a */);

    expect(result.workflowData).toHaveLength(0);
  });
});
```

### Integration Tests
```typescript
describe('n8n Multi-Session Integration', () => {
  test('complete session workflow', async () => {
    // Create session via action node
    const createResult = await executeNode('whatsAppBot', {
      operation: 'session',
      sessionOperation: 'create',
      newSessionId: 'integration-test',
      webhookUrl: 'https://n8n.example.com/webhook/test'
    });

    expect(createResult.success).toBe(true);

    // Send message via created session
    const sendResult = await executeNode('whatsAppBot', {
      operation: 'sendMessage',
      sessionId: 'integration-test',
      to: '1234567890@c.us',
      message: 'Test message'
    });

    expect(sendResult.success).toBe(true);

    // Verify trigger receives event
    const triggerResult = await simulateWebhook('whatsAppBotTrigger', {
      sessionId: 'integration-test',
      event: 'message',
      data: { body: 'Reply' }
    });

    expect(triggerResult.workflowData).toHaveLength(1);

    // Cleanup
    await executeNode('whatsAppBot', {
      operation: 'session',
      sessionOperation: 'delete',
      targetSessionId: 'integration-test'
    });
  });
});
```

---

## Metrics & Goals

**Lines of Code (Estimated)**:
- Credentials: 50 lines
- Action node: 200 lines
- Trigger node: 80 lines
- Examples: 530 lines
- Documentation: 300 lines
- Tests: 200 lines
- **Total**: ~1,360 lines

**Time Estimate**: 3 days
- Day 9: Credentials + action node
- Day 10: Trigger node + examples
- Day 11: Documentation + testing

**Success Criteria**:
- ✅ Credentials support session selection
- ✅ Action node can manage sessions
- ✅ Trigger node filters by session
- ✅ Backward compatible (single-session works)
- ✅ Example workflows provided
- ✅ Comprehensive documentation
- ✅ 80%+ test coverage

---

## Parallel Execution

**Phase B can run IN PARALLEL with Phase A4**:
- Different packages (whatsapp-n8n-nodes vs whatsapp-frontend)
- No file conflicts
- Both depend on Phase A2 API (already complete)
- Independent testing

**Optimal Timeline**:
```
Day 7-8: Phase A4 (Frontend)
Day 9-11: Phase B (n8n)

If run in parallel:
Day 7-9: Both phases simultaneously
Result: Complete in 3 days instead of 5
```

---

## Next Phase

### Phase C (Testing & Validation)
After B completes:
- End-to-end multi-session testing
- Load testing (10+ concurrent sessions)
- Security testing (session isolation)
- Integration testing (WhatsApp → n8n → Response)

---

## References

- **Depends On**: [003-phase-a2-api.md](003-phase-a2-api.md)
- **Parallel With**: [005-phase-a4-frontend-roadmap.md](005-phase-a4-frontend-roadmap.md)
- **Type Definitions**: [001-phase-a1-types.md](001-phase-a1-types.md)
- **Implementation Plan**: [MULTI_SESSION_PLAN.md](../../MULTI_SESSION_PLAN.md)
- **n8n Package**: `packages/whatsapp-n8n-nodes/`

---

**Status**: ⏳ Ready to implement
**Blocking**: None - Phase A2 API complete
**Parallel Opportunity**: Phase A4 can run simultaneously
