/**
 * Media Routes
 *
 * Handles media proxy, caching, and serving for WhatsApp media.
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import { mediaCacheService } from '../services/mediaCache';
import { mediaProxyConfig } from '../shared/config';
import { MediaProxyRequest, MediaProxyResponse } from '../types/media';
import { getErrorMessage } from '../types/webhook';

const router = Router();

/**
 * Proxy external media URL for use with whatsapp-api
 * POST /media/proxy
 * Body: { url: string, filename?: string, mimetype?: string }
 *
 * This endpoint fetches external media and caches it locally, returning
 * an internal URL that whatsapp-api can access via MessageMediaFromURL.
 * This bypasses the whatsapp-web.js atob() bug that prevents base64 media sending.
 */
router.post('/media/proxy', async (req: Request, res: Response) => {
  try {
    const { url, filename, mimetype } = req.body as MediaProxyRequest;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'url is required',
      } as MediaProxyResponse);
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format',
      } as MediaProxyResponse);
    }

    // Fetch and cache the media
    const entry = await mediaCacheService.fetchAndCache(url, filename, mimetype);

    // Construct the proxy URL
    // Use configured base URL or derive from request
    const baseUrl = mediaProxyConfig.baseUrl ||
      `${req.protocol}://${req.get('host')}`;
    const proxyUrl = `${baseUrl}/media/cache/${entry.id}`;

    console.log(`Media proxied: ${url} -> ${proxyUrl}`);

    res.json({
      success: true,
      proxyUrl,
      expiresAt: entry.expiresAt,
      cacheId: entry.id,
    } as MediaProxyResponse);
  } catch (error: unknown) {
    console.error('Media proxy error:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    } as MediaProxyResponse);
  }
});

/**
 * Serve cached media file
 * GET /media/cache/:id
 *
 * Serves the cached media file with appropriate Content-Type.
 * This endpoint is called by whatsapp-api when fetching media via MessageMediaFromURL.
 * No authentication required to allow whatsapp-api access.
 */
router.get('/media/cache/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const entry = mediaCacheService.get(id);

    if (!entry) {
      return res.status(404).json({
        success: false,
        error: 'Media not found or expired',
      });
    }

    // Check if file exists
    if (!fs.existsSync(entry.localPath)) {
      return res.status(404).json({
        success: false,
        error: 'Cached file not found',
      });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', entry.mimetype);
    res.setHeader('Content-Length', entry.size);
    if (entry.filename) {
      res.setHeader('Content-Disposition', `inline; filename="${entry.filename}"`);
    }

    // Stream the file
    const stream = fs.createReadStream(entry.localPath);
    stream.pipe(res);
  } catch (error: unknown) {
    console.error('Media cache serve error:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      error: 'Failed to serve cached media',
    });
  }
});

/**
 * Get media cache statistics
 * GET /media/stats
 */
router.get('/media/stats', async (_req: Request, res: Response) => {
  try {
    const stats = mediaCacheService.getStats();
    res.json({
      success: true,
      stats,
    });
  } catch (error: unknown) {
    console.error('Media stats error:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

export { router as mediaRouter };
