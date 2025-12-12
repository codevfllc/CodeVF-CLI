import chalk from 'chalk';
import ora from 'ora';
import { AuthManager } from '../modules/auth.js';
import { ApiClient } from '../modules/api.js';
import { WebSocketClient } from '../lib/api/websocket.js';
import { handleError } from '../utils/errors.js';
import * as readline from 'readline';

export async function chatCommand(taskId?: string): Promise<void> {
  const authManager = new AuthManager();

  if (!authManager.isAuthenticated()) {
    console.log(chalk.red('❌ Not authenticated. Please run: codevf login'));
    process.exit(1);
  }

  const apiClient = new ApiClient(authManager);
  let selectedTaskId = taskId;

  try {
    // If no taskId provided, show available tasks
    if (!selectedTaskId) {
      const spinner = ora('Fetching active tasks...').start();

      try {
        // Get available projects and tasks
        const projects = await apiClient.getProjects();
        spinner.stop();

        if (!projects.projects || projects.projects.length === 0) {
          console.log(chalk.yellow('⚠️  No active projects found.'));
          console.log(chalk.dim('Create a new project first using: codevf init'));
          return;
        }

        // Display available projects
        console.log(chalk.bold.cyan('\n📋 Available Projects:\n'));
        projects.projects.slice(0, 5).forEach((project: any, index: number) => {
          console.log(
            chalk.white(`${index + 1}. ${project.name}`)
          );
          console.log(chalk.dim(`   ID: ${project.id}\n`));
        });

        // For now, use the first project's ID
        selectedTaskId = projects.projects[0].id;
        console.log(chalk.dim(`Using project: ${chalk.bold(projects.projects[0].name)}\n`));
      } catch (error) {
        spinner?.stop();
        handleError(error);
        return;
      }
    }

    // Connect to WebSocket session
    if (selectedTaskId) {
      await connectToSession(selectedTaskId, apiClient, authManager);
    }
  } catch (error) {
    handleError(error);
  }
}

async function connectToSession(
  taskId: string,
  apiClient: ApiClient,
  authManager: AuthManager
): Promise<void> {
  const spinner = ora(`Connecting to session ${taskId}...`).start();

  try {
    const token = authManager.getAccessToken();
    const wsUrl = apiClient.getWebSocketUrl(taskId, token);

    const wsClient = new WebSocketClient(wsUrl);

    // Setup readline for user input
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    let isConnected = false;

    // Setup WebSocket handlers
    wsClient.on('connected', () => {
      isConnected = true;
      spinner.stop();
      console.log(chalk.green(`✓ Connected to task ${taskId}\n`));
      console.log(chalk.dim('Type your messages below. Press Ctrl+C to exit.\n'));
      rl.setPrompt(chalk.green('You: '));
      rl.prompt();
    });

    wsClient.on('engineer_message', (message: any) => {
      const senderLabel = chalk.magenta('Engineer');
      console.log(`\n${senderLabel}: ${message.text || message}\n`);
      if (isConnected) {
        rl.prompt();
      }
    });

    wsClient.on('billing_update', (update: any) => {
      console.log(chalk.dim(`\n💳 ${update.creditsUsed} credits used (${update.duration} min)\n`));
      if (isConnected) {
        rl.prompt();
      }
    });

    wsClient.on('closure_request', () => {
      console.log(chalk.yellow('\n⚠️  Session is ending...\n'));
    });

    wsClient.on('engineer_disconnected', () => {
      console.log(chalk.yellow('\n⚠️  Engineer disconnected.\n'));
    });

    wsClient.on('error', (error: any) => {
      console.error(chalk.red(`\nError: ${error.message || error}\n`));
    });

    // Connect
    await wsClient.connect();

    // Setup readline for input
    rl.on('line', async (input) => {
      if (input.trim()) {
        try {
          wsClient.send({
            type: 'customer_message',
            payload: {
              content: input,
            },
          });
        } catch (error) {
          console.error(chalk.red(`Failed to send message: ${error}`));
        }
      }
      rl.prompt();
    });

    rl.on('close', () => {
      wsClient.disconnect();
      console.log(chalk.dim('\nSession closed.'));
      process.exit(0);
    });

    process.on('SIGINT', () => {
      rl.close();
    });
  } catch (error) {
    spinner?.stop();
    handleError(error);
  }
}

