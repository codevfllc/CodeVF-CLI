/**
 * codevf-instant tool implementation
 * Quick validation queries with single response
 */

import { TasksApi, CreateTaskResult } from '../../lib/api/tasks.js';
import { ProjectsApi } from '../../lib/api/projects.js';
import { ApiClient } from '../../lib/api/client.js';
import axios from 'axios';
import { checkForActiveTasks } from './task-checker.js';
import { logger } from '../../lib/utils/logger.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export interface FileAttachment {
  fileName: string;
  content: string; // base64 encoded for binary files, raw text for text files
  mimeType: string;
}

export interface InstantToolArgs {
  message: string;
  maxCredits?: number;
  attachments?: FileAttachment[];
  assignmentTimeoutSeconds?: number;
  continueTaskId?: string;
  decision?: 'override' | 'followup';
  tagId?: number; // Engineer expertise level: 1=Engineer (1.7x), 4=Vibe Coder (1.5x), 5=General Purpose (1.0x, default)
}

export type InstantToolResult = CallToolResult;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export class InstantTool {
  private tasksApi: TasksApi;
  private projectsApi: ProjectsApi;
  private apiClient: ApiClient;
  private baseUrl: string;

  constructor(tasksApi: TasksApi, projectsApi: ProjectsApi, apiClient: ApiClient, baseUrl: string) {
    this.tasksApi = tasksApi;
    this.projectsApi = projectsApi;
    this.apiClient = apiClient;
    this.baseUrl = baseUrl;
  }

  /**
   * Handle codevf-instant tool call
   */
  async execute(args: InstantToolArgs): Promise<InstantToolResult> {
    try {
      logger.info('Executing codevf-instant', {
        message: args.message,
        attachmentCount: args.attachments?.length || 0,
        continueTaskId: args.continueTaskId,
        decision: args.decision,
      });

      // Get or create a project for this task
      logger.info('Getting or creating project for instant query');
      const project = await this.projectsApi.getOrCreateDefault();
      logger.info('Using project', { projectId: project.id, repoUrl: project.repoUrl });

      // Check for active tasks and ask user for preference
      const taskCheck = await checkForActiveTasks(
        this.tasksApi,
        project.id.toString(),
        args.continueTaskId,
        'instant',
        args.message
      );

      if (taskCheck.shouldPromptUser) {
        const task = taskCheck.decision?.existingTask;
        const options = taskCheck.decision?.options;
        const agentInstruction = taskCheck.decision?.agentInstruction;

        // If no decision was provided, ask the user
        if (!args.decision) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    agentInstruction,
                    activeTask: task,
                    options: options,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // Handle the user's decision
        logger.info('Processing user decision', { decision: args.decision, taskId: task?.id });

        switch (args.decision) {
          case 'override':
            logger.info('User chose to override existing task');
            // Close the old task before creating new one
            if (task?.id) {
              try {
                logger.info('Overriding existing task', { taskId: task.id });
                await this.apiClient.request(`/api/cli/tasks/${task.id}/override`, {
                  method: 'POST',
                });
                logger.info('Task overridden successfully');
              } catch (err) {
                logger.error('Failed to override task', err);
              }
            }
            // Continue to create new task and poll for response
            break;
          case 'followup':
            logger.info('User chose to add as follow-up to existing task');
            // Create a follow-up task linked to the existing task
            if (task?.id) {
              return await this.createAndPollFollowupTask(
                task.id,
                project.id.toString(),
                args.message,
                args.maxCredits,
                args.assignmentTimeoutSeconds
              );
            }
            break;
        }
      }

      // If we have a task to resume, continue with it instead of creating a new one
      if (!taskCheck.shouldPromptUser && taskCheck.taskToResumeId) {
        // If a decision was provided with continueTaskId, handle it
        if (args.decision) {
          logger.info('Processing decision with continued task', {
            decision: args.decision,
            taskId: taskCheck.taskToResumeId,
          });

          switch (args.decision) {
            case 'followup':
              logger.info('User chose to add as follow-up to continued task');
              return await this.createAndPollFollowupTask(
                taskCheck.taskToResumeId,
                project.id.toString(),
                args.message,
                args.maxCredits,
                args.assignmentTimeoutSeconds
              );
            case 'override':
              logger.info('User chose to override continued task');
              try {
                logger.info('Overriding existing task', {
                  taskId: taskCheck.taskToResumeId,
                });
                await this.apiClient.request(
                  `/api/cli/tasks/${taskCheck.taskToResumeId}/override`,
                  {
                    method: 'POST',
                  }
                );
                logger.info('Task overridden successfully');
              } catch (err) {
                logger.error('Failed to override task', err);
              }
              // Continue to create new task and poll for response
              break;
          }
        }

        // No decision provided, just resume the task
        logger.info('Resuming existing task', { taskId: taskCheck.taskToResumeId });

        logger.info('Waiting for engineer response via polling...');

        // Wait for response (5 min timeout)
        const response = await this.tasksApi.waitForResponse(taskCheck.taskToResumeId, {
          timeoutMs: 300000,
          pollIntervalMs: 3000,
        });

        logger.info('Response received', { taskId: taskCheck.taskToResumeId });

        return {
          content: [
            {
              type: 'text',
              text: response.text,
            },
          ],
        };
      }

      // Validate credits
      const maxCredits = args.maxCredits || 10;
      if (maxCredits < 1 || maxCredits > 10) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: maxCredits must be between 1 and 10 for instant queries',
            },
          ],
          isError: true,
        };
      }

      // Validate and normalize timeout (default 300 seconds = 5 minutes for Claude agent)
      let assignmentTimeoutSeconds = 300; // Always default to 5 minutes for Claude agent
      if (args.assignmentTimeoutSeconds !== undefined) {
        if (typeof args.assignmentTimeoutSeconds !== 'number') {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: assignmentTimeoutSeconds must be a number',
              },
            ],
            isError: true,
          };
        }
        // Allow 30 seconds to 30 minutes (1800 seconds)
        assignmentTimeoutSeconds = Math.min(Math.max(args.assignmentTimeoutSeconds, 30), 1800);
      }

      // Validate attachments
      if (args.attachments) {
        if (args.attachments.length > 5) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: Maximum 5 attachments allowed per instant query',
              },
            ],
            isError: true,
          };
        }

        for (const attachment of args.attachments) {
          if (!attachment.fileName || !attachment.content || !attachment.mimeType) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'Error: Each attachment must have fileName, content, and mimeType',
                },
              ],
              isError: true,
            };
          }

          // Validate file size (10MB for images/PDFs, 1MB for text)
          const isImage = attachment.mimeType.startsWith('image/');
          const isPdf = attachment.mimeType === 'application/pdf';
          const maxSize = isImage || isPdf ? 10 * 1024 * 1024 : 1 * 1024 * 1024;

          let fileSize = 0;
          try {
            if (isImage || isPdf) {
              fileSize = Buffer.from(attachment.content, 'base64').length;
            } else {
              fileSize = Buffer.byteLength(attachment.content, 'utf8');
            }
          } catch {
            return {
              content: [
                {
                  type: 'text',
                  text: `Error: Invalid content encoding for file ${attachment.fileName}`,
                },
              ],
              isError: true,
            };
          }

          if (fileSize > maxSize) {
            const maxSizeMB = Math.round(maxSize / (1024 * 1024));
            return {
              content: [
                {
                  type: 'text',
                  text: `Error: File ${attachment.fileName} is too large (max ${maxSizeMB}MB for ${isImage ? 'images' : isPdf ? 'PDFs' : 'text files'})`,
                },
              ],
              isError: true,
            };
          }
        }
      }

      // Create task
      const task = await this.tasksApi.create({
        message: args.message,
        taskMode: 'realtime_answer',
        maxCredits,
        projectId: project.id.toString(),
        assignmentTimeoutSeconds,
        tagId: args.tagId, // Engineer expertise level (defaults to General Purpose if not specified)
      });

      logger.info('Task created', { taskId: task.taskId });

      // Upload attachments if provided
      if (args.attachments && args.attachments.length > 0) {
        logger.info('Uploading attachments', { count: args.attachments.length });

        try {
          await this.uploadAttachments(task.taskId, args.attachments);
          logger.info('All attachments uploaded successfully');
        } catch (uploadError) {
          logger.error('Failed to upload attachments', uploadError);
          return {
            content: [
              {
                type: 'text',
                text: `Error: Failed to upload attachments: ${(uploadError as Error).message}`,
              },
            ],
            isError: true,
          };
        }
      }

      // Show warning if low balance
      if (task.warning) {
        logger.warn('Credit warning', { warning: task.warning });
      }

      logger.info('Waiting for engineer response via polling...');

      // Wait for response (5 min timeout)
      const response = await this.tasksApi.waitForResponse(task.taskId, {
        timeoutMs: 300000,
        pollIntervalMs: 3000,
      });

      // Format response
      const formattedResponse = this.formatResponse(response);

      return {
        content: [
          {
            type: 'text',
            text: formattedResponse,
          },
        ],
      };
    } catch (error) {
      logger.error('codevf-instant failed', error);

      return {
        content: [
          {
            type: 'text',
            text: `Error: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Upload attachments for a task
   */
  private async uploadAttachments(taskId: string, attachments: FileAttachment[]): Promise<void> {
    // Get auth token from environment or config
    const authToken = process.env.CODEVF_AUTH_TOKEN || 'dev-token';

    for (const attachment of attachments) {
      try {
        logger.info('Uploading attachment', {
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
        });

        const response = await axios.post(
          `${this.baseUrl}/api/cli/tasks/${taskId}/upload-file`,
          {
            fileName: attachment.fileName,
            content: attachment.content,
            mimeType: attachment.mimeType,
          },
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.data.success) {
          throw new Error(response.data.error || 'Upload failed');
        }

        logger.info('Attachment uploaded successfully', {
          fileName: attachment.fileName,
          size: response.data.data?.size || 0,
        });
      } catch (error) {
        logger.error('Failed to upload attachment', {
          fileName: attachment.fileName,
          error: getErrorMessage(error),
        });
        throw new Error(`Failed to upload ${attachment.fileName}: ${getErrorMessage(error)}`);
      }
    }
  }

  /**
   * Create a follow-up task and poll for the engineer's response
   */
  private async createAndPollFollowupTask(
    parentTaskId: string,
    projectId: string,
    message: string,
    maxCredits?: number,
    assignmentTimeoutSeconds?: number
  ): Promise<InstantToolResult> {
    try {
      logger.info('Creating follow-up task', { parentTaskId });
      const followupData = (await this.apiClient.post(`/api/cli/tasks/${parentTaskId}/followup`, {
        message,
        projectId,
        maxCredits: maxCredits || 10,
        assignmentTimeoutSeconds,
      })) as { success: boolean; data: CreateTaskResult };
      logger.info('Follow-up task created', {
        followUpTaskId: followupData.data.taskId,
      });

      // Poll for response on the new follow-up task
      logger.info('Waiting for engineer response on follow-up task via polling...');
      const response = await this.tasksApi.waitForResponse(followupData.data.taskId, {
        timeoutMs: 300000,
        pollIntervalMs: 3000,
      });

      logger.info('Response received on follow-up task', {
        taskId: followupData.data.taskId,
      });

      return {
        content: [
          {
            type: 'text',
            text: response.text,
          },
        ],
      };
    } catch (err) {
      logger.error('Failed to create follow-up task', err);
      return {
        content: [
          {
            type: 'text',
            text: `Error: Failed to create follow-up task: ${(err as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Format engineer response
   */
  private formatResponse(
    response:
      | string
      | {
          text: string;
          creditsUsed?: number;
          durationSeconds?: number;
          // Allow extra properties without losing type safety for known fields
          [key: string]: unknown;
        }
  ): string {
    // If the response is already a string, return it as-is
    if (typeof response === 'string') {
      return response;
    }

    // Base text is required on the structured response
    let output = response.text ?? '';

    const metaParts: string[] = [];
    if (typeof response.creditsUsed === 'number') {
      metaParts.push(`credits used: ${response.creditsUsed}`);
    }
    if (typeof response.durationSeconds === 'number') {
      metaParts.push(`duration: ${response.durationSeconds}s`);
    }

    if (metaParts.length > 0) {
      output += `\n\n(${metaParts.join(', ')})`;
    }

    return output;
  }
}
