# n8n Node Development Guide

## Overview

This guide provides comprehensive instructions for developing, testing, and troubleshooting custom n8n nodes for the WhatsApp Bot integration. It covers TypeScript patterns, common compilation issues, and testing strategies specific to n8n node development.

## Development Environment Setup

### Prerequisites
```bash
# Required dependencies
npm install -D typescript @types/node
npm install n8n-workflow n8n-core

# Testing dependencies  
npm install -D jest ts-jest @types/jest
```

### TypeScript Configuration
```json
// tsconfig.json for n8n nodes
{
  "compilerOptions": {
    "target": "ES2019",
    "module": "commonjs",
    "lib": ["ES2019", "ES2020.Promise"],
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": [
    "**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "**/*.test.ts"
  ]
}
```

## n8n Node Architecture Patterns

### 1. Action Node (INodeType)
Action nodes perform operations when executed in workflows:

```typescript
import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class WhatsAppBot implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'WhatsApp Bot',
    name: 'whatsAppBot',
    icon: 'file:whatsapp.svg',
    group: ['communication'],
    version: 1,
    description: 'Send messages and media via WhatsApp',
    defaults: {
      name: 'WhatsApp Bot',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'whatsAppBotApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        default: 'sendMessage',
        options: [
          {
            name: 'Send Message',
            value: 'sendMessage',
            description: 'Send a text message',
          },
          {
            name: 'Send Media',
            value: 'sendMedia',
            description: 'Send media files',
          },
        ],
      },
      // Additional properties...
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const operation = this.getNodeParameter('operation', i) as string;
        const credentials = await this.getCredentials('whatsAppBotApi', i);

        let responseData: any;

        switch (operation) {
          case 'sendMessage':
            responseData = await this.sendMessage(credentials, i);
            break;
          case 'sendMedia':
            responseData = await this.sendMedia(credentials, i);
            break;
          default:
            throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`, {
              itemIndex: i,
            });
        }

        returnData.push({
          json: responseData,
          pairedItem: {
            item: i,
          },
        });

      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: {
              error: error.message,
            },
            pairedItem: {
              item: i,
            },
          });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }

  private async sendMessage(credentials: any, itemIndex: number): Promise<any> {
    const chatId = this.getNodeParameter('chatId', itemIndex) as string;
    const message = this.getNodeParameter('message', itemIndex) as string;
    
    // Implementation...
    return { success: true, messageId: 'msg123' };
  }
}
```

### 2. Webhook Trigger Node (INodeType)
Webhook triggers receive HTTP requests and convert them to workflow executions:

```typescript
import {
  IWebhookFunctions,
  IWebhookResponseData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class WhatsAppBotTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'WhatsApp Bot Trigger',
    name: 'whatsAppBotTrigger',
    icon: 'file:whatsapp.svg',
    group: ['trigger'],
    version: 1,
    description: 'Triggers on WhatsApp events',
    defaults: {
      name: 'WhatsApp Bot Trigger',
    },
    inputs: [],
    outputs: ['main'],
    credentials: [
      {
        name: 'whatsAppBotApi',
        required: true,
      },
    ],
    webhooks: [
      {
        name: 'default',
        httpMethod: 'POST',
        responseMode: 'onReceived',
        path: 'webhook',
      },
    ],
    properties: [
      {
        displayName: 'Event Types',
        name: 'eventTypes',
        type: 'multiOptions',
        default: ['message_received'],
        required: true,
        options: [
          {
            name: 'Message Received',
            value: 'message_received',
          },
          {
            name: 'Group Join',
            value: 'group_join',
          },
        ],
      },
    ],
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const credentials = await this.getCredentials('whatsAppBotApi');
    const req = this.getRequestObject();
    const body = this.getBodyData();

    // Validate webhook signature
    if (credentials.webhookSecret) {
      const signature = req.headers['x-webhook-signature'] as string;
      if (!this.validateSignature(body, signature, credentials.webhookSecret as string)) {
        throw new NodeOperationError(this.getNode(), 'Invalid webhook signature');
      }
    }

    // Process the event
    const eventTypes = this.getNodeParameter('eventTypes') as string[];
    const eventType = body.eventType as string;

    if (!eventTypes.includes(eventType)) {
      return {
        noWebhookResponse: true,
      };
    }

    return {
      workflowData: [
        [
          {
            json: body,
          },
        ],
      ],
    };
  }

  private validateSignature(body: any, signature: string, secret: string): boolean {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(body))
      .digest('hex');
    
    return signature === `sha256=${expectedSignature}`;
  }
}
```

## Common TypeScript Issues & Solutions

### 1. Method Context Problems

**❌ Incorrect:**
```typescript
class WhatsAppBotTrigger implements INodeType {
  private getTriggerConfig(): ITriggerConfig {
    // ERROR: 'this' context is wrong
    return {
      eventTypes: this.getNodeParameter('eventTypes') as string[],
    };
  }
}
```

**✅ Correct:**
```typescript
export class WhatsAppBotTrigger implements INodeType {
  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    // Correct context - methods accessed within webhook function
    const eventTypes = this.getNodeParameter('eventTypes') as string[];
    
