/**
 * Memory Controller
 *
 * Provides RAG memory insights endpoints for viewing, searching,
 * exporting, and deleting conversation memories stored in Qdrant.
 */

import {
  Controller,
  Get,
  Post,
  Delete,
  Route,
  Tags,
  Security,
  Body,
  Path,
  Query,
  Response,
  SuccessResponse,
} from 'tsoa';
import { qdrantHandler } from '../services/qdrantHandler';
import { stateManager } from '../utils/stateManager';
import { WhatsAppPlatform, DEFAULT_PLATFORM, isValidPlatform } from '../utils/phoneNumber';
import { getErrorMessage } from '../types/webhook';
import {
  BaseResponse,
  MemoryStatsResponse,
  MemorySearchRequest,
  MemorySearchResponse,
  MemorySearchResultItem,
  MemoryExportResponse,
  MemoryExportItem,
  DeleteMemoryResponse,
} from '../types/api';

@Route('memory')
@Tags('Memory')
@Security('api_key')
export class MemoryController extends Controller {
  /**
   * Get memory statistics for a user
   *
   * Returns memory usage stats including vector count, storage size,
   * and collection information for the specified identifier.
   *
   * @summary Get memory statistics for a user
   * @param identifier Phone number or group ID (e.g., "254722833440")
   * @param platform WhatsApp platform suffix (default: "c.us")
   * @param tag Optional tag to filter stats by
   */
  @Get('stats')
  @SuccessResponse(200, 'Memory stats retrieved successfully')
  @Response<BaseResponse>(400, 'Invalid request')
  @Response<BaseResponse>(500, 'Internal server error')
  public async getMemoryStats(
    @Query() identifier: string,
    @Query() platform?: string,
    @Query() tag?: string
  ): Promise<MemoryStatsResponse> {
    try {
      if (!identifier) {
        this.setStatus(400);
        return {
          success: false,
          error: 'identifier query parameter is required',
        };
      }

      const resolvedPlatform: WhatsAppPlatform = (platform && isValidPlatform(platform))
        ? platform
        : DEFAULT_PLATFORM;

      // Get user to retrieve tags
      const user = await stateManager.getUser(identifier);
      const userTags = user?.tags || [];

      // Get memory stats from Qdrant
      const stats = await qdrantHandler.getMemoryStats(identifier, tag, resolvedPlatform);

      if (!stats) {
        this.setStatus(500);
        return {
          success: false,
          error: 'Qdrant handler not initialized or failed to retrieve stats',
        };
      }

      return {
        success: true,
        identifier: stats.identifier,
        platform: stats.platform,
        tags: stats.tags.length > 0 ? stats.tags : userTags,
        collections: stats.collections.map((c) => ({
          collectionName: c.collectionName,
          vectorCount: c.vectorCount,
          indexedVectors: c.indexedVectors,
          storageSizeBytes: c.storageSizeBytes,
          lastUpdatedAt: c.lastUpdatedAt,
        })),
        totalMessages: stats.totalMessages,
        totalStorageBytes: stats.totalStorageBytes,
      };
    } catch (error: unknown) {
      console.error('Memory stats error:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Search memories with filters
   *
   * Performs hybrid (vector + keyword) search across conversation memories.
   * Supports filtering by identifier, tag, collection, and time range.
   *
   * @summary Search memories with filters
   * @param body Search request with query and filters
   */
  @Post('search')
  @SuccessResponse(200, 'Search completed successfully')
  @Response<BaseResponse>(400, 'Invalid request')
  @Response<BaseResponse>(500, 'Internal server error')
  public async searchMemories(
    @Body() body: MemorySearchRequest
  ): Promise<MemorySearchResponse> {
    try {
      const {
        query,
        identifier,
        platform,
        tag,
        collection = 'default',
        strategy = 'hybrid',
        limit = 10,
        offset = 0,
        minScore,
        after,
        before,
      } = body;

      if (!query || query.trim().length === 0) {
        this.setStatus(400);
        return {
          success: false,
          error: 'query is required and cannot be empty',
        };
      }

      // Search memories
      const searchResult = await qdrantHandler.searchMemories({
        query: query.trim(),
        identifier,
        platform,
        tag,
        collection,
        strategy,
        limit,
        offset,
      });

      if (!searchResult) {
        this.setStatus(500);
        return {
          success: false,
          error: 'Qdrant handler not initialized or search failed',
        };
      }

      // Map results to API format
      let results: MemorySearchResultItem[] = searchResult.results.map((r) => ({
        id: r.id,
        identifier: r.identifier,
        platform: r.platform,
        sessionId: r.sessionId,
        role: r.role,
        content: r.content,
        timestamp: r.timestamp,
        tags: r.tags,
        score: r.score,
        scores: {
          vector: r.vectorScore,
          keyword: r.keywordScore,
        },
        collection,
      }));

      // Apply time filters if provided
      if (after) {
        const afterDate = new Date(after);
        results = results.filter((r) => new Date(r.timestamp) >= afterDate);
      }

      if (before) {
        const beforeDate = new Date(before);
        results = results.filter((r) => new Date(r.timestamp) <= beforeDate);
      }

      // Apply minimum score filter if provided
      if (minScore !== undefined) {
        results = results.filter((r) => r.score >= minScore);
      }

      return {
        success: true,
        results,
        total: results.length,
        count: results.length,
        offset: searchResult.offset,
        limit: searchResult.limit,
        query: query.trim(),
        strategy,
      };
    } catch (error: unknown) {
      console.error('Memory search error:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Export all memories for a user
   *
   * Returns all conversation memories for data portability.
   * Messages are exported in chronological order.
   *
   * @summary Export all memories for a user
   * @param identifier Phone number or group ID (e.g., "254722833440")
   * @param platform WhatsApp platform suffix (default: "c.us")
   * @param collection Optional collection name (defaults to "default")
   */
  @Get('export')
  @SuccessResponse(200, 'Memories exported successfully')
  @Response<BaseResponse>(400, 'Invalid request')
  @Response<BaseResponse>(500, 'Internal server error')
  public async exportMemories(
    @Query() identifier: string,
    @Query() platform?: string,
    @Query() collection: string = 'default'
  ): Promise<MemoryExportResponse> {
    try {
      if (!identifier) {
        this.setStatus(400);
        return {
          success: false,
          error: 'identifier query parameter is required',
        };
      }

      const resolvedPlatform: WhatsAppPlatform = (platform && isValidPlatform(platform))
        ? platform
        : DEFAULT_PLATFORM;

      // Export memories
      const exportResult = await qdrantHandler.exportMemories(identifier, collection, resolvedPlatform);

      if (!exportResult) {
        this.setStatus(500);
        return {
          success: false,
          error: 'Qdrant handler not initialized or export failed',
        };
      }

      // Map to API format
      const messages: MemoryExportItem[] = exportResult.messages.map((m) => ({
        id: m.id,
        identifier: m.identifier,
        platform: m.platform,
        sessionId: m.sessionId,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        tags: m.tags,
        collection,
        metadata: {
          keywords: m.keywords,
          messageType: m.messageType,
          importance: m.importance,
        },
      }));

      return {
        success: true,
        identifier: exportResult.identifier,
        platform: exportResult.platform,
        exportedAt: exportResult.exportedAt,
        messages,
        count: exportResult.count,
        collections: exportResult.collections,
      };
    } catch (error: unknown) {
      console.error('Memory export error:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Delete a specific memory
   *
   * Removes a specific conversation memory by its message ID.
   * This operation cannot be undone.
   *
   * @summary Delete a specific memory
   * @param messageId Message ID to delete
   * @param collection Optional collection name (defaults to "default")
   */
  @Delete('{messageId}')
  @SuccessResponse(200, 'Memory deleted successfully')
  @Response<BaseResponse>(400, 'Invalid request')
  @Response<BaseResponse>(500, 'Internal server error')
  public async deleteMemory(
    @Path() messageId: string,
    @Query() collection: string = 'default'
  ): Promise<DeleteMemoryResponse> {
    try {
      if (!messageId || messageId.trim().length === 0) {
        this.setStatus(400);
        return {
          success: false,
          error: 'messageId is required',
        };
      }

      // Delete memory
      const deleteResult = await qdrantHandler.deleteMemory(
        messageId.trim(),
        collection
      );

      return {
        success: deleteResult.deleted,
        messageId: deleteResult.messageId,
        collection: deleteResult.collection,
        deleted: deleteResult.deleted,
        ...(deleteResult.deleted
          ? {}
          : { error: 'Failed to delete memory - it may not exist' }),
      };
    } catch (error: unknown) {
      console.error('Memory delete error:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }
}
