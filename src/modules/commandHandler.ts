import chalk from 'chalk';
import prompts from 'prompts';
import { spawn } from 'child_process';
import { ConfigManager } from './config.js';
import { AiAgent } from './aiAgent.js';
import { consultEngineerTool } from '../tools/consultEngineer.js';
import { RoutingMode, AgentMode, COMMAND_PREFIXES } from './constants.js';
import { initCommand } from '../commands/init.js';
import { tasksCommand } from '../commands/tasks.js';
import { fixCommand } from '../commands/fix.js';
import { handleCvf, handleCvfInstant, handleCvfChat } from '../commands/mcp-tools.js';
import { renderHelpMenu } from '../ui/SessionUI.js';
import { runWithCancelableSpinner } from '../ui/SessionUI.js';

interface CommandContext {
  configManager: ConfigManager;
  aiAgent: AiAgent;
  routingMode: RoutingMode;
  agentMode: AgentMode;
  aiEnabled: boolean;
  autoAcceptMode: boolean;
  loadedConfig: any;
}

/**
 * Checks if a command is a slash command
 */
export function isSlashCommand(input: string): boolean {
  return input.startsWith(COMMAND_PREFIXES.SLASH);
}

/**
 * Handles slash commands and returns true if handled
 */
export async function handleSlashCommand(
  trimmed: string,
  context: CommandContext
): Promise<{ handled: boolean; updatedContext?: Partial<CommandContext> }> {
  // Help commands
  if (['/?', '/help', '/commands'].includes(trimmed)) {
    renderHelpMenu();
    return { handled: true };
  }

  // Human request with description
  if (trimmed.startsWith('/human')) {
    return await handleHumanCommand(trimmed);
  }

  // Mode switching commands
  if (trimmed === '/hybrid') {
    return handleHybridModeCommand(context);
  }

  if (trimmed === '/ai') {
    return handleAiModeCommand(context);
  }

  if (trimmed === '/human') {
    return { handled: true, updatedContext: { routingMode: 'human' as RoutingMode } };
  }

  // Agent mode commands
  if (trimmed === '/build') {
    console.log(chalk.cyan('  [✓] Switched to build agent'));
    return { handled: true, updatedContext: { agentMode: 'build' as AgentMode } };
  }

  if (trimmed === '/plan') {
    console.log(chalk.yellow('  [✓] Switched to plan agent'));
    return { handled: true, updatedContext: { agentMode: 'plan' as AgentMode } };
  }

  // Route status
  if (trimmed === '/route') {
    showRouteStatus(context);
    return { handled: true };
  }

  // Task management
  if (trimmed === '/tasks') {
    await tasksCommand(undefined);
    return { handled: true };
  }

  if (trimmed.startsWith('/cancel ')) {
    const id = trimmed.replace('/cancel', '').trim();
    if (!id) {
      console.log(chalk.red('Usage: /cancel <taskId>'));
    } else {
      await tasksCommand(id);
    }
    return { handled: true };
  }

  // Project initialization
  if (trimmed === '/init') {
    await initCommand();
    const loadedConfig = loadConfigSafely(context.configManager);
    const aiEnabled = !!loadedConfig?.ai?.enabled;
    return {
      handled: true,
      updatedContext: {
        loadedConfig,
        aiEnabled,
        routingMode: aiEnabled ? 'ai' as RoutingMode : context.routingMode
      }
    };
  }

  // MCP tool commands
  if (trimmed === '/cvf' || trimmed.startsWith('/cvf ')) {
    const message = trimmed.replace('/cvf', '').trim();
    await handleCvf(message || undefined);
    return { handled: true };
  }

  if (trimmed.startsWith('/cvf-instant')) {
    const message = trimmed.replace('/cvf-instant', '').trim();
    await handleCvfInstant(message || undefined);
    return { handled: true };
  }

  if (trimmed.startsWith('/cvf-chat')) {
    const message = trimmed.replace('/cvf-chat', '').trim();
    await handleCvfChat(message || undefined);
    return { handled: true };
  }

  // Exit commands
  if (['/exit', '/quit'].includes(trimmed)) {
    console.log(chalk.dim('  Exiting...'));
    process.exit(0);
  }

  // Shell mode
  if (trimmed === '/shell') {
    await handleShellMode();
    return { handled: true };
  }

  // Unknown command
  console.log(chalk.yellow(`  [!] Unknown command: ${trimmed}`));
  console.log(chalk.dim('  Type ') + chalk.white('/?') + chalk.dim(' for help'));
  return { handled: true };
}

