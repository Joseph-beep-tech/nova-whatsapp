#!/usr/bin/env npx ts-node
/**
 * n8n Custom Nodes Deployment Script
 *
 * Deploys the whatsapp-n8n-nodes package to a remote n8n server via SSH/SCP.
 *
 * Usage:
 *   npm run deploy           # Full deployment
 *   npm run deploy:backup    # Backup only
 *   npm run deploy:verify    # Verify remote setup only
 *
 * Key Learnings (Jan 2026):
 * - SSH agent may not work on macOS (uses Keychain) - use explicit privateKeyPath
 * - npm may not be available on server - uses docker exec fallback
 * - docker-compose.yml needs volume mount for custom nodes
 * - N8N_CUSTOM_EXTENSIONS must be set in .env or docker-compose.yml
 * - "No codex available" warning in logs means nodes ARE successfully loaded
 * - Custom nodes must have `n8n-community-node-package` keyword in package.json
 */

import { NodeSSH } from 'node-ssh';
import * as fs from 'fs';
import * as path from 'path';
import { deployConfig, DeployConfig } from './config';

// Parse CLI arguments
const args = process.argv.slice(2);
const backupOnly = args.includes('--backup-only');
const verifyOnly = args.includes('--verify-only');

// Logging utilities
const timestamp = () => new Date().toISOString();
const logFile = path.join(__dirname, 'logs', `deploy-${timestamp().replace(/[:.]/g, '-')}.log`);
let logBuffer: string[] = [];

function log(message: string, level: 'info' | 'error' | 'success' | 'warn' = 'info'): void {
	const prefix = {
		info: '\x1b[36m[INFO]\x1b[0m',
		error: '\x1b[31m[ERROR]\x1b[0m',
		success: '\x1b[32m[SUCCESS]\x1b[0m',
		warn: '\x1b[33m[WARN]\x1b[0m',
	};
	const logLine = `${timestamp()} ${prefix[level]} ${message}`;
	console.log(logLine);
	logBuffer.push(`${timestamp()} [${level.toUpperCase()}] ${message}`);
}

function saveLog(): void {
	try {
		fs.mkdirSync(path.dirname(logFile), { recursive: true });
		fs.writeFileSync(logFile, logBuffer.join('\n'));
		log(`Log saved to: ${logFile}`, 'info');
	} catch (error) {
		console.error('Failed to save log file:', error);
	}
}

// Pre-flight checks
async function preflightChecks(config: DeployConfig): Promise<boolean> {
	log('Running pre-flight checks...');

	// Check local dist folder exists
	const distPath = path.resolve(__dirname, '..', config.local.distPath);
	if (!fs.existsSync(distPath)) {
		log(`Local dist folder not found: ${distPath}`, 'error');
		log('Run "npm run build" first', 'info');
		return false;
	}
	log(`Local dist folder found: ${distPath}`, 'success');

	// Check package.json exists
	const packageJsonPath = path.resolve(__dirname, '..', config.local.packageJson);
	if (!fs.existsSync(packageJsonPath)) {
		log(`package.json not found: ${packageJsonPath}`, 'error');
		return false;
	}
	log(`package.json found: ${packageJsonPath}`, 'success');

	return true;
}

// SSH connection
async function connectSSH(config: DeployConfig): Promise<NodeSSH> {
	const ssh = new NodeSSH();
	log(`Connecting to ${config.ssh.user}@${config.ssh.host}...`);

	try {
		const connectOptions: { host: string; username: string; privateKey?: string; agent?: string } = {
			host: config.ssh.host,
			username: config.ssh.user,
		};

		if (config.ssh.privateKeyPath) {
			const keyPath = config.ssh.privateKeyPath.replace('~', process.env.HOME || '');
			connectOptions.privateKey = fs.readFileSync(keyPath, 'utf8');
		} else {
			// Use SSH agent
			connectOptions.agent = process.env.SSH_AUTH_SOCK;
		}

		await ssh.connect(connectOptions);
		log(`Connected to ${config.ssh.host}`, 'success');
		return ssh;
	} catch (error) {
		log(`SSH connection failed: ${(error as Error).message}`, 'error');
		throw error;
	}
}

