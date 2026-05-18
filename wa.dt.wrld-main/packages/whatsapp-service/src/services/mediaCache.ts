/**
 * Media Cache Service
 *
 * Fetches and caches external media files for use with whatsapp-api MessageMediaFromURL.
 * This bypasses the whatsapp-web.js atob() bug by serving media via internal URLs.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';
import { mediaProxyConfig } from '../shared/config';
import { CachedMediaEntry, MediaCacheStats } from '../types/media';
import { getErrorMessage } from '../types/webhook';

/**
 * MIME type to file extension mapping
 */
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'audio/mpeg': '.mp3',
  'audio/ogg': '.ogg',
  'audio/wav': '.wav',
  'application/pdf': '.pdf',
  'application/octet-stream': '.bin',
};

/**
 * Get file extension from MIME type
 */
function getExtensionFromMime(mimetype: string): string {
  return MIME_TO_EXT[mimetype] || '.bin';
}

/**
 * Detect MIME type from Content-Type header
 */
function parseMimeType(contentType: string | null): string {
  if (!contentType) return 'application/octet-stream';
  // Strip charset and other parameters
  return contentType.split(';')[0].trim();
}

export class MediaCacheService {
  private cache: Map<string, CachedMediaEntry> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private initialized = false;

  /**
   * Initialize the media cache service
   * Creates cache directory and starts cleanup interval
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    // Ensure cache directory exists
    const cacheDir = mediaProxyConfig.cacheDir;
    if (!existsSync(cacheDir)) {
      mkdirSync(cacheDir, { recursive: true });
    }

    // Start periodic cleanup
    this.cleanupInterval = setInterval(
      () => this.cleanup().catch(err => console.error('Media cache cleanup error:', err)),
      mediaProxyConfig.cleanupIntervalMs
    );

    // Load existing cache entries from disk (optional, for persistence across restarts)
    await this.loadCacheIndex();

    this.initialized = true;
    console.log(`✅ Media cache initialized at ${cacheDir}`);
  }

  /**
   * Fetch external URL and cache locally
   * @param url External URL to fetch
   * @param filename Optional filename override
   * @param mimetype Optional MIME type override
   * @returns Cached media entry
   */
  async fetchAndCache(
    url: string,
    filename?: string,
    mimetype?: string
  ): Promise<CachedMediaEntry> {
    const id = randomUUID();

    // Fetch the media
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch media: ${response.status} ${response.statusText}`);
    }

    // Check content length before downloading
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > mediaProxyConfig.maxFileSizeBytes) {
      throw new Error(
        `Media too large: ${contentLength} bytes (max: ${mediaProxyConfig.maxFileSizeBytes})`
      );
    }

    // Determine MIME type
    const detectedMime = parseMimeType(response.headers.get('content-type'));
    const finalMime = mimetype || detectedMime;

    // Determine filename
    const ext = getExtensionFromMime(finalMime);
    const finalFilename = filename || `media-${id}${ext}`;

    // Create local file path
    const localPath = path.join(mediaProxyConfig.cacheDir, `${id}${ext}`);

    // Stream response to file
    if (!response.body) {
      throw new Error('Response body is null');
    }

    const writeStream = createWriteStream(localPath);
    await pipeline(Readable.fromWeb(response.body as never), writeStream);

    // Get file size
    const stats = await fs.stat(localPath);

    // Verify size after download
    if (stats.size > mediaProxyConfig.maxFileSizeBytes) {
      await fs.unlink(localPath);
      throw new Error(
        `Media too large: ${stats.size} bytes (max: ${mediaProxyConfig.maxFileSizeBytes})`
      );
    }

    // Create cache entry
    const entry: CachedMediaEntry = {
      id,
      url,
      mimetype: finalMime,
      filename: finalFilename,
      size: stats.size,
      expiresAt: new Date(Date.now() + mediaProxyConfig.cacheTtlSeconds * 1000),
      localPath,
      cachedAt: new Date(),
    };

    this.cache.set(id, entry);

    // Persist cache index
    await this.saveCacheIndex();

    console.log(`📁 Cached media: ${id} (${finalMime}, ${stats.size} bytes)`);

    return entry;
  }

  /**
   * Get cached media entry by ID
   * @param id Cache entry ID
   * @returns Cache entry if exists and not expired, null otherwise
   */
  get(id: string): CachedMediaEntry | null {
    const entry = this.cache.get(id);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (new Date() > entry.expiresAt) {
      // Remove expired entry
      this.cache.delete(id);
      // Try to delete file (async, don't wait)
      fs.unlink(entry.localPath).catch(() => {});
      return null;
    }

    return entry;
  }

  /**
   * Get cached media file path by ID
   * @param id Cache entry ID
   * @returns Local file path if exists and not expired, null otherwise
   */
  getFilePath(id: string): string | null {
    const entry = this.get(id);
    return entry?.localPath || null;
  }

  /**
   * Clean up expired cache entries
   */
  async cleanup(): Promise<number> {
    const now = new Date();
    let cleanedCount = 0;

    for (const [id, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(id);

        try {
          await fs.unlink(entry.localPath);
          cleanedCount++;
        } catch {
          // File may already be deleted
        }
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired cache entries`);
      await this.saveCacheIndex();
    }

    return cleanedCount;
  }

  /**
   * Get cache statistics
   */
  getStats(): MediaCacheStats {
    let totalSize = 0;
    let expiredEntries = 0;
    const now = new Date();

    for (const entry of this.cache.values()) {
      totalSize += entry.size;
      if (now > entry.expiresAt) {
        expiredEntries++;
      }
    }

    return {
      totalEntries: this.cache.size,
      totalSize,
      expiredEntries,
    };
  }

  /**
   * Clear all cached entries
   */
  async clear(): Promise<void> {
    for (const entry of this.cache.values()) {
      try {
        await fs.unlink(entry.localPath);
      } catch {
        // File may already be deleted
      }
    }

    this.cache.clear();
    await this.saveCacheIndex();
    console.log('🗑️ Media cache cleared');
  }

  /**
   * Graceful shutdown
   */
  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    await this.saveCacheIndex();
    console.log('Media cache service closed');
  }

  /**
   * Save cache index to disk for persistence
   */
  private async saveCacheIndex(): Promise<void> {
    const indexPath = path.join(mediaProxyConfig.cacheDir, 'cache-index.json');
    const entries = Array.from(this.cache.values()).map((entry) => ({
      ...entry,
      expiresAt: entry.expiresAt.toISOString(),
      cachedAt: entry.cachedAt.toISOString(),
    }));

    await fs.writeFile(indexPath, JSON.stringify(entries, null, 2));
  }

  /**
   * Load cache index from disk
   */
  private async loadCacheIndex(): Promise<void> {
    const indexPath = path.join(mediaProxyConfig.cacheDir, 'cache-index.json');

    try {
      const data = await fs.readFile(indexPath, 'utf-8');
      const entries = JSON.parse(data) as Array<{
        id: string;
        url: string;
        mimetype: string;
        filename?: string;
        size: number;
        expiresAt: string;
        localPath: string;
        cachedAt: string;
      }>;

      const now = new Date();

      for (const entry of entries) {
        const expiresAt = new Date(entry.expiresAt);

        // Skip expired entries
        if (now > expiresAt) continue;

        // Check if file still exists
        try {
          await fs.access(entry.localPath);
          this.cache.set(entry.id, {
            ...entry,
            expiresAt,
            cachedAt: new Date(entry.cachedAt),
          });
        } catch {
          // File doesn't exist, skip
        }
      }

      console.log(`📂 Loaded ${this.cache.size} cache entries from index`);
    } catch (error) {
      // Index doesn't exist or is invalid, start fresh
      const msg = getErrorMessage(error);
      if (!msg.includes('ENOENT')) {
        console.warn('Failed to load cache index:', msg);
      }
    }
  }
}

// Singleton instance
export const mediaCacheService = new MediaCacheService();
