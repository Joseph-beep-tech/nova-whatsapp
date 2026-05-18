/**
 * Welcome Controller
 *
 * Provides welcome message configuration for tags.
 * Welcome messages are automatically sent when a user is assigned a tag.
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
  Response,
  SuccessResponse,
} from 'tsoa';
import { WelcomeService, WelcomeMessageItem } from '../services/welcomeService';
import { getErrorMessage } from '../types/webhook';
import {
  ListWelcomeMessagesResponse,
  SetWelcomeMessageRequest,
  SetWelcomeMessageResponse,
  DeleteWelcomeMessageResponse,
  BaseResponse,
  ApiWelcomeMessageItem,
} from '../types/api';

// Welcome service (set at initialization time)
let welcomeService: WelcomeService;

/**
 * Initialize welcome controller with service
 */
export function initWelcomeController(service: WelcomeService): void {
  welcomeService = service;
}

@Route('welcome-messages')
@Tags('Welcome')
@Security('api_key')
export class WelcomeController extends Controller {
  /**
   * List all welcome messages
   *
   * Returns all configured welcome messages for all tags.
   *
   * @summary List all welcome message configurations
   */
  @Get('')
  @Response<BaseResponse>(500, 'Internal server error')
  public async listWelcomeMessages(): Promise<ListWelcomeMessagesResponse> {
    try {
      const messagesMap = await welcomeService.listWelcomeMessages();

      // Convert from Record<string, WelcomeMessageConfig> to array with tag field
      const welcomeMessages = Object.entries(messagesMap).map(([tag, config]) => ({
        tag,
        messages: config.messages as unknown as ApiWelcomeMessageItem[],
        enabled: config.enabled,
      }));

      return {
        success: true,
        welcomeMessages,
      };
    } catch (error: unknown) {
      console.error('Error listing welcome messages:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Set welcome messages for a tag
   *
   * Configures the welcome messages sent when a user is assigned this tag.
   * Messages are sent in sequence and follow the wwebjs-api sendMessage schema.
   *
   * @summary Configure welcome messages for a tag
   * @param tag Tag name
   * @param body Welcome message configuration
   *
   * @example body {
   *   "messages": [
   *     {
   *       "contentType": "string",
   *       "content": "Welcome to SOMO! You're now registered."
   *     },
   *     {
   *       "contentType": "MessageMediaFromURL",
   *       "content": "https://example.com/welcome.jpg",
   *       "options": { "caption": "Welcome image" }
   *     }
   *   ],
   *   "enabled": true
   * }
   */
  @Post('{tag}')
  @SuccessResponse(200, 'Welcome messages configured')
  @Response<BaseResponse>(400, 'Invalid request')
  @Response<BaseResponse>(500, 'Internal server error')
  public async setWelcomeMessages(
    @Path() tag: string,
    @Body() body: SetWelcomeMessageRequest
  ): Promise<SetWelcomeMessageResponse> {
    try {
      if (!tag) {
        this.setStatus(400);
        return {
          success: false,
          error: 'Tag is required',
        };
      }

      const { messages, enabled = true } = body;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        this.setStatus(400);
        return {
          success: false,
          error: 'Messages array is required and must not be empty',
        };
      }

      // Validate each message has required fields
      for (const msg of messages) {
        if (!msg.contentType || msg.content === undefined) {
          this.setStatus(400);
          return {
            success: false,
            error: 'Each message must have contentType and content fields',
          };
        }
      }

      // Convert API types to internal types (they're compatible)
      const internalMessages = messages as unknown as WelcomeMessageItem[];
      await welcomeService.setWelcomeMessage(tag, internalMessages, enabled);

      return {
        success: true,
        tag,
        messages,
        enabled,
      };
    } catch (error: unknown) {
      console.error('Error setting welcome messages:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Disable welcome messages for a tag
   *
   * Disables welcome messages for a tag without deleting the configuration.
   *
   * @summary Disable welcome messages for a tag
   * @param tag Tag name
   */
  @Delete('{tag}')
  @SuccessResponse(200, 'Welcome messages disabled')
  @Response<BaseResponse>(400, 'Invalid request')
  @Response<BaseResponse>(500, 'Internal server error')
  public async disableWelcomeMessages(
    @Path() tag: string
  ): Promise<DeleteWelcomeMessageResponse> {
    try {
      if (!tag) {
        this.setStatus(400);
        return {
          success: false,
          error: 'Tag is required',
        };
      }

      await welcomeService.disableWelcomeMessage(tag);

      return {
        success: true,
        tag,
        enabled: false,
      };
    } catch (error: unknown) {
      console.error('Error disabling welcome message:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }
}
