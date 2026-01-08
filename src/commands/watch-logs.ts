import * as fs from 'fs';
import * as path from 'path';
import { AuthManager } from '../modules/auth.js';
import { ApiClient } from '../modules/api.js';
import { handleError } from '../utils/errors.js';
import { WebSocketClient } from '../lib/api/websocket.js';

interface FileWatchState {
  lastPosition: number;
  taskId: string;
}

export async function watchLogsCommand(taskId?: string): Promise<void> {
  const authManager = new AuthManager();

  if (!authManager.isAuthenticated()) {
    console.log('Error: Not authenticated. Please run: codevf login');
    process.exit(1);
  }

  if (!taskId) {
    console.log('Error: Task ID is required');
    console.log('Usage: codevf watch-logs <taskId>');
    process.exit(1);
  }

  const logsPath = path.join(process.cwd(), 'logs.txt');
  const apiClient = new ApiClient(authManager);
  let wsClient: WebSocketClient | null = null;

  try {
    const token = authManager.getAccessToken();
    if (!token) {
      console.log('Error: No authentication token found');
      process.exit(1);
    }

    const baseUrl = process.env.CODEVF_API_URL || 'http://localhost:3000';
    const wsUrl = `${baseUrl.replace(/^https?:/, 'ws:')}/ws?taskId=${taskId}&userType=customer`;

    wsClient = new WebSocketClient(wsUrl, token);
    await wsClient.connect();
  } catch (error) {
    console.error('Error connecting to WebSocket:', error);
    process.exit(1);
  }

  // Check if logs.txt exists
  if (!fs.existsSync(logsPath)) {
    console.log(`logs.txt not found at ${logsPath}`);
    console.log('Waiting for logs.txt to be created...');
  }

  const watchState: FileWatchState = {
    lastPosition: 0,
    taskId,
  };

  // Initial read if file exists
  if (fs.existsSync(logsPath)) {
    const content = fs.readFileSync(logsPath, 'utf-8');
    watchState.lastPosition = Buffer.byteLength(content, 'utf-8');
  }

  console.log(`Watching logs.txt for task ${taskId}`);
  console.log('Press Ctrl+C to stop watching');

  // Watch for file changes
  const watcher = fs.watch(logsPath, async (eventType, filename) => {
    if (eventType === 'change' && filename === 'logs.txt') {
      try {
        await sendNewLogs(watchState, wsClient);
      } catch (error) {
        console.error('Error sending logs:', error);
      }
    }
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('Stopping log watcher');
    watcher.close();
    if (wsClient) {
      wsClient.disconnect();
    }
    process.exit(0);
  });
}

async function sendNewLogs(state: FileWatchState, wsClient: WebSocketClient | null): Promise<void> {
  const logsPath = path.join(process.cwd(), 'logs.txt');

  if (!fs.existsSync(logsPath) || !wsClient) {
    return;
  }

  try {
    const content = fs.readFileSync(logsPath, 'utf-8');
    const contentBytes = Buffer.byteLength(content, 'utf-8');

    // Only send if there's new content
    if (contentBytes > state.lastPosition) {
      const newContent = content.slice(state.lastPosition);
      state.lastPosition = contentBytes;

      // Send via WebSocket
      wsClient.send({
        payload: newContent,
        type: 'customer_console_logs',
      });

      console.log(`Sent ${newContent.length} bytes of new logs to engineer`);
    }
  } catch (error) {
    // Silently ignore file read errors (file might be in use)
    if ((error as any).code !== 'ENOENT') {
      handleError(error);
    }
  }
}
