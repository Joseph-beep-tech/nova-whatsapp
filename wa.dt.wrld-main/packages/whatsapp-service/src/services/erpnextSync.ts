/**
 * ERPNext Sync Service
 *
 * Handles async write-through sync from wa.dt.wrld → ERPNext.
 * All methods are no-ops when ENABLE_ERPNEXT_SYNC=false.
 * Network errors are logged but never thrown.
 *
 * Features:
 * - upsertContact: Create or update ERPNext Contact on user registration
 * - queueCommunication: Batched message logging (10-second flush)
 * - refreshCampaignCache: Periodic campaign → tag config refresh
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { erpnextConfig } from '../shared/config';
import {
  FrappeContactDoc,
  FrappeCampaignDoc,
  FrappeCommunicationDoc,
  FrappeDocResponse,
  FrappeListResponse,
  CommunicationParams,
} from '../types/erpnext';
import { getErrorMessage } from '../types/webhook';

const logger = {
  info: (...args: unknown[]) => console.log('[ERPNext]', ...args),
  warn: (...args: unknown[]) => console.warn('[ERPNext]', ...args),
  error: (...args: unknown[]) => console.error('[ERPNext]', ...args),
  debug: (...args: unknown[]) => console.debug('[ERPNext]', ...args),
};

/**
 * ERPNext sync service singleton.
 *
 * When disabled (ENABLE_ERPNEXT_SYNC=false), every method returns immediately.
 */
