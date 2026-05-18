/**
 * Users Controller
 *
 * Provides user registration, tag management, and listing endpoints.
 * Users are identified by their phone number (identifier) and platform.
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
  Query,
  Response,
  SuccessResponse,
} from 'tsoa';
import { stateManager, UserResponse } from '../utils/stateManager';
import { WelcomeService, WelcomeResult } from '../services/welcomeService';
import { WhatsAppPlatform, DEFAULT_PLATFORM, isValidPlatform } from '../utils/phoneNumber';
import { getErrorMessage } from '../types/webhook';
import {
  RegisterUserRequest,
  RegisterUserResponse,
  ListUsersResponse,
  ListUserTagsResponse,
  GetUserResponse,
  ModifyTagsRequest,
  ModifyTagsResponse,
  BaseResponse,
  User,
} from '../types/api';

// Welcome service (set at initialization time)
let welcomeService: WelcomeService | null = null;

/**
 * Initialize users controller with welcome service
 */
export function initUsersController(service: WelcomeService): void {
  welcomeService = service;
}

/**
 * Convert UserResponse to API User type
 */
function toApiUser(user: UserResponse): User {
  return {
    identifier: user.identifier,
    platform: user.platform,
    name: user.name,
    pushname: user.pushname,
    tags: user.tags,
    welcomedTags: user.welcomedTags,
    firstContactAt: user.firstContactAt,
    lastContactAt: user.lastContactAt,
    messageCount: user.messageCount,
  };
}

/**
 * Convert WelcomeResult to API response format
 */
function toApiWelcomeResult(result: WelcomeResult): Array<{ tag: string; success: boolean; error?: string }> {
  const apiResult: Array<{ tag: string; success: boolean; error?: string }> = [];

  for (const sent of result.sentWelcomes) {
    apiResult.push({ tag: sent.tag, success: true });
  }

  for (const tag of result.skippedTags) {
    apiResult.push({ tag, success: true }); // Skipped is still "success" (no error)
  }

  for (const err of result.errors) {
    apiResult.push({ tag: err.tag, success: false, error: err.error });
  }

  return apiResult;
}

