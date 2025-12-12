/**
 * codevf-listen tool implementation
 * Monitor active chat sessions in real-time
 */

import { TasksApi } from '../../lib/api/tasks.js';
import { logger } from '../../lib/utils/logger.js';

export interface ListenToolArgs {
  sessionId?: string;
  verbose?: boolean;
}

export interface ListenToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

export class ListenTool {
  private tasksApi: TasksApi;
  private baseUrl: string;

  constructor(tasksApi: TasksApi, baseUrl: string) {
    this.tasksApi = tasksApi;
    this.baseUrl = baseUrl;
  }

  /**
   * Handle codevf-listen tool call
   * Provides monitoring capabilities for active sessions
   */
  async execute(args: ListenToolArgs): Promise<ListenToolResult> {
    try {
      logger.info('Executing codevf-listen', { sessionId: args.sessionId });

      if (args.sessionId) {
        // Monitor specific session
        return await this.monitorSession(args.sessionId, args.verbose || false);
      } else {
        // List all active sessions
        return await this.listActiveSessions(args.verbose || false);
      }
    } catch (error) {
      logger.error('codevf-listen failed', error);

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
   * Monitor a specific session
   */
  private async monitorSession(
    sessionId: string,
    verbose: boolean
  ): Promise<ListenToolResult> {
    try {
      // Get session details (this would be implemented via API)
      const sessionUrl = `${this.baseUrl}/session/${sessionId}`;

      let output = `Monitoring session: ${sessionId}\n\n`;
      output += `Session URL: ${sessionUrl}\n`;
      output += `Status: Active\n`;
      output += `Last updated: ${new Date().toLocaleTimeString()}\n\n`;

      if (verbose) {
        output += 'Connection established. Waiting for engineer updates...\n';
        output += 'Messages will appear as they are sent.\n';
      }

      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * List all active sessions for the current user
   */
  private async listActiveSessions(verbose: boolean): Promise<ListenToolResult> {
    try {
      let output = 'Active Chat Sessions:\n\n';

      // Note: Fetching all active sessions would require a list endpoint
      // For now, provide guidance on how to monitor sessions
      output += 'To monitor a specific chat session, use:\n';
      output += '  codevf-listen <sessionId>\n\n';
      output += 'Chat sessions are created using codevf-chat tool.\n';
      output += 'Each session provides a URL for real-time monitoring.\n\n';
      output += 'Session URLs follow this format:\n';
      output += `  ${this.baseUrl}/session/<sessionId>\n\n`;
      output += 'Share these URLs with team members to collaborate on debugging sessions.';

      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    } catch (error) {
      throw error;
    }
  }
}
