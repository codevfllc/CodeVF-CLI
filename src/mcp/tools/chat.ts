/**
 * codevf-chat tool implementation
 * Extended collaboration sessions
 */

import { TasksApi } from '../../lib/api/tasks.js';
import { ProjectsApi } from '../../lib/api/projects.js';
import { logger } from '../../lib/utils/logger.js';
import axios from 'axios';

export interface FileAttachment {
  fileName: string;
  content: string; // base64 encoded for binary files, raw text for text files
  mimeType: string;
}

export interface ChatToolArgs {
  message: string;
  maxCredits?: number;
  attachments?: FileAttachment[];
  assignmentTimeoutSeconds?: number;
}

export interface ChatToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

export class ChatTool {
  private tasksApi: TasksApi;
  private projectsApi: ProjectsApi;
  private baseUrl: string;

  constructor(tasksApi: TasksApi, projectsApi: ProjectsApi, baseUrl: string) {
    this.tasksApi = tasksApi;
    this.projectsApi = projectsApi;
    this.baseUrl = baseUrl;
  }

  /**
   * Handle codevf-chat tool call
   */
  async execute(args: ChatToolArgs): Promise<ChatToolResult> {
    try {
      logger.info('Executing codevf-chat', {
        message: args.message,
        attachmentCount: args.attachments?.length || 0
      });

      // Validate credits
      const maxCredits = args.maxCredits || 240;
      if (maxCredits < 4 || maxCredits > 1920) {
        return {
          content: [
            {
              type: 'text',
              text: 'Error: maxCredits must be between 4 and 1920 for chat sessions',
            },
          ],
          isError: true,
        };
      }

      // Validate and normalize timeout (default 300 seconds = 5 minutes)
      let assignmentTimeoutSeconds = 300; // Default
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
                text: 'Error: Maximum 5 attachments allowed per chat session',
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
          } catch (error) {
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

      // Get or create a project for this task
      logger.info('Getting or creating project for chat session');
      const project = await this.projectsApi.getOrCreateDefault();
      logger.info('Using project', { projectId: project.id, repoUrl: project.repoUrl });

      // Create task
      logger.info('Chat tool creating task', { message: args.message, maxCredits });

      const task = await this.tasksApi.create({
        message: args.message,
        taskMode: 'realtime_chat',
        maxCredits,
        projectId: project.id.toString(),
        assignmentTimeoutSeconds,
      });

      logger.info('Chat task created', { taskId: task.taskId });

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

      // Return session URL for extended collaboration
      const sessionUrl = `${this.baseUrl}/engineer/tasks/${task.taskId}`;

      let response = `Chat session started successfully!\n\n`;
      response += `Task ID: ${task.taskId}\n`;
      response += `Max Credits: ${maxCredits}\n`;
      response += `Mode: Real-time Chat\n`;

      if (args.attachments && args.attachments.length > 0) {
        response += `Attachments: ${args.attachments.length} file(s) shared with engineer\n`;
      }

      response += `\nEngineer Session URL: ${sessionUrl}\n\n`;
      response += `This session will remain active until:\n`;
      response += `- Maximum credits are reached (${maxCredits})\n`;
      response += `- Engineer marks the task as completed\n`;
      response += `- Session timeout (4 hours)\n\n`;

      if (task.warning) {
        response += `⚠️  ${task.warning}\n\n`;
      }

      response += `The engineer can now see your message`;
      if (args.attachments && args.attachments.length > 0) {
        response += ` and ${args.attachments.length} attachment(s)`;
      }
      response += ` and will respond via the CLI interface.`;

      return {
        content: [
          {
            type: 'text',
            text: response,
          },
        ],
      };
    } catch (error) {
      logger.error('codevf-chat failed', error);

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
          mimeType: attachment.mimeType
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
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.data.success) {
          throw new Error(response.data.error || 'Upload failed');
        }

        logger.info('Attachment uploaded successfully', {
          fileName: attachment.fileName,
          size: response.data.data?.size || 0
        });
      } catch (error) {
        logger.error('Failed to upload attachment', {
          fileName: attachment.fileName,
          error: (error as any).message
        });
        throw new Error(`Failed to upload ${attachment.fileName}: ${(error as any).message}`);
      }
    }
  }

  /**
   * Format chat session info
   */
  private formatResponse(
    task: {
      actionId: number;
      creditsRemaining: number;
      warning?: string;
    },
    maxCredits: number
  ): string {
    const sessionUrl = `${this.baseUrl}/session/${task.actionId}`;

    let output = 'Chat session started with engineer.\n\n';
    output += `Session URL: ${sessionUrl}\n\n`;
    output += 'Share this link with your user to monitor the conversation.\n\n';
    output += `Max credits: ${maxCredits}\n`;
    output += `Rate: 2 credits/minute\n`;
    output += `Estimated duration: ${Math.floor(maxCredits / 2)} minutes\n`;

    if (task.warning) {
      output += `\n⚠️  ${task.warning}\n`;
    }

    output += `\nCredits remaining: ${task.creditsRemaining}\n`;

    return output;
  }
}
