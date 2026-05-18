// WhatsApp Bot Types and Interfaces

export interface IWhatsAppBotCredentials {
	serverUrl: string;
	apiKey: string;
	sessionId: string;
	webhookSecret?: string;
	timeout?: number;
}

// Message Types
export interface IWhatsAppMessage {
	id: string;
	body: string;
	type: 'chat' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contact' | 'poll' | 'sticker';
	timestamp: number;
	from: string;
	to: string;
	fromMe: boolean;
	hasMedia: boolean;
	hasQuotedMsg: boolean;
	isGroup: boolean;
	author?: string;
	deviceType: string;
	isForwarded: boolean;
	isStatus: boolean;
	isStarred: boolean;
}

export interface IWhatsAppContact {
	id: string;
	name: string;
	pushname: string;
	shortName?: string;
	number: string;
	isMe: boolean;
	isUser: boolean;
	isGroup: boolean;
	isWAContact: boolean;
	isMyContact: boolean;
	isBlocked: boolean;
	profilePicUrl?: string;
}

export interface IWhatsAppGroup {
	id: string;
	name: string;
	description?: string;
	participants: IWhatsAppGroupParticipant[];
	admins: string[];
	owner: string;
	createdAt: number;
	participantCount: number;
	isReadOnly: boolean;
	announce: boolean;
	restrict: boolean;
	inviteCode?: string;
}

export interface IWhatsAppGroupParticipant {
	id: string;
	isAdmin: boolean;
	isSuperAdmin: boolean;
}

export interface IWhatsAppMedia {
	data: Buffer | string;
	mimetype: string;
	filename?: string;
	caption?: string;
	size?: number;
	url?: string;
}

export interface IWhatsAppPoll {
	name: string;
	options: string[];
	multipleSelection: boolean;
	allowCreatorEdit: boolean;
	results?: IWhatsAppPollResults;
}

export interface IWhatsAppPollResults {
	totalVotes: number;
	results: Array<{
		option: string;
		votes: number;
		voters: string[];
	}>;
}

export interface IWhatsAppLocation {
	latitude: number;
	longitude: number;
	description?: string;
}

// Event Types
export interface IWhatsAppEvent {
	eventType: 'message_received' | 'group_join' | 'group_leave' | 'group_update' | 'message_reaction' | 'call' | 'status_update';
	data: any;
	timestamp: string;
	botInstance: string;
}

export interface IMessageEvent extends IWhatsAppEvent {
	eventType: 'message_received';
	data: {
		message: IWhatsAppMessage;
		contact: IWhatsAppContact;
		group?: IWhatsAppGroup;
		media?: IWhatsAppMedia;
		location?: IWhatsAppLocation;
		quotedMessage?: IWhatsAppMessage;
	};
}

export interface IGroupEvent extends IWhatsAppEvent {
	eventType: 'group_join' | 'group_leave' | 'group_update';
	data: {
		groupId: string;
		group: IWhatsAppGroup;
		participants?: string[];
		action: string;
		author?: string;
	};
}

export interface IReactionEvent extends IWhatsAppEvent {
	eventType: 'message_reaction';
	data: {
		messageId: string;
		reaction: string;
		author: string;
		timestamp: number;
	};
}

// API Request/Response Types
export interface IWhatsAppApiRequest {
	action: string;
	data: Record<string, any>;
}

export interface IWhatsAppApiResponse {
	success: boolean;
	data?: any;
	error?: string;
}

// Node Configuration Types
export interface ITriggerConfig {
	eventTypes: string[];
	chatTypes: 'all' | 'individual' | 'group';
	messageTypes?: string[];
	keywordFilters?: string[];
	contactFilter?: 'none' | 'whitelist' | 'blacklist';
	contacts?: string[];
	groupFilter?: 'none' | 'whitelist' | 'blacklist';
	groups?: string[];
	filterToNumber?: string;
	filterFromNumber?: string;
}

export interface IActionConfig {
	operation: string;
	to?: string;
	message?: string;
	media?: IWhatsAppMedia;
	options?: Record<string, any>;
}

// Error Types
export interface IWhatsAppError {
	code: string;
	message: string;
	retryable: boolean;
	context?: Record<string, unknown>;
}

// Rate Limiting Types
export interface IRateLimitConfig {
	messagesPerMinute: number;
	burstLimit: number;
	queueSize: number;
	backoffStrategy: 'linear' | 'exponential';
}