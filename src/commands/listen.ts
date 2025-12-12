import chalk from 'chalk';
import ora from 'ora';
import { AuthManager } from '../modules/auth.js';
import { ApiClient } from '../modules/api.js';
import { WebSocketClient } from '../lib/api/websocket.js';
import { handleError } from '../utils/errors.js';

interface SessionMonitor {
  taskId: string;
  projectName: string;
  messageCount: number;
  lastMessageTime: string;
  isActive: boolean;
}

export async function listenCommand(): Promise<void> {
  const authManager = new AuthManager();

  if (!authManager.isAuthenticated()) {
    console.log(chalk.red('❌ Not authenticated. Please run: codevf login'));
    process.exit(1);
  }

  const apiClient = new ApiClient(authManager);

  try {
    const spinner = ora('Initializing session monitor...').start();

    // Fetch available projects as potential sessions
    const projects = await apiClient.getProjects();
    spinner.stop();

    if (!projects.projects || projects.projects.length === 0) {
      console.log(chalk.yellow('⚠️  No active projects to monitor.'));
      return;
    }

    // Create monitors for each project with active tasks
    const monitors: Map<string, SessionMonitor> = new Map();
    const wsClients: Map<string, WebSocketClient> = new Map();

    console.log(chalk.bold.cyan('🎧 Session Monitor Started\n'));
    console.log(chalk.dim(`Monitoring ${projects.projects.length} projects. Press Ctrl+C to exit.\n`));

    const token = authManager.getAccessToken();

    for (const project of projects.projects.slice(0, 5)) {
      // Monitor up to 5 projects
      const monitor: SessionMonitor = {
        taskId: project.id,
        projectName: project.name,
        messageCount: 0,
        lastMessageTime: new Date().toLocaleTimeString(),
        isActive: true,
      };

      monitors.set(project.id, monitor);

      // Try to connect to each project's WebSocket
      try {
        const wsUrl = apiClient.getWebSocketUrl(project.id, token);
        const wsClient = new WebSocketClient(wsUrl);

        wsClient.on('engineer_message', (message: any) => {
          const monitor = monitors.get(project.id);
          if (!monitor) return;

          monitor.messageCount++;
          monitor.lastMessageTime = new Date().toLocaleTimeString();

          const senderLabel = chalk.magenta('🔵 Engineer');

          console.log(
            chalk.dim(`[${monitor.lastMessageTime}] `) +
              chalk.bold(`${monitor.projectName}`) +
              chalk.dim(` (${project.id})\n`) +
              `${senderLabel}: ${message.text || message}\n`
          );
        });

        wsClient.on('billing_update', (update: any) => {
          const monitor = monitors.get(project.id);
          if (!monitor) return;

          console.log(
            chalk.dim(`[${new Date().toLocaleTimeString()}] `) +
              chalk.bold(`${monitor.projectName}`) +
              chalk.dim(` 💳 ${update.creditsUsed} credits (${update.duration})\n`)
          );
        });

        wsClient.on('closure_request', () => {
          const monitor = monitors.get(project.id);
          if (!monitor) return;

          monitor.isActive = false;
          console.log(
            chalk.yellow(
              `⚠️  Session ${project.id} ending.\n`
            )
          );
        });

        wsClient.on('error', (error: any) => {
          console.log(
            chalk.yellow(
              `[Warning] Cannot monitor ${project.name}: ${error.message || error}`
            )
          );
        });

        // Start connection
        wsClient.connect().catch(() => {
          // Silent fail for inactive sessions
        });

        wsClients.set(project.id, wsClient);
      } catch (error) {
        console.error(
          chalk.dim(`Skipping ${project.name}: Not an active session`)
        );
      }
    }

    // Print periodic status
    const statusInterval = setInterval(() => {
      console.log(chalk.bold.cyan('\n📊 Session Status:\n'));
      monitors.forEach((monitor) => {
        const status = monitor.isActive ? chalk.green('🟢 Active') : chalk.gray('⚫ Ended');
        console.log(
          `${status} ${chalk.bold(monitor.projectName)} - ` +
            `${monitor.messageCount} messages, ` +
            `last: ${monitor.lastMessageTime}`
        );
      });
      console.log('');
    }, 30000); // Print status every 30 seconds

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      clearInterval(statusInterval);
      console.log(chalk.yellow('\n\n👋 Closing monitoring connections...\n'));

      wsClients.forEach((client) => {
        client.disconnect();
      });

      console.log(chalk.green('✓ Monitor closed.\n'));
      process.exit(0);
    });
  } catch (error) {
    handleError(error);
  }
}

