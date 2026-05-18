import {
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';

/**
 * WhatsApp Bot Trigger Node
 *
 * Receives webhooks from wwebjs-api and filters based on:
 * - Event type (message_create, message_ack, etc.)
 * - To number (bot's number)
 * - From number (sender's number)
 * - fromMe flag (filter out bot's own messages)
 */
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
			// Event Type Filter
			{
				displayName: 'Event Types',
				name: 'eventTypes',
				type: 'multiOptions',
				default: ['message', 'message_create'],
				required: true,
				description: 'Which wwebjs-api events to trigger on',
				options: [
					{
						name: 'Message',
						value: 'message',
						description: 'When a message event is received (whatsapp-web.js)',
					},
					{
						name: 'Message Created',
						value: 'message_create',
						description: 'When a message is sent or received (wwebjs-api)',
					},
					{
						name: 'Message Acknowledged',
						value: 'message_ack',
						description: 'When message delivery status changes',
					},
					{
						name: 'Message Revoked (Everyone)',
						value: 'message_revoke_everyone',
						description: 'When a message is deleted for everyone',
					},
					{
						name: 'Message Revoked (Me)',
						value: 'message_revoke_me',
						description: 'When a message is deleted for me',
					},
					{
						name: 'Group Join',
						value: 'group_join',
						description: 'When someone joins a group',
					},
					{
						name: 'Group Leave',
						value: 'group_leave',
						description: 'When someone leaves a group',
					},
					{
						name: 'Ready',
						value: 'ready',
						description: 'When the WhatsApp session is ready and connected',
					},
					{
						name: 'Disconnected',
						value: 'disconnected',
						description: 'When the WhatsApp session disconnects',
					},
				],
			},
			// Ignore own messages
			{
				displayName: 'Ignore Own Messages',
				name: 'ignoreFromMe',
				type: 'boolean',
				default: true,
				description: 'Whether to ignore messages sent by the bot itself (fromMe: true)',
			},
			// Allow group messages
			{
				displayName: 'Allow Group Messages',
				name: 'allowGroupMessages',
				type: 'boolean',
				default: false,
				description: 'Whether to trigger on messages from groups (@g.us). Disabled by default to prevent bot responding in groups.',
			},
			// To Number Filter (Bot's number)
			{
				displayName: 'Filter by To Number (Bot)',
				name: 'filterToNumber',
				type: 'string',
				default: '',
				placeholder: '254748085137',
				description: 'Only trigger when message.to contains this number (your bot number). Leave empty to accept all.',
			},
			// From Number Filter
			{
				displayName: 'Filter by From Number',
				name: 'filterFromNumber',
				type: 'string',
				default: '',
				placeholder: '254700123456',
				description: 'Only trigger when message.from contains this number. Leave empty to accept all.',
			},
			// Session ID Filter
			{
				displayName: 'Filter by Session ID',
				name: 'filterSessionId',
				type: 'string',
				default: '',
				placeholder: 'mysession',
				description: 'Only trigger for events from this session. Leave empty to accept all sessions.',
			},
		],
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const body = this.getBodyData() as IDataObject;

		// Extract wwebjs-api payload structure
		const dataType = body.dataType as string;
		const sessionId = body.sessionId as string;
		const data = body.data as IDataObject;
		const message = data?.message as IDataObject;

		// Get filter parameters
		const eventTypes = this.getNodeParameter('eventTypes', []) as string[];
		const ignoreFromMe = this.getNodeParameter('ignoreFromMe', true) as boolean;
		const allowGroupMessages = this.getNodeParameter('allowGroupMessages', false) as boolean;
		const filterToNumber = this.getNodeParameter('filterToNumber', '') as string;
		const filterFromNumber = this.getNodeParameter('filterFromNumber', '') as string;
		const filterSessionId = this.getNodeParameter('filterSessionId', '') as string;

		// Filter 1: Event type
		if (!eventTypes.includes(dataType)) {
			return {
				noWebhookResponse: true,
			};
		}

		// Filter 2: Session ID
		if (filterSessionId && sessionId !== filterSessionId) {
			return {
				noWebhookResponse: true,
			};
		}

		// Message-specific filters (only apply if we have message data)
		if (message) {
			// Filter 3: Ignore own messages
			if (ignoreFromMe && message.fromMe === true) {
				return {
					noWebhookResponse: true,
				};
			}

			// Filter 4: Block group messages (unless explicitly allowed)
			if (!allowGroupMessages) {
				const from = (message.from as string) || '';
				if (from.endsWith('@g.us')) {
					return {
						noWebhookResponse: true,
					};
				}
			}

			// Filter 5: To number (bot's number)
			if (filterToNumber) {
				const toNumber = (message.to as string) || '';
				if (!toNumber.includes(filterToNumber)) {
					return {
						noWebhookResponse: true,
					};
				}
			}

			// Filter 6: From number
			if (filterFromNumber) {
				const fromNumber = (message.from as string) || '';
				if (!fromNumber.includes(filterFromNumber)) {
					return {
						noWebhookResponse: true,
					};
				}
			}
		}

		// Build output data - flatten for easier use in n8n
		const outputData: IDataObject = {
			// Event metadata
			dataType,
			sessionId,

			// Message data (if present)
			messageId: message?.id as IDataObject | undefined,
			messageBody: message?.body,
			messageType: message?.type,
			messageTimestamp: message?.timestamp,

			// Sender/recipient
			from: message?.from,
			to: message?.to,
			fromMe: message?.fromMe,

			// Message flags
			hasMedia: message?.hasMedia,
			hasQuotedMsg: message?.hasQuotedMsg,
			isForwarded: message?.isForwarded,
			isStatus: message?.isStatus,

			// Raw data for advanced use
			rawMessage: message,
			rawData: data,
		};

		const returnData: INodeExecutionData[] = [
			{
				json: outputData,
			},
		];

		return {
			workflowData: [returnData],
		};
	}
}