// Verify remote setup
async function verifyRemote(ssh: NodeSSH, config: DeployConfig): Promise<boolean> {
	log('Verifying remote setup...');

	// Check n8n path exists
	const n8nCheck = await ssh.execCommand(`ls -la ${config.remote.n8nPath}`);
	if (n8nCheck.code !== 0) {
		log(`n8n path not found: ${config.remote.n8nPath}`, 'error');
		return false;
	}
	log(`n8n path found: ${config.remote.n8nPath}`, 'success');

	// Check custom nodes path exists (create if not)
	const customNodesPath = config.remote.customNodesPath;
	const customNodesCheck = await ssh.execCommand(`ls -la ${customNodesPath}`);
	if (customNodesCheck.code !== 0) {
		log(`Creating custom nodes directory: ${customNodesPath}`, 'info');
		const mkdirResult = await ssh.execCommand(`mkdir -p ${customNodesPath}`);
		if (mkdirResult.code !== 0) {
			log(`Failed to create custom nodes directory: ${mkdirResult.stderr}`, 'error');
			return false;
		}
	}
	log(`Custom nodes path ready: ${customNodesPath}`, 'success');

	// Check Docker is available
	const dockerCheck = await ssh.execCommand('docker --version');
	if (dockerCheck.code !== 0) {
		log('Docker not found on remote server', 'error');
		return false;
	}
	log(`Docker available: ${dockerCheck.stdout.trim()}`, 'success');

	// Check docker-compose.yml has custom nodes volume mount
	// Per n8n docs: custom nodes must be in ~/.n8n/custom/ inside container
	const composeCheck = await ssh.execCommand(
		`cd ${config.remote.n8nPath} && grep -E "custom|N8N_CUSTOM" docker-compose.yml 2>/dev/null || echo "NOT_FOUND"`
	);
	if (composeCheck.stdout.includes('NOT_FOUND')) {
		log('docker-compose.yml may not have custom nodes configuration', 'warn');
		log('Required in docker-compose.yml:', 'info');
		log('  volumes:', 'info');
		log('    - ../custom-nodes:/home/node/.n8n/custom', 'info');
		log('  environment:', 'info');
		log('    - N8N_CUSTOM_EXTENSIONS=/home/node/.n8n/custom', 'info');
	} else {
		log('docker-compose.yml has custom nodes configuration', 'success');
	}

	// Session learning: Also check .env file for N8N_CUSTOM_EXTENSIONS
	// docker-compose.override.yml may read from .env
	const envCheck = await ssh.execCommand(
		`cd ${config.remote.n8nPath} && grep N8N_CUSTOM_EXTENSIONS .env 2>/dev/null || echo "NOT_FOUND"`
	);
	if (envCheck.stdout.includes('NOT_FOUND')) {
		log('.env file may not have N8N_CUSTOM_EXTENSIONS set', 'warn');
		log('Add to .env: N8N_CUSTOM_EXTENSIONS=/home/node/.n8n/custom', 'info');
	} else {
		log('.env has N8N_CUSTOM_EXTENSIONS configured', 'success');
	}

	return true;
}

// Backup current deployment
async function backup(ssh: NodeSSH, config: DeployConfig): Promise<string | null> {
	if (!config.backup.enabled) {
		log('Backups disabled, skipping...', 'warn');
		return null;
	}

	const remotePath = `${config.remote.customNodesPath}/${config.remote.nodeName}`;
	const backupName = `${config.remote.nodeName}.backup.${timestamp().replace(/[:.]/g, '-')}`;
	const backupPath = `${config.remote.customNodesPath}/${backupName}`;

	// Check if current deployment exists
	const checkResult = await ssh.execCommand(`ls -la ${remotePath}`);
	if (checkResult.code !== 0) {
		log('No existing deployment to backup', 'info');
		return null;
	}

	log(`Creating backup: ${backupName}`);
	const cpResult = await ssh.execCommand(`cp -r ${remotePath} ${backupPath}`);
	if (cpResult.code !== 0) {
		log(`Backup failed: ${cpResult.stderr}`, 'error');
		return null;
	}
	log(`Backup created: ${backupPath}`, 'success');

	// Rotate old backups
	await rotateBackups(ssh, config);

	return backupPath;
}

