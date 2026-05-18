#!/usr/bin/env npx tsx

import * as fs from 'fs';
import * as path from 'path';

interface AssetMapping {
	src: string;
	dest: string;
}

export const assets: AssetMapping[] = [
	{ src: 'nodes/WhatsAppBot/whatsapp.svg', dest: 'dist/nodes/WhatsAppBot/whatsapp.svg' },
	{ src: 'nodes/WhatsAppBotTrigger/whatsapp.svg', dest: 'dist/nodes/WhatsAppBotTrigger/whatsapp.svg' },
	{ src: 'assets/whatsapp.svg', dest: 'dist/credentials/whatsapp.svg' },
];

export function copyAssets(baseDir: string = __dirname): AssetMapping[] {
	const results: AssetMapping[] = [];

	for (const { src, dest } of assets) {
		const srcPath = path.join(baseDir, src);
		const destPath = path.join(baseDir, dest);

		// Ensure destination directory exists
		const destDir = path.dirname(destPath);
		if (!fs.existsSync(destDir)) {
			fs.mkdirSync(destDir, { recursive: true });
		}

		// Copy the file
		fs.copyFileSync(srcPath, destPath);
		console.log(`Copied ${src} -> ${dest}`);
		results.push({ src, dest });
	}

	return results;
}

// Run if called directly
if (require.main === module) {
	copyAssets();
}
