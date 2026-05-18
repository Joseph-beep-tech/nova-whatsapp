/**
 * Media Proxy Types
 *
 * Type definitions for the media proxy service that caches external media
 * for use with whatsapp-api MessageMediaFromURL.
 */

/**
 * Cached media entry stored in the media cache
 */
export interface CachedMediaEntry {
  /** Unique identifier for this cache entry */
  id: string;
  /** Original URL the media was fetched from */
  url: string;
  /** MIME type of the media (e.g., 'image/jpeg', 'video/mp4') */
  mimetype: string;
  /** Optional filename for the media */
  filename?: string;
  /** Size of the cached file in bytes */
  size: number;
  /** Timestamp when this cache entry expires */
  expiresAt: Date;
  /** Local file path where the media is cached */
  localPath: string;
  /** Timestamp when the media was cached */
  cachedAt: Date;
}

/**
 * Request body for POST /media/proxy
 */
export interface MediaProxyRequest {
  /** URL to fetch and cache */
  url: string;
  /** Optional filename override */
  filename?: string;
  /** Optional MIME type override (auto-detected if not provided) */
  mimetype?: string;
}

/**
 * Response from POST /media/proxy
 */
export interface MediaProxyResponse {
  /** Whether the proxy operation succeeded */
  success: boolean;
  /** Internal URL to access the cached media */
  proxyUrl?: string;
  /** When the cached media will expire */
  expiresAt?: Date;
  /** Cache entry ID */
  cacheId?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Media cache statistics
 */
export interface MediaCacheStats {
  /** Total number of cached entries */
  totalEntries: number;
  /** Total size of cached files in bytes */
  totalSize: number;
  /** Number of entries that have expired but not yet cleaned */
  expiredEntries: number;
}
