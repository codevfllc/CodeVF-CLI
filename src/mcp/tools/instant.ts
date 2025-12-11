/**
 * codevf-instant tool implementation
 * Quick validation queries with single response
 */

import { TasksApi } from '../../lib/api/tasks.js';
import { ProjectsApi } from '../../lib/api/projects.js';
import { WebSocketClient } from '../../lib/api/websocket.js';
import { TokenManager } from '../../lib/auth/token-manager.js';
import { logger } from '../../lib/utils/logger.js';

export interface InstantToolArgs {
  message: string;
  maxCredits?: number;
}

export interface InstantToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

export class InstantTool {
  private tasksApi: TasksApi;
  private projectsApi: ProjectsApi;
  private tokenManager: TokenManager;
  private baseUrl: string;

  constructor(tasksApi: TasksApi, projectsApi: ProjectsApi, tokenManager: TokenManager, baseUrl: string) {
    this.tasksApi = tasksApi;
    this.projectsApi = projectsApi;
    this.tokenManager = tokenManager;
    this.baseUrl = baseUrl;
  }

  /**
   * Handle codevf-instant tool call
   */
  async execute(args: InstantToolArgs): Promise<InstantToolResult> {
    try {
      logger.info('Executing codevf-instant', { message: args.message });

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

      // Get or create a project for this task
      logger.info('Getting or creating project for instant query');
      const project = await this.projectsApi.getOrCreateDefault();
      logger.info('Using project', { projectId: project.id, repoUrl: project.repoUrl });

      // Create task
      const task = await this.tasksApi.create({
        message: args.message,
        taskMode: 'realtime_answer',
        status: "requested",
        maxCredits,
        projectId: project.id.toString(),
      });

      logger.info('Task created', { taskId: task.taskId });

      // Show warning if low balance
      if (task.warning) {
        logger.warn('Credit warning', { warning: task.warning });
      }

      // Connect WebSocket
      const token = await this.tokenManager.getValidToken();
      const wsUrl = this.getWebSocketUrl(task.taskId, token);
      const ws = new WebSocketClient(wsUrl);

      await ws.connect();

      logger.info('Waiting for engineer response...');

      console.log(`[Debug] Running on ${wsUrl}`)

      // Wait for response (5 min timeout)
      const response = await ws.waitForResponse(300000);

      // Disconnect
      ws.disconnect();

      // Format response
      const formattedResponse = this.formatResponse(response, task.warning);

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
   * Get WebSocket connection URL
   */
  private getWebSocketUrl(taskId: string, token: string): string {
    const wsProtocol = this.baseUrl.startsWith('https://') ? 'wss://' : 'ws://';
    const host = this.baseUrl.replace(/^https?:\/\//, '');
    return `${wsProtocol}${host}/ws?taskId=${taskId}&userType=customer&token=${token}`;
  }

  /**
   * Format engineer response
   */
  private formatResponse(
    response: { text: string; creditsUsed: number; duration: string },
    warning?: string
  ): string {
    let output = 'Engineer Response:\n\n';
    output += response.text + '\n\n';
    output += '---\n';
    output += `Credits used: ${response.creditsUsed}\n`;
    output += `Session time: ${response.duration}\n`;

    if (warning) {
      output += `\n⚠️  ${warning}\n`;
    }

    return output;
  }
}
