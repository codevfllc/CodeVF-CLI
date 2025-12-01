import React from 'react';
import { render } from 'ink';
import ora from 'ora';
import chalk from 'chalk';
import prompts from 'prompts';
import { AuthManager } from '../modules/auth.js';
import { ConfigManager } from '../modules/config.js';
import { ApiClient } from '../modules/api.js';
import { WebSocketClient } from '../modules/websocket.js';
import { PermissionManager } from '../modules/permissions.js';
import { LiveSession } from '../ui/LiveSession.js';
import { CreateTaskRequest } from '../types/index.js';

const DEFAULT_MAX_CREDITS = 120;

export async function fixCommand(issueDescription: string): Promise<void> {
  const authManager = new AuthManager();
  const configManager = new ConfigManager();

  console.log(chalk.bold.blue('\n🔧 CodeVF Fix Session\n'));

  // Check authentication
  if (!authManager.isAuthenticated()) {
    console.log(chalk.red('Error: Not authenticated.'));
    console.log(chalk.yellow('Please run: codevf login\n'));
    process.exit(1);
  }

  // Check if project is initialized
  if (!configManager.isInitialized()) {
    console.log(chalk.red('Error: No CodeVF project found.'));
    console.log(chalk.yellow('Please run: codevf init\n'));
    process.exit(1);
  }

  const config = configManager.loadConfig();

  // Validate issue description
  if (!issueDescription || issueDescription.trim().length === 0) {
    console.log(chalk.red('Error: Please provide an issue description.'));
    console.log(chalk.yellow('Usage: codevf fix "your issue description"\n'));
    process.exit(1);
  }

  const spinner = ora('Creating debug task...').start();

  try {
    const apiClient = new ApiClient(authManager);

    // Create task
    const createRequest: CreateTaskRequest = {
      issueDescription: issueDescription.trim(),
      projectId: config.projectId,
      maxCredits: DEFAULT_MAX_CREDITS,
    };

    const { taskId, estimatedWaitTime } = await apiClient.createTask(createRequest);
    spinner.succeed(chalk.green('Task created'));

    if (estimatedWaitTime > 0) {
      console.log(
        chalk.yellow(`\nEstimated wait time: ${Math.ceil(estimatedWaitTime / 60)} minutes`)
      );

      const { proceed } = await prompts({
        type: 'confirm',
        name: 'proceed',
        message: 'Continue waiting?',
        initial: true,
      });

      if (!proceed) {
        console.log(chalk.dim('\nTask cancelled.\n'));
        return;
      }
    }

    // Connect WebSocket
    spinner.start('Connecting to session...');
    const wsUrl = apiClient.getWebSocketUrl(taskId, authManager.getAccessToken());
    const wsClient = new WebSocketClient(wsUrl, authManager.getAccessToken());

    await wsClient.connect();
    spinner.succeed(chalk.green('Connected to session'));

    // Clear console and render live session UI
    console.clear();

    const permissionManager = new PermissionManager();

    const { unmount, waitUntilExit } = render(
      <LiveSession
        taskId={taskId}
        wsClient={wsClient}
        apiClient={apiClient}
        permissionManager={permissionManager}
      />
    );

    // Handle CTRL+C
    process.on('SIGINT', async () => {
      unmount();
      console.log(chalk.yellow('\n\n👋 Ending session...'));

      try {
        await apiClient.endSession(taskId);
        wsClient.disconnect();

        // Ask for rating
        console.log(chalk.bold('\n⭐ Rate this session\n'));
        const { rating, feedback } = await prompts([
          {
            type: 'number',
            name: 'rating',
            message: 'Rate engineer (1-5):',
            min: 1,
            max: 5,
            initial: 5,
          },
          {
            type: 'text',
            name: 'feedback',
            message: 'Optional feedback:',
          },
        ]);

        if (rating) {
          await apiClient.rateEngineer(taskId, rating, feedback);
          console.log(chalk.green('\n✓ Thank you for your feedback!\n'));
        }
      } catch (error) {
        console.error(chalk.red('Failed to end session properly'));
      }

      process.exit(0);
    });

    await waitUntilExit();
  } catch (error) {
    spinner.fail('Failed to start session');
    throw error;
  }
}
