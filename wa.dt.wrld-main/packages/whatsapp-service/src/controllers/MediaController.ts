/**
 * Media Controller
 *
 * Provides media proxy and caching for WhatsApp media.
 * Used to work around the whatsapp-web.js atob() bug.
 */

import {
  Controller,
  Get,
  Post,
  Route,
  Tags,
  Security,
  Body,
  Path,
  Response,
  SuccessResponse,
} from 'tsoa';
import * as fs from 'fs';
import { mediaCacheService } from '../services/mediaCache';
import { mediaProxyConfig } from '../shared/config';
import { getErrorMessage } from '../types/webhook';
import {
  MediaProxyRequest,
  MediaProxyResponse,
  MediaStatsResponse,
  BaseResponse,
} from '../types/api';

@Route('media')
@Tags('Media')
export class MediaController extends Controller {
  /**
   * Proxy external media
   *
   * Fetches external media and caches it locally, returning an internal
   * URL that wwebjs-api can access via MessageMediaFromURL.
   * This bypasses the whatsapp-web.js atob() bug that prevents base64 media sending.
   *
   * @summary Proxy and cache external media
   * @param body Media proxy request
   *
   * @example body {
   *   "url": "https://example.com/image.jpg",
   *   "filename": "my-image.jpg",
   *   "mimetype": "image/jpeg"
   * }
   */
  @Post('proxy')
  @Security('api_key')
  @SuccessResponse(200, 'Media proxied successfully')
  @Response<MediaProxyResponse>(400, 'Invalid request')
  @Response<MediaProxyResponse>(500, 'Internal server error')
  public async proxyMedia(@Body() body: MediaProxyRequest): Promise<MediaProxyResponse> {
    try {
      const { url, filename, mimetype } = body;

      if (!url) {
        this.setStatus(400);
        return {
          success: false,
          error: 'url is required',
        };
      }

      // Validate URL format
      try {
        new URL(url);
      } catch {
        this.setStatus(400);
        return {
          success: false,
          error: 'Invalid URL format',
        };
      }

      // Fetch and cache the media
      const entry = await mediaCacheService.fetchAndCache(url, filename, mimetype);

      // Construct the proxy URL
      // Note: baseUrl should be set in production to the external URL
      const baseUrl = mediaProxyConfig.baseUrl || 'http://localhost:3001/service';
      const proxyUrl = `${baseUrl}/media/cache/${entry.id}`;

      console.log(`Media proxied: ${url} -> ${proxyUrl}`);

      return {
        success: true,
        proxyUrl,
        expiresAt: entry.expiresAt.toISOString(),
        cacheId: entry.id,
      };
    } catch (error: unknown) {
      console.error('Media proxy error:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Serve cached media
   *
   * Serves a cached media file. This endpoint is called by wwebjs-api
   * when fetching media via MessageMediaFromURL.
   *
   * Note: This endpoint does not require authentication to allow
   * wwebjs-api container access.
   *
   * @summary Serve cached media file
   * @param id Cache entry ID
   */
  @Get('cache/{id}')
  @Response<BaseResponse>(404, 'Media not found or expired')
  @Response<BaseResponse>(500, 'Internal server error')
  public async getCachedMedia(@Path() id: string): Promise<unknown> {
    // Note: This returns raw file data, not JSON
    // tsoa doesn't fully support streaming responses, so the actual implementation
    // will be handled by the legacy Express route
    // This controller method exists primarily for API documentation

    const entry = mediaCacheService.get(id);

    if (!entry) {
      this.setStatus(404);
      return {
        success: false,
        error: 'Media not found or expired',
      };
    }

    // Check if file exists
    if (!fs.existsSync(entry.localPath)) {
      this.setStatus(404);
      return {
        success: false,
        error: 'Cached file not found',
      };
    }

    // Note: In practice, the legacy route handles this with streaming
    // This is a fallback that returns basic info
    return {
      success: true,
      message: 'Media served via legacy route',
      mimetype: entry.mimetype,
      size: entry.size,
    };
  }

  /**
   * Get media cache statistics
   *
   * Returns statistics about the media cache.
   *
   * @summary Get cache statistics
   */
  @Get('stats')
  @Security('api_key')
  @Response<BaseResponse>(500, 'Internal server error')
  public async getStats(): Promise<MediaStatsResponse> {
    try {
      const stats = mediaCacheService.getStats();
      return {
        success: true,
        stats,
      };
    } catch (error: unknown) {
      console.error('Media stats error:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }
}
