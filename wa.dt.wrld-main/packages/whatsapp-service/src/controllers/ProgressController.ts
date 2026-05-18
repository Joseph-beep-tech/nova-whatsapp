/**
 * Progress Controller
 *
 * Multi-tenant learning progress API for LMS/KB services.
 * All endpoints require `tag` parameter to identify the business client.
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
} from 'tsoa';
import { progressService } from '../services/learning';
import { ProgressUpdateRequest as InternalProgressUpdateRequest } from '../types/learning/api';
import { DEFAULT_PLATFORM } from '../utils/phoneNumber';
import { getErrorMessage } from '../types/webhook';
import {
  ModuleStructureResponse,
  LearnersResponse,
  ProgressResponse,
  ProgressUpdateRequest,
  ProgressUpdateResponse,
  BaseResponse,
  ApiModuleStructure,
  ApiUserLearningData,
  ApiLearnerSummary,
} from '../types/api';

@Route('progress')
@Tags('Progress')
@Security('api_key')
export class ProgressController extends Controller {
  /**
   * Get module structure for a tag
   *
   * Returns the module structure from the LMS content collection.
   * This defines the learning path for the specified tag/program.
   *
   * @summary Get module structure for a tag
   * @param tag Business client tag (e.g., "SOMO", "CompanyX")
   */
  @Get('modules')
  @Response<BaseResponse>(400, 'Bad request - tag required')
  @Response<BaseResponse>(500, 'Internal server error')
  public async getModuleStructure(@Query() tag: string): Promise<ModuleStructureResponse> {
    try {
      if (!tag) {
        this.setStatus(400);
        return {
          success: false,
          error: 'tag query parameter is required',
        };
      }

      const result = await progressService.getModuleStructure(tag);

      if (!result.success) {
        this.setStatus(400);
        return {
          success: false,
          error: result.error,
        };
      }

      return {
        success: true,
        tag: result.tag,
        programName: result.programName,
        modules: result.modules as unknown as ApiModuleStructure[],
        totalModules: result.totalModules,
      };
    } catch (error: unknown) {
      console.error('Get module structure error:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Get all learners for a tag
   *
   * Returns list of learners with their progress summaries.
   * Useful for admin dashboards to track learner progress.
   *
   * @summary Get learners for a tag
   * @param tag Business client tag (e.g., "SOMO", "CompanyX")
   */
  @Get('learners')
  @Response<BaseResponse>(400, 'Bad request - tag required')
  @Response<BaseResponse>(500, 'Internal server error')
  public async getLearners(@Query() tag: string): Promise<LearnersResponse> {
    try {
      if (!tag) {
        this.setStatus(400);
        return {
          success: false,
          error: 'tag query parameter is required',
        };
      }

      const result = await progressService.getLearnersForTag(tag);

      if (!result.success) {
        this.setStatus(400);
        return {
          success: false,
          error: result.error,
        };
      }

      return {
        success: true,
        tag,
        learners: result.learners as unknown as ApiLearnerSummary[],
        total: result.learners?.length || 0,
      };
    } catch (error: unknown) {
      console.error('Get learners error:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Get learner progress
   *
   * Returns progress data for a specific learner in a tag context.
   * Optionally includes full module structure and interaction history.
   *
   * @summary Get learner progress
   * @param identifier Phone number or group ID (e.g., "254722833440")
   * @param tag Business client tag (required)
   * @param includeModuleStructure Include full module structure from content collection
   * @param includeHistory Include recent interaction history from conversation memory
   */
  @Get()
  @Response<BaseResponse>(400, 'Bad request - identifier and tag required')
  @Response<BaseResponse>(404, 'Learner not found')
  @Response<BaseResponse>(500, 'Internal server error')
  public async getProgress(
    @Query() identifier: string,
    @Query() tag: string,
    @Query() includeModuleStructure?: boolean,
    @Query() includeHistory?: boolean
  ): Promise<ProgressResponse> {
    try {
      if (!identifier) {
        this.setStatus(400);
        return {
          success: false,
          error: 'identifier query parameter is required',
        };
      }

      if (!tag) {
        this.setStatus(400);
        return {
          success: false,
          error: 'tag query parameter is required',
        };
      }

      const result = await progressService.getProgress({
        chatId: identifier,
        tag,
        includeModuleStructure: includeModuleStructure || false,
        includeHistory: includeHistory || false,
      });

      if (!result.success) {
        const status = result.error?.includes('not found') ? 404 : 400;
        this.setStatus(status);
        return {
          success: false,
          error: result.error,
        };
      }

      return {
        success: true,
        user: result.user ? {
          identifier: result.user.chatId,
          platform: DEFAULT_PLATFORM,
          displayName: result.user.displayName,
          tags: result.user.tags,
        } : undefined,
        learning: result.learning as unknown as ApiUserLearningData,
        moduleStructure: result.moduleStructure as unknown as ApiModuleStructure[],
      };
    } catch (error: unknown) {
      console.error('Get progress error:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }

  /**
   * Update learner progress
   *
   * Updates progress for a specific learner. Can mark sections/modules as complete,
   * update current module, and merge additional metadata.
   *
   * @summary Update learner progress
   * @param body Progress update data including identifier and tag
   *
   * @example body {
   *   "identifier": "254722833440",
   *   "tag": "SOMO",
   *   "moduleId": "module-1",
   *   "sectionCompleted": "Introduction",
   *   "moduleCompleted": false,
   *   "setCurrentModule": "module-1"
   * }
   */
  @Post()
  @Response<BaseResponse>(400, 'Bad request - identifier and tag required')
  @Response<BaseResponse>(500, 'Internal server error')
  public async updateProgress(
    @Body() body: ProgressUpdateRequest
  ): Promise<ProgressUpdateResponse> {
    try {
      const { identifier, tag } = body;

      if (!identifier) {
        this.setStatus(400);
        return {
          success: false,
          error: 'identifier is required in request body',
        };
      }

      if (!tag) {
        this.setStatus(400);
        return {
          success: false,
          error: 'tag is required in request body',
        };
      }

      const internalUpdate: InternalProgressUpdateRequest = {
        tag: body.tag,
        moduleId: body.moduleId,
        sectionCompleted: body.sectionCompleted,
        moduleCompleted: body.moduleCompleted,
        setCurrentModule: body.setCurrentModule,
        metadata: body.metadata,
        context: body.context,
      };

      const result = await progressService.updateProgress(identifier, internalUpdate);

      if (!result.success) {
        this.setStatus(400);
        return {
          success: false,
          error: result.error,
        };
      }

      return {
        success: true,
        learning: result.learning as unknown as ApiUserLearningData,
        updated: {
          moduleId: body.moduleId,
          sectionCompleted: body.sectionCompleted,
          moduleCompleted: body.moduleCompleted,
          currentModule: body.setCurrentModule,
        },
      };
    } catch (error: unknown) {
      console.error('Update progress error:', getErrorMessage(error));
      this.setStatus(500);
      return {
        success: false,
        error: getErrorMessage(error),
      };
    }
  }
}
