/**
 * Event Router Service
 *
 * Routes events to appropriate targets based on user tags and configuration.
 * Supports multiple routing targets: n8n webhooks, Qdrant RAG, local handlers.
 */

import axios, { AxiosError } from 'axios';
import { stateManager } from '../utils/stateManager';
import {
  TagConfiguration,
  RoutingTarget,
  RoutableEvent,
  RoutingResult,
  EventRoutingResult,
  getTagConfigKey,
  TAG_CONFIG_PREFIX,
  isN8nWebhookTarget,
  isQdrantRagTarget,
  isLocalHandlerTarget,
  isPassthroughTarget,
  N8nWebhookTarget,
  QdrantRagTarget,
  LocalHandlerTarget,
} from '../types/routing';
import { QueuedEvent, ProcessingResult } from './eventQueue';
import { getErrorMessage } from '../types/webhook';
import { messageRouter } from '../handlers/messageRouter';
import { keywordHandler } from '../handlers/keywordHandler';
import { WelcomeService } from './welcomeService';
import { alertService } from './alertService';
import { alertConfig } from '../shared/config';
import { WhatsAppPlatform, DEFAULT_PLATFORM, toChatId, fromChatId } from '../utils/phoneNumber';
import { LlmServiceImpl } from './llmService';
import { WhatsAppApiClient } from '../dispatcher/whatsappApiClient';
import type { EventHubService } from './eventHub';
import { toSocketMessage, toSocketMessageUpdate, toSocketSessionStatus } from '../utils/socketPayloads';

/** Local handler function type */
export type LocalHandler = (event: RoutableEvent, config?: Record<string, unknown>) => Promise<unknown>;

/**
 * Event Router Service
 *
 * Determines routing based on user tags and forwards events to appropriate targets.
 */
class EventRouterService {
  private localHandlers: Map<string, LocalHandler> = new Map();
  private qdrantHandler: ((event: RoutableEvent, config: QdrantRagTarget, tagConfig?: TagConfiguration) => Promise<unknown>) | null = null;
  private legacyWebhookForwarder: ((event: RoutableEvent) => Promise<void>) | null = null;
  private welcomeService: WelcomeService | null = null;
  private llmService: LlmServiceImpl | null = null;
  private apiClient: WhatsAppApiClient | null = null;
  private eventHub: EventHubService | null = null;

  /**
   * Set the EventHub for real-time socket broadcasting
   */
  setEventHub(hub: EventHubService): void {
    this.eventHub = hub;
    console.log('[EventRouter] EventHub configured');
  }

  /**
   * Set the welcome service for auto-tag welcome messages
   */
  setWelcomeService(service: WelcomeService): void {
    this.welcomeService = service;
    console.log('[EventRouter] Welcome service configured');
  }

  /**
   * Set the LLM service for conversational AI features
   */
  setLlmService(service: LlmServiceImpl): void {
    this.llmService = service;
    console.log('[EventRouter] LLM service configured');
  }

  /**
   * Set the WhatsApp API client for sending messages
   */
  setApiClient(client: WhatsAppApiClient): void {
    this.apiClient = client;
  }

  /**
   * Register a local handler
   */
  registerLocalHandler(name: string, handler: LocalHandler): void {
    this.localHandlers.set(name, handler);
    console.log(`[EventRouter] Registered local handler: ${name}`);
  }

  /**
   * Set the Qdrant RAG handler
   */
  setQdrantHandler(handler: (event: RoutableEvent, config: QdrantRagTarget, tagConfig?: TagConfiguration) => Promise<unknown>): void {
    this.qdrantHandler = handler;
    console.log('[EventRouter] Qdrant handler configured');
  }

  /**
   * Set the legacy webhook forwarder (for backwards compatibility)
   */
  setLegacyWebhookForwarder(forwarder: (event: RoutableEvent) => Promise<void>): void {
    this.legacyWebhookForwarder = forwarder;
    console.log('[EventRouter] Legacy webhook forwarder configured');
  }

