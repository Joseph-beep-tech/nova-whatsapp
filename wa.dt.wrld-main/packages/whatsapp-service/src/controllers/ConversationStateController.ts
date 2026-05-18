/**
 * Conversation State Controller
 *
 * Provides endpoints for managing conversation state including handoff status,
 * agent assignments, and automation pausing.
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
  Query,
  Response,
  SuccessResponse,
} from 'tsoa';
import { stateManager, ConversationStateResponse } from '../utils/stateManager';
import { WhatsAppPlatform, DEFAULT_PLATFORM, isValidPlatform } from '../utils/phoneNumber';
import { getErrorMessage } from '../types/webhook';
import {
  GetConversationStateResponse,
  SetConversationStateRequest,
  SetConversationStateResponse,
  ApiConversationState,
  BaseResponse,
} from '../types/api';

/**
 * Convert internal ConversationStateResponse to API type
 */
function toApiConversationState(state: ConversationStateResponse): ApiConversationState {
  return {
    identifier: state.identifier,
    platform: state.platform,
    sessionId: state.sessionId,
    handoffStatus: state.handoffStatus,
    assignedAgent: state.assignedAgent,
    lastAgentActivity: state.lastAgentActivity,
    automationPaused: state.automationPaused,
    metadata: state.metadata,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
  };
}

@Route('conversation-state')
@Tags('Conversation State')
@Security('api_key')
export class ConversationStateController extends Controller {
  /**
   * Get conversation state
   *
   * Retrieves the current state of a conversation including handoff status,
   * assigned agent, and automation settings.
   *
   * @summary Get conversation state by identifier and sessionId
   * @param sessionId WhatsApp session ID
   * @param identifier Phone number or group ID (e.g., "254722833440")
   */
  @Get('{sessionId}')
  @SuccessResponse(200, 'Conversation state retrieved successfully')
  @Response<BaseResponse>(400, 'Invalid request')
  @Response<BaseResponse>(404, 'Conversation state not found')
  @Response<BaseResponse>(500, 'Internal server error')
  public async getConversationState(
    @Path() sessionId: string,
    @Query() identifier: string
  ): Promise<GetConversationStateResponse> {
    try {
      if (!identifier) {
        this.setStatus(400);
        return {
          success: false,
          error: 'identifier query parameter is required',
        };
      }

      if (!sessionId) {
        this.setStatus(400);
        return {
          success: false,
          error: 'sessionId is required',
        };
      }

      const state = await stateManager.getConversationState(identifier, sessionId);

      if (!state) {
        this.setStatus(404);
        return {
          success: false,
          error: 'Conversation state not found',
          state: null,
        };
      }

      return {
        success: true,
        state: toApiConversationState(state),
      };
    } catch (error: unknown) {
      console.error('Get conversation state error:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Set conversation state
   *
   * Creates or updates conversation state. Use this to manage handoff status,
   * assign agents, pause automation, or update metadata.
   *
   * @summary Set or update conversation state
   * @param sessionId WhatsApp session ID
   * @param body State update request including identifier and optional platform
   */
  @Post('{sessionId}')
  @SuccessResponse(200, 'Conversation state updated successfully')
  @Response<BaseResponse>(400, 'Invalid request')
  @Response<BaseResponse>(500, 'Internal server error')
  public async setConversationState(
    @Path() sessionId: string,
    @Body() body: SetConversationStateRequest
  ): Promise<SetConversationStateResponse> {
    try {
      const { identifier, platform: platformParam, handoffStatus, assignedAgent, automationPaused, metadata } = body;

      if (!identifier) {
        this.setStatus(400);
        return {
          success: false,
          error: 'identifier is required in request body',
        };
      }

      if (!sessionId) {
        this.setStatus(400);
        return {
          success: false,
          error: 'sessionId is required',
        };
      }

      // Validate that at least one field is being updated
      if (
        handoffStatus === undefined &&
        assignedAgent === undefined &&
        automationPaused === undefined &&
        !metadata
      ) {
        this.setStatus(400);
        return {
          success: false,
          error: 'At least one field must be provided for update',
        };
      }

      const platform: WhatsAppPlatform = (platformParam && isValidPlatform(platformParam))
        ? platformParam
        : DEFAULT_PLATFORM;

      // Prepare update data
      const updateData: {
        handoffStatus?: typeof handoffStatus;
        assignedAgent?: string;
        automationPaused?: boolean;
        metadata?: Record<string, unknown>;
      } = {};

      if (handoffStatus !== undefined) {
        updateData.handoffStatus = handoffStatus;
      }

      if (assignedAgent !== undefined) {
        updateData.assignedAgent = assignedAgent;
      }

      if (automationPaused !== undefined) {
        updateData.automationPaused = automationPaused;
      }

      if (metadata) {
        updateData.metadata = metadata;
      }

      const state = await stateManager.setConversationState(identifier, platform, sessionId, updateData);

      return {
        success: true,
        state: toApiConversationState(state),
      };
    } catch (error: unknown) {
      console.error('Set conversation state error:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }
}
