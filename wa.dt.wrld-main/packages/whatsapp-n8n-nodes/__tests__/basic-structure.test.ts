import { WhatsAppBot } from '../nodes/WhatsAppBot/WhatsAppBot.node';
import { WhatsAppBotTrigger } from '../nodes/WhatsAppBotTrigger/WhatsAppBotTrigger.node';
import { WhatsAppBotApi } from '../credentials/WhatsAppBotApi.credentials';

describe('Basic Node Structure Tests', () => {
	describe('WhatsApp Bot Action Node', () => {
		let node: WhatsAppBot;

		beforeEach(() => {
			node = new WhatsAppBot();
		});

		it('should be instantiable', () => {
			expect(node).toBeInstanceOf(WhatsAppBot);
		});

		it('should have correct basic properties', () => {
			expect(node.description.displayName).toBe('WhatsApp Bot');
			expect(node.description.name).toBe('whatsAppBot');
			expect(node.description.group).toEqual(['output']);
			expect(node.description.version).toBe(1);
		});

		it('should have credentials configured', () => {
			expect(node.description.credentials).toEqual([
				{
					name: 'whatsAppBotApi',
					required: true,
				},
			]);
		});

		it('should have correct input/output configuration', () => {
			expect(node.description.inputs).toEqual(['main']);
			expect(node.description.outputs).toEqual(['main']);
		});

		it('should have properties defined', () => {
			expect(node.description.properties).toBeDefined();
			expect(Array.isArray(node.description.properties)).toBe(true);
			expect(node.description.properties.length).toBeGreaterThan(0);
		});

		it('should have execute method', () => {
			expect(typeof node.execute).toBe('function');
		});

		it('should have resource property with message option', () => {
			const resourceProp = node.description.properties.find(p => p.name === 'resource');
			expect(resourceProp).toBeDefined();
			expect(resourceProp?.type).toBe('options');
			const options = resourceProp?.options as Array<{ name: string; value: string }>;
			expect(options?.some(o => o.value === 'message')).toBe(true);
		});

		it('should have operation property with sendText, replyToMessage, reactToMessage', () => {
			const operationProp = node.description.properties.find(p => p.name === 'operation');
			expect(operationProp).toBeDefined();
			expect(operationProp?.type).toBe('options');
			const options = operationProp?.options as Array<{ name: string; value: string }>;
			expect(options?.some(o => o.value === 'sendText')).toBe(true);
			expect(options?.some(o => o.value === 'replyToMessage')).toBe(true);
			expect(options?.some(o => o.value === 'reactToMessage')).toBe(true);
		});

		it('should have sendMedia operation', () => {
			const operationProp = node.description.properties.find(p => p.name === 'operation');
			const options = operationProp?.options as Array<{ name: string; value: string }>;
			expect(options?.some(o => o.value === 'sendMedia')).toBe(true);
		});

		it('should have chatId property', () => {
			const chatIdProp = node.description.properties.find(p => p.name === 'chatId');
			expect(chatIdProp).toBeDefined();
			expect(chatIdProp?.required).toBe(true);
			expect(chatIdProp?.type).toBe('string');
		});

		it('should have message property', () => {
			const messageProp = node.description.properties.find(p => p.name === 'message');
			expect(messageProp).toBeDefined();
			expect(messageProp?.type).toBe('string');
		});

		it('should have messageId property for reply/react', () => {
			const messageIdProp = node.description.properties.find(p => p.name === 'messageId');
			expect(messageIdProp).toBeDefined();
			expect(messageIdProp?.type).toBe('string');
		});

		it('should have reaction property', () => {
			const reactionProp = node.description.properties.find(p => p.name === 'reaction');
			expect(reactionProp).toBeDefined();
			expect(reactionProp?.type).toBe('string');
			expect(reactionProp?.default).toBe('👍');
		});
	});

	describe('WhatsApp Bot Trigger Node', () => {
		let node: WhatsAppBotTrigger;

		beforeEach(() => {
			node = new WhatsAppBotTrigger();
		});

		it('should be instantiable', () => {
			expect(node).toBeInstanceOf(WhatsAppBotTrigger);
		});

		it('should have correct basic properties', () => {
			expect(node.description.displayName).toBe('WhatsApp Bot Trigger');
			expect(node.description.name).toBe('whatsAppBotTrigger');
			expect(node.description.group).toEqual(['trigger']);
			expect(node.description.version).toBe(1);
		});

		it('should have webhook configuration', () => {
			expect(node.description.webhooks).toBeDefined();
			expect(Array.isArray(node.description.webhooks)).toBe(true);
			expect(node.description.webhooks!.length).toBe(1);
			expect(node.description.webhooks![0].name).toBe('default');
			expect(node.description.webhooks![0].httpMethod).toBe('POST');
		});

		it('should have no inputs and one output', () => {
			expect(node.description.inputs).toEqual([]);
			expect(node.description.outputs).toEqual(['main']);
		});

		it('should have webhook method', () => {
			expect(typeof node.webhook).toBe('function');
		});

		it('should have eventTypes property with multiOptions', () => {
			const eventTypesProp = node.description.properties.find(p => p.name === 'eventTypes');
			expect(eventTypesProp).toBeDefined();
			expect(eventTypesProp?.type).toBe('multiOptions');
			// Default includes both 'message' (wwebjs-api) and 'message_create' (whatsapp-web.js) event types
			expect(eventTypesProp?.default).toEqual(['message', 'message_create']);
		});

		it('should have ignoreFromMe property', () => {
			const ignoreFromMeProp = node.description.properties.find(p => p.name === 'ignoreFromMe');
			expect(ignoreFromMeProp).toBeDefined();
			expect(ignoreFromMeProp?.type).toBe('boolean');
			expect(ignoreFromMeProp?.default).toBe(true);
		});

		it('should have filterToNumber property', () => {
			const filterToNumberProp = node.description.properties.find(p => p.name === 'filterToNumber');
			expect(filterToNumberProp).toBeDefined();
			expect(filterToNumberProp?.type).toBe('string');
		});

		it('should have filterFromNumber property', () => {
			const filterFromNumberProp = node.description.properties.find(p => p.name === 'filterFromNumber');
			expect(filterFromNumberProp).toBeDefined();
			expect(filterFromNumberProp?.type).toBe('string');
		});

		it('should have filterSessionId property', () => {
			const filterSessionIdProp = node.description.properties.find(p => p.name === 'filterSessionId');
			expect(filterSessionIdProp).toBeDefined();
			expect(filterSessionIdProp?.type).toBe('string');
		});

		it('should have allowGroupMessages property with default false', () => {
			const allowGroupProp = node.description.properties.find(p => p.name === 'allowGroupMessages');
			expect(allowGroupProp).toBeDefined();
			expect(allowGroupProp?.type).toBe('boolean');
			expect(allowGroupProp?.default).toBe(false);
		});

		it('should have ready and disconnected event types', () => {
			const eventTypesProp = node.description.properties.find(p => p.name === 'eventTypes');
			const options = eventTypesProp?.options as Array<{ name: string; value: string }>;
			expect(options?.some(o => o.value === 'ready')).toBe(true);
			expect(options?.some(o => o.value === 'disconnected')).toBe(true);
		});
	});

	describe('WhatsApp Bot API Credentials', () => {
		let credentials: WhatsAppBotApi;

		beforeEach(() => {
			credentials = new WhatsAppBotApi();
		});

		it('should be instantiable', () => {
			expect(credentials).toBeInstanceOf(WhatsAppBotApi);
		});

		it('should have correct name and displayName', () => {
			expect(credentials.name).toBe('whatsAppBotApi');
			expect(credentials.displayName).toBe('WhatsApp Bot API');
		});

		it('should have documentation URL', () => {
			expect(credentials.documentationUrl).toBe('https://wa.dater.world/docs');
		});

		it('should have properties defined', () => {
			expect(credentials.properties).toBeDefined();
			expect(Array.isArray(credentials.properties)).toBe(true);
			expect(credentials.properties.length).toBeGreaterThan(0);
		});

		it('should have required serverUrl property', () => {
			const serverUrlProp = credentials.properties.find(p => p.name === 'serverUrl');
			expect(serverUrlProp).toBeDefined();
			expect(serverUrlProp?.required).toBe(true);
			expect(serverUrlProp?.type).toBe('string');
		});

		it('should have required apiKey property with password type', () => {
			const apiKeyProp = credentials.properties.find(p => p.name === 'apiKey');
			expect(apiKeyProp).toBeDefined();
			expect(apiKeyProp?.required).toBe(true);
			expect(apiKeyProp?.type).toBe('string');
			expect(apiKeyProp?.typeOptions).toEqual({ password: true });
		});

		it('should have required sessionId property', () => {
			const sessionIdProp = credentials.properties.find(p => p.name === 'sessionId');
			expect(sessionIdProp).toBeDefined();
			expect(sessionIdProp?.required).toBe(true);
			expect(sessionIdProp?.type).toBe('string');
			expect(sessionIdProp?.default).toBe('mysession');
		});

		it('should have optional timeout property', () => {
			const timeoutProp = credentials.properties.find(p => p.name === 'timeout');
			expect(timeoutProp).toBeDefined();
			expect(timeoutProp?.required).toBe(false);
			expect(timeoutProp?.type).toBe('number');
			expect(timeoutProp?.default).toBe(30);
		});

		it('should have test configuration with x-api-key header', () => {
			expect(credentials.test).toBeDefined();
			expect(credentials.test.request.url).toBe('/ping');
			expect(credentials.test.request.method).toBe('GET');
			expect(credentials.test.request.headers).toHaveProperty('x-api-key');
		});

		it('should have authenticate configuration with x-api-key header', () => {
			expect(credentials.authenticate).toBeDefined();
			expect(credentials.authenticate.type).toBe('generic');
			expect(credentials.authenticate.properties.headers).toHaveProperty('x-api-key');
		});
	});

	describe('Package Configuration', () => {
		it('should have correct package.json structure', () => {
			const packageJson = require('../package.json');

			expect(packageJson.name).toBe('@dater/n8n-nodes-whatsapp-bot');
			expect(packageJson.version).toBe('1.0.0');
			expect(packageJson.keywords).toContain('n8n-community-node-package');
			expect(packageJson.keywords).toContain('whatsapp');
		});

		it('should have correct n8n node configuration', () => {
			const packageJson = require('../package.json');

			expect(packageJson.n8n).toBeDefined();
			expect(packageJson.n8n.n8nNodesApiVersion).toBe(1);
			expect(Array.isArray(packageJson.n8n.nodes)).toBe(true);
			expect(Array.isArray(packageJson.n8n.credentials)).toBe(true);
		});
	});
});