// Rotate old backups
async function rotateBackups(ssh: NodeSSH, config: DeployConfig): Promise<void> {
	log('Rotating old backups...');

	const listResult = await ssh.execCommand(
		`ls -1dt ${config.remote.customNodesPath}/${config.remote.nodeName}.backup.* 2>/dev/null || true`
	);

	if (listResult.stdout.trim() === '') {
		return;
	}

	const backups = listResult.stdout.trim().split('\n');
	if (backups.length > config.backup.maxBackups) {
		const toDelete = backups.slice(config.backup.maxBackups);
		for (const backup of toDelete) {
			log(`Deleting old backup: ${backup}`, 'info');
			await ssh.execCommand(`rm -rf ${backup}`);
		}
	}
}

// Deploy files
async function deploy(ssh: NodeSSH, config: DeployConfig): Promise<boolean> {
	const localDistPath = path.resolve(__dirname, '..', config.local.distPath);
	const localPackageJson = path.resolve(__dirname, '..', config.local.packageJson);
	const remotePath = `${config.remote.customNodesPath}/${config.remote.nodeName}`;

	log(`Deploying to ${remotePath}...`);

	// Clean and create remote directory
	log('Cleaning remote directory...');
	await ssh.execCommand(`rm -rf ${remotePath}`);
	await ssh.execCommand(`mkdir -p ${remotePath}/dist`);

	// Upload dist folder
	log('Uploading dist folder...');
	try {
		const distFiles = fs.readdirSync(localDistPath, { withFileTypes: true });
		for (const file of distFiles) {
			const localPath = path.join(localDistPath, file.name);
			const remoteFilePath = `${remotePath}/dist/${file.name}`;

			if (file.isDirectory()) {
				await ssh.execCommand(`mkdir -p ${remoteFilePath}`);
				await ssh.putDirectory(localPath, remoteFilePath, {
					recursive: true,
					concurrency: 10,
				});
			} else {
				await ssh.putFile(localPath, remoteFilePath);
			}
		}
		log('Dist folder uploaded', 'success');
	} catch (error) {
		log(`Failed to upload dist folder: ${(error as Error).message}`, 'error');
		return false;
	}

	// Upload package.json
	log('Uploading package.json...');
	try {
		await ssh.putFile(localPackageJson, `${remotePath}/package.json`);
		log('package.json uploaded', 'success');
	} catch (error) {
		log(`Failed to upload package.json: ${(error as Error).message}`, 'error');
		return false;
	}

	// Install production dependencies (axios, n8n-core)
	// Per n8n docs: node modules need their dependencies installed
	// First try npm on server, if not available use docker exec
	log('Installing production dependencies...');
	const npmCheckResult = await ssh.execCommand('which npm 2>/dev/null');

	if (npmCheckResult.code === 0) {
		// npm is available on server
		const npmResult = await ssh.execCommand(`cd ${remotePath} && npm install --production --ignore-scripts 2>&1`);
		if (npmResult.code !== 0) {
			log(`npm install failed: ${npmResult.stderr || npmResult.stdout}`, 'error');
			return false;
		}
		log('Dependencies installed (server npm)', 'success');
	} else {
		// npm not on server, try using n8n container
		// The custom-nodes dir is mounted at /home/node/.n8n/custom in the container
		log('npm not found on server, using n8n container...', 'warn');
		const containerPath = `/home/node/.n8n/custom/${config.remote.nodeName}`;
		const dockerNpmResult = await ssh.execCommand(
			`cd ${config.remote.n8nPath} && docker compose exec -T n8n sh -c "cd ${containerPath} && npm install --production --ignore-scripts 2>&1" 2>&1`
		);
		if (dockerNpmResult.code !== 0) {
			// If docker exec also fails, try without npm install
			// n8n-core is provided by n8n runtime, only axios needs installing
			log(`Docker npm install failed: ${dockerNpmResult.stderr || dockerNpmResult.stdout}`, 'warn');
			log('Continuing without npm install - n8n may provide required dependencies', 'warn');
		} else {
			log('Dependencies installed (docker npm)', 'success');
		}
	}

	// Set permissions (n8n runs as node user, UID 1000)
	log('Setting file permissions...');
	await ssh.execCommand(`chmod -R 755 ${remotePath}`);
	await ssh.execCommand(`chown -R 1000:1000 ${remotePath}`);
	log('Permissions set', 'success');

	return true;
}

