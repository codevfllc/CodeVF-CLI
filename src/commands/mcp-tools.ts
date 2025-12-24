/**
 * MCP tool commands for interactive mode
 * Provides /cvf, /cvf-instant and /cvf-chat slash commands
 */

import chalk from 'chalk';
import prompts from 'prompts';
import { ConfigManager } from '../lib/config/manager.js';
import { TokenManager } from '../lib/auth/token-manager.js';
import { ApiClient } from '../lib/api/client.js';
import { TasksApi } from '../lib/api/tasks.js';
import { WebSocketClient } from '../lib/api/websocket.js';
import { logger } from '../lib/utils/logger.js';

/**
 * Check if MCP is configured
 */
function checkMcpConfig(): { configured: boolean; config?: any; configManager?: ConfigManager } {
  const configManager = new ConfigManager('config.json');

  if (!configManager.exists()) {
    console.log(chalk.yellow('  [!] MCP not configured'));
    console.log(chalk.dim('  Run: ') + chalk.white('codevf setup') + chalk.dim(' to configure'));
    return { configured: false };
  }

  try {
    const config = configManager.load();
    return { configured: true, config, configManager };
  } catch (error) {
    console.log(chalk.red('  [✗] Failed to load MCP config'));
    return { configured: false };
  }
}

/**
 * Handle /cvf-instant command
 */
