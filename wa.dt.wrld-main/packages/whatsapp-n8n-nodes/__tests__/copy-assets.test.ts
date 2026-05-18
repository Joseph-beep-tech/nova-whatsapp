import * as path from 'path';

// Mock fs module
jest.mock('fs', () => ({
	existsSync: jest.fn(),
	mkdirSync: jest.fn(),
	copyFileSync: jest.fn(),
}));

import * as fs from 'fs';
import { copyAssets, assets } from '../copy-assets';

const mockFs = fs as jest.Mocked<typeof fs>;

describe('copy-assets', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.spyOn(console, 'log').mockImplementation(() => {});
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('assets configuration', () => {
		it('should define all required asset mappings', () => {
			expect(assets).toHaveLength(3);
			expect(assets).toContainEqual({
				src: 'nodes/WhatsAppBot/whatsapp.svg',
				dest: 'dist/nodes/WhatsAppBot/whatsapp.svg',
			});
			expect(assets).toContainEqual({
				src: 'nodes/WhatsAppBotTrigger/whatsapp.svg',
				dest: 'dist/nodes/WhatsAppBotTrigger/whatsapp.svg',
			});
			expect(assets).toContainEqual({
				src: 'assets/whatsapp.svg',
				dest: 'dist/credentials/whatsapp.svg',
			});
		});
	});

	describe('copyAssets', () => {
		it('should copy all assets to their destinations', () => {
			mockFs.existsSync.mockReturnValue(true);

			const results = copyAssets('/base');

			expect(results).toHaveLength(3);
			expect(mockFs.copyFileSync).toHaveBeenCalledTimes(3);
		});

		it('should create destination directories if they do not exist', () => {
			mockFs.existsSync.mockReturnValue(false);

			copyAssets('/base');

			expect(mockFs.mkdirSync).toHaveBeenCalledTimes(3);
			expect(mockFs.mkdirSync).toHaveBeenCalledWith(
				path.join('/base', 'dist/nodes/WhatsAppBot'),
				{ recursive: true }
			);
			expect(mockFs.mkdirSync).toHaveBeenCalledWith(
				path.join('/base', 'dist/nodes/WhatsAppBotTrigger'),
				{ recursive: true }
			);
			expect(mockFs.mkdirSync).toHaveBeenCalledWith(
				path.join('/base', 'dist/credentials'),
				{ recursive: true }
			);
		});

		it('should not create directories if they already exist', () => {
			mockFs.existsSync.mockReturnValue(true);

			copyAssets('/base');

			expect(mockFs.mkdirSync).not.toHaveBeenCalled();
		});

		it('should copy files with correct source and destination paths', () => {
			mockFs.existsSync.mockReturnValue(true);

			copyAssets('/base');

			expect(mockFs.copyFileSync).toHaveBeenCalledWith(
				path.join('/base', 'nodes/WhatsAppBot/whatsapp.svg'),
				path.join('/base', 'dist/nodes/WhatsAppBot/whatsapp.svg')
			);
			expect(mockFs.copyFileSync).toHaveBeenCalledWith(
				path.join('/base', 'nodes/WhatsAppBotTrigger/whatsapp.svg'),
				path.join('/base', 'dist/nodes/WhatsAppBotTrigger/whatsapp.svg')
			);
			expect(mockFs.copyFileSync).toHaveBeenCalledWith(
				path.join('/base', 'assets/whatsapp.svg'),
				path.join('/base', 'dist/credentials/whatsapp.svg')
			);
		});

		it('should log each copy operation', () => {
			mockFs.existsSync.mockReturnValue(true);

			copyAssets('/base');

			expect(console.log).toHaveBeenCalledTimes(3);
			expect(console.log).toHaveBeenCalledWith(
				'Copied nodes/WhatsAppBot/whatsapp.svg -> dist/nodes/WhatsAppBot/whatsapp.svg'
			);
		});

		it('should return results with source and destination info', () => {
			mockFs.existsSync.mockReturnValue(true);

			const results = copyAssets('/base');

			expect(results[0]).toEqual({
				src: 'nodes/WhatsAppBot/whatsapp.svg',
				dest: 'dist/nodes/WhatsAppBot/whatsapp.svg',
			});
		});
	});
});
