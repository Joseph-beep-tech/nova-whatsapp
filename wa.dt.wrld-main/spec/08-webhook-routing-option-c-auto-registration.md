# Option C: Auto-Registration from n8n Node

Multi-target webhook routing using n8n's `webhookMethods` lifecycle hooks to auto-register/unregister with whatsapp-service.

## Overview

This approach modifies the WhatsAppBotTrigger node to automatically register its webhook URL with whatsapp-service when the workflow is activated, and unregister when deactivated.

```
Workflow Activated  →  WhatsAppBotTrigger.webhookMethods.create()
                              │
                              ▼
                       POST /webhook/register to whatsapp-service
                              │
                              ▼
                       whatsapp-service stores: {url, events, filters}

wwebjs-api event    →  POST /events to whatsapp-service
                              │
                              ▼
                       whatsapp-service fans out to ALL registered webhooks
                              │
                       ┌──────┴──────┬──────────────┐
                       ▼             ▼              ▼
               Trigger #1     Trigger #2     Trigger #3
               (filters)      (filters)      (filters)
                       │             │              │
                       ▼             ▼              ▼
               Execute or    Execute or     Execute or
               return {}     return {}      return {}

Workflow Deactivated → WhatsAppBotTrigger.webhookMethods.delete()
                              │
                              ▼
                       POST /webhook/unregister
```

## Why This Approach

| Aspect | Option A | Option B | Option C |
|--------|----------|----------|----------|
| Manual config | n8n workflow | JSON file | None (auto) |
| Uses existing code | No | Partially | Yes |
| n8n standard pattern | Partially | No | Yes (webhookMethods) |
| Code changes | n8n UI | whatsapp-service | Both (node + service) |
| Complexity | Low | Medium | Medium |

**Option C is the most "n8n-native"** approach because it uses the standard `webhookMethods` lifecycle that other triggers use (Slack, GitHub, etc.).

## Architecture

### Existing Infrastructure (Already in whatsapp-service)

```typescript
// whatsapp-service/src/index.ts:191-328

POST /webhook/register/:sessionId    // Store webhook registration
POST /webhook/unregister/:sessionId  // Remove registration
GET  /webhook/list/:sessionId        // List registrations
POST /events/:sessionId              // Receive & fan out events
```

### Required Changes

| Component | Change |
|-----------|--------|
| `WhatsAppBotTrigger.node.ts` | Add `webhookMethods` with create/delete hooks |
| `whatsapp-service` | Enhance `/events` to filter before forwarding |
| `wwebjs-api .env` | Point `BASE_WEBHOOK_URL` to whatsapp-service |

## Implementation Steps

### Step 1: Enhance WhatsAppBotTrigger with webhookMethods

Update `packages/whatsapp-n8n-nodes/nodes/WhatsAppBotTrigger/WhatsAppBotTrigger.node.ts`:

