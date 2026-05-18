# n8n Workflows

Exported n8n workflow definitions for the WhatsApp bot integration.

## Workflows

| File | Description |
|------|-------------|
| `whatsapp-echo-reply.json` | Echo bot that replies with "Echo: {message}" |

## Setup

### 1. Import Workflow
1. Go to your n8n instance
2. Click **Add workflow** → **Import from file**
3. Select the JSON file

### 2. Configure Credentials
Replace placeholder values before activating:

| Placeholder | Description |
|-------------|-------------|
| `YOUR_API_KEY_HERE` | WhatsApp API key (x-api-key header) |
| `YOUR_INSTANCE_ID` | n8n instance ID (auto-generated on import) |