  /**
   * Extract identifier and platform from event data
   */
  private extractIdentity(data: Record<string, unknown> | undefined): { identifier: string; platform: WhatsAppPlatform } | null {
    // Handle undefined/null data (e.g., authenticated event has no data)
    if (!data) {
      return null;
    }

    // Try common locations for chatId
    const candidates = [
      data.from,
      data.chatId,
      (data.message as Record<string, unknown>)?.from,
      (data.msg as Record<string, unknown>)?.from,
      (data.data as Record<string, unknown>)?.from,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.includes('@')) {
        try {
          return fromChatId(candidate);
        } catch {
          // Invalid format, try next candidate
        }
      }
    }

    return null;
  }

  /**
   * Get tag configurations for a list of tags
   */
  async getTagConfigurations(tags: string[]): Promise<TagConfiguration[]> {
    const configs: TagConfiguration[] = [];

    for (const tag of tags) {
      const key = getTagConfigKey(tag);
      const configValue = await stateManager.getConfig(key);
      const config = configValue as unknown as TagConfiguration | undefined;
      if (config && config.enabled) {
        configs.push({ ...config, tag });
      }
    }

    return configs;
  }

  /**
   * Get all tag configurations
   */
  async getAllTagConfigurations(): Promise<TagConfiguration[]> {
    const allConfigs = await stateManager.getConfigsByPrefix(TAG_CONFIG_PREFIX);
    const configs: TagConfiguration[] = [];

    for (const [key, value] of Object.entries(allConfigs)) {
      const config = value as unknown as TagConfiguration;
      if (config) {
        // Extract tag from key
        const tag = key.slice(TAG_CONFIG_PREFIX.length);
        configs.push({ ...config, tag });
      }
    }

    return configs;
  }

  /**
   * Set tag configuration
   */
  async setTagConfiguration(tag: string, config: Omit<TagConfiguration, 'tag'>): Promise<TagConfiguration> {
    const key = getTagConfigKey(tag);
    const fullConfig: TagConfiguration = {
      ...config,
      tag,
      updatedAt: new Date().toISOString(),
    };

    if (!fullConfig.createdAt) {
      const existingValue = await stateManager.getConfig(key);
      const existing = existingValue as unknown as TagConfiguration | undefined;
      fullConfig.createdAt = existing?.createdAt || new Date().toISOString();
    }

    await stateManager.setConfig(key, fullConfig as unknown as Record<string, unknown>);
    console.log(`[EventRouter] Tag configuration saved: ${tag}`);
    return fullConfig;
  }

  /**
   * Delete tag configuration
   */
  async deleteTagConfiguration(tag: string): Promise<boolean> {
    const key = getTagConfigKey(tag);
    const deleted = await stateManager.deleteConfig(key);
    if (deleted) {
      console.log(`[EventRouter] Tag configuration deleted: ${tag}`);
    }
    return deleted;
  }

  /**
   * Route to a single target
   */
  private async routeToTarget(event: RoutableEvent, target: RoutingTarget, tagConfig?: TagConfiguration): Promise<RoutingResult> {
    const startTime = Date.now();

    try {
      let response: unknown;

      if (isN8nWebhookTarget(target)) {
        response = await this.routeToN8nWebhook(event, target);
      } else if (isQdrantRagTarget(target)) {
        response = await this.routeToQdrantRag(event, target, tagConfig);
      } else if (isLocalHandlerTarget(target)) {
        response = await this.routeToLocalHandler(event, target);
      } else if (isPassthroughTarget(target)) {
        console.log(`[EventRouter] Passthrough: ${event.dataType} for ${event.identifier}`);
        response = { passthrough: true };
      } else {
        throw new Error(`Unknown target type: ${(target as RoutingTarget).type}`);
      }

      return {
        target,
        success: true,
        response,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = getErrorMessage(error);

      // Create alert for failed routing if alerts are enabled
      if (alertConfig.enabled && alertService.isEnabled()) {
        await alertService.createAlert({
          type: 'failed_message',
          severity: 'warning',
          message: `Failed to route ${event.dataType} to ${target.type}`,
          metadata: {
            identifier: event.identifier,
            platform: event.platform,
            sessionId: event.sessionId,
            errorMessage,
            targetType: target.type,
          },
        });
      }

      return {
        target,
        success: false,
        error: errorMessage,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Route to n8n webhook
   */
  private async routeToN8nWebhook(event: RoutableEvent, target: N8nWebhookTarget): Promise<unknown> {
    console.log(`[EventRouter] Routing to n8n webhook: ${target.webhookUrl}`);

    const response = await axios.post(
      target.webhookUrl,
      {
        dataType: event.dataType,
        data: event.data,
        sessionId: event.sessionId,
        chatId: toChatId(event.identifier, event.platform),
        identifier: event.identifier,
        platform: event.platform,
        tags: event.tags,
        receivedAt: event.receivedAt,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          ...target.headers,
        },
        timeout: target.timeout || 30000,
      }
    );

    return response.data;
  }

  /**
   * Route to Qdrant RAG handler
   */
  private async routeToQdrantRag(event: RoutableEvent, target: QdrantRagTarget, tagConfig?: TagConfiguration): Promise<unknown> {
    if (!this.qdrantHandler) {
      throw new Error('Qdrant handler not configured');
    }

    console.log(`[EventRouter] Routing to Qdrant RAG: ${target.collectionName}`);
    return await this.qdrantHandler(event, target, tagConfig);
  }

  /**
   * Route to local handler
   */
  private async routeToLocalHandler(event: RoutableEvent, target: LocalHandlerTarget): Promise<unknown> {
    const handler = this.localHandlers.get(target.handlerName);
    if (!handler) {
      throw new Error(`Local handler not found: ${target.handlerName}`);
    }

    console.log(`[EventRouter] Routing to local handler: ${target.handlerName}`);
    return await handler(event, target.config);
  }

  /**
   * Handle unregistered user via LLM.
   *
   * When a user has no tags and LLM is enabled, detect their intent
   * and respond with either tag registration or a welcome message.
   *
   * Returns true if the message was handled, false to continue normal routing.
   */
  private async handleUnregisteredUser(
    event: RoutableEvent,
    messageBody: string
  ): Promise<boolean> {
    if (!this.llmService?.isEnabled() || !this.apiClient) {
      return false;
    }

    // Get available tags for context
    const allTagConfigs = await this.getAllTagConfigurations();
    const availableTags = allTagConfigs
      .filter(tc => tc.enabled)
      .map(tc => ({ tag: tc.tag, displayName: tc.displayName }));

    if (availableTags.length === 0) {
      return false;
    }

    const tagNames = availableTags.map(t => t.tag);
    const chatId = toChatId(event.identifier, event.platform);

    // Detect intent
    const intent = await this.llmService.detectIntent(messageBody, tagNames);
    console.log(`[EventRouter] LLM intent for unregistered ${event.identifier}: ${intent.intent} (confidence: ${intent.confidence})`);

    if (intent.intent === 'tag_interest' && intent.tag && tagNames.includes(intent.tag)) {
      // User wants a specific tag - register them
      const result = await stateManager.registerUser(event.identifier, event.platform, {
        tags: [intent.tag],
      });

      if (result.newTags.length > 0 && this.welcomeService) {
        await this.welcomeService.sendWelcomeForNewTags(
          event.identifier,
          event.platform,
          result.newTags,
          event.sessionId
        );
        console.log(`[EventRouter] LLM-registered ${event.identifier} with tag: ${intent.tag}`);
      }
      return true;
    }

    // For greetings, questions, or unknown intent - send welcome
    const response = intent.intent === 'greeting' || intent.intent === 'unknown'
      ? await this.llmService.generateWelcome({ availableTags })
      : await this.llmService.generateUnregisteredResponse(messageBody, availableTags);

    try {
      await this.apiClient.sendMessage(event.sessionId, {
        chatId,
        contentType: 'string',
        content: response,
      });
      console.log(`[EventRouter] LLM welcome sent to unregistered ${event.identifier}`);
    } catch (error) {
      console.error('[EventRouter] Failed to send LLM welcome:', getErrorMessage(error));
    }

    return true;
  }

  /**
   * Check for and handle session disconnect events
   */
  private async handleSessionDisconnect(event: RoutableEvent): Promise<void> {
    // Check if this is a session disconnect event
    if (event.dataType === 'disconnected' || event.dataType === 'session_disconnect') {
      if (alertConfig.enabled && alertService.isEnabled()) {
        await alertService.createAlert({
          type: 'session_disconnect',
          severity: 'critical',
          message: `WhatsApp session ${event.sessionId} disconnected`,
          metadata: {
            sessionId: event.sessionId,
          },
        });
        console.log(`[EventRouter] Created session disconnect alert for session: ${event.sessionId}`);
      }
    }
  }

  /**
   * Check queue depth and create alert if threshold exceeded
   *
   * This method should be called periodically or after enqueueing events.
   * It requires eventQueue service to be passed in.
   */
  async checkQueueBackup(queueStats: { waiting: number; active: number; delayed: number }): Promise<void> {
    if (!alertConfig.enabled || !alertService.isEnabled()) {
      return;
    }

    const threshold = alertConfig.queueBackupThreshold || 100;
    const totalPending = queueStats.waiting + queueStats.active + queueStats.delayed;

    if (totalPending >= threshold) {
      // Check if we already have an unacknowledged queue backup alert to avoid spam
      const existingAlerts = await alertService.listAlerts({
        type: 'queue_backup',
        acknowledged: false,
        limit: 1,
      });

      if (existingAlerts.success && existingAlerts.alerts && existingAlerts.alerts.length > 0) {
        // Already have an active alert, don't create duplicate
        console.log(`[EventRouter] Queue backup alert already exists (depth: ${totalPending})`);
        return;
      }

      await alertService.createAlert({
        type: 'queue_backup',
        severity: 'warning',
        message: `Event queue depth (${totalPending}) exceeded threshold (${threshold})`,
        metadata: {
          queueName: 'whatsapp-events',
          queueDepth: totalPending,
          threshold,
          waiting: queueStats.waiting,
          active: queueStats.active,
          delayed: queueStats.delayed,
        },
      });
      console.log(`[EventRouter] Created queue backup alert: depth=${totalPending}, threshold=${threshold}`);
    }
  }

  /**
   * Process a queued event (called by queue worker)
   */
  async processEvent(queuedEvent: QueuedEvent): Promise<ProcessingResult> {
    const startTime = Date.now();

    // Build routable event - parse chatId from QueuedEvent into identifier + platform
    let identity: { identifier: string; platform: WhatsAppPlatform } | null = null;

    if (queuedEvent.chatId) {
      try {
        identity = fromChatId(queuedEvent.chatId);
      } catch {
        // Invalid chatId format, try extracting from data
      }
    }

    if (!identity) {
      identity = this.extractIdentity(queuedEvent.data);
    }

    let tags = queuedEvent.tags || [];

    const event: RoutableEvent = {
      sessionId: queuedEvent.sessionId,
      dataType: queuedEvent.dataType,
      data: queuedEvent.data,
      identifier: identity?.identifier || 'unknown',
      platform: identity?.platform || DEFAULT_PLATFORM,
      tags,
      receivedAt: queuedEvent.receivedAt,
    };

    // Emit non-message socket events immediately (qr, ready, message_ack, etc.)
    // message_create is emitted after the dedup/fromMe filter below.
    if (event.dataType !== 'message_create') {
      this.emitSocketEvent(event);
    }

    // Check for session disconnect and create alert if needed
    await this.handleSessionDisconnect(event);

    // Tag detection and auto-registration for message events
    let messageBody = '';

    if (event.dataType === 'message_create' &&
        event.identifier !== 'unknown') {
      const decision = await messageRouter.route(event);
      messageBody = decision.messageBody;

      // Skip own messages and duplicates
      if (!decision.shouldProcess) {
        return {
          success: true,
          jobId: 'skipped',
          routedTo: [],
          message: `Skipped: ${decision.skipReason}`,
        };
      }

      // Emit message socket event after dedup/fromMe filter passes
      this.emitSocketEvent(event);

      // Auto-register user with detected tags
      if (decision.detectedTags.length > 0) {
        const result = await stateManager.registerUser(event.identifier, event.platform, {
          tags: decision.detectedTags,
        });

        // Send welcome messages for newly added tags
        if (result.newTags.length > 0 && this.welcomeService) {
          await this.welcomeService.sendWelcomeForNewTags(
            event.identifier,
            event.platform,
            result.newTags,
            event.sessionId
          );
          console.log(`[EventRouter] Auto-registered ${event.identifier} with tags: [${decision.detectedTags}], new: [${result.newTags}]`);
        }

        // Merge detected tags into event for routing
        tags = [...new Set([...tags, ...decision.detectedTags])];
        event.tags = tags;
      }

      // Handle keyword commands (ping, echo, help, etc.)
      if (decision.keywords.length > 0) {
        const keywordResult = await keywordHandler.handle({
          identifier: event.identifier,
          platform: event.platform,
          sessionId: event.sessionId,
          messageBody: decision.messageBody,
          userTags: tags,
        });

        if (keywordResult.handled) {
          console.log(`[EventRouter] Keyword handled: ${keywordResult.keyword} for ${event.identifier}`);
          return {
            success: true,
            jobId: 'keyword',
            routedTo: [`keyword:${keywordResult.keyword}`],
            message: `Keyword handled: ${keywordResult.keyword}`,
          };
        }
      }
    }

    // Get tag configurations
    const tagConfigs = await this.getTagConfigurations(tags);

    // If no tag routing configured, try LLM for unregistered users
    if (tagConfigs.length === 0) {
      // LLM handles unregistered users with intent detection + welcome
      if (messageBody && tags.length === 0) {
        const handled = await this.handleUnregisteredUser(event, messageBody);
        if (handled) {
          return {
            success: true,
            jobId: 'llm_unregistered',
            routedTo: ['llm:unregistered_user'],
          };
        }
      }

      if (this.legacyWebhookForwarder) {
        console.log(`[EventRouter] No tag routing, using legacy webhook forwarding`);
        await this.legacyWebhookForwarder(event);
        return {
          success: true,
          jobId: 'legacy',
          routedTo: ['legacy_webhooks'],
        };
      }

      return {
        success: true,
        jobId: 'no_route',
        routedTo: [],
      };
    }

    // Route to configured targets
    const routedTo: string[] = [];
    let anySuccess = false;

    for (const tagConfig of tagConfigs) {
      if (!tagConfig.routing || !tagConfig.routing.target.enabled) {
        continue;
      }

      // Check event type filter
      const eventTypes = tagConfig.routing.eventTypes || [];
      if (eventTypes.length > 0 && !eventTypes.includes(event.dataType)) {
        continue;
      }

      // Route to primary target (pass tagConfig for SPAO content retrieval)
      const result = await this.routeToTarget(event, tagConfig.routing.target, tagConfig);
      routedTo.push(`${tagConfig.tag}:${tagConfig.routing.target.type}`);

      if (result.success) {
        anySuccess = true;
      } else if (tagConfig.routing.fallback && tagConfig.routing.fallback.enabled) {
        // Try fallback
        console.log(`[EventRouter] Primary failed, trying fallback for tag: ${tagConfig.tag}`);
        const fallbackResult = await this.routeToTarget(event, tagConfig.routing.fallback, tagConfig);
        routedTo.push(`${tagConfig.tag}:fallback:${tagConfig.routing.fallback.type}`);
        if (fallbackResult.success) {
          anySuccess = true;
        }
      }
    }

    // If we had targets but none succeeded, send user-facing error message
    if (!anySuccess && routedTo.length > 0 && this.apiClient && event.dataType === 'message_create') {
      try {
        const chatId = toChatId(event.identifier, event.platform);
        await this.apiClient.sendMessage(event.sessionId, {
          chatId,
          contentType: 'string',
          content: "Sorry, I'm having trouble right now. Please try again in a moment.",
        });
        console.log(`[EventRouter] Sent error message to ${event.identifier} after all targets failed`);
      } catch (sendError) {
        console.error('[EventRouter] Failed to send error message:', getErrorMessage(sendError));
      }
    }

    // Track WA message usage (fire-and-forget)
    this.trackWaMessageUsage(event.identifier).catch(() => {});

    return {
      success: anySuccess || routedTo.length === 0,
      jobId: `routed_${Date.now()}`,
      routedTo,
    };
  }

  /**
   * Track WhatsApp message usage for billing (lightweight, best-effort)
   */
  private async trackWaMessageUsage(identifier: string): Promise<void> {
    try {
      const usageKey = `wa_usage_${identifier}`;
      const usage = (await stateManager.getConfig(usageKey) as Record<string, unknown>) || {};

      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const monthKey = today.slice(0, 7); // YYYY-MM
      const todayCount = ((usage[`messages_${today}`] as number) || 0) + 1;
      const monthCount = ((usage[`messages_${monthKey}`] as number) || 0) + 1;
      const total = ((usage.messagesTotal as number) || 0) + 1;

      await stateManager.setConfig(usageKey, {
        ...usage,
        [`messages_${today}`]: todayCount,
        [`messages_${monthKey}`]: monthCount,
        messagesTotal: total,
        lastMessageAt: new Date().toISOString(),
      });
    } catch {
      // Best-effort — don't block message processing
    }
  }

  /**
   * Route an event synchronously (when queue is disabled)
   */
  async routeEventSync(
    sessionId: string,
    dataType: string,
    data: Record<string, unknown>
  ): Promise<EventRoutingResult> {
    const startTime = Date.now();

    // Extract identifier+platform and lookup user tags
    const identity = this.extractIdentity(data);
    let tags: string[] = [];

    if (identity) {
      const user = await stateManager.getUser(identity.identifier);
      if (user) {
        tags = user.tags;
      }
    }

    const event: RoutableEvent = {
      sessionId,
      dataType,
      data,
      identifier: identity?.identifier || 'unknown',
      platform: identity?.platform || DEFAULT_PLATFORM,
      tags,
      receivedAt: new Date().toISOString(),
    };

    // Emit non-message socket events immediately (qr, ready, message_ack, etc.)
    // message_create is emitted after the dedup/fromMe filter below.
    if (dataType !== 'message_create') {
      this.emitSocketEvent(event);
    }

    // Check for session disconnect and create alert if needed
    await this.handleSessionDisconnect(event);

    // Tag detection and auto-registration for message events
    let messageBody = '';

    if (dataType === 'message_create' && identity) {
      const decision = await messageRouter.route(event);
      messageBody = decision.messageBody;

      if (!decision.shouldProcess) {
        return {
          event,
          results: [],
          success: true,
          totalDurationMs: Date.now() - startTime,
          message: `Skipped: ${decision.skipReason}`,
        };
      }

      // Emit message socket event after dedup/fromMe filter passes
      this.emitSocketEvent(event);

      if (decision.detectedTags.length > 0) {
        const result = await stateManager.registerUser(identity.identifier, identity.platform, {
          tags: decision.detectedTags,
        });

        if (result.newTags.length > 0 && this.welcomeService) {
          await this.welcomeService.sendWelcomeForNewTags(
            identity.identifier,
            identity.platform,
            result.newTags,
            sessionId
          );
          console.log(`[EventRouter] Auto-registered ${identity.identifier} with tags: [${decision.detectedTags}], new: [${result.newTags}]`);
        }

        tags = [...new Set([...tags, ...decision.detectedTags])];
        event.tags = tags;
      }

      // Handle keyword commands (ping, echo, help, etc.)
      if (decision.keywords.length > 0) {
        const keywordResult = await keywordHandler.handle({
          identifier: identity.identifier,
          platform: identity.platform,
          sessionId,
          messageBody: decision.messageBody,
          userTags: tags,
        });

        if (keywordResult.handled) {
          console.log(`[EventRouter] Keyword handled: ${keywordResult.keyword} for ${identity.identifier}`);
          return {
            event,
            results: [],
            success: true,
            totalDurationMs: Date.now() - startTime,
            message: `Keyword handled: ${keywordResult.keyword}`,
          };
        }
      }
    }

    // Get tag configurations
    const tagConfigs = await this.getTagConfigurations(tags);

    // If no tag routing, try LLM for unregistered users
    if (tagConfigs.length === 0) {
      // LLM handles unregistered users with intent detection + welcome
      if (messageBody && tags.length === 0) {
        const handled = await this.handleUnregisteredUser(event, messageBody);
        if (handled) {
          return {
            event,
            results: [],
            success: true,
            totalDurationMs: Date.now() - startTime,
            message: 'Handled by LLM: unregistered user',
          };
        }
      }

      if (this.legacyWebhookForwarder) {
        await this.legacyWebhookForwarder(event);
      }

      return {
        event,
        results: [],
        success: true,
        totalDurationMs: Date.now() - startTime,
      };
    }

    // Route to all applicable targets
    const results: RoutingResult[] = [];

    for (const tagConfig of tagConfigs) {
      if (!tagConfig.routing || !tagConfig.routing.target.enabled) {
        continue;
      }

      // Check event type filter
      const eventTypes = tagConfig.routing.eventTypes || [];
      if (eventTypes.length > 0 && !eventTypes.includes(event.dataType)) {
        continue;
      }

      // Route to primary target (pass tagConfig for SPAO content retrieval)
      const result = await this.routeToTarget(event, tagConfig.routing.target, tagConfig);
      results.push(result);

      // Try fallback if primary failed
      if (!result.success && tagConfig.routing.fallback && tagConfig.routing.fallback.enabled) {
        const fallbackResult = await this.routeToTarget(event, tagConfig.routing.fallback, tagConfig);
        results.push(fallbackResult);
      }
    }

    const anySuccess = results.length === 0 || results.some(r => r.success);

    // If we had targets but none succeeded, send user-facing error message
    if (!anySuccess && results.length > 0 && this.apiClient && event.dataType === 'message_create') {
      try {
        const chatId = toChatId(event.identifier, event.platform);
        await this.apiClient.sendMessage(sessionId, {
          chatId,
          contentType: 'string',
          content: "Sorry, I'm having trouble right now. Please try again in a moment.",
        });
        console.log(`[EventRouter] Sent error message to ${event.identifier} after all targets failed`);
      } catch (sendError) {
        console.error('[EventRouter] Failed to send error message:', getErrorMessage(sendError));
      }
    }

    return {
      event,
      results,
      success: anySuccess,
      totalDurationMs: Date.now() - startTime,
    };
  }

  /**
   * Emit a socket event for real-time dashboard updates.
   * For message events: called after dedup/fromMe filter passes.
   * For session events: called immediately. Never throws.
   */
  private emitSocketEvent(event: RoutableEvent): void {
    if (!this.eventHub) return;

    try {
      switch (event.dataType) {
        case 'message_create': {
          const msgPayload = toSocketMessage(event);
          this.eventHub.emitMessage(msgPayload);

          // Also emit a chat update so the chat list refreshes
          this.eventHub.emitChatUpdate({
            id: `${event.identifier}:${event.platform}`,
            lastMessage: msgPayload.content,
            lastMessageTime: msgPayload.timestamp,
          });
          break;
        }

        case 'message_ack': {
          const updatePayload = toSocketMessageUpdate(event);
          if (updatePayload) {
            this.eventHub.emitMessageUpdate(updatePayload);
          }
          break;
        }

        case 'qr':
        case 'authenticated':
        case 'ready':
        case 'disconnected':
        case 'loading_screen': {
          const statusPayload = toSocketSessionStatus(event);
          if (statusPayload) {
            this.eventHub.emitSessionStatus(statusPayload);
          }
          break;
        }

        // Other event types (group_join, etc.) — no socket emission for now
      }
    } catch (error: unknown) {
      // Best-effort — never block event processing
      console.error('[EventRouter] Socket emit error:', error instanceof Error ? error.message : error);
    }
  }
}

// Singleton instance
export const eventRouter = new EventRouterService();
