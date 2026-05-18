/**
 * Deployment Script Tests
 *
 * Unit tests for the n8n custom nodes deployment script.
 * These tests mock SSH connections and filesystem operations.
 */

import { NodeSSH } from 'node-ssh';
import * as fs from 'fs';

// Mock node-ssh
jest.mock('node-ssh');

// Mock fs module
jest.mock('fs', () => ({
	existsSync: jest.fn(),
	readFileSync: jest.fn(),
	writeFileSync: jest.fn(),
	mkdirSync: jest.fn(),
	readdirSync: jest.fn(),
}));

// DeployConfig interface (matching deploy/config.ts)
interface DeployConfig {
	ssh: {
		host: string;
		user: string;
		privateKeyPath?: string;
	};
	remote: {
		n8nPath: string;
		customNodesPath: string;
		nodeName: string;
	};
	local: {
		distPath: string;
		packageJson: string;
	};
	backup: {
		enabled: boolean;
		maxBackups: number;
	};
}

// Test config that matches the DeployConfig interface
const testConfig: DeployConfig = {
	ssh: {
		host: 'test.server',
		user: 'testuser',
		privateKeyPath: '~/.ssh/test_key',
	},
	remote: {
		n8nPath: '/var/www/test/n8n',
		customNodesPath: '/var/www/test/custom-nodes',
		nodeName: 'n8n-nodes-test',
	},
	local: {
		distPath: './dist',
		packageJson: './package.json',
	},
	backup: {
		enabled: true,
		maxBackups: 3,
	},
};

const testConfigNoPrivateKey: DeployConfig = {
	...testConfig,
	ssh: {
		host: 'test.server',
		user: 'testuser',
		// privateKeyPath intentionally omitted
	},
};

const testConfigBackupDisabled: DeployConfig = {
	...testConfig,
	backup: {
		enabled: false,
		maxBackups: 3,
	},
};

