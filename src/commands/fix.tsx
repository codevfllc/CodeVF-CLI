import React from 'react';
import { render } from 'ink';
import ora from 'ora';
import chalk from 'chalk';
import prompts from 'prompts';
import { execSync } from 'child_process';
import { readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';
import { AuthManager } from '../modules/auth.js';
import { ConfigManager } from '../modules/config.js';
import { ApiClient } from '../modules/api.js';
import { WebSocketClient } from '../modules/websocket.js';
import { PermissionManager } from '../modules/permissions.js';
import { TunnelManager } from '../modules/tunnel.js';
import { LiveSession } from '../ui/LiveSession.js';
import { CreateTaskRequest, TaskMode, ActionContext } from '../types/index.js';

const DEFAULT_MAX_CREDITS = 240;

/**
 * Gathers project context automatically for engineers
 */
async function gatherProjectContext(configManager: ConfigManager): Promise<ActionContext> {
  const context: ActionContext = {
    project: {
      type: 'unknown',
      rootPath: process.cwd(),
      configExists: configManager.isInitialized()
    },
    timestamp: new Date().toISOString()
  };

  // Load config if available
  if (configManager.isInitialized()) {
    try {
      const config = configManager.loadConfig();
      context.environment = {
        testCommand: config.testCommand,
        buildCommand: config.buildCommand,
        allowedTools: config.allowedTools
      };
    } catch (error) {
      // Config load failed - continue without it
    }
  }

  // Detect project type from file structure
  try {
    const entries = readdirSync(process.cwd());
    if (entries.includes('package.json')) {
      context.project.type = 'node';
    } else if (entries.includes('requirements.txt')) {
      context.project.type = 'python';
    } else if (entries.includes('go.mod')) {
      context.project.type = 'go';
    } else if (entries.includes('Cargo.toml')) {
      context.project.type = 'rust';
    } else if (entries.includes('pom.xml')) {
      context.project.type = 'java';
    }
  } catch (error) {
    // Project type detection failed - leave as unknown
  }

  // Gather git info
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    const commitHash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    const isDirty = execSync('git status --porcelain', { encoding: 'utf8' }).trim().length > 0;

    context.git = { branch, commitHash, isDirty };

    // Recent commits (last 5)
    const logOutput = execSync(
      'git log -5 --pretty=format:"%H|%s|%an|%ai"',
      { encoding: 'utf8' }
    );

    if (logOutput) {
      context.git.recentCommits = logOutput.split('\n').map(line => {
        const [hash, message, author, date] = line.split('|');
        return { hash, message, author, date };
      });
    }
  } catch (error) {
    // Not a git repo or git not available - that's okay
  }

  // File structure analysis (lightweight)
  try {
    const extensions: Record<string, number> = {};
    const keyFiles: string[] = [];
    let totalFiles = 0;

    function scanDir(dir: string, depth: number = 0) {
      if (depth > 2) return; // Limit depth to avoid performance issues

      try {
        const entries = readdirSync(dir);
        for (const entry of entries) {
          // Skip hidden files and node_modules
          if (entry.startsWith('.') || entry === 'node_modules') continue;

          const fullPath = join(dir, entry);
          const stat = statSync(fullPath);

          if (stat.isDirectory()) {
            scanDir(fullPath, depth + 1);
          } else if (stat.isFile()) {
            totalFiles++;
            const lastDot = entry.lastIndexOf('.');
            if (lastDot > 0) {
              const ext = entry.substring(lastDot);
              extensions[ext] = (extensions[ext] || 0) + 1;
            }

            // Key files
            if (['package.json', 'requirements.txt', 'go.mod', 'Cargo.toml', 'pom.xml'].includes(entry)) {
              keyFiles.push(entry);
            }
          }
        }
      } catch (error) {
        // Permission issues or other errors - skip directory
      }
    }

    scanDir(process.cwd());
    context.files = { totalFiles, extensions, keyFiles };
  } catch (error) {
    // File scan failed - continue without it
  }

  // Dependencies (for Node.js projects)
  if (context.project.type === 'node') {
    try {
      const packageJsonPath = join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      context.dependencies = {
        production: Object.keys(packageJson.dependencies || {}),
        dev: Object.keys(packageJson.devDependencies || {})
      };
    } catch (error) {
      // package.json not readable - continue without it
    }
  }

  return context;
}

export async function fixCommand(
  issueDescription: string,
  options?: { maxCredits?: number; taskMode?: TaskMode }
): Promise<void> {
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

  const spinner = ora('Gathering project context...').start();

  try {
    const apiClient = new ApiClient(authManager);

    // Gather context
    const context = await gatherProjectContext(configManager);

    spinner.text = 'Creating task with context...';

    // Create task with realtime_chat mode (CLI-only mode)
    const createRequest: CreateTaskRequest = {
      issueDescription: issueDescription.trim(),
      projectId: config.projectId,
      maxCredits: options?.maxCredits || DEFAULT_MAX_CREDITS,
      taskMode: options?.taskMode || 'realtime_chat',
      contextData: JSON.stringify(context), // Send context data
    };

    const { taskId, estimatedWaitTime, warning, creditsRemaining, maxCreditsAllocated } = await apiClient.createTask(createRequest);
    spinner.succeed(chalk.green('Task created with project context'));

    if (warning) {
      console.log(chalk.yellow(`\n${warning}\n`));
    }

    if (typeof creditsRemaining === 'number') {
      console.log(chalk.dim(`Credits available: ${creditsRemaining.toFixed(1)} credits`));
    }
    if (typeof maxCreditsAllocated === 'number') {
      console.log(chalk.dim(`Task budget: up to ${maxCreditsAllocated.toFixed(1)} credits`));
    }

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
    const tunnelManager = new TunnelManager();

    const { unmount, waitUntilExit } = render(
      <LiveSession
        taskId={taskId}
        wsClient={wsClient}
        apiClient={apiClient}
        permissionManager={permissionManager}
        tunnelManager={tunnelManager}
      />
    );

    let exiting = false;

    // Function to handle rating after session ends
    const handleRating = async () => {
      if (exiting) return;
      exiting = true;

      unmount();

      try {
        // Ask for rating
        console.log(chalk.bold('\n⭐ Rate the engineer\n'));
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
        console.error(chalk.red('Failed to submit rating'));
      }
    };

    // Handle CTRL+C
    process.on('SIGINT', async () => {
      if (exiting) return;
      exiting = true;

      unmount();
      await tunnelManager.closeTunnel();
      console.log(chalk.yellow('\n\n👋 Ending session...'));

      try {
        await apiClient.endSession(taskId);
        wsClient.disconnect();
      } catch (error) {
        console.error(chalk.red('Failed to end session properly'));
      }

      await handleRating();
      process.exit(0);
    });

    await waitUntilExit();

    // Session ended normally (via /end or timeout) - show rating
    await handleRating();
  } catch (error) {
    spinner.fail('Failed to start session');
    throw error;
  }
}