```typescript
import {
	IDataObject,
	IHookFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
	NodeApiError,
} from 'n8n-workflow';
import axios from 'axios';

export class WhatsAppBotTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'WhatsApp Bot Trigger',
		name: 'whatsAppBotTrigger',
		icon: 'file:whatsapp.svg',
		group: ['trigger'],
		version: 1,
		description: 'Triggers on WhatsApp events from wwebjs-api',
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
			// ... existing properties (eventTypes, ignoreFromMe, etc.)
		],
	};

	/**
	 * Webhook lifecycle methods
	 *
	 * These are called by n8n when the workflow is activated/deactivated:
	 * - create(): Called when workflow is activated
	 * - delete(): Called when workflow is deactivated
	 * - checkExists(): Called to verify webhook is still valid
	 */
	webhookMethods = {
		default: {
			/**
			 * Check if webhook registration exists
			 */
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const credentials = await this.getCredentials('whatsAppBotApi');
				const serviceUrl = credentials.serviceUrl as string || credentials.serverUrl as string;
				const sessionId = credentials.sessionId as string || 'default';
				const apiKey = credentials.apiKey as string;

				if (!serviceUrl) {
					// No service URL configured, skip registration
					return true;
				}

				try {
					const response = await axios.get(
						`${serviceUrl}/webhook/list/${sessionId}`,
						{
							headers: {
								'x-api-key': apiKey,
							},
							timeout: 10000,
						}
					);

					const webhooks = response.data?.webhooks || [];
					return webhooks.some((w: { url: string }) => w.url === webhookUrl);
				} catch (error) {
					// If service is unavailable, assume webhook doesn't exist
					return false;
				}
			},

			/**
			 * Register webhook with whatsapp-service when workflow activates
			 */
			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const credentials = await this.getCredentials('whatsAppBotApi');
				const serviceUrl = credentials.serviceUrl as string || credentials.serverUrl as string;
				const sessionId = credentials.sessionId as string || 'default';
				const apiKey = credentials.apiKey as string;

				if (!serviceUrl) {
					// No service URL - using direct wwebjs-api webhook
					// Skip registration, user configured BASE_WEBHOOK_URL manually
					console.log('[WhatsAppBotTrigger] No serviceUrl configured, skipping auto-registration');
					return true;
				}

				// Get filter settings to pass to service
				const eventTypes = this.getNodeParameter('eventTypes', ['message', 'message_create']) as string[];

				try {
					await axios.post(
						`${serviceUrl}/webhook/register/${sessionId}`,
						{
							webhookUrl,
							events: eventTypes,
							// Optional: pass filters to service for pre-filtering
							filters: {
								// Service can do initial filtering before forwarding
							},
						},
						{
							headers: {
								'Content-Type': 'application/json',
								'x-api-key': apiKey,
							},
							timeout: 10000,
						}
					);

					console.log(`[WhatsAppBotTrigger] Registered webhook: ${webhookUrl}`);
					return true;
				} catch (error: unknown) {
					const message = error instanceof Error ? error.message : 'Unknown error';
					console.error(`[WhatsAppBotTrigger] Failed to register webhook: ${message}`);

					// Don't fail activation - webhook might still work if manually configured
					return true;
				}
			},

			/**
			 * Unregister webhook when workflow deactivates
			 */
			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const credentials = await this.getCredentials('whatsAppBotApi');
				const serviceUrl = credentials.serviceUrl as string || credentials.serverUrl as string;
				const sessionId = credentials.sessionId as string || 'default';
				const apiKey = credentials.apiKey as string;

				if (!serviceUrl) {
					return true;
				}

				try {
					await axios.post(
						`${serviceUrl}/webhook/unregister/${sessionId}`,
						{
							webhookUrl,
						},
						{
							headers: {
								'Content-Type': 'application/json',
								'x-api-key': apiKey,
							},
							timeout: 10000,
						}
					);

					console.log(`[WhatsAppBotTrigger] Unregistered webhook: ${webhookUrl}`);
					return true;
				} catch (error: unknown) {
					const message = error instanceof Error ? error.message : 'Unknown error';
					console.error(`[WhatsAppBotTrigger] Failed to unregister webhook: ${message}`);
					return true;
				}
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		// ... existing webhook handler (filtering happens here)
	}
}
```

### Step 2: Update Credentials to Include Service URL

Update `packages/whatsapp-n8n-nodes/credentials/WhatsAppBotApi.credentials.ts`:

```typescript
import {
	IAuthenticateGeneric,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class WhatsAppBotApi implements ICredentialType {
	name = 'whatsAppBotApi';
	displayName = 'WhatsApp Bot API';
	documentationUrl = 'https://github.com/user/wa-chatbot-local';

	properties: INodeProperties[] = [
		{
			displayName: 'Server URL',
			name: 'serverUrl',
			type: 'string',
			default: 'http://wwebjs-api:3000',
			description: 'The URL of the wwebjs-api server (for sending messages)',
			required: true,
		},
		{
			displayName: 'Service URL',
			name: 'serviceUrl',
			type: 'string',
			default: '',
			placeholder: 'http://whatsapp-service:3001',
			description: 'Optional: URL of whatsapp-service for auto-registration. Leave empty if using direct wwebjs-api webhook.',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			description: 'The x-api-key for authenticating with the API',
			required: true,
		},
		{
			displayName: 'Session ID',
			name: 'sessionId',
			type: 'string',
			default: 'default',
			description: 'The WhatsApp session ID',
			required: true,
		},
		{
			displayName: 'Timeout (seconds)',
			name: 'timeout',
			type: 'number',
			default: 30,
			description: 'Request timeout in seconds',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'x-api-key': '={{$credentials.apiKey}}',
			},
		},
	};
}
```

### Step 3: Enhance whatsapp-service /events Endpoint

The existing `/events/:sessionId` endpoint already forwards to registered webhooks. Optionally enhance it to support pre-filtering:

