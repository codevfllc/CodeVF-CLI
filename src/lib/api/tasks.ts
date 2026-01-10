/**
 * Task creation and management API wrapper
 */

import { ApiClient } from './client.js';
import { InsufficientCreditsError, TimeoutError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export type TaskMode = 'realtime_answer' | 'realtime_chat' | 'fast' | 'standard';

export interface CreateTaskOptions {
  message: string;
  taskMode: TaskMode;
  maxCredits: number;
  projectId?: string;
  status?: string;
  contextData?: any;
  initiatedBy?: string;
  assignmentTimeoutSeconds?: number;
  parentActionId?: string;
  tagId?: number; // Engineer expertise tag (1=Engineer 1.7x, 4=Vibe Coder 1.5x, 5=General Purpose 1.0x)
}

export interface CreateTaskResult {
  taskId: string;
  actionId: number;
  estimatedWaitTime: number;
  creditsRemaining: number;
  maxCreditsAllocated: number;
  warning?: string;
}

export interface TaskMessage {
  id?: string | number;
  sender?: string;
  content?: string;
  timestamp?: string;
}

export interface TaskStatus {
  status: string;
  actualCreditsUsed?: number | null;
  response?: string | null;
  messages?: TaskMessage[];
  completedAt?: string | null;
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
      requestedProjectId: options.projectId,
      defaultProjectId: this.defaultProjectId,
      assignmentTimeoutSeconds: options.assignmentTimeoutSeconds,
    });

    const response = await this.client.post('/api/cli/tasks/create', {
      issueDescription: options.message,
      taskMode: options.taskMode,
      maxCredits: options.maxCredits,
      status: options.status ?? 'requested',
      projectId: options.projectId || this.defaultProjectId,
      contextData: options.contextData ? JSON.stringify(options.contextData) : null,
      initiatedBy: options.initiatedBy || 'ai_tool',
      autoApproveCommands: false,
      assignmentTimeoutSeconds: options.assignmentTimeoutSeconds, // Always send if provided
      parentActionId: options.parentActionId ? parseInt(options.parentActionId) : undefined,
      tagId: options.tagId, // Engineer expertise tag (defaults to General Purpose if not specified)
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
   * Get active or requesting tasks (not completed)
   */
  async getActiveTasks(projectId?: string): Promise<any[]> {
    logger.debug('Getting active tasks', { projectId });
    const response = await this.client.post('/api/cli/tasks/active', {
      projectId: projectId || this.defaultProjectId,
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to get active tasks');
    }

    return response.data || [];
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

  /**
   * Get parent task chain up to 4 levels deep
   */
  async getParentTaskChain(projectId: string, taskId?: string): Promise<{
    taskId: string | null;
    hasParent: boolean;
    parentChain: Array<{ taskId: string; mode: string; status: string; message: string }>;
  }> {
    logger.debug('Getting parent task chain', { projectId, taskId });
    const response = await this.client.post('/api/cli/tasks/parents', {
      projectId: projectId || this.defaultProjectId,
      taskId: taskId,
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to get parent task chain');
    }

    return response.data;
  }

  /**
   * Poll for an engineer response
   */
  async waitForResponse(
    taskId: string,
    options: { timeoutMs?: number; pollIntervalMs?: number } = {}
  ): Promise<{ text: string; creditsUsed: number; duration: string }> {
    const timeoutMs = options.timeoutMs ?? 300000;
    const pollIntervalMs = options.pollIntervalMs ?? 3000;
    const startTime = Date.now();
    const seenMessageIds = new Set<string>();
    let responseText = '';
    let creditsUsed = 0;

    while (Date.now() - startTime < timeoutMs) {
      const status = (await this.getStatus(taskId)) as TaskStatus;

      if (typeof status.actualCreditsUsed === 'number') {
        creditsUsed = status.actualCreditsUsed;
      }

      if (Array.isArray(status.messages)) {
        for (const message of status.messages) {
          if (message.sender !== 'engineer') {
            continue;
          }

          const messageId = String(message.id ?? message.timestamp ?? message.content ?? '');
          if (!messageId || seenMessageIds.has(messageId)) {
            continue;
          }

          seenMessageIds.add(messageId);

          if (message.content) {
            responseText += `${message.content}\n`;
          }
        }
      }

      if (status.response && !responseText.includes(status.response)) {
        responseText += `${responseText ? '\n' : ''}${status.response}\n`;
      }

      if (status.status === 'completed') {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    if (Date.now() - startTime >= timeoutMs) {
      throw new TimeoutError('Timeout waiting for engineer response');
    }

    const duration = Math.ceil((Date.now() - startTime) / 60000);
    return {
      text: responseText.trim(),
      creditsUsed,
      duration: `${duration} min`,
    };
  }
}
