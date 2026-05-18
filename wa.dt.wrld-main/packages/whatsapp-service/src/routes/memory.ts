/**
 * Memory Routes
 *
 * Provides RAG memory insights endpoints for viewing, searching,
 * exporting, and deleting conversation memories.
 */

import { Router, Request, Response } from 'express';
import { qdrantHandler } from '../services/qdrantHandler';
import { stateManager } from '../utils/stateManager';
import { getErrorMessage } from '../types/webhook';
import { WhatsAppPlatform, DEFAULT_PLATFORM, isValidPlatform } from '../utils/phoneNumber';
import {
  MemorySearchRequest,
  MemorySearchResultItem,
  MemoryExportItem,
} from '../types/api';

const router = Router();

/**
 * Get memory statistics for a user
 * GET /memory/stats?identifier=254722833440&platform=c.us&tag=SOMO
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const identifier = req.query.identifier as string | undefined;
    const platformParam = req.query.platform as string | undefined;
    const tag = req.query.tag as string | undefined;

    if (!identifier) {
      return res.status(400).json({
        success: false,
        error: 'identifier query parameter is required',
      });
    }

    const platform: WhatsAppPlatform = (platformParam && isValidPlatform(platformParam))
      ? platformParam
      : DEFAULT_PLATFORM;

    // Get user to retrieve tags
    const user = await stateManager.getUser(identifier);
    const userTags = user?.tags || [];

    // Get memory stats from Qdrant
    const stats = await qdrantHandler.getMemoryStats(identifier, tag, platform);

    if (!stats) {
      return res.status(500).json({
        success: false,
        error: 'Qdrant handler not initialized or failed to retrieve stats',
      });
    }

    res.json({
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
    });
  } catch (error: unknown) {
    console.error('Memory stats error:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

/**
 * Search memories with filters
 * POST /memory/search
 * Body: { query, identifier?, platform?, tag?, collection?, strategy?, limit?, offset?, minScore?, after?, before? }
 */
router.post('/search', async (req: Request, res: Response) => {
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
    } = req.body as MemorySearchRequest;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'query is required and cannot be empty',
      });
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
      return res.status(500).json({
        success: false,
        error: 'Qdrant handler not initialized or search failed',
      });
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

    res.json({
      success: true,
      results,
      total: results.length,
      count: results.length,
      offset: searchResult.offset,
      limit: searchResult.limit,
      query: query.trim(),
      strategy,
    });
  } catch (error: unknown) {
    console.error('Memory search error:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

/**
 * Export all memories for a user
 * GET /memory/export?identifier=254722833440&platform=c.us&collection=default
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const identifier = req.query.identifier as string | undefined;
    const platformParam = req.query.platform as string | undefined;
    const collection = (req.query.collection as string) || 'default';

    if (!identifier) {
      return res.status(400).json({
        success: false,
        error: 'identifier query parameter is required',
      });
    }

    const platform: WhatsAppPlatform = (platformParam && isValidPlatform(platformParam))
      ? platformParam
      : DEFAULT_PLATFORM;

    // Export memories
    const exportResult = await qdrantHandler.exportMemories(identifier, collection, platform);

    if (!exportResult) {
      return res.status(500).json({
        success: false,
        error: 'Qdrant handler not initialized or export failed',
      });
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

    res.json({
      success: true,
      identifier: exportResult.identifier,
      platform: exportResult.platform,
      exportedAt: exportResult.exportedAt,
      messages,
      count: exportResult.count,
      collections: exportResult.collections,
    });
  } catch (error: unknown) {
    console.error('Memory export error:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

/**
 * Delete a specific memory
 * DELETE /memory/:messageId
 * Query: ?collection=default (optional)
 */
router.delete('/:messageId', async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const collection = (req.query.collection as string) || 'default';

    if (!messageId || messageId.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'messageId is required',
      });
    }

    // Delete memory
    const deleteResult = await qdrantHandler.deleteMemory(
      messageId.trim(),
      collection
    );

    res.json({
      success: deleteResult.deleted,
      messageId: deleteResult.messageId,
      collection: deleteResult.collection,
      deleted: deleteResult.deleted,
      ...(deleteResult.deleted
        ? {}
        : { error: 'Failed to delete memory - it may not exist' }),
    });
  } catch (error: unknown) {
    console.error('Memory delete error:', getErrorMessage(error));
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

export { router as memoryRouter };