```typescript
// whatsapp-service/src/index.ts - enhance existing endpoint

app.post('/events/:sessionId?', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId || 'default';
    const { dataType, data } = req.body;

    // Get registered webhooks for this session
    const webhooks = await stateManager.getWebhooks(sessionId);

    // Filter webhooks that want this event type
    const targetWebhooks = webhooks.filter(w => {
      // Event type filter
      if (!w.events.includes(dataType) && !w.events.includes('*')) {
        return false;
      }

      // Optional: Add pre-filtering based on stored filters
      // if (w.filters?.fromMe !== undefined) { ... }

      return true;
    });

    console.log(`[events] Forwarding ${dataType} to ${targetWebhooks.length} webhook(s)`);

    // Forward event to all registered webhooks in parallel
    const promises = targetWebhooks.map(webhook =>
      axios.post(webhook.url, req.body, {
        headers: {
          'Content-Type': 'application/json',
          // Forward original headers if needed
        },
        timeout: 10000,
      }).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[events] Failed to forward to ${webhook.url}: ${message}`);
      })
    );

    await Promise.allSettled(promises);

    res.json({
      success: true,
      message: `Event forwarded to ${targetWebhooks.length} webhook(s)`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[events] Error:', message);
    res.status(500).json({
      success: false,
      error: message,
    });
  }
});
```

### Step 4: Update wwebjs-api Configuration

Point `BASE_WEBHOOK_URL` to whatsapp-service:

```bash
# /var/www/wa.dater.world/whatsapp-api/.env
BASE_WEBHOOK_URL=http://whatsapp-service:3001/events/mysession
ENABLE_WEBHOOK=TRUE
```

### Step 5: Deploy and Test

```bash
# 1. Build and deploy n8n nodes
cd packages/whatsapp-n8n-nodes
npm run build
npm run deploy

# 2. Restart n8n to load updated nodes
ssh root@no.flow "cd /var/www/flow.dater.world/n8n && docker compose restart n8n"

# 3. Update wwebjs-api BASE_WEBHOOK_URL
ssh root@no.flow "cd /var/www/wa.dater.world/whatsapp-api && \
  sed -i 's|BASE_WEBHOOK_URL=.*|BASE_WEBHOOK_URL=http://whatsapp-service:3001/events/mysession|' .env && \
  docker compose down && docker compose up -d && \
  docker network connect n8n_default wwebjs-api"

# 4. Create workflow with WhatsApp Bot Trigger
# 5. Configure credentials with serviceUrl = http://whatsapp-service:3001
# 6. Activate workflow - should auto-register
# 7. Check whatsapp-service logs for registration
docker logs whatsapp-service | grep -i register
```

## Verification

### Check Registration Worked

```bash
# List registered webhooks
curl http://whatsapp-service:3001/webhook/list/mysession \
  -H "x-api-key: YOUR_API_KEY"

# Expected response:
{
  "success": true,
  "sessionId": "mysession",
  "webhooks": [
    {
      "url": "http://n8n:5678/webhook/abc123/webhook",
      "events": ["message", "message_create"],
      "registeredAt": "2026-01-19T..."
    }
  ]
}
```

### Test Event Flow

1. Send WhatsApp message to bot number
2. Check wwebjs-api logs - should POST to whatsapp-service
3. Check whatsapp-service logs - should forward to registered webhooks
4. Check n8n workflow execution - trigger should fire

## Credential Configuration UI

With this approach, the credentials dialog shows:

| Field | Example Value | Purpose |
|-------|---------------|---------|
| Server URL | `http://wwebjs-api:3000` | For sending messages (action node) |
| Service URL | `http://whatsapp-service:3001` | For webhook registration (trigger) |
| API Key | `eca01c9a...` | Authentication |
| Session ID | `mysession` | WhatsApp session |

**If Service URL is empty**, the trigger skips auto-registration and expects manual `BASE_WEBHOOK_URL` configuration (backward compatible).

## Comparison

| Aspect | Option A | Option B | Option C |
|--------|----------|----------|----------|
| **Setup** | Manual n8n workflow | Manual JSON config | Automatic |
| **Standard n8n pattern** | No | No | Yes (webhookMethods) |
| **Per-workflow config** | Execute Workflow nodes | JSON entries | Credential field |
| **Hot reload** | Save workflow | Edit JSON | Activate/deactivate |
| **Code changes** | None | whatsapp-service | n8n node + credentials |
| **Backward compatible** | Yes | Yes | Yes (serviceUrl optional) |

## Pros and Cons

**Pros:**
- Most "n8n-native" approach using standard webhookMethods
- Auto-registers when workflow activates
- No manual configuration needed
- Works with multiple workflows automatically
- Backward compatible (serviceUrl optional)

**Cons:**
- Requires code changes to n8n node
- Requires whatsapp-service to be running
- Two URLs in credentials (serverUrl + serviceUrl)
- More moving parts

## Files Changed Summary

| File | Change |
|------|--------|
| `WhatsAppBotTrigger.node.ts` | Add `webhookMethods` object |
| `WhatsAppBotApi.credentials.ts` | Add `serviceUrl` field |
| `whatsapp-service/src/index.ts` | Enhance `/events` endpoint (optional) |
| wwebjs-api `.env` | Point BASE_WEBHOOK_URL to whatsapp-service |
