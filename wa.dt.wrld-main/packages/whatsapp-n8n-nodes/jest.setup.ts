// Global test setup
import 'jest';

// Mock axios for all tests
jest.mock('axios', () => ({
	create: jest.fn(() => ({
		request: jest.fn(),
		get: jest.fn(),
		post: jest.fn(),
		put: jest.fn(),
		delete: jest.fn(),
	})),
	request: jest.fn(),
	get: jest.fn(),
	post: jest.fn(),
	put: jest.fn(),
	delete: jest.fn(),
	isAxiosError: jest.fn(),
}));

// Mock crypto for webhook signature validation
Object.defineProperty(global, 'crypto', {
	value: {
		createHmac: jest.fn().mockReturnValue({
			update: jest.fn().mockReturnValue({
				digest: jest.fn().mockReturnValue('mocked-hash'),
			}),
		}),
	},
});

// Suppress console logs during tests unless LOG_LEVEL is set
if (!process.env.LOG_LEVEL) {
	global.console = {
		...console,
		log: jest.fn(),
		debug: jest.fn(),
		info: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
	};
}

// Add custom matchers with TypeScript declarations
declare global {
	namespace jest {
		interface Matchers<R> {
			toHaveValidNodeStructure(): R;
		}
	}
}

expect.extend({
	toHaveValidNodeStructure(received: any) {
		const requiredProperties = ['displayName', 'name', 'group', 'version', 'description'];
		const missingProps = requiredProperties.filter(prop => !received.hasOwnProperty(prop));
		
		if (missingProps.length > 0) {
			return {
				message: () => `Expected node description to have properties: ${missingProps.join(', ')}`,
				pass: false,
			};
		}
		
		return {
			message: () => 'Node description has all required properties',
			pass: true,
		};
	},
});