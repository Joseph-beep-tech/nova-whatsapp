/**
 * LMS Collection Client Factory
 *
 * Creates Qdrant clients for external LMS content collections
 * based on TagConfiguration.lms settings. Supports multiple business
 * clients with different Qdrant instances and schema mappings.
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { LmsConfiguration, LmsSchemaMapping } from '../../types/content/lms';
import { ModuleStructure, ContentSearchResult } from '../../types/content/module';
import { getErrorMessage } from '../../types/webhook';

/**
 * LMS Collection Client
 *
 * Provides access to an external LMS content collection in Qdrant.
 * Uses schema mapping to interpret collection structure.
 */
export class LmsCollectionClient {
  private client: QdrantClient;
  private config: LmsConfiguration;
  private schema: LmsSchemaMapping;
  private moduleCache: ModuleStructure[] | null = null;
  private moduleCacheExpiry: number = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(lmsConfig: LmsConfiguration) {
    this.config = lmsConfig;
    this.schema = lmsConfig.schema;
    this.client = new QdrantClient({
      url: lmsConfig.contentCollection.url,
      apiKey: lmsConfig.contentCollection.apiKey || undefined,
    });
  }

  /**
   * Get the collection name
   */
  get collectionName(): string {
    return this.config.contentCollection.collectionName;
  }

  /**
   * Test connection to the Qdrant instance
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.client.getCollections();
      return true;
    } catch (error) {
      console.error('[LmsCollectionClient] Connection test failed:', getErrorMessage(error));
      return false;
    }
  }

  /**
   * Get collection info
   */
  async getCollectionInfo(): Promise<{
    vectorCount: number;
    indexedVectors: number;
  } | null> {
    try {
      const info = await this.client.getCollection(this.collectionName);
      return {
        vectorCount: info.points_count || 0,
        indexedVectors: info.indexed_vectors_count || 0,
      };
    } catch (error) {
      console.error('[LmsCollectionClient] Failed to get collection info:', getErrorMessage(error));
      return null;
    }
  }

  /**
   * Scroll all points from the collection
   */
  private async scrollAll(): Promise<Array<{ payload: Record<string, unknown> }>> {
    const allPoints: Array<{ payload: Record<string, unknown> }> = [];
    let offset: string | number | undefined = undefined;
    const batchSize = 100;

    try {
      do {
        const result = await this.client.scroll(this.collectionName, {
          limit: batchSize,
          offset,
          with_payload: true,
          with_vector: false,
        });

        for (const point of result.points) {
          if (point.payload) {
            allPoints.push({ payload: point.payload as Record<string, unknown> });
          }
        }

        // next_page_offset can be string, number, null, undefined, or object
        // We only want string or number for pagination
        const nextOffset = result.next_page_offset;
        if (typeof nextOffset === 'string' || typeof nextOffset === 'number') {
          offset = nextOffset;
        } else {
          offset = undefined;
        }
      } while (offset !== undefined);

      return allPoints;
    } catch (error) {
      console.error('[LmsCollectionClient] Failed to scroll collection:', getErrorMessage(error));
      return [];
    }
  }

  /**
   * Get module structure using configured schema mapping
   *
   * Scrolls the collection and groups points by module field.
   */
  async getModuleStructure(forceRefresh: boolean = false): Promise<ModuleStructure[]> {
    // Return cached if valid
    if (!forceRefresh && this.moduleCache && Date.now() < this.moduleCacheExpiry) {
      return this.moduleCache;
    }

    const points = await this.scrollAll();
    const modules = new Map<string | number, ModuleStructure>();

    for (const point of points) {
      const payload = point.payload;
      const rawModuleId = payload[this.schema.moduleField];
      const sectionTitle = payload[this.schema.sectionField] as string;

      if (rawModuleId === undefined || rawModuleId === null) {
        continue;
      }

      // Ensure moduleId is string or number
      const moduleId: string | number =
        typeof rawModuleId === 'number' ? rawModuleId : String(rawModuleId);
      const moduleKey = String(moduleId);

      if (!modules.has(moduleKey)) {
        // Get module name from dedicated field or fall back to module ID
        const moduleName = this.schema.moduleNameField
          ? (payload[this.schema.moduleNameField] as string) || `Module ${moduleId}`
          : `Module ${moduleId}`;

        modules.set(moduleKey, {
          moduleId,
          moduleName,
          sections: [],
          totalChunks: 0,
          order: this.schema.orderField ? (payload[this.schema.orderField] as number) : undefined,
        });
      }

      const mod = modules.get(moduleKey)!;
      mod.totalChunks++;

      if (sectionTitle && !mod.sections.includes(sectionTitle)) {
        mod.sections.push(sectionTitle);
      }
    }

    // Sort by module ID (numeric sort if possible)
    const sortedModules = Array.from(modules.values()).sort((a, b) => {
      const aNum = typeof a.moduleId === 'number' ? a.moduleId : parseInt(String(a.moduleId), 10);
      const bNum = typeof b.moduleId === 'number' ? b.moduleId : parseInt(String(b.moduleId), 10);

      if (!isNaN(aNum) && !isNaN(bNum)) {
        return aNum - bNum;
      }
      return String(a.moduleId).localeCompare(String(b.moduleId));
    });

    // Cache the result
    this.moduleCache = sortedModules;
    this.moduleCacheExpiry = Date.now() + this.CACHE_TTL_MS;

    console.log(
      `[LmsCollectionClient] Loaded ${sortedModules.length} modules from ${this.collectionName}`
    );

    return sortedModules;
  }

