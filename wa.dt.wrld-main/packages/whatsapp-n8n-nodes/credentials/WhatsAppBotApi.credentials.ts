import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class WhatsAppBotApi implements ICredentialType {
	name = 'whatsAppBotApi';
	displayName = 'WhatsApp Bot API';
	documentationUrl = 'https://wa.dater.world/docs';
	icon = 'file:whatsapp.svg' as const;
	properties: INodeProperties[] = [
		{
			displayName: 'Server URL',
			name: 'serverUrl',
			type: 'string',
			default: 'https://wa.dater.world',
			required: true,
			description: 'The base URL of your wwebjs-api server',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'The x-api-key for authenticating with wwebjs-api',
		},
		{
			displayName: 'Session ID',
			name: 'sessionId',
			type: 'string',
			default: 'mysession',
			required: true,
			placeholder: 'e.g., mysession',
			description: 'The WhatsApp session identifier (used in API endpoints)',
		},
		{
			displayName: 'Webhook Secret',
			name: 'webhookSecret',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: false,
			description: 'Secret for validating incoming webhook events (optional)',
		},
		{
			displayName: 'Timeout (seconds)',
			name: 'timeout',
			type: 'number',
			default: 30,
			required: false,
			description: 'Request timeout in seconds',
		},
	];

	// Test the credentials against wwebjs-api /ping endpoint
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.serverUrl}}',
			url: '/ping',
			method: 'GET',
			headers: {
				'x-api-key': '={{$credentials.apiKey}}',
				'User-Agent': 'n8n-whatsapp-bot-node/1.0.0',
			},
		},
	};

	// Generic authentication for HTTP requests - uses x-api-key header
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'x-api-key': '={{$credentials.apiKey}}',
				'Content-Type': 'application/json',
				'User-Agent': 'n8n-whatsapp-bot-node/1.0.0',
			},
		},
	};
}