    const config = this.buildTriggerConfig();
    return { workflowData: [[{ json: config }]] };
  }
  
  private buildTriggerConfig(): ITriggerConfig {
    // Private methods should not access 'this' n8n methods
    return {
      // Use parameters passed in or static configuration
    };
  }
}
```

### 2. Interface Compatibility Issues

**❌ Incorrect Interface Usage:**
```typescript
// Mixing trigger and webhook interfaces
async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
  // ERROR: Wrong interface for webhook node
  const webhookUrl = this.getNodeWebhookUrl('default');
}
```

**✅ Correct Interface Usage:**
```typescript
// Pure webhook trigger - no trigger() method needed
export class WhatsAppBotTrigger implements INodeType {
  // Only implement webhook() for webhook triggers
  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    // Webhook processing logic
  }
  
  // Remove trigger() method entirely for webhook nodes
}
```

### 3. Type Safety Issues

**❌ Unsafe Type Handling:**
```typescript
// Unsafe type conversions
const body = this.getBodyData() as IWhatsAppEvent; // May fail
const error = error as Error; // Unknown error type
```

**✅ Safe Type Handling:**
```typescript
// Safe type checking and error handling
const body = this.getBodyData();
if (!this.isValidWhatsAppEvent(body)) {
  throw new NodeOperationError(this.getNode(), 'Invalid event format');
}

try {
  // Process event
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  throw new NodeOperationError(this.getNode(), errorMessage);
}

private isValidWhatsAppEvent(body: any): body is IWhatsAppEvent {
  return body && 
         typeof body.eventType === 'string' &&
         typeof body.timestamp === 'string' &&
         body.data !== undefined;
}
```

### 4. Parameter Configuration Issues

**❌ Missing Required Properties:**
```typescript
interface ITriggerConfig {
  eventTypes: string[];
  contactFilter?: 'whitelist' | 'blacklist'; // Missing 'none'
  groups?: string[]; // Missing groupFilter property
}
```

**✅ Complete Type Definitions:**
```typescript
interface ITriggerConfig {
  eventTypes: string[];
  chatTypes: 'all' | 'individual' | 'group';
  messageTypes?: string[];
  keywordFilters?: string[];
  contactFilter?: 'none' | 'whitelist' | 'blacklist';
  contacts?: string[];
  groupFilter?: 'none' | 'whitelist' | 'blacklist';
  groups?: string[];
}
```

## Testing Strategies

### 1. Unit Testing with Jest

```typescript
// WhatsAppBot.test.ts
import { WhatsAppBot } from '../nodes/WhatsAppBot/WhatsAppBot.node';
import { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

describe('WhatsAppBot Node', () => {
  let whatsAppBot: WhatsAppBot;
  let mockExecuteFunctions: jest.Mocked<IExecuteFunctions>;

  beforeEach(() => {
    whatsAppBot = new WhatsAppBot();
    mockExecuteFunctions = {
      getInputData: jest.fn(),
      getNodeParameter: jest.fn(),
      getCredentials: jest.fn(),
      continueOnFail: jest.fn().mockReturnValue(false),
      getNode: jest.fn().mockReturnValue({ name: 'Test Node' }),
    } as any;
  });

  describe('execute', () => {
    it('should send message successfully', async () => {
      // Arrange
      const inputData: INodeExecutionData[] = [
        { json: { test: 'data' }, pairedItem: { item: 0 } }
      ];
      
      mockExecuteFunctions.getInputData.mockReturnValue(inputData);
      mockExecuteFunctions.getNodeParameter
        .mockReturnValueOnce('sendMessage') // operation
        .mockReturnValueOnce('1234567890@c.us') // chatId
        .mockReturnValueOnce('Hello World'); // message
      
      mockExecuteFunctions.getCredentials.mockResolvedValue({
        serverUrl: 'https://your-wa.example.com',
        apiToken: 'test-token'
      });

      // Act
      const result = await whatsAppBot.execute.call(mockExecuteFunctions);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json).toEqual({
        success: true,
        messageId: expect.any(String)
      });
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      mockExecuteFunctions.getInputData.mockReturnValue([
        { json: {}, pairedItem: { item: 0 } }
      ]);
      mockExecuteFunctions.getNodeParameter.mockReturnValue('invalid-operation');
      
      // Act & Assert
      await expect(
        whatsAppBot.execute.call(mockExecuteFunctions)
      ).rejects.toThrow('Unknown operation: invalid-operation');
    });
  });
});
```

### 2. Integration Testing

```typescript
// integration.test.ts
describe('WhatsApp Bot Integration', () => {
  it('should process webhook and trigger workflow', async () => {
    const triggerNode = new WhatsAppBotTrigger();
    
    const mockWebhookFunctions: jest.Mocked<IWebhookFunctions> = {
      getCredentials: jest.fn().mockResolvedValue({
        serverUrl: 'https://your-wa.example.com',
        webhookSecret: 'test-secret'
      }),
      getRequestObject: jest.fn().mockReturnValue({
        headers: { 'x-webhook-signature': 'sha256=valid-signature' }
      }),
      getBodyData: jest.fn().mockReturnValue({
        eventType: 'message_received',
        data: { message: { body: 'test' } }
      }),
      getNodeParameter: jest.fn().mockReturnValue(['message_received']),
      getNode: jest.fn().mockReturnValue({ name: 'Test Trigger' }),
    } as any;

    const result = await triggerNode.webhook.call(mockWebhookFunctions);
    
    expect(result.workflowData).toBeDefined();
    expect(result.workflowData![0][0].json.eventType).toBe('message_received');
  });
});
```

### 3. Entity Routing Testing

```typescript
// entityRouting.test.ts
describe('Entity Routing', () => {
  it('should route user messages correctly', () => {
    const event: IWhatsAppEvent = {
      eventType: 'message_received',
      data: {
        message: { from: '1234567890@c.us', isGroup: false },
        entityRoute: { type: 'user', id: '1234567890@c.us' }
      }
    };

    const config: ITriggerConfig = {
      eventTypes: ['message_received'],
      chatTypes: 'individual',
      contactFilter: 'whitelist',
      contacts: ['1234567890@c.us']
    };

    const shouldProcess = entityRouter.shouldProcessEvent(event, config);
    expect(shouldProcess).toBe(true);
  });

  it('should handle group context routing', () => {
    const event: IWhatsAppEvent = {
      eventType: 'message_received',
      data: {
        message: { from: 'group123@g.us', isGroup: true, author: '1234567890@c.us' },
        entityRoute: {
          type: 'user',
          id: '1234567890@c.us',
          parentId: 'group123@g.us',
          context: { groupId: 'group123@g.us' }
        }
      }
    };

    const result = entityRouter.extractEntityContext(event);
    expect(result.type).toBe('user');
    expect(result.context?.groupId).toBe('group123@g.us');
  });
});
```

## Debugging & Troubleshooting

### 1. TypeScript Compilation Debugging

```bash
# Run TypeScript compiler with detailed output
npx tsc --noEmit --listFiles