/**
 * Handles the /human command with description
 */
async function handleHumanCommand(
  trimmed: string
): Promise<{ handled: boolean }> {
  const humanText = trimmed.replace('/human', '').trim();
  if (!humanText) {
    console.log(chalk.yellow('  [!] Usage: /human <description>'));
    console.log(chalk.dim('  Example: /human need help debugging auth'));
    return { handled: true };
  }

  console.log(chalk.yellow('  💳 Human engineer: 2 credits/min (no AI attempt)'));
  const { proceed } = await prompts({
    type: 'confirm',
    name: 'proceed',
    message: '  Connect to human engineer?',
    initial: true,
  });

  if (proceed) {
    console.log(chalk.dim('  [→] Connecting to engineer...'));
    await fixCommand(`(Human request) ${humanText}`, { taskMode: 'realtime_chat' });
  } else {
    console.log(chalk.dim('  Request cancelled'));
  }

  return { handled: true };
}

/**
 * Handles the /hybrid mode command
 */
function handleHybridModeCommand(
  context: CommandContext
): { handled: boolean; updatedContext?: Partial<CommandContext> } {
  const loadedConfig = loadConfigSafely(context.configManager);
  const aiEnabled = !!loadedConfig?.ai?.enabled;
  const toolsEnabled = loadedConfig?.ai?.tools?.consultEngineer?.enabled !== false;

  if (!aiEnabled) {
    console.log(chalk.yellow('  [!] AI not available for hybrid mode'));
    console.log(chalk.dim('  Run ') + chalk.white('codevf init') + chalk.dim(' to enable AI'));
    return { handled: true };
  }

  const maxCredits = loadedConfig?.ai?.tools?.consultEngineer?.maxCreditsPerCall || 10;
  if (toolsEnabled) {
    console.log(chalk.green(`  [✓] Switched to hybrid mode (AI + consultEngineer tool, ${maxCredits} credits/call)`));
  } else {
    console.log(chalk.cyan('  [✓] Switched to hybrid mode (AI only, no tools)'));
  }

  return {
    handled: true,
    updatedContext: {
      routingMode: 'hybrid' as RoutingMode,
      loadedConfig,
      aiEnabled
    }
  };
}

/**
 * Handles the /ai mode command
 */
function handleAiModeCommand(
  context: CommandContext
): { handled: boolean; updatedContext?: Partial<CommandContext> } {
  const loadedConfig = loadConfigSafely(context.configManager);
  const aiEnabled = !!loadedConfig?.ai?.enabled;

  if (!aiEnabled) {
    console.log(chalk.yellow('  [!] AI mode not available'));
    console.log(chalk.dim('  Run ') + chalk.white('codevf init') + chalk.dim(' to enable AI'));
    return { handled: true };
  }

  console.log(chalk.cyan('  [✓] Switched to AI mode'));
  return {
    handled: true,
    updatedContext: {
      routingMode: 'ai' as RoutingMode,
      loadedConfig,
      aiEnabled
    }
  };
}

/**
 * Shows current routing status
 */
function showRouteStatus(context: CommandContext): void {
  const currentMode =
    context.routingMode === 'hybrid'
      ? chalk.green('[Hybrid]')
      : context.routingMode === 'ai'
        ? chalk.cyan('[AI]')
        : chalk.magenta('[Human]');
  const currentAgent = context.agentMode === 'build' ? chalk.cyan('[Build]') : chalk.yellow('[Plan]');
  console.log(chalk.dim('  Current routing mode: ') + currentMode);
  console.log(chalk.dim('  Current agent mode: ') + currentAgent);
}

/**
 * Handles shell mode
 */