  /**
   * Search content using vector similarity
   *
   * Requires pre-computed embedding vector.
   */
  async searchContent(embedding: number[], limit: number = 5): Promise<ContentSearchResult[]> {
    try {
      // Build vector query based on whether named vectors are used
      const vectorParam = this.config.contentCollection.vectorName
        ? { name: this.config.contentCollection.vectorName, vector: embedding }
        : embedding;

      const results = await this.client.search(this.collectionName, {
        vector: vectorParam,
        limit,
        with_payload: true,
      });

      return results.map((r) => ({
        moduleId: (r.payload as Record<string, unknown>)[this.schema.moduleField] as
          | string
          | number,
        sectionTitle: (r.payload as Record<string, unknown>)[this.schema.sectionField] as string,
        content: (r.payload as Record<string, unknown>)[this.schema.contentField] as string,
        score: r.score,
        payload: r.payload as Record<string, unknown>,
      }));
    } catch (error) {
      console.error('[LmsCollectionClient] Content search failed:', getErrorMessage(error));
      return [];
    }
  }

  /**
   * Get content for a specific module
   */
  async getModuleContent(moduleId: string | number): Promise<ContentSearchResult[]> {
    try {
      const results = await this.client.scroll(this.collectionName, {
        filter: {
          must: [
            {
              key: this.schema.moduleField,
              match: { value: moduleId },
            },
          ],
        },
        limit: 100,
        with_payload: true,
        with_vector: false,
      });

      return results.points.map((point) => {
        const payload = point.payload as Record<string, unknown>;
        return {
          moduleId: payload[this.schema.moduleField] as string | number,
          sectionTitle: payload[this.schema.sectionField] as string,
          content: payload[this.schema.contentField] as string,
          score: 1.0, // No similarity search, full match
          payload,
        };
      });
    } catch (error) {
      console.error('[LmsCollectionClient] Failed to get module content:', getErrorMessage(error));
      return [];
    }
  }

  /**
   * Get sections for a specific module
   */
  async getModuleSections(moduleId: string | number): Promise<string[]> {
    const content = await this.getModuleContent(moduleId);
    const sections = new Set<string>();

    for (const item of content) {
      if (item.sectionTitle) {
        sections.add(item.sectionTitle);
      }
    }

    return Array.from(sections);
  }

  /**
   * Clear the module cache
   */
  clearCache(): void {
    this.moduleCache = null;
    this.moduleCacheExpiry = 0;
  }
}

/**
 * LMS Collection Client Factory
 *
 * Creates and caches LMS clients per tag. Clients are cached by
 * a composite key of tag + url + collection name.
 */
class LmsCollectionClientFactory {
  private clients: Map<string, LmsCollectionClient> = new Map();

  /**
   * Generate cache key for a client
   */
  private getCacheKey(tag: string, lmsConfig: LmsConfiguration): string {
    return `${tag}_${lmsConfig.contentCollection.url}_${lmsConfig.contentCollection.collectionName}`;
  }

  /**
   * Get or create a client for a tag
   */
  getClient(tag: string, lmsConfig: LmsConfiguration): LmsCollectionClient {
    const key = this.getCacheKey(tag, lmsConfig);

    if (!this.clients.has(key)) {
      console.log(`[LmsClientFactory] Creating client for ${tag} -> ${lmsConfig.contentCollection.collectionName}`);
      this.clients.set(key, new LmsCollectionClient(lmsConfig));
    }

    return this.clients.get(key)!;
  }

  /**
   * Check if a client exists for a tag
   */
  hasClient(tag: string, lmsConfig: LmsConfiguration): boolean {
    const key = this.getCacheKey(tag, lmsConfig);
    return this.clients.has(key);
  }

  /**
   * Remove a client from cache
   */
  removeClient(tag: string, lmsConfig: LmsConfiguration): void {
    const key = this.getCacheKey(tag, lmsConfig);
    this.clients.delete(key);
  }

  /**
   * Clear all cached clients
   */
  clearAll(): void {
    this.clients.clear();
  }

  /**
   * Get count of cached clients
   */
  get clientCount(): number {
    return this.clients.size;
  }
}

// Singleton factory instance
export const lmsClientFactory = new LmsCollectionClientFactory();
