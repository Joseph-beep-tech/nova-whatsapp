import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
	IDataObject,
} from 'n8n-workflow';
import axios from 'axios';
import { IWhatsAppBotCredentials } from '../../types/WhatsAppBot.types';

/**
 * WhatsApp Bot Action Node
 *
 * Sends messages via wwebjs-api endpoints.
 * MVP: sendText, replyToMessage, reactToMessage operations.
 */
export class WhatsAppBot implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'WhatsApp Bot',
		name: 'whatsAppBot',
		icon: 'file:whatsapp.svg',
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Send messages via wwebjs-api',
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
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Message',
						value: 'message',
						description: 'Send messages',
					},
				],
				default: 'message',
			},
			// Message Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['message'],
					},
				},
				options: [
					{
						name: 'Send Text',
						value: 'sendText',
						description: 'Send a text message',
						action: 'Send a text message',
					},
					{
						name: 'Reply to Message',
						value: 'replyToMessage',
						description: 'Reply to a specific message',
						action: 'Reply to a message',
					},
					{
						name: 'React to Message',
						value: 'reactToMessage',
						description: 'React to a message with an emoji',
						action: 'React to a message',
					},
					{
						name: 'Send Media',
						value: 'sendMedia',
						description: 'Send an image, video, audio, or document',
						action: 'Send media message',
					},
				],
				default: 'sendText',
			},
			// Chat ID field
			{
				displayName: 'Chat ID',
				name: 'chatId',
				type: 'string',
				required: true,
				default: '',
				placeholder: '254700123456@c.us',
				description: 'WhatsApp chat ID (phone@c.us for individual, groupid@g.us for groups)',
			},
			// Message field for sendText
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['sendText', 'replyToMessage'],
					},
				},
				default: '',
				description: 'The text message to send',
			},
			// Message ID for reply/react
			{
				displayName: 'Message ID',
				name: 'messageId',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['replyToMessage', 'reactToMessage'],
					},
				},
				default: '',
				placeholder: 'true_254700123456@c.us_3EB0A0BCE52F1D610F0CA9',
				description: 'The ID of the message to reply to or react to',
			},
			// Reaction emoji
			{
				displayName: 'Reaction',
				name: 'reaction',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['reactToMessage'],
					},
				},
				default: '👍',
				description: 'The emoji to react with',
			},
			// Media Type selector
			{
				displayName: 'Media Type',
				name: 'mediaType',
				type: 'options',
				required: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['sendMedia'],
					},
				},
				options: [
					{
						name: 'Image',
						value: 'image',
						description: 'Send an image file (jpg, png, gif, webp)',
					},
					{
						name: 'Video',
						value: 'video',
						description: 'Send a video file (mp4, 3gp)',
					},
					{
						name: 'Audio',
						value: 'audio',
						description: 'Send an audio file (mp3, ogg, m4a)',
					},
					{
						name: 'Document',
						value: 'document',
						description: 'Send a document file (pdf, doc, etc.)',
					},
				],
				default: 'image',
				description: 'The type of media to send',
			},
			// Media URL field
			{
				displayName: 'Media URL',
				name: 'mediaUrl',
				type: 'string',
				required: true,
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['sendMedia'],
					},
				},
				default: '',
				placeholder: 'https://example.com/image.jpg',
				description: 'URL of the media file to send',
			},
			// Media filename (optional)
			{
				displayName: 'Filename',
				name: 'filename',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['sendMedia'],
					},
				},
				default: '',
				placeholder: 'document.pdf',
				description: 'Optional filename for the media (useful for documents)',
			},
			// Media caption
			{
				displayName: 'Caption',
				name: 'caption',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['message'],
						operation: ['sendMedia'],
					},
				},
				default: '',
				description: 'Optional caption for the media',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = await this.getCredentials('whatsAppBotApi') as unknown as IWhatsAppBotCredentials;

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;

				let responseData: IDataObject;

				if (resource === 'message') {
					const chatId = this.getNodeParameter('chatId', i) as string;
					const { serverUrl, sessionId, apiKey, timeout } = credentials;

					switch (operation) {
						case 'sendText': {
							const message = this.getNodeParameter('message', i) as string;

							// wwebjs-api /client/sendMessage endpoint
							const url = `${serverUrl}/client/sendMessage/${sessionId}`;
							const body = {
								chatId,
								contentType: 'string',
								content: message,
							};

							responseData = await makeApiRequest(url, body, apiKey, timeout);
							break;
						}

						case 'replyToMessage': {
							const message = this.getNodeParameter('message', i) as string;
							const messageId = this.getNodeParameter('messageId', i) as string;

							// wwebjs-api /message/reply endpoint
							const url = `${serverUrl}/message/reply/${sessionId}`;
							const body = {
								messageId,
								message,
							};

							responseData = await makeApiRequest(url, body, apiKey, timeout);
							break;
						}

						case 'reactToMessage': {
							const messageId = this.getNodeParameter('messageId', i) as string;
							const reaction = this.getNodeParameter('reaction', i) as string;

							// wwebjs-api /message/react endpoint
							const url = `${serverUrl}/message/react/${sessionId}`;
							const body = {
								messageId,
								reaction,
							};

							responseData = await makeApiRequest(url, body, apiKey, timeout);
							break;
						}

						case 'sendMedia': {
							const mediaType = this.getNodeParameter('mediaType', i) as string;
							const mediaUrl = this.getNodeParameter('mediaUrl', i) as string;
							const filename = this.getNodeParameter('filename', i, '') as string;
							const caption = this.getNodeParameter('caption', i, '') as string;

							// wwebjs-api /client/sendMessage endpoint with MessageMedia
							const url = `${serverUrl}/client/sendMessage/${sessionId}`;

							// Build media content based on type
							// mediaType helps wwebjs-api determine correct handling
							const mediaContent: Record<string, unknown> = {
								url: mediaUrl,
								mediaType, // image, video, audio, document
							};

							// Add optional filename
							if (filename) {
								mediaContent.filename = filename;
							}

							const body: Record<string, unknown> = {
								chatId,
								contentType: 'MessageMedia',
								content: mediaContent,
							};

							// Add caption as options if provided
							if (caption) {
								body.options = { caption };
							}

							responseData = await makeApiRequest(url, body, apiKey, timeout);
							break;
						}

						default:
							throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`, {
								itemIndex: i,
							});
					}
				} else {
					throw new NodeOperationError(this.getNode(), `Unknown resource: ${resource}`, {
						itemIndex: i,
					});
				}

				returnData.push({
					json: responseData,
					pairedItem: { item: i },
				});

			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				// Re-throw as NodeOperationError if not already
				if (error instanceof NodeOperationError) {
					throw error;
				}
				throw new NodeOperationError(this.getNode(), error as Error, {
					itemIndex: i,
				});
			}
		}

		return [returnData];
	}
}

/**
 * Make HTTP request to wwebjs-api
 * Throws regular Error on failure (wrapped by caller)
 */
async function makeApiRequest(
	url: string,
	body: Record<string, unknown>,
	apiKey: string,
	timeout?: number,
): Promise<IDataObject> {
	try {
		const response = await axios.post(url, body, {
			headers: {
				'x-api-key': apiKey,
				'Content-Type': 'application/json',
				'User-Agent': 'n8n-whatsapp-bot-node/1.0.0',
			},
			timeout: (timeout || 30) * 1000,
		});

		return response.data as IDataObject;
	} catch (error: unknown) {
		if (axios.isAxiosError(error)) {
			if (error.response) {
				throw new Error(`HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`);
			} else if (error.request) {
				throw new Error(`Network error: Unable to connect to ${url}`);
			}
		}
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';
		throw new Error(`Request error: ${errorMessage}`);
	}
}