@Route('users')
@Tags('Users')
@Security('api_key')
export class UsersController extends Controller {
  /**
   * Register or update a user
   *
   * Creates a new user or updates an existing user with the provided tags.
   * If sessionId is provided and new tags are added, sends welcome messages
   * for those tags.
   *
   * @summary Register or update a user with tags
   * @param body User registration data
   */
  @Post('register')
  @SuccessResponse(200, 'User registered successfully')
  @Response<BaseResponse>(400, 'Invalid request')
  @Response<BaseResponse>(500, 'Internal server error')
  public async registerUser(@Body() body: RegisterUserRequest): Promise<RegisterUserResponse> {
    try {
      const { identifier, platform: platformParam, name, pushname, tags, sessionId } = body;

      if (!identifier) {
        this.setStatus(400);
        return {
          success: false,
          error: 'identifier is required',
        };
      }

      const platform: WhatsAppPlatform = (platformParam && isValidPlatform(platformParam))
        ? platformParam
        : DEFAULT_PLATFORM;

      const result = await stateManager.registerUser(identifier, platform, {
        name,
        pushname,
        tags: tags?.map((t) => t.trim()).filter((t) => t.length > 0),
      });

      // Send welcome messages for newly added tags (if sessionId provided)
      let welcomeResult: Array<{ tag: string; success: boolean; error?: string }> | null = null;
      if (result.newTags.length > 0 && sessionId && welcomeService) {
        const internalResult = await welcomeService.sendWelcomeForNewTags(
          identifier,
          platform,
          result.newTags,
          sessionId
        );
        welcomeResult = toApiWelcomeResult(internalResult);
      }

      return {
        success: true,
        user: toApiUser(result.user),
        isNew: result.isNew,
        newTags: result.newTags,
        welcomeResult,
      };
    } catch (error: unknown) {
      console.error('User registration error:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * List all users
   *
   * Returns all registered users, optionally filtered by tag.
   *
   * @summary List users, optionally filtered by tag
   * @param tag Optional tag to filter users by
   */
  @Get('list')
  @Response<BaseResponse>(500, 'Internal server error')
  public async listUsers(@Query() tag?: string): Promise<ListUsersResponse> {
    try {
      const users = tag
        ? await stateManager.getUsersByTag(tag)
        : await stateManager.getUsers();

      return {
        success: true,
        users: users.map(toApiUser),
        total: users.length,
        ...(tag && { filteredByTag: tag }),
      };
    } catch (error: unknown) {
      console.error('User list error:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Get all unique tags
   *
   * Returns all unique tags that have been assigned to users.
   *
   * @summary List all unique user tags
   */
  @Get('tags')
  @Response<BaseResponse>(500, 'Internal server error')
  public async getAllTags(): Promise<ListUserTagsResponse> {
    try {
      const tags = await stateManager.getAllTags();

      return {
        success: true,
        tags,
        total: tags.length,
      };
    } catch (error: unknown) {
      console.error('Get tags error:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Get a user by identifier
   *
   * Returns the user with the specified identifier (phone number or group ID).
   *
   * @summary Get user by identifier
   * @param identifier Phone number or group ID (e.g., "254722833440")
   */
  @Get()
  @Response<BaseResponse>(400, 'Invalid request')
  @Response<BaseResponse>(404, 'User not found')
  @Response<BaseResponse>(500, 'Internal server error')
  public async getUser(@Query() identifier: string): Promise<GetUserResponse> {
    try {
      if (!identifier) {
        this.setStatus(400);
        return {
          success: false,
          error: 'identifier query parameter is required',
        };
      }

      const user = await stateManager.getUser(identifier);

      if (!user) {
        this.setStatus(404);
        return {
          success: false,
          error: 'User not found',
        };
      }

      return {
        success: true,
        user: toApiUser(user),
      };
    } catch (error: unknown) {
      console.error('Get user error:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Add tags to a user
   *
   * Adds the specified tags to an existing user.
   *
   * @summary Add tags to a user
   * @param body Identifier and tags to add
   */
  @Post('tags')
  @Response<BaseResponse>(400, 'Invalid request')
  @Response<BaseResponse>(404, 'User not found')
  @Response<BaseResponse>(500, 'Internal server error')
  public async addTags(
    @Body() body: ModifyTagsRequest
  ): Promise<ModifyTagsResponse> {
    try {
      const { identifier, tags } = body;

      if (!identifier) {
        this.setStatus(400);
        return {
          success: false,
          error: 'identifier is required',
        };
      }

      if (!tags || !Array.isArray(tags) || tags.length === 0) {
        this.setStatus(400);
        return {
          success: false,
          error: 'tags array is required and must not be empty',
        };
      }

      const normalizedTags = tags.map((t) => t.trim()).filter((t) => t.length > 0);

      if (normalizedTags.length === 0) {
        this.setStatus(400);
        return {
          success: false,
          error: 'tags array must contain at least one non-empty tag',
        };
      }

      const user = await stateManager.addTags(identifier, normalizedTags);

      if (!user) {
        this.setStatus(404);
        return {
          success: false,
          error: 'User not found',
        };
      }

      return {
        success: true,
        user: toApiUser(user),
        addedTags: normalizedTags,
      };
    } catch (error: unknown) {
      console.error('Add tags error:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Remove tags from a user
   *
   * Removes the specified tags from an existing user.
   *
   * @summary Remove tags from a user
   * @param body Identifier and tags to remove
   */
  @Delete('tags')
  @Response<BaseResponse>(400, 'Invalid request')
  @Response<BaseResponse>(404, 'User not found')
  @Response<BaseResponse>(500, 'Internal server error')
  public async removeTags(
    @Body() body: ModifyTagsRequest
  ): Promise<ModifyTagsResponse> {
    try {
      const { identifier, tags } = body;

      if (!identifier) {
        this.setStatus(400);
        return {
          success: false,
          error: 'identifier is required',
        };
      }

      if (!tags || !Array.isArray(tags) || tags.length === 0) {
        this.setStatus(400);
        return {
          success: false,
          error: 'tags array is required and must not be empty',
        };
      }

      const normalizedTags = tags.map((t) => t.trim()).filter((t) => t.length > 0);

      if (normalizedTags.length === 0) {
        this.setStatus(400);
        return {
          success: false,
          error: 'tags array must contain at least one non-empty tag',
        };
      }

      const user = await stateManager.removeTags(identifier, normalizedTags);

      if (!user) {
        this.setStatus(404);
        return {
          success: false,
          error: 'User not found',
        };
      }

      return {
        success: true,
        user: toApiUser(user),
        removedTags: normalizedTags,
      };
    } catch (error: unknown) {
      console.error('Remove tags error:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }
}
