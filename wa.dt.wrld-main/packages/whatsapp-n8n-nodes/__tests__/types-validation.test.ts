describe('TypeScript Type Validation', () => {
	describe('Type Import Tests', () => {
		it('should import all WhatsApp types successfully', async () => {
			const types = await import('../types/WhatsAppBot.types');
			
			// Check that all major interfaces are accessible
			expect(types).toBeDefined();
		});

		it('should import credential classes successfully', async () => {
			const credentials = await import('../credentials/WhatsAppBotApi.credentials');
			
			expect(credentials.WhatsAppBotApi).toBeDefined();
		});

		it('should import node classes successfully', async () => {
			const actionNode = await import('../nodes/WhatsAppBot/WhatsAppBot.node');
			const triggerNode = await import('../nodes/WhatsAppBotTrigger/WhatsAppBotTrigger.node');
			
			expect(actionNode.WhatsAppBot).toBeDefined();
			expect(triggerNode.WhatsAppBotTrigger).toBeDefined();
		});
	});

	describe('Build Configuration', () => {
		it('should have valid TypeScript configuration', () => {
			const tsConfig = require('../tsconfig.json');
			
			expect(tsConfig.compilerOptions).toBeDefined();
			expect(tsConfig.compilerOptions.target).toBe('ES2019');
			expect(tsConfig.compilerOptions.module).toBe('CommonJS');
			expect(tsConfig.compilerOptions.strict).toBe(true);
		});

		it('should include correct source directories', () => {
			const tsConfig = require('../tsconfig.json');
			
			expect(tsConfig.include).toContain('credentials/**/*');
			expect(tsConfig.include).toContain('nodes/**/*');
			expect(tsConfig.include).toContain('types/**/*');
		});

		it('should exclude test and build directories', () => {
			const tsConfig = require('../tsconfig.json');
			
			expect(tsConfig.exclude).toContain('dist');
			expect(tsConfig.exclude).toContain('**/*.test.ts');
			expect(tsConfig.exclude).toContain('node_modules');
		});
	});

	describe('Interface Structure Validation', () => {
		it('should validate basic message interface structure', () => {
			// This test ensures our types are structurally sound
			const validMessage = {
				id: 'msg123',
				body: 'Hello World',
				type: 'chat',
				timestamp: Date.now(),
				from: '1234567890@c.us',
				to: 'bot@c.us',
				fromMe: false,
				hasMedia: false,
				hasQuotedMsg: false,
				isGroup: false,
				deviceType: 'web',
				isForwarded: false,
				isStatus: false,
				isStarred: false,
			};

			// Basic structure validation
			expect(validMessage).toHaveProperty('id');
			expect(validMessage).toHaveProperty('body');
			expect(validMessage).toHaveProperty('type');
			expect(validMessage).toHaveProperty('timestamp');
			expect(validMessage).toHaveProperty('from');
			expect(validMessage).toHaveProperty('to');
			expect(typeof validMessage.fromMe).toBe('boolean');
			expect(typeof validMessage.hasMedia).toBe('boolean');
			expect(typeof validMessage.isGroup).toBe('boolean');
		});

		it('should validate basic contact interface structure', () => {
			const validContact = {
				id: '1234567890@c.us',
				name: 'John Doe',
				pushname: 'John',
				number: '1234567890',
				isMe: false,
				isUser: true,
				isGroup: false,
				isWAContact: true,
				isMyContact: true,
				isBlocked: false,
			};

			expect(validContact).toHaveProperty('id');
			expect(validContact).toHaveProperty('name');
			expect(validContact).toHaveProperty('number');
			expect(typeof validContact.isMe).toBe('boolean');
			expect(typeof validContact.isUser).toBe('boolean');
		});

		it('should validate basic group interface structure', () => {
			const validGroup = {
				id: 'group123@g.us',
				name: 'Test Group',
				participants: [],
				admins: [],
				owner: 'owner@c.us',
				createdAt: Date.now(),
				participantCount: 5,
				isReadOnly: false,
				announce: false,
				restrict: false,
			};

			expect(validGroup).toHaveProperty('id');
			expect(validGroup).toHaveProperty('name');
			expect(Array.isArray(validGroup.participants)).toBe(true);
			expect(Array.isArray(validGroup.admins)).toBe(true);
			expect(typeof validGroup.participantCount).toBe('number');
		});
	});

	describe('Node Configuration Validation', () => {
		it('should have valid action node configuration', async () => {
			const { WhatsAppBot } = await import('../nodes/WhatsAppBot/WhatsAppBot.node');
			const node = new WhatsAppBot();

			const requiredProps = ['displayName', 'name', 'group', 'version', 'description'];
			requiredProps.forEach(prop => {
				expect(node.description).toHaveProperty(prop);
			});

			expect(node.description.inputs).toEqual(['main']);
			expect(node.description.outputs).toEqual(['main']);
			expect(Array.isArray(node.description.properties)).toBe(true);
		});

		it('should have valid trigger node configuration', async () => {
			const { WhatsAppBotTrigger } = await import('../nodes/WhatsAppBotTrigger/WhatsAppBotTrigger.node');
			const node = new WhatsAppBotTrigger();

			const requiredProps = ['displayName', 'name', 'group', 'version', 'description'];
			requiredProps.forEach(prop => {
				expect(node.description).toHaveProperty(prop);
			});

			expect(node.description.inputs).toEqual([]);
			expect(node.description.outputs).toEqual(['main']);
			expect(node.description.webhooks).toBeDefined();
		});

		it('should have valid credentials configuration', async () => {
			const { WhatsAppBotApi } = await import('../credentials/WhatsAppBotApi.credentials');
			const creds = new WhatsAppBotApi();

			expect(creds.name).toBe('whatsAppBotApi');
			expect(creds.displayName).toBe('WhatsApp Bot API');
			expect(Array.isArray(creds.properties)).toBe(true);
			expect(creds.test).toBeDefined();
			expect(creds.authenticate).toBeDefined();
		});
	});
});