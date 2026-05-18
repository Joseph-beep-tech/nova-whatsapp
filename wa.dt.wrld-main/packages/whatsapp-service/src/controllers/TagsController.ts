/**
 * Tags Controller
 *
 * Provides tag configuration management for smart routing.
 * Tags control how messages are routed to different handlers.
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
import { eventRouter } from '../services/eventRouter';
import { getErrorMessage } from '../types/webhook';
import {
  SetTagConfigRequest,
  ListTagConfigsResponse,
  TagConfigResponse,
  DeleteTagConfigResponse,
  BaseResponse,
} from '../types/api';

@Route('tags')
@Tags('Tags')
@Security('api_key')
export class TagsController extends Controller {
  /**
   * List all tag configurations
   *
   * Returns all configured tags with their routing settings.
   *
   * @summary List all tag configurations
   */
  @Get('configs')
  @Response<BaseResponse>(500, 'Internal server error')
  public async listConfigs(): Promise<ListTagConfigsResponse> {
    try {
      const configs = await eventRouter.getAllTagConfigurations();

      return {
        success: true,
        configs,
        total: configs.length,
      };
    } catch (error: unknown) {
      console.error('Error getting tag configs:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Get tag configuration
   *
   * Returns the configuration for a specific tag.
   *
   * @summary Get configuration for a tag
   * @param tag Tag name (case-insensitive, will be uppercased)
   */
  @Get('{tag}/config')
  @Response<BaseResponse>(400, 'Invalid request')
  @Response<BaseResponse>(404, 'Tag configuration not found')
  @Response<BaseResponse>(500, 'Internal server error')
  public async getConfig(@Path() tag: string): Promise<TagConfigResponse> {
    try {
      if (!tag) {
        this.setStatus(400);
        return {
          success: false,
          error: 'Tag is required',
        };
      }

      const configs = await eventRouter.getTagConfigurations([tag.toUpperCase()]);
      const config = configs[0];

      if (!config) {
        this.setStatus(404);
        return {
          success: false,
          error: `No configuration found for tag: ${tag}`,
        };
      }

      return {
        success: true,
        config,
      };
    } catch (error: unknown) {
      console.error('Error getting tag config:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Set tag configuration
   *
   * Creates or updates the configuration for a tag. The configuration
   * controls how messages from users with this tag are routed.
   *
   * @summary Create or update tag configuration
   * @param tag Tag name (case-insensitive, will be uppercased)
   * @param body Tag configuration data
   */
  @Post('{tag}/config')
  @SuccessResponse(200, 'Configuration saved')
  @Response<BaseResponse>(400, 'Invalid request')
  @Response<BaseResponse>(500, 'Internal server error')
  public async setConfig(
    @Path() tag: string,
    @Body() body: SetTagConfigRequest
  ): Promise<TagConfigResponse> {
    try {
      if (!tag) {
        this.setStatus(400);
        return {
          success: false,
          error: 'Tag is required',
        };
      }

      // Validate routing target if provided
      if (body.routing?.target) {
        const target = body.routing.target;
        if (!target.type) {
          this.setStatus(400);
          return {
            success: false,
            error: 'Routing target must have a type',
          };
        }

        const validTypes = ['n8n_webhook', 'qdrant_rag', 'local_handler', 'passthrough'];
        if (!validTypes.includes(target.type)) {
          this.setStatus(400);
          return {
            success: false,
            error: `Invalid routing target type. Must be one of: ${validTypes.join(', ')}`,
          };
        }
      }

      const savedConfig = await eventRouter.setTagConfiguration(tag.toUpperCase(), {
        enabled: body.enabled ?? true,
        displayName: body.displayName,
        welcomeMessage: body.welcomeMessage,
        routing: body.routing,
        memory: body.memory,
        lms: body.lms,
        kb: body.kb,
      });

      return {
        success: true,
        config: savedConfig,
      };
    } catch (error: unknown) {
      console.error('Error setting tag config:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Delete tag configuration
   *
   * Removes the configuration for a tag. Messages from users
   * with this tag will fall through to default routing.
   *
   * @summary Delete tag configuration
   * @param tag Tag name (case-insensitive, will be uppercased)
   */
  @Delete('{tag}/config')
  @SuccessResponse(200, 'Configuration deleted')
  @Response<BaseResponse>(400, 'Invalid request')
  @Response<BaseResponse>(404, 'Tag configuration not found')
  @Response<BaseResponse>(500, 'Internal server error')
  public async deleteConfig(@Path() tag: string): Promise<DeleteTagConfigResponse> {
    try {
      if (!tag) {
        this.setStatus(400);
        return {
          success: false,
          error: 'Tag is required',
        };
      }

      const deleted = await eventRouter.deleteTagConfiguration(tag.toUpperCase());

      if (!deleted) {
        this.setStatus(404);
        return {
          success: false,
          error: `No configuration found for tag: ${tag}`,
        };
      }

      return {
        success: true,
        tag: tag.toUpperCase(),
        deleted: true,
      };
    } catch (error: unknown) {
      console.error('Error deleting tag config:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }
}
