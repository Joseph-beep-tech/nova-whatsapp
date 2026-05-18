/**
 * MediaCacheService Unit Tests
 *
 * Tests the media caching service for the media proxy feature.
 * Validates Task 052.2: "MediaCacheService with fetch, get, cleanup"
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import type { Stats } from 'fs';

// Mock the config module BEFORE importing the service
jest.mock('../../../src/shared/config', () => ({
  config: {
    port: 3001,
    apiKey: 'test-api-key',
    whatsappApiUrl: 'http://localhost:3000',
  },
  mediaProxyConfig: {
    cacheDir: '/tmp/test-media-cache',
    cacheTtlSeconds: 300,
    maxFileSizeBytes: 16777216,
    cleanupIntervalMs: 60000,
    baseUrl: '',
  },
}));

// Mock fs modules
jest.mock('fs/promises');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  createWriteStream: jest.fn(),
}));

// Mock stream/promises
jest.mock('stream/promises', () => ({
  pipeline: jest.fn().mockResolvedValue(undefined),
}));

// Mock crypto for deterministic UUIDs in tests
jest.mock('crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('test-uuid-1234'),
}));

// Create a mock Headers class that mimics the Fetch API Headers
class MockHeaders {
  private map = new Map<string, string>();

  constructor(init?: Record<string, string> | [string, string][]) {
    if (Array.isArray(init)) {
      init.forEach(([key, value]) => this.map.set(key.toLowerCase(), value));
    } else if (init) {
      Object.entries(init).forEach(([key, value]) => this.map.set(key.toLowerCase(), value));
    }
  }

  get(name: string): string | null {
    return this.map.get(name.toLowerCase()) || null;
  }

  has(name: string): boolean {
    return this.map.has(name.toLowerCase());
  }
}

// Create mock fetch response helper
function createMockResponse(
  ok: boolean,
  headers: Record<string, string>,
  body?: unknown,
  status?: number,
  statusText?: string
): Response {
  return {
    ok,
    status: status || (ok ? 200 : 500),
    statusText: statusText || (ok ? 'OK' : 'Error'),
    headers: new MockHeaders(headers),
    body: body as ReadableStream,
    clone: jest.fn(),
    text: jest.fn(),
    json: jest.fn(),
    arrayBuffer: jest.fn(),
    blob: jest.fn(),
    formData: jest.fn(),
    bodyUsed: false,
    redirected: false,
    type: 'basic',
    url: '',
  } as unknown as Response;
}

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Import after mocks are set up
import { MediaCacheService } from '../../../src/services/mediaCache';
import { mediaProxyConfig } from '../../../src/shared/config';

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedFsSync = fsSync as jest.Mocked<typeof fsSync>;

// Mock the Readable.fromWeb to return a passthrough that works with pipeline
jest.mock('stream', () => {
  const actual = jest.requireActual('stream');
  return {
    ...actual,
    Readable: {
      ...actual.Readable,
      fromWeb: jest.fn().mockReturnValue(actual.Readable.from(['test data'])),
    },
  };
});

describe('MediaCacheService', () => {
  let service: MediaCacheService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mocks
    mockedFsSync.existsSync.mockReturnValue(true);
    mockedFsSync.mkdirSync.mockReturnValue(undefined);
    mockedFsSync.createWriteStream.mockReturnValue({
      on: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
    } as unknown as fsSync.WriteStream);

    mockedFs.readFile.mockRejectedValue(new Error('ENOENT: no such file'));
    mockedFs.writeFile.mockResolvedValue(undefined);
    mockedFs.stat.mockResolvedValue({ size: 1024 } as Stats);
    mockedFs.unlink.mockResolvedValue(undefined);
    mockedFs.access.mockResolvedValue(undefined);

    // Create new service instance for each test
    service = new MediaCacheService();
  });

  afterEach(async () => {
    await service.close();
  });

  // ==========================================================================
  // Initialization Tests
  // ==========================================================================

  describe('init', () => {
    it('should create cache directory if it does not exist', async () => {
      mockedFsSync.existsSync.mockReturnValue(false);

      await service.init();

      expect(mockedFsSync.mkdirSync).toHaveBeenCalledWith(
        mediaProxyConfig.cacheDir,
        { recursive: true }
      );
    });

    it('should not create directory if it already exists', async () => {
      mockedFsSync.existsSync.mockReturnValue(true);

      await service.init();

      expect(mockedFsSync.mkdirSync).not.toHaveBeenCalled();
    });

    it('should load existing cache index on startup', async () => {
      const existingIndex = JSON.stringify([
        {
          id: 'existing-id',
          url: 'https://example.com/image.jpg',
          mimetype: 'image/jpeg',
          filename: 'image.jpg',
          size: 500,
          expiresAt: new Date(Date.now() + 60000).toISOString(),
          localPath: '/tmp/test/existing-id.jpg',
          cachedAt: new Date().toISOString(),
        },
      ]);

      mockedFs.readFile.mockResolvedValue(existingIndex);
      mockedFs.access.mockResolvedValue(undefined);

      await service.init();

      const entry = service.get('existing-id');
      expect(entry).not.toBeNull();
      expect(entry?.url).toBe('https://example.com/image.jpg');
    });

    it('should skip expired entries when loading cache index', async () => {
      const expiredIndex = JSON.stringify([
        {
          id: 'expired-id',
          url: 'https://example.com/old.jpg',
          mimetype: 'image/jpeg',
          size: 500,
          expiresAt: new Date(Date.now() - 60000).toISOString(),
          localPath: '/tmp/test/expired-id.jpg',
          cachedAt: new Date().toISOString(),
        },
      ]);

      mockedFs.readFile.mockResolvedValue(expiredIndex);

      await service.init();

      const entry = service.get('expired-id');
      expect(entry).toBeNull();
    });
  });

  // ==========================================================================
  // fetchAndCache Tests
  // ==========================================================================

  describe('fetchAndCache', () => {
    beforeEach(async () => {
      await service.init();
    });

    it('should fetch URL and cache file locally', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse(true, {
          'content-type': 'image/jpeg',
          'content-length': '1024',
        }, {})
      );

      const entry = await service.fetchAndCache('https://example.com/image.jpg');

      expect(entry.id).toBe('test-uuid-1234');
      expect(entry.url).toBe('https://example.com/image.jpg');
      expect(entry.mimetype).toBe('image/jpeg');
      expect(entry.size).toBe(1024);
      expect(entry.localPath).toContain('.jpg');
    });

    it('should use provided filename', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse(true, { 'content-type': 'image/png' }, {})
      );

      const entry = await service.fetchAndCache(
        'https://example.com/image.png',
        'custom-name.png'
      );

      expect(entry.filename).toBe('custom-name.png');
    });

    it('should use provided MIME type override', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse(true, { 'content-type': 'application/octet-stream' }, {})
      );

      const entry = await service.fetchAndCache(
        'https://example.com/media',
        undefined,
        'video/mp4'
      );

      expect(entry.mimetype).toBe('video/mp4');
    });

    it('should throw error for failed fetch', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse(false, {}, null, 404, 'Not Found')
      );

      await expect(
        service.fetchAndCache('https://example.com/missing.jpg')
      ).rejects.toThrow('Failed to fetch media: 404 Not Found');
    });

    it('should throw error if content-length exceeds max size', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse(true, {
          'content-type': 'video/mp4',
          'content-length': '999999999',
        }, {})
      );

      await expect(
        service.fetchAndCache('https://example.com/huge.mp4')
      ).rejects.toThrow(/Media too large/);
    });

    it('should throw error if file size after download exceeds max size', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse(true, { 'content-type': 'video/mp4' }, {})
      );

      // Simulate file being larger than expected after download
      mockedFs.stat.mockResolvedValue({
        size: mediaProxyConfig.maxFileSizeBytes + 1,
      } as Stats);

      await expect(
        service.fetchAndCache('https://example.com/tricky.mp4')
      ).rejects.toThrow(/Media too large/);

      // Should clean up the file
      expect(mockedFs.unlink).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // get Tests
  // ==========================================================================

  describe('get', () => {
    beforeEach(async () => {
      await service.init();
    });

    it('should return null for non-existent entry', () => {
      const entry = service.get('non-existent-id');
      expect(entry).toBeNull();
    });

    it('should return null for expired entry', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse(true, { 'content-type': 'image/jpeg' }, {})
      );

      // Cache an entry
      await service.fetchAndCache('https://example.com/image.jpg');

      // Get the entry and manually expire it
      const entry = service.get('test-uuid-1234');
      expect(entry).not.toBeNull();

      // Modify expiry to past (simulate expiration)
      if (entry) {
        entry.expiresAt = new Date(Date.now() - 1000);
      }

      // Now get should return null
      const expiredEntry = service.get('test-uuid-1234');
      expect(expiredEntry).toBeNull();
    });

    it('should return valid entry', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse(true, { 'content-type': 'image/png' }, {})
      );

      await service.fetchAndCache('https://example.com/test.png');

      const entry = service.get('test-uuid-1234');
      expect(entry).not.toBeNull();
      expect(entry?.url).toBe('https://example.com/test.png');
    });
  });

  // ==========================================================================
  // getFilePath Tests
  // ==========================================================================

  describe('getFilePath', () => {
    beforeEach(async () => {
      await service.init();
    });

    it('should return null for non-existent entry', () => {
      const filePath = service.getFilePath('non-existent-id');
      expect(filePath).toBeNull();
    });

    it('should return local path for valid entry', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse(true, { 'content-type': 'image/jpeg' }, {})
      );

      await service.fetchAndCache('https://example.com/image.jpg');

      const filePath = service.getFilePath('test-uuid-1234');
      expect(filePath).not.toBeNull();
      expect(filePath).toContain('.jpg');
    });
  });

  // ==========================================================================
  // cleanup Tests
  // ==========================================================================

  describe('cleanup', () => {
    beforeEach(async () => {
      await service.init();
    });

    it('should remove expired entries', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse(true, { 'content-type': 'image/jpeg' }, {})
      );

      // Cache an entry
      await service.fetchAndCache('https://example.com/image.jpg');

      // Manually expire the entry
      const entry = service.get('test-uuid-1234');
      if (entry) {
        entry.expiresAt = new Date(Date.now() - 1000);
      }

      // Run cleanup
      const cleaned = await service.cleanup();

      expect(cleaned).toBe(1);
      expect(service.get('test-uuid-1234')).toBeNull();
    });

    it('should not remove valid entries', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse(true, { 'content-type': 'image/jpeg' }, {})
      );

      await service.fetchAndCache('https://example.com/image.jpg');

      const cleaned = await service.cleanup();

      expect(cleaned).toBe(0);
      expect(service.get('test-uuid-1234')).not.toBeNull();
    });
  });

  // ==========================================================================
  // getStats Tests
  // ==========================================================================

  describe('getStats', () => {
    beforeEach(async () => {
      await service.init();
    });

    it('should return correct statistics', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse(true, { 'content-type': 'image/jpeg' }, {})
      );

      await service.fetchAndCache('https://example.com/image.jpg');

      const stats = service.getStats();

      expect(stats.totalEntries).toBe(1);
      expect(stats.totalSize).toBe(1024);
      expect(stats.expiredEntries).toBe(0);
    });

    it('should count expired entries correctly', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse(true, { 'content-type': 'image/jpeg' }, {})
      );

      await service.fetchAndCache('https://example.com/image.jpg');

      // Manually expire the entry
      const entry = service.get('test-uuid-1234');
      if (entry) {
        entry.expiresAt = new Date(Date.now() - 1000);
      }

      const stats = service.getStats();

      expect(stats.expiredEntries).toBe(1);
    });
  });

  // ==========================================================================
  // clear Tests
  // ==========================================================================

  describe('clear', () => {
    beforeEach(async () => {
      await service.init();
    });

    it('should remove all cached entries', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse(true, { 'content-type': 'image/jpeg' }, {})
      );

      await service.fetchAndCache('https://example.com/image.jpg');

      expect(service.getStats().totalEntries).toBe(1);

      await service.clear();

      expect(service.getStats().totalEntries).toBe(0);
    });
  });
});
