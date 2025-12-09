/**
 * Task creation and management API wrapper
 */

import { ApiClient } from './client.js';
import { InsufficientCreditsError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export type TaskMode = 'realtime_answer' | 'realtime_chat' | 'fast' | 'standard';

export interface CreateTaskOptions {
  message: string;
  taskMode: TaskMode;
  maxCredits: number;
  projectId?: string;
  contextData?: any;
  initiatedBy?: string;
}

export interface CreateTaskResult {
  taskId: string;
  actionId: number;
  estimatedWaitTime: number;
  creditsRemaining: number;
  maxCreditsAllocated: number;
  warning?: string;
}

export class TasksApi {
  private client: ApiClient;
  private baseUrl: string;
  private defaultProjectId: string;

  constructor(client: ApiClient, baseUrl: string, defaultProjectId?: string) {
    this.client = client;
    this.baseUrl = baseUrl;
    this.defaultProjectId = defaultProjectId || '1'; // Default project ID
  }

  /**
   * Create a new task
   */
  async create(options: CreateTaskOptions): Promise<CreateTaskResult> {
    logger.info('Creating task', {
      mode: options.taskMode,
      maxCredits: options.maxCredits,
    });

    const response = await this.client.post('/api/cli/tasks/create', {
      issueDescription: options.message,
      taskMode: options.taskMode,
      maxCredits: options.maxCredits,
      projectId: options.projectId || this.defaultProjectId,
      contextData: options.contextData ? JSON.stringify(options.contextData) : null,
      initiatedBy: options.initiatedBy || 'ai_tool',
      autoApproveCommands: false,
    });

    if (!response.success || !response.data) {
      // Check for credit errors
      if (response.error?.includes('No credits available')) {
        const pricingUrl = `${this.baseUrl}/pricing`;
        throw new InsufficientCreditsError(0, options.maxCredits, pricingUrl);
      }

      throw new Error(response.error || 'Failed to create task');
    }

    logger.info('Task created', {
      taskId: response.data.taskId,
      actionId: response.data.actionId,
    });

    return {
      taskId: response.data.taskId,
      actionId: response.data.actionId,
      estimatedWaitTime: response.data.estimatedWaitTime,
      creditsRemaining: response.data.creditsRemaining,
      maxCreditsAllocated: response.data.maxCreditsAllocated,
      warning: response.warning,
    };
  }

  /**
   * Get task status
   */
  async getStatus(taskId: string): Promise<any> {
    logger.debug('Getting task status', { taskId });
    const response = await this.client.get(`/api/cli/tasks/${taskId}/status`);

    if (!response.success) {
      throw new Error(response.error || 'Failed to get task status');
    }

    return response.data;
  }
}