// Restart n8n
async function restartN8n(ssh: NodeSSH, config: DeployConfig): Promise<boolean> {
	log('Restarting n8n container...');

	const result = await ssh.execCommand(`cd ${config.remote.n8nPath} && docker compose restart n8n`);
	if (result.code !== 0) {
		log(`Failed to restart n8n: ${result.stderr}`, 'error');
		return false;
	}
	log('n8n container restarted', 'success');

	// Wait for n8n to start
	log('Waiting for n8n to start (10 seconds)...');
	await new Promise((resolve) => setTimeout(resolve, 10000));

	// Check n8n logs for custom node loading
	log('Checking n8n logs for custom node loading...');
	const logsResult = await ssh.execCommand(
		`cd ${config.remote.n8nPath} && docker compose logs --tail=50 n8n 2>&1 | grep -i "custom\\|whatsapp\\|codex" || echo "No custom node logs found"`
	);

	// Session learning: "No codex available" is a NORMAL warning that confirms nodes ARE loaded
	// It just means no AI documentation exists for the node
	if (logsResult.stdout.includes('No codex available for')) {
		log('Custom nodes successfully loaded (codex warnings are normal)', 'success');
	}
	log(`n8n logs: ${logsResult.stdout}`, 'info');

	// Verify n8n is running
	const statusResult = await ssh.execCommand(`cd ${config.remote.n8nPath} && docker compose ps n8n`);
	if (!statusResult.stdout.includes('Up') && !statusResult.stdout.includes('running')) {
		log('n8n container may not be running properly', 'warn');
		log(`Status: ${statusResult.stdout}`, 'info');
	} else {
		log('n8n container is running', 'success');
	}

	return true;
}

// Rollback to backup
async function rollback(ssh: NodeSSH, config: DeployConfig, backupPath: string): Promise<void> {
	log(`Rolling back to backup: ${backupPath}`, 'warn');

	const remotePath = `${config.remote.customNodesPath}/${config.remote.nodeName}`;

	// Remove failed deployment
	await ssh.execCommand(`rm -rf ${remotePath}`);

	// Restore backup
	await ssh.execCommand(`mv ${backupPath} ${remotePath}`);

	log('Rollback complete', 'success');

	// Restart n8n with restored version
	await restartN8n(ssh, config);
}

// Main deployment function
async function main(): Promise<void> {
	log('========================================');
	log('n8n Custom Nodes Deployment Script');
	log('========================================');

	let ssh: NodeSSH | null = null;
	let backupPath: string | null = null;

	try {
		// Pre-flight checks
		if (!(await preflightChecks(deployConfig))) {
			process.exit(1);
		}

		// Connect SSH
		ssh = await connectSSH(deployConfig);

		// Verify remote setup
		if (!(await verifyRemote(ssh, deployConfig))) {
			process.exit(1);
		}

		if (verifyOnly) {
			log('Verify only mode - deployment skipped', 'info');
			ssh.dispose();
			saveLog();
			process.exit(0);
		}

		// Backup current deployment
		backupPath = await backup(ssh, deployConfig);

		if (backupOnly) {
			log('Backup only mode - deployment skipped', 'info');
			ssh.dispose();
			saveLog();
			process.exit(0);
		}

		// Deploy files
		if (!(await deploy(ssh, deployConfig))) {
			if (backupPath) {
				await rollback(ssh, deployConfig, backupPath);
			}
			process.exit(1);
		}

		// Restart n8n
		if (!(await restartN8n(ssh, deployConfig))) {
			log('n8n restart may have failed, check manually', 'warn');
		}

		log('========================================');
		log('Deployment complete!', 'success');
		log('========================================');
		log('');
		log('Next steps:');
		log('1. Open n8n UI and search for "WhatsApp Bot"');
		log('2. Configure credentials with your API key');
		log('3. Test trigger and action nodes');

	} catch (error) {
		log(`Deployment failed: ${(error as Error).message}`, 'error');

		if (ssh && backupPath) {
			await rollback(ssh, deployConfig, backupPath);
		}

		process.exit(1);
	} finally {
		if (ssh) {
			ssh.dispose();
		}
		saveLog();
	}
}

// Run
main();