async function handleShellMode(): Promise<void> {
  console.log(chalk.dim('Entered local shell mode (not shared). Type /resume to go back.'));

  let shellMode = true;
  while (shellMode) {
    const { line: shellLine } = await prompts({
      type: 'text',
      name: 'line',
      message: chalk.bold('shell> ') + chalk.dim('(local)'),
    });

    if (!shellLine) {
      continue;
    }

    const shellTrimmed = shellLine.trim();

    if (['/resume', '/session', '/codevf'].includes(shellTrimmed)) {
      shellMode = false;
      console.log(chalk.dim('Back to CodeVF prompt.'));
      continue;
    }

    if (['/exit', '/quit'].includes(shellTrimmed)) {
      console.log(chalk.dim('Goodbye.'));
      process.exit(0);
    }

    if (shellTrimmed.startsWith('/')) {
      console.log(chalk.yellow(`Unknown command in shell: ${shellTrimmed}`));
      console.log(chalk.dim('Use /resume to return to the session prompt.'));
      continue;
    }

    try {
      await new Promise<void>((resolve) => {
        const child = spawn(shellTrimmed, {
          shell: true,
          stdio: 'inherit',
          cwd: process.cwd(),
        });
        child.on('exit', () => resolve());
        child.on('error', (err) => {
          console.log(chalk.red(`Command failed: ${err.message}`));
          resolve();
        });
      });
    } catch (error: any) {
      console.log(chalk.red(`Command failed: ${error.message || error}`));
    }
  }
}

/**
 * Safely loads config without throwing
 */
function loadConfigSafely(configManager: ConfigManager): any {
  if (configManager.isInitialized()) {
    try {
      return configManager.loadConfig();
    } catch (error) {
      return null;
    }
  }
  return null;
}

/**
 * Handles hybrid mode execution flow
 *
 * Hybrid mode = AI mode + consultEngineer tool access
 * The AI can now directly consult human engineers when needed
 */
export async function handleHybridMode(
  trimmed: string,
  context: CommandContext
): Promise<void> {
  try {
    // Run AI with consultEngineer tool - the AI will decide when to consult humans
    const result = await context.aiAgent.runWithTools(
      trimmed,
      [consultEngineerTool],
      { agent: context.agentMode }
    );

    // Display completion message based on result
    if (result.confidence === 'failed') {
      console.log(chalk.yellow('  ⚠️  Task completed with limitations'));
    }
  } catch (error: any) {
    console.log(chalk.red(`  ❌ Error: ${error?.message || error}`));

    // Offer fallback to direct human help if AI+tools failed
    const { fallback } = await prompts({
      type: 'confirm',
      name: 'fallback',
      message: '  Connect directly to human engineer instead?',
      initial: true,
    });

    if (fallback) {
      console.log(chalk.dim('  [→] Connecting to engineer...'));
      await fixCommand(trimmed, { taskMode: 'realtime_chat' });
    }
  }
}

/**
 * Handles AI-only mode execution
 */
export async function handleAiMode(trimmed: string, context: CommandContext): Promise<void> {
  try {
    const result = await runWithCancelableSpinner(
      async (signal, spinner) => {
        return await context.aiAgent.run(trimmed, {
          signal,
          agent: context.agentMode,
          spinner,
        });
      },
      chalk.cyan.bold('✨ Processing with AI...')
    );

    if (result === null) {
      console.log(
        chalk.dim('  Request cancelled. You can try again or type /human for human support.')
      );
    }
  } catch (error: any) {
    console.log(chalk.red(`  [×] AI Error: ${error?.message || error}`));
    const { fallback } = await prompts({
      type: 'confirm',
      name: 'fallback',
      message: '  Route to human engineer instead?',
      initial: true,
    });

    if (fallback) {
      console.log(chalk.dim('  [→] Connecting to engineer...'));
      await fixCommand(trimmed, { taskMode: 'realtime_chat' });
    }
  }
}

/**
 * Handles human-only mode execution
 */
export async function handleHumanMode(trimmed: string): Promise<void> {
  console.log(chalk.yellow('  💳 Human engineer: 2 credits/min'));
  const { proceed } = await prompts({
    type: 'confirm',
    name: 'proceed',
    message: '  Connect to human engineer?',
    initial: true,
  });

  if (proceed) {
    console.log(chalk.dim('  [→] Connecting to engineer...'));
    await fixCommand(trimmed, { taskMode: 'realtime_chat' });
  } else {
    console.log(chalk.dim('  Request cancelled'));
  }
}