export async function handleCvfInstant(message?: string): Promise<void> {
  // Check MCP configuration
  const { configured, config, configManager } = checkMcpConfig();
  if (!configured || !config || !configManager) {
    return;
  }

  // Get message if not provided
  let finalMessage = message;
  if (!finalMessage) {
    const response = await prompts({
      type: 'text',
      name: 'message',
      message: chalk.cyan('  Question for engineer:'),
    });

    if (!response.message) {
      console.log(chalk.dim('  Cancelled'));
      return;
    }

    finalMessage = response.message;
  }

  // Get max credits
  const { maxCredits } = await prompts({
    type: 'number',
    name: 'maxCredits',
    message: chalk.cyan('  Max credits (1-10):'),
    initial: 10,
    min: 1,
    max: 10,
  });

  if (!maxCredits) {
    console.log(chalk.dim('  Cancelled'));
    return;
  }

  try {
    // Initialize components
    const tokenManager = new TokenManager(configManager);
    const apiClient = new ApiClient(config.baseUrl, tokenManager);
    const defaultProjectId = config.defaults?.projectId || '1';

    logger.info('handleCvfInstant config:', {
      baseUrl: config.baseUrl,
      defaults: config.defaults,
      defaultProjectId,
    });

    const tasksApi = new TasksApi(apiClient, config.baseUrl, defaultProjectId);

    console.log(chalk.cyan('  [→] Creating instant query...'));

    // Create task
    const task = await tasksApi.create({
      message: finalMessage!,
      taskMode: 'realtime_answer',
      maxCredits,
      status: 'requested',
      projectId: defaultProjectId,
    });

    if (task.warning) {
      console.log(chalk.yellow(`  [!] ${task.warning}`));
    }

    console.log(chalk.cyan(`  [→] Connecting to engineer (Task ${task.taskId})...`));

    // Connect WebSocket
    const token = await tokenManager.getValidToken();
    const wsProtocol = config.baseUrl.startsWith('https://') ? 'wss://' : 'ws://';
    const host = config.baseUrl.replace(/^https?:\/\//, '');
    const wsUrl = `${wsProtocol}${host}/ws?taskId=${task.taskId}&userType=customer&token=${token}`;

    const ws = new WebSocketClient(wsUrl);
    await ws.connect();

    console.log(chalk.cyan('  [→] Waiting for engineer response...'));

    // Wait for response (5 min timeout)
    const response = await ws.waitForResponse(300000);

    // Give the server a moment to send any final messages
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Disconnect
    ws.disconnect();

    // Display response
    console.log();
    console.log(chalk.bold.green('  ✓ Engineer Response:'));
    console.log();
    console.log(chalk.white('  ' + response.text.split('\n').join('\n  ')));
    console.log();
    console.log(chalk.dim('  ───────────────'));
    console.log(chalk.dim(`  Credits used: ${response.creditsUsed}`));
    console.log(chalk.dim(`  Session time: ${response.duration}`));
    console.log();
  } catch (error: any) {
    console.log(chalk.red(`  [✗] Error: ${error.message || error}`));
    logger.error('cvf-instant failed', error);
  }
}

/**
 * Handle /cvf-chat command
 */
export async function handleCvfChat(message?: string): Promise<void> {
  // Check MCP configuration
  const { configured, config, configManager } = checkMcpConfig();
  if (!configured || !config || !configManager) {
    return;
  }

  // Get message if not provided
  let finalMessage = message;
  if (!finalMessage) {
    const response = await prompts({
      type: 'text',
      name: 'message',
      message: chalk.cyan('  Problem description:'),
    });

    if (!response.message) {
      console.log(chalk.dim('  Cancelled'));
      return;
    }

    finalMessage = response.message;
  }

  // Get max credits
  const { maxCredits } = await prompts({
    type: 'number',
    name: 'maxCredits',
    message: chalk.cyan('  Max credits (4-1920):'),
    initial: 240,
    min: 4,
    max: 1920,
  });

  if (!maxCredits) {
    console.log(chalk.dim('  Cancelled'));
    return;
  }

  try {
    // Initialize components
    const tokenManager = new TokenManager(configManager);
    const apiClient = new ApiClient(config.baseUrl, tokenManager);
    const defaultProjectId = config.defaults?.projectId || '1';
    const tasksApi = new TasksApi(apiClient, config.baseUrl, defaultProjectId);

    console.log(chalk.cyan('  [→] Starting chat session...'));

    // Create task
    const task = await tasksApi.create({
      message: finalMessage!,
      taskMode: 'realtime_chat',
      status: 'requested',
      maxCredits,
      projectId: defaultProjectId,
    });

    if (task.warning) {
      console.log(chalk.yellow(`  [!] ${task.warning}`));
    }

    // Display session info
    const sessionUrl = `${config.baseUrl}/session/${task.actionId}`;
    const estimatedMinutes = Math.floor(maxCredits / 2);

    console.log();
    console.log(chalk.bold.green('  ✓ Chat session started!'));
    console.log();
    console.log(chalk.white('  Session URL: ') + chalk.cyan.underline(sessionUrl));
    console.log();
    console.log(chalk.dim('  ───────────────'));
    console.log(chalk.dim(`  Max credits: ${maxCredits}`));
    console.log(chalk.dim(`  Rate: 2 credits/minute`));
    console.log(chalk.dim(`  Estimated duration: ~${estimatedMinutes} minutes`));
    console.log(chalk.dim(`  Credits remaining: ${task.creditsRemaining}`));
    console.log();
    console.log(chalk.white('  Open the URL above to monitor the conversation.'));
    console.log();
  } catch (error: any) {
    console.log(chalk.red(`  [✗] Error: ${error.message || error}`));
    logger.error('cvf-chat failed', error);
  }
}

/**
 * Handle /cvf command - interactive menu
 */
export async function handleCvf(message?: string): Promise<void> {
  // Check MCP configuration
  const { configured } = checkMcpConfig();
  if (!configured) {
    return;
  }

  // If message provided, use instant by default
  if (message) {
    await handleCvfInstant(message);
    return;
  }

  // Show menu
  console.log();
  console.log(chalk.bold.cyan('  🤝 CodeVF Engineer Tools'));
  console.log();

  const { choice } = await prompts({
    type: 'select',
    name: 'choice',
    message: 'Choose tool:',
    choices: [
      {
        title: chalk.cyan('⚡ Instant') + chalk.dim(' - Quick validation (1-10 credits, ~2 min)'),
        value: 'instant',
      },
      {
        title:
          chalk.blue('💬 Chat') + chalk.dim(' - Extended session (4-1920 credits, up to 16 hours)'),
        value: 'chat',
      },
      {
        title: chalk.dim('Cancel'),
        value: 'cancel',
      },
    ],
    initial: 0,
  });

  if (!choice || choice === 'cancel') {
    console.log(chalk.dim('  Cancelled'));
    return;
  }

  console.log();

  if (choice === 'instant') {
    await handleCvfInstant();
  } else if (choice === 'chat') {
    await handleCvfChat();
  }
}
