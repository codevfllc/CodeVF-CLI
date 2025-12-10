/**
 * codevf-chat tool implementation
 * Extended collaboration sessions
 */

import { TasksApi } from '../../lib/api/tasks.js';
import { logger } from '../../lib/utils/logger.js';

export interface ChatToolArgs {
  message: string;
  maxCredits?: number;
}

export interface ChatToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

export class ChatTool {
  private tasksApi: TasksApi;
  private baseUrl: string;

  constructor(tasksApi: TasksApi, baseUrl: string) {
    this.tasksApi = tasksApi;
    this.baseUrl = baseUrl;
  }

  /**
   * Handle codevf-chat tool call
   */
  async execute(args: ChatToolArgs): Promise<ChatToolResult> {
    try {
      logger.info('Executing codevf-chat', { message: args.message });

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

      // Create task
      logger.info('Chat tool creating task', { message: args.message, maxCredits });
      const task = await this.tasksApi.create({
        message: args.message,
        taskMode: 'realtime_chat',
        maxCredits,
      });

      logger.info('Chat session created', {
        taskId: task.taskId,
        actionId: task.actionId,
      });

      // Format response with session info
      const formattedResponse = this.formatResponse(task, maxCredits);

      return {
        content: [
          {
            type: 'text',
            text: formattedResponse,
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
