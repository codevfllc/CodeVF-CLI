import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { AuthManager } from '../modules/auth.js';
import { ApiClient } from '../modules/api.js';
import { handleError } from '../utils/errors.js';
import { WebSocketClient } from '../lib/api/websocket.js';

interface FileWatchState {
  lastPosition: number;
  taskId: string;
}

export async function watchLogsCommand(taskId?: string, command?: string): Promise<void> {
  const authManager = new AuthManager();

  if (!authManager.isAuthenticated()) {
    console.log('Error: Not authenticated. Please run: codevf login');
    process.exit(1);
  }

  if (!taskId) {
    console.log('Error: Task ID is required');
    console.log('Usage: codevf watch-logs <taskId> [command]');
    console.log('Example: codevf watch-logs abc123');
    console.log('Example with command: codevf watch-logs abc123 "npm run dev"');
    process.exit(1);
  }

  const logsPath = path.join(process.cwd(), 'logs.txt');
  let wsClient: WebSocketClient | null = null;
  let childProcess: any = null;

  try {
    let token: string | null = null;
    try {
      token = authManager.getAccessToken();
    } catch (authError) {
      console.error('Error getting auth token:', authError);
      process.exit(1);
    }

    if (!token) {
      console.error('Error: No authentication token found');
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

  // Clear logs file if it exists
  fs.writeFileSync(logsPath, '', 'utf-8');

  // If a command is provided, run it with log interception
  if (command) {
    console.log(`Running command: ${command}`);
    console.log(`Logs will be captured to: ${logsPath}\n`);
    
    childProcess = startCommandWithLogCapture(command, logsPath);
  } else {
    // Check if logs.txt exists
    if (!fs.existsSync(logsPath)) {
      console.log(`logs.txt not found at ${logsPath}`);
      console.log('Waiting for logs.txt to be created...');
    } else {
      console.log(`Watching logs.txt for task ${taskId}`);
    }
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

  console.log(`Watching logs for task ${taskId}`);
  console.log('Press Ctrl+C to stop');

  // Watch for file changes - watch the directory instead if file doesn't exist yet
  const watchDir = process.cwd();
  const watcher = fs.watch(watchDir, async (eventType, filename) => {
    if (filename === 'logs.txt' && eventType === 'change') {
      try {
        await sendNewLogs(watchState, wsClient);
      } catch (error) {
        console.error('Error sending logs:', error);
      }
    }
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nStopping log watcher');
    watcher.close();
    if (wsClient) {
      wsClient.disconnect();
    }
    if (childProcess) {
      childProcess.kill();
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

/**
 * Start a command and capture its output with proper object serialization
 */
function startCommandWithLogCapture(command: string, logsPath: string): any {
  const logsFile = fs.createWriteStream(logsPath, { flags: 'a' });

  // Parse command and arguments
  const [cmd, ...cmdArgs] = command.split(' ');

  const child = spawn(cmd, cmdArgs, {
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true,
  });

  // Capture stdout
  if (child.stdout) {
    child.stdout.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          const logLine = `${new Date().toISOString()} [stdout] ${line}\n`;
          logsFile.write(logLine);
          process.stdout.write(line + '\n');
        }
      }
    });
  }

  // Capture stderr
  if (child.stderr) {
    child.stderr.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          const logLine = `${new Date().toISOString()} [stderr] ${line}\n`;
          logsFile.write(logLine);
          process.stderr.write(line + '\n');
        }
      }
    });
  }

  child.on('exit', (code) => {
    const exitLine = `${new Date().toISOString()} [process] Exited with code ${code}\n`;
    logsFile.write(exitLine);
    logsFile.end();
  });

  return child;
}
