/**
 * Chats Controller
 *
 * Provides conversation management endpoints for agent takeover (HITL).
 * Allows agents to claim/release conversations and retrieve context.
 */

import {
  Controller,
  Get,
  Post,
  Route,
  Tags,
  Security,
  Body,
  Query,
  Response,
  SuccessResponse,
} from 'tsoa';
import { conversationManager } from '../utils/conversationManager';
import { qdrantHandler } from '../services/qdrantHandler';
import { stateManager } from '../utils/stateManager';
import { WhatsAppPlatform, DEFAULT_PLATFORM, isValidPlatform } from '../utils/phoneNumber';
import { getErrorMessage } from '../types/webhook';
import { ConversationMessage as MemoryMessage } from '../types/memory';
import {
  ClaimChatRequest,
  ClaimChatResponse,
  ReleaseChatResponse,
  GetContextResponse,
  BaseResponse,
  ConversationMessage,
  ConversationContext,
} from '../types/api';

/**
 * Default collection name for conversation history
 * TODO: Make this configurable via environment variable
 */
const DEFAULT_COLLECTION = 'conversations';

/**
 * Convert memory.ConversationMessage to api.ConversationMessage
 */
function toApiMessage(msg: MemoryMessage): ConversationMessage {
  return {
    id: msg.id,
    identifier: msg.identifier,
    platform: msg.platform,
    body: msg.content,
    fromUser: msg.role === 'user',
    timestamp: msg.timestamp,
  };
}

@Route('chats')
@Tags('Chats')
@Security('api_key')
export class ChatsController extends Controller {
  /**
   * Claim a conversation for an agent
   *
   * Assigns the conversation to the specified agent, removing it from
   * automated routing. The agent can then take over the conversation.
   *
   * @summary Claim a conversation for manual handling
   * @param body Claim request with identifier, platform, and agent ID
   */
  @Post('claim')
  @SuccessResponse(200, 'Conversation claimed successfully')
  @Response<BaseResponse>(400, 'Invalid request')
  @Response<BaseResponse>(500, 'Internal server error')
  public async claimChat(
    @Body() body: ClaimChatRequest
  ): Promise<ClaimChatResponse> {
    try {
      const { identifier, platform: platformParam, agentId } = body;

      if (!identifier) {
        this.setStatus(400);
        return {
          success: false,
          error: 'identifier is required',
        };
      }

      if (!agentId) {
        this.setStatus(400);
        return {
          success: false,
          error: 'agentId is required',
        };
      }

      const platform: WhatsAppPlatform = (platformParam && isValidPlatform(platformParam))
        ? platformParam
        : DEFAULT_PLATFORM;

      const assignment = await conversationManager.claimChat(identifier, platform, agentId);

      return {
        success: true,
        chat: {
          identifier: assignment.identifier,
          platform: assignment.platform,
          assignedTo: assignment.assignedTo || '',
          claimedAt: assignment.claimedAt,
        },
      };
    } catch (error: unknown) {
      console.error('Chat claim error:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Release a conversation back to automation
   *
   * Removes the agent assignment from the conversation, allowing it to be
   * handled by automated routing again.
   *
   * @summary Release a conversation back to automation
   * @param identifier Phone number or group ID (e.g., "254722833440")
   */
  @Post('release')
  @SuccessResponse(200, 'Conversation released successfully')
  @Response<BaseResponse>(400, 'Invalid request')
  @Response<BaseResponse>(404, 'Conversation not found')
  @Response<BaseResponse>(500, 'Internal server error')
  public async releaseChat(@Body() body: { identifier: string }): Promise<ReleaseChatResponse> {
    try {
      const { identifier } = body;

      if (!identifier) {
        this.setStatus(400);
        return {
          success: false,
          error: 'identifier is required',
        };
      }

      const assignment = await conversationManager.releaseChat(identifier);

      return {
        success: true,
        message: `Conversation ${identifier} released back to automation`,
        released: true,
      };
    } catch (error: unknown) {
      const errorMsg = getErrorMessage(error);
      console.error('Chat release error:', errorMsg);

      if (errorMsg.includes('No assignment found')) {
        this.setStatus(404);
        return {
          success: false,
          error: errorMsg,
          released: false,
        };
      }

      this.setStatus(500);
      return {
        success: false,
        error: errorMsg,
        released: false,
      };
    }
  }

  /**
   * Get conversation context
   *
   * Retrieves conversation context including recent message history,
   * RAG summary, and user tags. Used by agents when taking over a conversation.
   *
   * @summary Get conversation context for agent takeover
   * @param identifier Phone number or group ID (e.g., "254722833440")
   * @param limit Maximum number of messages to retrieve (default: 20)
   */
  @Get('context')
  @SuccessResponse(200, 'Context retrieved successfully')
  @Response<BaseResponse>(400, 'Invalid request')
  @Response<BaseResponse>(404, 'User not found')
  @Response<BaseResponse>(500, 'Internal server error')
  public async getContext(
    @Query() identifier: string,
    @Query() limit: number = 20
  ): Promise<GetContextResponse> {
    try {
      if (!identifier) {
        this.setStatus(400);
        return {
          success: false,
          error: 'identifier query parameter is required',
        };
      }

      // Validate limit
      const messageLimit = Math.max(1, Math.min(limit, 100)); // Clamp between 1 and 100

      // Get user data for tags
      const user = await stateManager.getUser(identifier);
      if (!user) {
        this.setStatus(404);
        return {
          success: false,
          error: `User not found: ${identifier}`,
        };
      }

      // Get conversation history from Qdrant
      const memoryMessages = await qdrantHandler.getConversationHistory(
        DEFAULT_COLLECTION,
        identifier,
        messageLimit,
        user.platform
      );

      // Convert memory messages to API messages
      const messages = memoryMessages.map(toApiMessage);

      // Get assignment info (if any)
      const assignment = await conversationManager.getAssignment(identifier);

      // Build context response
      const context: ConversationContext = {
        messages,
        userTags: user.tags,
        ...(assignment && {
          claimedAt: assignment.claimedAt,
          claimedBy: assignment.assignedTo || undefined,
        }),
      };

      // TODO: Add RAG summary generation
      // For now, ragSummary is undefined unless we implement summary generation

      return {
        success: true,
        context,
      };
    } catch (error: unknown) {
      console.error('Get context error:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }
}
