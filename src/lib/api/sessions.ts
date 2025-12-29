/**
 * Session API - Chat session management
 */

import { ApiClient } from './client.js';
import { logger } from '../utils/logger.js';

export interface SessionMessage {
  id: string;
  sender: 'customer' | 'engineer' | 'ai-assistant';
  content: string;
  timestamp: string;
}

export interface SessionData {
  sessionId: string;
  token: string;
  actionId: number;
  action: {
    id: number;
    status: string;
    mode: string;
    maxCredits: number;
    actualCreditsUsed?: number;
    projectId: number;
    engineerId?: number;
  };
  project?: {
    id: number;
    repoUrl?: string;
  };
  engineer?: {
    id: number;
    name: string;
    email: string;
  };
  messages: SessionMessage[];
  pagination?: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface SendMessageRequest {
  sender: 'customer' | 'engineer' | 'ai-assistant';
  content: string;
}

export interface SendMessageResponse {
  message: SessionMessage;
}

export class SessionsApi {
  private client: ApiClient;
  private baseUrl: string;

  constructor(client: ApiClient, baseUrl: string) {
    this.client = client;
    this.baseUrl = baseUrl;
  }

  /**
   * Get or verify session exists for a task ID
   * Task ID is just the integer ID from projectActions
   */
  async getSession(
    taskId: string | number,
    options?: { limit?: number; offset?: number }
  ): Promise<SessionData> {
    const taskIdStr = taskId.toString();
    const params = new URLSearchParams();

    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.offset) params.set('offset', options.offset.toString());

    const queryString = params.toString();
    const path = `/api/session/${taskIdStr}${queryString ? `?${queryString}` : ''}`;

    logger.debug('Getting session', { taskId: taskIdStr, path });

    const response = await this.client.get<SessionData>(path);

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get session');
    }

    logger.info('Session retrieved', {
      sessionId: response.data.sessionId,
      messageCount: response.data.messages.length,
      status: response.data.action.status,
    });

    return response.data;
  }

  /**
   * Check if a session exists for a task ID
   * Returns true if session exists and is active, false otherwise
   */
  async sessionExists(taskId: string | number): Promise<boolean> {
    try {
      const session = await this.getSession(taskId);
      const activeStatuses = [
        'requested',
        'estimated',
        'approved',
        'in_progress',
        'waiting_response',
      ];
      return activeStatuses.includes(session.action.status);
    } catch (error) {
      logger.debug('Session check failed', { taskId, error: (error as Error).message });
      return false;
    }
  }

  /**
   * Get all messages for a session
   */
  async getMessages(taskId: string | number): Promise<SessionMessage[]> {
    const taskIdStr = taskId.toString();
    const path = `/api/session/${taskIdStr}/messages`;

    logger.debug('Getting session messages', { taskId: taskIdStr });

    const response = await this.client.get<{ messages: SessionMessage[] }>(path);

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get messages');
    }

    logger.info('Messages retrieved', {
      taskId: taskIdStr,
      count: response.data.messages.length,
    });

    return response.data.messages;
  }

  /**
   * Send a message in a session
   */
  async sendMessage(taskId: string | number, request: SendMessageRequest): Promise<SessionMessage> {
    const taskIdStr = taskId.toString();
    const path = `/api/session/${taskIdStr}/messages`;

    logger.debug('Sending message', {
      taskId: taskIdStr,
      sender: request.sender,
      contentLength: request.content.length,
    });

    const response = await this.client.post<SendMessageResponse>(path, request);

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to send message');
    }

    logger.info('Message sent', {
      taskId: taskIdStr,
      messageId: response.data.message.id,
      sender: response.data.message.sender,
    });

    return response.data.message;
  }

  /**
   * Cancel a session
   */
  async cancelSession(taskId: string | number): Promise<void> {
    const taskIdStr = taskId.toString();
    const path = `/api/session/${taskIdStr}/cancel`;

    logger.debug('Cancelling session', { taskId: taskIdStr });

    const response = await this.client.post(path);

    if (!response.success) {
      throw new Error(response.error || 'Failed to cancel session');
    }

    logger.info('Session cancelled', { taskId: taskIdStr });
  }

  /**
   * Get WebSocket URL for session
   */
  getWebSocketUrl(
    taskId: string | number,
    userType: 'customer' | 'engineer' | 'ai-assistant'
  ): string {
    const wsUrl = this.baseUrl.replace('http://', 'ws://').replace('https://', 'wss://');
    return `${wsUrl}/ws?taskId=${taskId}&userType=${userType}`;
  }

  /**
   * Helper: Get session info formatted for display
   */
  async getSessionInfo(taskId: string | number): Promise<string> {
    const session = await this.getSession(taskId);

    let info = `Session: ${session.sessionId}\n`;
    info += `Status: ${session.action.status}\n`;
    info += `Mode: ${session.action.mode}\n`;
    info += `Credits: ${session.action.actualCreditsUsed || 0} / ${session.action.maxCredits}\n`;

    if (session.engineer) {
      info += `Engineer: ${session.engineer.name} (${session.engineer.email})\n`;
    } else {
      info += `Engineer: Not assigned yet\n`;
    }

    info += `Messages: ${session.messages.length}\n`;

    if (session.project?.repoUrl) {
      info += `Repository: ${session.project.repoUrl}\n`;
    }

    return info;
  }
}