# Check specific file issues
npx tsc --noEmit --skipLibCheck nodes/WhatsAppBot/WhatsAppBot.node.ts

# Generate declaration files for debugging
npx tsc --declaration --emitDeclarationOnly
```

### 2. Common Error Patterns

**Missing Context Methods:**
```
error TS2339: Property 'getNodeParameter' does not exist on type 'WhatsAppBotTrigger'
```
**Solution:** Move method calls inside proper context functions (webhook, execute).

**Type Conversion Errors:**
```
error TS2352: Conversion of type 'IDataObject' to type 'IWhatsAppEvent' may be a mistake
```
**Solution:** Use proper type guards and validation.

**Interface Compatibility:**
```
error TS2741: Property 'groupFilter' is missing in type 'ITriggerConfig'
```
**Solution:** Update interface definitions to include all properties.

### 3. Runtime Debugging

```typescript
// Add comprehensive logging for debugging
async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
  console.log('Webhook called with headers:', this.getRequestObject().headers);
  console.log('Webhook body:', JSON.stringify(this.getBodyData(), null, 2));
  
  const credentials = await this.getCredentials('whatsAppBotApi');
  console.log('Credentials loaded:', !!credentials);
  
  try {
    const result = this.processWebhook();
    console.log('Processing result:', result);
    return result;
  } catch (error) {
    console.error('Webhook processing failed:', error);
    throw error;
  }
}
```

## Best Practices

### 1. Error Handling
- Always use `NodeOperationError` for user-facing errors
- Include `itemIndex` for item-specific errors
- Implement graceful fallbacks with `continueOnFail()`
- Log detailed error information for debugging

### 2. Type Safety
- Use strict TypeScript configuration
- Implement type guards for external data
- Avoid `any` types - use proper interfaces
- Validate all external inputs

### 3. Performance
- Cache credentials per execution cycle
- Minimize API calls in loops
- Use appropriate HTTP timeouts
- Implement proper retry logic

### 4. Testing
- Write comprehensive unit tests
- Test error conditions and edge cases
- Mock all external dependencies
- Test entity routing scenarios thoroughly

### 5. Documentation
- Document all node parameters clearly
- Include usage examples in descriptions
- Provide troubleshooting guidance
- Document entity routing patterns

## Deployment Checklist

- [ ] All TypeScript compilation errors resolved
- [ ] Unit tests passing (>90% coverage)
- [ ] Integration tests passing
- [ ] Error handling implemented
- [ ] Type safety validated
- [ ] Performance tested under load
- [ ] Documentation updated
- [ ] Entity routing configured correctly
- [ ] Authentication implemented
- [ ] Webhook signatures validated

This guide provides a solid foundation for developing reliable, type-safe n8n nodes with advanced entity routing capabilities for the WhatsApp Bot integration.