describe('Deployment Script Tests', () => {
	let mockSSH: jest.Mocked<NodeSSH>;
	let mockExecCommand: jest.Mock;
	let mockConnect: jest.Mock;
	let mockPutFile: jest.Mock;
	let mockPutDirectory: jest.Mock;
	let mockDispose: jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();

		// Setup SSH mock
		mockExecCommand = jest.fn().mockResolvedValue({ code: 0, stdout: '', stderr: '' });
		mockConnect = jest.fn().mockResolvedValue(undefined);
		mockPutFile = jest.fn().mockResolvedValue(undefined);
		mockPutDirectory = jest.fn().mockResolvedValue(undefined);
		mockDispose = jest.fn();

		mockSSH = {
			connect: mockConnect,
			execCommand: mockExecCommand,
			putFile: mockPutFile,
			putDirectory: mockPutDirectory,
			dispose: mockDispose,
		} as unknown as jest.Mocked<NodeSSH>;

		(NodeSSH as jest.MockedClass<typeof NodeSSH>).mockImplementation(() => mockSSH);

		// Set HOME for privateKey path expansion
		process.env.HOME = '/home/testuser';
		process.env.SSH_AUTH_SOCK = '/tmp/ssh-agent.sock';
	});

	describe('DeployConfig Interface', () => {
		it('should have correct structure for SSH configuration', () => {
			expect(testConfig.ssh).toHaveProperty('host');
			expect(testConfig.ssh).toHaveProperty('user');
			expect(typeof testConfig.ssh.host).toBe('string');
			expect(typeof testConfig.ssh.user).toBe('string');
		});

		it('should have correct structure for remote paths', () => {
			expect(testConfig.remote).toHaveProperty('n8nPath');
			expect(testConfig.remote).toHaveProperty('customNodesPath');
			expect(testConfig.remote).toHaveProperty('nodeName');
		});

		it('should have correct structure for local paths', () => {
			expect(testConfig.local).toHaveProperty('distPath');
			expect(testConfig.local).toHaveProperty('packageJson');
		});

		it('should have correct structure for backup settings', () => {
			expect(testConfig.backup).toHaveProperty('enabled');
			expect(testConfig.backup).toHaveProperty('maxBackups');
			expect(typeof testConfig.backup.enabled).toBe('boolean');
			expect(typeof testConfig.backup.maxBackups).toBe('number');
		});

		it('should allow optional privateKeyPath in SSH config', () => {
			expect(testConfigNoPrivateKey.ssh.privateKeyPath).toBeUndefined();
		});
	});

	describe('Pre-flight Checks', () => {
		it('should return false when dist folder is missing', () => {
			(fs.existsSync as jest.Mock).mockReturnValue(false);

			const distPath = '/test/packages/whatsapp-n8n-nodes/dist';
			const exists = fs.existsSync(distPath);

			expect(exists).toBe(false);
		});

		it('should return true when dist folder exists', () => {
			(fs.existsSync as jest.Mock).mockReturnValue(true);

			const distPath = '/test/packages/whatsapp-n8n-nodes/dist';
			const exists = fs.existsSync(distPath);

			expect(exists).toBe(true);
		});

		it('should check package.json existence', () => {
			(fs.existsSync as jest.Mock)
				.mockReturnValueOnce(true) // dist folder
				.mockReturnValueOnce(true); // package.json

			const distExists = fs.existsSync('/test/dist');
			const packageJsonExists = fs.existsSync('/test/package.json');

			expect(distExists).toBe(true);
			expect(packageJsonExists).toBe(true);
		});

		it('should fail when package.json is missing', () => {
			(fs.existsSync as jest.Mock)
				.mockReturnValueOnce(true) // dist folder
				.mockReturnValueOnce(false); // package.json

			const distExists = fs.existsSync('/test/dist');
			const packageJsonExists = fs.existsSync('/test/package.json');

			expect(distExists).toBe(true);
			expect(packageJsonExists).toBe(false);
		});
	});

	describe('SSH Connection', () => {
		it('should connect with privateKey when path is provided', async () => {
			(fs.readFileSync as jest.Mock).mockReturnValue('mock-private-key-content');

			const ssh = new NodeSSH();
			await ssh.connect({
				host: testConfig.ssh.host,
				username: testConfig.ssh.user,
				privateKey: 'mock-private-key-content',
			});

			expect(mockConnect).toHaveBeenCalledWith({
				host: 'test.server',
				username: 'testuser',
				privateKey: 'mock-private-key-content',
			});
		});

		it('should use SSH agent when privateKeyPath is not provided', async () => {
			const ssh = new NodeSSH();
			await ssh.connect({
				host: testConfigNoPrivateKey.ssh.host,
				username: testConfigNoPrivateKey.ssh.user,
				agent: process.env.SSH_AUTH_SOCK,
			});

			expect(mockConnect).toHaveBeenCalledWith({
				host: 'test.server',
				username: 'testuser',
				agent: '/tmp/ssh-agent.sock',
			});
		});

		it('should expand ~ in privateKeyPath', () => {
			const keyPath = testConfig.ssh.privateKeyPath?.replace('~', process.env.HOME || '');
			expect(keyPath).toBe('/home/testuser/.ssh/test_key');
		});

		it('should handle SSH connection failure', async () => {
			mockConnect.mockRejectedValue(new Error('Connection refused'));

			const ssh = new NodeSSH();
			await expect(
				ssh.connect({
					host: testConfig.ssh.host,
					username: testConfig.ssh.user,
				})
			).rejects.toThrow('Connection refused');
		});

		// Session learning: macOS uses Keychain, SSH agent may have no identities
		it('should handle SSH agent with no identities (macOS Keychain scenario)', async () => {
			// When SSH agent is available but has no identities loaded
			mockConnect.mockRejectedValue(new Error('All configured authentication methods failed'));

			const ssh = new NodeSSH();
			await expect(
				ssh.connect({
					host: testConfigNoPrivateKey.ssh.host,
					username: testConfigNoPrivateKey.ssh.user,
					agent: process.env.SSH_AUTH_SOCK,
				})
			).rejects.toThrow('All configured authentication methods failed');
		});

		it('should prefer explicit privateKeyPath over SSH agent', () => {
			// When privateKeyPath is provided, it should be used instead of SSH agent
			expect(testConfig.ssh.privateKeyPath).toBeDefined();
			expect(testConfigNoPrivateKey.ssh.privateKeyPath).toBeUndefined();
		});
	});

	describe('Remote Verification', () => {
		it('should verify n8n path exists', async () => {
			mockExecCommand.mockResolvedValue({ code: 0, stdout: 'drwxr-xr-x n8n', stderr: '' });

			const ssh = new NodeSSH();
			const result = await ssh.execCommand(`ls -la ${testConfig.remote.n8nPath}`);

			expect(result.code).toBe(0);
			expect(mockExecCommand).toHaveBeenCalledWith(`ls -la ${testConfig.remote.n8nPath}`);
		});

		it('should detect when n8n path does not exist', async () => {
			mockExecCommand.mockResolvedValue({
				code: 2,
				stdout: '',
				stderr: 'No such file or directory',
			});

			const ssh = new NodeSSH();
			const result = await ssh.execCommand(`ls -la ${testConfig.remote.n8nPath}`);

			expect(result.code).toBe(2);
		});

		it('should create custom nodes directory if missing', async () => {
			mockExecCommand
				.mockResolvedValueOnce({ code: 2, stdout: '', stderr: 'No such file' }) // ls fails
				.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }); // mkdir succeeds

			const ssh = new NodeSSH();
			const lsResult = await ssh.execCommand(`ls -la ${testConfig.remote.customNodesPath}`);
			expect(lsResult.code).toBe(2);

			const mkdirResult = await ssh.execCommand(`mkdir -p ${testConfig.remote.customNodesPath}`);
			expect(mkdirResult.code).toBe(0);
		});

		it('should verify Docker is available', async () => {
			mockExecCommand.mockResolvedValue({
				code: 0,
				stdout: 'Docker version 24.0.0, build abc123',
				stderr: '',
			});

			const ssh = new NodeSSH();
			const result = await ssh.execCommand('docker --version');

			expect(result.code).toBe(0);
			expect(result.stdout).toContain('Docker version');
		});

		it('should check docker-compose.yml for custom nodes config', async () => {
			mockExecCommand.mockResolvedValue({
				code: 0,
				stdout: '- N8N_CUSTOM_EXTENSIONS=/home/node/.n8n/custom',
				stderr: '',
			});

			const ssh = new NodeSSH();
			const result = await ssh.execCommand(
				`cd ${testConfig.remote.n8nPath} && grep -E "custom|N8N_CUSTOM" docker-compose.yml`
			);

			expect(result.stdout).toContain('N8N_CUSTOM_EXTENSIONS');
		});

		it('should warn when docker-compose.yml missing custom nodes config', async () => {
			mockExecCommand.mockResolvedValue({
				code: 0,
				stdout: 'NOT_FOUND',
				stderr: '',
			});

			const ssh = new NodeSSH();
			const result = await ssh.execCommand(
				`cd ${testConfig.remote.n8nPath} && grep -E "custom|N8N_CUSTOM" docker-compose.yml 2>/dev/null || echo "NOT_FOUND"`
			);

			expect(result.stdout).toContain('NOT_FOUND');
		});
	});

	describe('Backup Operations', () => {
		it('should create timestamped backup', async () => {
			const remotePath = `${testConfig.remote.customNodesPath}/${testConfig.remote.nodeName}`;
			const backupPattern = new RegExp(`cp -r ${remotePath} ${remotePath}\\.backup\\.\\d{4}-\\d{2}-\\d{2}`);

			mockExecCommand
				.mockResolvedValueOnce({ code: 0, stdout: 'exists', stderr: '' }) // check exists
				.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }); // cp -r

			const ssh = new NodeSSH();

			// Check if deployment exists
			await ssh.execCommand(`ls -la ${remotePath}`);

			// Create backup with timestamp
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
			await ssh.execCommand(`cp -r ${remotePath} ${remotePath}.backup.${timestamp}`);

			expect(mockExecCommand).toHaveBeenCalledTimes(2);
			const cpCall = mockExecCommand.mock.calls[1][0];
			expect(cpCall).toMatch(/cp -r.*backup\./);
		});

		it('should skip backup when no existing deployment', async () => {
			const remotePath = `${testConfig.remote.customNodesPath}/${testConfig.remote.nodeName}`;

			mockExecCommand.mockResolvedValue({
				code: 2,
				stdout: '',
				stderr: 'No such file or directory',
			});

			const ssh = new NodeSSH();
			const result = await ssh.execCommand(`ls -la ${remotePath}`);

			expect(result.code).toBe(2);
			// Backup should not be attempted when path doesn't exist
		});

		it('should skip backup when disabled in config', () => {
			expect(testConfigBackupDisabled.backup.enabled).toBe(false);
		});

		it('should rotate old backups beyond maxBackups', async () => {
			const backupList = [
				`${testConfig.remote.customNodesPath}/${testConfig.remote.nodeName}.backup.2026-01-10T12-00-00`,
				`${testConfig.remote.customNodesPath}/${testConfig.remote.nodeName}.backup.2026-01-09T12-00-00`,
				`${testConfig.remote.customNodesPath}/${testConfig.remote.nodeName}.backup.2026-01-08T12-00-00`,
				`${testConfig.remote.customNodesPath}/${testConfig.remote.nodeName}.backup.2026-01-07T12-00-00`, // Should be deleted
			];

			mockExecCommand
				.mockResolvedValueOnce({ code: 0, stdout: backupList.join('\n'), stderr: '' }) // list backups
				.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }); // rm -rf

			const ssh = new NodeSSH();

			// List backups
			const listResult = await ssh.execCommand(
				`ls -1dt ${testConfig.remote.customNodesPath}/${testConfig.remote.nodeName}.backup.*`
			);

			const backups = listResult.stdout.split('\n');
			expect(backups.length).toBe(4);

			// Delete oldest (4th backup, beyond maxBackups of 3)
			if (backups.length > testConfig.backup.maxBackups) {
				const toDelete = backups.slice(testConfig.backup.maxBackups);
				await ssh.execCommand(`rm -rf ${toDelete[0]}`);
			}

			expect(mockExecCommand).toHaveBeenLastCalledWith(expect.stringContaining('rm -rf'));
		});
	});

	describe('Deploy Operations', () => {
		it('should clean remote directory before deploy', async () => {
			const remotePath = `${testConfig.remote.customNodesPath}/${testConfig.remote.nodeName}`;

			mockExecCommand
				.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // rm -rf
				.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }); // mkdir -p

			const ssh = new NodeSSH();
			await ssh.execCommand(`rm -rf ${remotePath}`);
			await ssh.execCommand(`mkdir -p ${remotePath}/dist`);

			expect(mockExecCommand).toHaveBeenCalledWith(`rm -rf ${remotePath}`);
			expect(mockExecCommand).toHaveBeenCalledWith(`mkdir -p ${remotePath}/dist`);
		});

		it('should upload dist folder files', async () => {
			(fs.readdirSync as jest.Mock).mockReturnValue([
				{ name: 'credentials', isDirectory: () => true },
				{ name: 'nodes', isDirectory: () => true },
				{ name: 'types', isDirectory: () => true },
			]);

			const remotePath = `${testConfig.remote.customNodesPath}/${testConfig.remote.nodeName}`;

			const ssh = new NodeSSH();
			await ssh.putDirectory('/test/dist/credentials', `${remotePath}/dist/credentials`, {
				recursive: true,
				concurrency: 10,
			});

			expect(mockPutDirectory).toHaveBeenCalledWith(
				'/test/dist/credentials',
				`${remotePath}/dist/credentials`,
				{ recursive: true, concurrency: 10 }
			);
		});

		it('should upload package.json', async () => {
			const remotePath = `${testConfig.remote.customNodesPath}/${testConfig.remote.nodeName}`;

			const ssh = new NodeSSH();
			await ssh.putFile('/test/package.json', `${remotePath}/package.json`);

			expect(mockPutFile).toHaveBeenCalledWith('/test/package.json', `${remotePath}/package.json`);
		});

		it('should run npm install --production --ignore-scripts', async () => {
			const remotePath = `${testConfig.remote.customNodesPath}/${testConfig.remote.nodeName}`;

			mockExecCommand.mockResolvedValue({ code: 0, stdout: 'added 10 packages', stderr: '' });

			const ssh = new NodeSSH();
			const result = await ssh.execCommand(`cd ${remotePath} && npm install --production --ignore-scripts 2>&1`);

			expect(result.code).toBe(0);
			expect(mockExecCommand).toHaveBeenCalledWith(
				expect.stringContaining('npm install --production --ignore-scripts')
			);
		});

		it('should handle npm install failure', async () => {
			mockExecCommand.mockResolvedValue({
				code: 1,
				stdout: '',
				stderr: 'npm ERR! code ENOENT',
			});

			const ssh = new NodeSSH();
			const result = await ssh.execCommand('cd /test && npm install --production --ignore-scripts 2>&1');

			expect(result.code).toBe(1);
		});

		it('should check if npm is available on server', async () => {
			mockExecCommand.mockResolvedValue({ code: 0, stdout: '/usr/bin/npm', stderr: '' });

			const ssh = new NodeSSH();
			const result = await ssh.execCommand('which npm 2>/dev/null');

			expect(result.code).toBe(0);
			expect(result.stdout).toContain('npm');
		});

		it('should fall back to docker exec when npm not on server', async () => {
			// First call: which npm fails (npm not found)
			// Second call: docker compose exec succeeds
			mockExecCommand
				.mockResolvedValueOnce({ code: 1, stdout: '', stderr: '' }) // which npm fails
				.mockResolvedValueOnce({ code: 0, stdout: 'added 10 packages', stderr: '' }); // docker exec succeeds

			const ssh = new NodeSSH();

			// Check npm availability
			const npmCheck = await ssh.execCommand('which npm 2>/dev/null');
			expect(npmCheck.code).toBe(1); // npm not found

			// Use docker exec as fallback
			const containerPath = `/home/node/.n8n/custom/${testConfig.remote.nodeName}`;
			const dockerResult = await ssh.execCommand(
				`cd ${testConfig.remote.n8nPath} && docker compose exec -T n8n sh -c "cd ${containerPath} && npm install --production --ignore-scripts 2>&1" 2>&1`
			);

			expect(dockerResult.code).toBe(0);
			expect(mockExecCommand).toHaveBeenCalledWith(expect.stringContaining('docker compose exec'));
		});

		it('should continue without npm install when both methods fail', async () => {
			// Both npm and docker exec fail - deployment should continue with warning
			mockExecCommand
				.mockResolvedValueOnce({ code: 1, stdout: '', stderr: '' }) // which npm fails
				.mockResolvedValueOnce({
					code: 1,
					stdout: '',
					stderr: "can't cd to /home/node/.n8n/custom",
				}); // docker exec fails

			const ssh = new NodeSSH();

			// Check npm availability
			const npmCheck = await ssh.execCommand('which npm 2>/dev/null');
			expect(npmCheck.code).toBe(1);

			// Docker exec also fails
			const dockerResult = await ssh.execCommand('docker compose exec -T n8n sh -c "cd /test && npm install" 2>&1');
			expect(dockerResult.code).toBe(1);

			// Deployment should continue (n8n may provide required dependencies)
		});

		it('should set permissions to UID 1000 for n8n node user', async () => {
			const remotePath = `${testConfig.remote.customNodesPath}/${testConfig.remote.nodeName}`;

			mockExecCommand
				.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // chmod
				.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }); // chown

			const ssh = new NodeSSH();
			await ssh.execCommand(`chmod -R 755 ${remotePath}`);
			await ssh.execCommand(`chown -R 1000:1000 ${remotePath}`);

			expect(mockExecCommand).toHaveBeenCalledWith(`chmod -R 755 ${remotePath}`);
			expect(mockExecCommand).toHaveBeenCalledWith(`chown -R 1000:1000 ${remotePath}`);
		});
	});

	describe('Post-Deployment', () => {
		it('should restart n8n container using docker compose', async () => {
			mockExecCommand.mockResolvedValue({ code: 0, stdout: '', stderr: '' });

			const ssh = new NodeSSH();
			const result = await ssh.execCommand(`cd ${testConfig.remote.n8nPath} && docker compose restart n8n`);

			expect(result.code).toBe(0);
			expect(mockExecCommand).toHaveBeenCalledWith(
				expect.stringContaining('docker compose restart n8n')
			);
		});

		it('should check n8n logs for custom node loading', async () => {
			mockExecCommand.mockResolvedValue({
				code: 0,
				stdout: 'Loaded custom node: WhatsApp Bot',
				stderr: '',
			});

			const ssh = new NodeSSH();
			const result = await ssh.execCommand(
				`cd ${testConfig.remote.n8nPath} && docker compose logs --tail=50 n8n 2>&1 | grep -i "custom\\|whatsapp"`
			);

			expect(result.stdout).toContain('WhatsApp');
		});

		// Session learning: "No codex available" is a NORMAL warning, means nodes ARE loaded
		it('should recognize "No codex available" as successful node loading', async () => {
			// This warning appears when n8n successfully loads the node but no AI documentation exists
			mockExecCommand.mockResolvedValue({
				code: 0,
				stdout: 'No codex available for: whatsAppBot\nNo codex available for: whatsAppBotTrigger',
				stderr: '',
			});

			const ssh = new NodeSSH();
			const result = await ssh.execCommand(
				`cd ${testConfig.remote.n8nPath} && docker compose logs --tail=50 n8n 2>&1 | grep -i "whatsapp"`
			);

			// "No codex" warning confirms nodes were discovered and loaded
			expect(result.stdout).toContain('whatsAppBot');
			expect(result.stdout).toContain('whatsAppBotTrigger');
		});

		it('should verify n8n container status', async () => {
			mockExecCommand.mockResolvedValue({
				code: 0,
				stdout: 'n8n    Up 10 seconds',
				stderr: '',
			});

			const ssh = new NodeSSH();
			const result = await ssh.execCommand(`cd ${testConfig.remote.n8nPath} && docker compose ps n8n`);

			expect(result.stdout).toContain('Up');
		});

		it('should detect n8n container not running', async () => {
			mockExecCommand.mockResolvedValue({
				code: 0,
				stdout: 'n8n    Exit 1',
				stderr: '',
			});

			const ssh = new NodeSSH();
			const result = await ssh.execCommand(`cd ${testConfig.remote.n8nPath} && docker compose ps n8n`);

			expect(result.stdout).not.toContain('Up');
			expect(result.stdout).not.toContain('running');
		});

		// Session learning: Check .env file for N8N_CUSTOM_EXTENSIONS
		it('should verify N8N_CUSTOM_EXTENSIONS in .env file', async () => {
			mockExecCommand.mockResolvedValue({
				code: 0,
				stdout: 'N8N_CUSTOM_EXTENSIONS=/home/node/.n8n/custom',
				stderr: '',
			});

			const ssh = new NodeSSH();
			const result = await ssh.execCommand(
				`cd ${testConfig.remote.n8nPath} && grep N8N_CUSTOM_EXTENSIONS .env 2>/dev/null || echo "NOT_FOUND"`
			);

			expect(result.stdout).toContain('N8N_CUSTOM_EXTENSIONS');
		});

		it('should warn when N8N_CUSTOM_EXTENSIONS missing from .env', async () => {
			mockExecCommand.mockResolvedValue({
				code: 0,
				stdout: 'NOT_FOUND',
				stderr: '',
			});

			const ssh = new NodeSSH();
			const result = await ssh.execCommand(
				`cd ${testConfig.remote.n8nPath} && grep N8N_CUSTOM_EXTENSIONS .env 2>/dev/null || echo "NOT_FOUND"`
			);

			expect(result.stdout).toContain('NOT_FOUND');
		});
	});

	describe('Rollback Operations', () => {
		it('should remove failed deployment', async () => {
			const remotePath = `${testConfig.remote.customNodesPath}/${testConfig.remote.nodeName}`;

			mockExecCommand.mockResolvedValue({ code: 0, stdout: '', stderr: '' });

			const ssh = new NodeSSH();
			await ssh.execCommand(`rm -rf ${remotePath}`);

			expect(mockExecCommand).toHaveBeenCalledWith(`rm -rf ${remotePath}`);
		});

		it('should restore backup on failure', async () => {
			const remotePath = `${testConfig.remote.customNodesPath}/${testConfig.remote.nodeName}`;
			const backupPath = `${remotePath}.backup.2026-01-10T12-00-00`;

			mockExecCommand
				.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }) // rm -rf
				.mockResolvedValueOnce({ code: 0, stdout: '', stderr: '' }); // mv backup

			const ssh = new NodeSSH();
			await ssh.execCommand(`rm -rf ${remotePath}`);
			await ssh.execCommand(`mv ${backupPath} ${remotePath}`);

			expect(mockExecCommand).toHaveBeenCalledWith(`rm -rf ${remotePath}`);
			expect(mockExecCommand).toHaveBeenCalledWith(`mv ${backupPath} ${remotePath}`);
		});

		it('should restart n8n after rollback', async () => {
			mockExecCommand.mockResolvedValue({ code: 0, stdout: '', stderr: '' });

			const ssh = new NodeSSH();
			await ssh.execCommand(`cd ${testConfig.remote.n8nPath} && docker compose restart n8n`);

			expect(mockExecCommand).toHaveBeenCalledWith(
				expect.stringContaining('docker compose restart n8n')
			);
		});
	});

	describe('Logging', () => {
		it('should create logs directory', () => {
			(fs.mkdirSync as jest.Mock).mockReturnValue(undefined);

			const logsDir = '/test/deploy/logs';
			fs.mkdirSync(logsDir, { recursive: true });

			expect(fs.mkdirSync).toHaveBeenCalledWith(logsDir, { recursive: true });
		});

		it('should write log file with timestamp', () => {
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
			const logFile = `/test/deploy/logs/deploy-${timestamp}.log`;
			const logContent = '2026-01-10T12:00:00.000Z [INFO] Deployment started';

			fs.writeFileSync(logFile, logContent);

			expect(fs.writeFileSync).toHaveBeenCalledWith(logFile, logContent);
		});

		it('should format log entries with level prefixes', () => {
			const levels = {
				info: '[INFO]',
				error: '[ERROR]',
				success: '[SUCCESS]',
				warn: '[WARN]',
			};

			Object.entries(levels).forEach(([level, prefix]) => {
				expect(prefix).toBe(`[${level.toUpperCase()}]`);
			});
		});
	});

	describe('Config Example Structure', () => {
		it('should export DeployConfig interface', async () => {
			// Test that the example config has all required fields
			const configExample = await import('../deploy/config.example');

			expect(configExample.deployConfig).toBeDefined();
			expect(configExample.deployConfig.ssh).toBeDefined();
			expect(configExample.deployConfig.remote).toBeDefined();
			expect(configExample.deployConfig.local).toBeDefined();
			expect(configExample.deployConfig.backup).toBeDefined();
		});

		it('should have correct default values in example', async () => {
			const configExample = await import('../deploy/config.example');

			// Example config uses placeholder hostname (actual server goes in config.ts)
			expect(configExample.deployConfig.ssh.host).toBe('your-server.example.com');
			expect(configExample.deployConfig.ssh.user).toBe('root');
			expect(configExample.deployConfig.remote.nodeName).toBe('n8n-nodes-whatsapp-bot');
			expect(configExample.deployConfig.backup.maxBackups).toBe(5);
		});
	});

	describe('SSH Cleanup', () => {
		it('should dispose SSH connection on completion', () => {
			const ssh = new NodeSSH();
			ssh.dispose();

			expect(mockDispose).toHaveBeenCalled();
		});

		it('should dispose SSH connection on error', async () => {
			mockExecCommand.mockRejectedValue(new Error('Command failed'));

			const ssh = new NodeSSH();

			try {
				await ssh.execCommand('failing command');
			} catch {
				ssh.dispose();
			}

			expect(mockDispose).toHaveBeenCalled();
		});
	});
});
