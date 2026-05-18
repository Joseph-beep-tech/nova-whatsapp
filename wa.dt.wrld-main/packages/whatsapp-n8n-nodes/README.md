# n8n-nodes-whatsapp-bot

Custom n8n community nodes for WhatsApp Bot integration via [wwebjs-api](https://github.com/kulemantu/wwebjs-api).

## Installation

### In n8n (Community Nodes)

1. Go to **Settings > Community Nodes**
2. Select **Install**
3. Enter `@dater/n8n-nodes-whatsapp-bot`
4. Accept the risks and install

### Manual Installation

```bash
# In your n8n custom extensions directory
npm install @dater/n8n-nodes-whatsapp-bot
```

## Nodes

### WhatsApp Bot Trigger

Receives webhook events from wwebjs-api.

**Event Types:**
- Message Created
- Message Acknowledged
- Message Revoked
- Group Join/Leave
- Ready (session connected)
- Disconnected (session lost)

**Filters:**
- Ignore own messages (default: ON)
- Allow group messages (default: OFF)
- Filter by session ID
- Filter by phone number

### WhatsApp Bot

Sends messages via wwebjs-api.

**Operations:**
- **Send Text** - Send a text message
- **Send Media** - Send image, video, audio, or document (URL-based)
- **Reply to Message** - Reply to a specific message
- **React to Message** - Add emoji reaction

## Credentials

Configure the **WhatsApp Bot API** credential with:

| Field | Description |
|-------|-------------|
| Server URL | Base URL of wwebjs-api (e.g., `https://wa.example.com`) |
| API Key | The x-api-key for authentication |
| Session ID | WhatsApp session identifier |
| Timeout | Request timeout in seconds (default: 30) |

## Example Workflow

1. Add **WhatsApp Bot Trigger** node
2. Configure webhook URL in wwebjs-api to point to n8n
3. Add **WhatsApp Bot** node to send replies
4. Connect trigger output to bot input
5. Use `{{ $json.from }}` as Chat ID to reply to sender

## Chat ID Formats

| Type | Format | Example |
|------|--------|---------|
| Individual | `{phone}@c.us` | `1234567890@c.us` |
| Group | `{groupId}@g.us` | `123456789-1234567890@g.us` |

## License

MIT
