/**
 * Deployment Configuration Example
 *
 * Copy this file to config.ts and update with your values.
 * config.ts is gitignored.
 */

export interface DeployConfig {
	ssh: {
		host: string;
		user: string;
		privateKeyPath?: string; // Optional, uses SSH agent by default
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

export const deployConfig: DeployConfig = {
	// SSH connection
	ssh: {
		host: 'your-server.example.com',
		user: 'root',
		// privateKeyPath: '~/.ssh/id_rsa', // Uncomment if not using SSH agent
	},

	// Remote paths
	remote: {
		n8nPath: '/var/www/your-n8n.example.com/n8n',
		customNodesPath: '/var/www/your-n8n.example.com/custom-nodes',
		nodeName: 'n8n-nodes-whatsapp-bot',
	},

	// Local paths (relative to package root)
	local: {
		distPath: './dist',
		packageJson: './package.json',
	},

	// Backup settings
	backup: {
		enabled: true,
		maxBackups: 5, // Keep last 5 backups
	},
};