class ERPNextSyncService {
  private readonly enabled: boolean;
  private readonly client: AxiosInstance | null;
  private communicationBuffer: FrappeCommunicationDoc[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.enabled =
      erpnextConfig.enabled &&
      Boolean(erpnextConfig.baseUrl && erpnextConfig.apiKey && erpnextConfig.apiSecret);

    if (this.enabled) {
      this.client = axios.create({
        baseURL: erpnextConfig.baseUrl,
        timeout: 10_000,
        headers: {
          Authorization: `token ${erpnextConfig.apiKey}:${erpnextConfig.apiSecret}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });
      logger.info(`Enabled: ${erpnextConfig.baseUrl}`);
    } else {
      this.client = null;
      logger.info('Disabled (ENABLE_ERPNEXT_SYNC is not true)');
    }
  }

  /** Start the batched communication flush timer. */
  startBatchTimer(): void {
    if (!this.enabled || this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      void this.flushCommunications();
    }, erpnextConfig.batchFlushIntervalMs);
    logger.info(`Communication batch timer started (${erpnextConfig.batchFlushIntervalMs}ms)`);
  }

  /** Stop the batch timer and flush remaining. */
  async stopBatchTimer(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flushCommunications();
  }

  // ---------------------------------------------------------------------------
  // Contact sync
  // ---------------------------------------------------------------------------

  /**
   * Create or update an ERPNext Contact by phone number.
   * Returns the Contact document name on success, null on failure.
   */
  async upsertContact(
    phone: string,
    name: string,
    opts?: {
      platform?: string;
      tags?: string[];
      company?: string;
      lifecycleStage?: string;
    },
  ): Promise<string | null> {
    if (!this.enabled || !this.client) return null;

    try {
      // Try to find existing contact by phone
      const existing = await this.findContactByPhone(phone);

      const parts = name.trim().split(' ', 2);
      const doc: Partial<FrappeContactDoc> = {
        first_name: parts[0],
        last_name: parts[1] || '',
        mobile_no: phone,
        custom_wa_platform: opts?.platform,
        custom_wa_lifecycle_stage: (opts?.lifecycleStage as FrappeContactDoc['custom_wa_lifecycle_stage']) || undefined,
      };

      if (opts?.tags?.length) {
        doc.custom_wa_tags = opts.tags.map((t) => ({ campaign: t }));
      }
      if (opts?.company) {
        doc.company_name = opts.company;
      }

      if (existing) {
        const resp = await this.client.put<FrappeDocResponse<FrappeContactDoc>>(
          `/api/resource/Contact/${existing}`,
          doc,
        );
        logger.info(`Updated Contact: ${existing} (phone=${phone})`);
        return resp.data.data.name;
      } else {
        const resp = await this.client.post<FrappeDocResponse<FrappeContactDoc>>(
          '/api/resource/Contact',
          doc,
        );
        logger.info(`Created Contact: ${resp.data.data.name} (phone=${phone})`);
        return resp.data.data.name;
      }
    } catch (error: unknown) {
      logger.warn(`upsertContact failed for ${phone}:`, getErrorMessage(error));
      return null;
    }
  }

  /**
   * Find a Contact by phone number. Returns the document name or null.
   */
  private async findContactByPhone(phone: string): Promise<string | null> {
    if (!this.client) return null;

    try {
      const resp = await this.client.get<FrappeListResponse<{ name: string }>>(
        '/api/resource/Contact',
        {
          params: {
            filters: JSON.stringify([['mobile_no', '=', phone]]),
            fields: JSON.stringify(['name']),
            limit_page_length: 1,
          },
        },
      );
      return resp.data.data[0]?.name ?? null;
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Communication batching
  // ---------------------------------------------------------------------------

  /**
   * Queue a Communication (message) for batched write to ERPNext.
   * Messages are flushed every batchFlushIntervalMs (default 10s).
   */
  queueCommunication(params: CommunicationParams): void {
    if (!this.enabled) return;

    const doc: FrappeCommunicationDoc = {
      communication_type: 'Chat',
      communication_medium: 'Chat',
      content: params.messageBody,
      sender: params.direction === 'Received' ? params.phone : undefined,
      recipients: params.direction === 'Sent' ? params.phone : undefined,
      sent_or_received: params.direction,
      communication_date: new Date().toISOString(),
      company: params.company,
    };

    if (params.tag) {
      doc.subject = `WhatsApp [${params.tag}]`;
    }

    this.communicationBuffer.push(doc);
    logger.debug(`Queued communication (buffer=${this.communicationBuffer.length})`);
  }

  /**
   * Flush all buffered Communication documents to ERPNext.
   */
  private async flushCommunications(): Promise<void> {
    if (!this.client || this.communicationBuffer.length === 0) return;

    const batch = this.communicationBuffer.splice(0);
    logger.info(`Flushing ${batch.length} communications`);

    for (const doc of batch) {
      try {
        await this.client.post('/api/resource/Communication', doc);
      } catch (error: unknown) {
        logger.warn('Failed to write Communication:', getErrorMessage(error));
        // Don't re-queue — messages are best-effort
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Campaign cache refresh
  // ---------------------------------------------------------------------------

  /**
   * Fetch all Campaigns from ERPNext and return them.
   * The caller (stateManager / eventRouter) can update tag configs accordingly.
   */
  async fetchCampaigns(): Promise<FrappeCampaignDoc[]> {
    if (!this.enabled || !this.client) return [];

    try {
      const resp = await this.client.get<FrappeListResponse<FrappeCampaignDoc>>(
        '/api/resource/Campaign',
        {
          params: {
            fields: JSON.stringify([
              'name',
              'campaign_name',
              'status',
              'custom_wa_tag',
              'custom_wa_display_name',
              'custom_wa_routing_targets',
              'custom_wa_system_prompt',
              'custom_wa_welcome_messages',
              'custom_wa_regex_pattern',
              'custom_wa_voice_prompt_number',
            ]),
            filters: JSON.stringify([['status', '!=', 'Cancelled']]),
            limit_page_length: 100,
          },
        },
      );
      logger.info(`Fetched ${resp.data.data.length} campaigns`);
      return resp.data.data;
    } catch (error: unknown) {
      logger.warn('fetchCampaigns failed:', getErrorMessage(error));
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Health check
  // ---------------------------------------------------------------------------

  async healthCheck(): Promise<boolean> {
    if (!this.enabled || !this.client) return false;

    try {
      await this.client.get('/api/method/frappe.auth.get_logged_user');
      return true;
    } catch {
      return false;
    }
  }
}

/** Singleton instance — import and use directly. */
export const erpnextSync = new ERPNextSyncService();
