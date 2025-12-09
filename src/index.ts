#!/usr/bin/env node

// Load environment variables from .env before any other modules run
import 'dotenv/config';

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import { loginCommand } from './commands/login.js';
import { logoutCommand } from './commands/logout.js';
import { setupCommand } from './commands/setup.js';
import { welcomeCommand, isFirstRun } from './commands/welcome.js';
import { initCommand } from './commands/init.js';
import { syncCommand } from './commands/sync.js';
import { fixCommand } from './commands/fix.js';
import { tasksCommand } from './commands/tasks.js';
import { handleError } from './utils/errors.js';
import { ConfigManager } from './modules/config.js';
import { AiAgent } from './modules/aiAgent.js';
import React from 'react';
import { render } from 'ink';
import { CLI_VERSION, RoutingMode, AgentMode } from './modules/constants.js';
import { InteractiveApp } from './ui/InteractiveApp.js';
import {
  renderHeader,
  renderQuickCommands,
  showModeSwitched,
} from './ui/SessionUI.js';
import {
  handleSlashCommand,
  isSlashCommand,
  handleHybridMode,
  handleAiMode,
  handleHumanMode,
} from './modules/commandHandler.js';

const args = hideBin(process.argv);

/**
 * Safely loads config without throwing errors
 */
function loadConfigSafely(configManager: ConfigManager) {
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
 * Interactive session mode - main entry point when no arguments provided
 */
async function runInteractiveMode() {
  try {
    const configManager = new ConfigManager();
    let loadedConfig = loadConfigSafely(configManager);
    const isInitialized = configManager.isInitialized();
    let aiEnabled = !!loadedConfig?.ai?.enabled;
    let routingMode: RoutingMode = aiEnabled ? 'hybrid' : 'human';
    let agentMode: AgentMode = 'build';
    const aiAgent = new AiAgent(configManager);

    const logUserMessage = (message: string) => {
      // Display the user's input inside a full-width highlight block, left-aligned
      const columns = process.stdout.columns || 80;
      const lines = message.split(/\r?\n/);
      const contentWidth = Math.min(
        Math.max(...lines.map((line) => line.length), 1),
        columns - 6
      );

      const horizontalPad = '  ';
      const totalWidth = Math.min(columns, contentWidth + horizontalPad.length * 2);
      const fullLine = (text: string) => {
        const padded = text.padEnd(contentWidth, ' ');
        return chalk.bgGray.white(`${horizontalPad}${padded}${horizontalPad}`);
      };

      lines.forEach((line) => {
        console.log(fullLine(line));
      });
    };

    // Render header and quick commands
    renderHeader(isInitialized, loadedConfig);
    renderQuickCommands(isInitialized, aiEnabled, aiEnabled, agentMode);

    // Command submission handler
    const handleSubmit = async (text: string, mode: RoutingMode) => {
      const trimmed = text.trim();

      logUserMessage(trimmed);

      // Handle slash commands
      if (isSlashCommand(trimmed)) {
        await handleSlashCommand(trimmed, {
          configManager,
          aiAgent,
          routingMode: mode,
          agentMode,
          aiEnabled,
          autoAcceptMode: false,
          loadedConfig,
        });
        return;
      }

      // Route to appropriate mode handler
      if (mode === 'hybrid' && aiEnabled) {
        await handleHybridMode(trimmed, {
          configManager,
          aiAgent,
          routingMode: mode,
          agentMode,
          aiEnabled,
          autoAcceptMode: false,
          loadedConfig,
        });
      } else if (mode === 'ai' && aiEnabled) {
        await handleAiMode(trimmed, {
          configManager,
          aiAgent,
          routingMode: mode,
          agentMode,
          aiEnabled,
          autoAcceptMode: false,
          loadedConfig,
        });
      } else {
        await handleHumanMode(trimmed);
      }
    };

    // Try to use ink - it will handle raw mode setup internally
    try {
      // Render ink app and keep it mounted
      render(
        React.createElement(InteractiveApp, {
          initialRoutingMode: routingMode,
          initialAgentMode: agentMode,
          aiEnabled,
          onSubmit: handleSubmit,
          onModeChange: (mode) => {
            routingMode = mode;
            showModeSwitched(mode);
          },
          onAgentModeChange: (mode) => {
            agentMode = mode;
          },
        })
      );
    } catch (inkError: any) {
      // Fallback if ink fails
      console.error(chalk.yellow('\nWarning: Interactive mode requires TTY support'));
      console.log(chalk.yellow('\nFalling back to compatibility mode (paste support disabled)'));
      console.log(chalk.cyan('\nFor full features with paste support, run directly:'));
      console.log(chalk.white('  cd ' + process.cwd()));
      console.log(chalk.white('  CODEVF_API_URL=http://localhost:3000 tsx src/index.ts\n'));

      const readline = await import('readline');
      while (true) {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const getModeIndicator = (mode: RoutingMode) => {
          switch (mode) {
            case 'hybrid':
              return chalk.green('[Hybrid]');
            case 'ai':
              return chalk.cyan('[AI]');
            case 'human':
              return chalk.magenta('[Human]');
            default:
              return chalk.white('[Unknown]');
          }
        };

        const answer = await new Promise<string>((resolve) => {
          rl.question(`  ${getModeIndicator(routingMode)} ${chalk.dim('›')} `, (answer) => {
            rl.close();
            resolve(answer);
          });
        });

        if (answer.trim()) {
          await handleSubmit(answer.trim(), routingMode);
        }
      }
    }
  } catch (error) {
    handleError(error);
  }
}

/**
 * Command-line argument mode - handle specific commands
 */
if (args.length === 0) {
  // Check if this is the first run
  if (isFirstRun()) {
    welcomeCommand().catch(handleError);
  } else {
    runInteractiveMode();
  }
} else {
  yargs(args)
    .scriptName('codevf')
    .version(CLI_VERSION)
    .usage('$0 <command> [options]')
    .epilogue('For first-time setup, run: codevf welcome\nDocumentation: https://docs.codevf.com')
    .command(
      'login',
      'Authenticate with CodeVF (for CLI usage)',
      () => {},
      async () => {
        try {
          await loginCommand();
        } catch (error) {
          handleError(error);
        }
      }
    )
    .command(
      'logout',
      'Clear local authentication',
      () => {},
      async () => {
        try {
          await logoutCommand();
        } catch (error) {
          handleError(error);
        }
      }
    )
    .command(
      'setup',
      'Configure MCP server for Claude Code integration',
      () => {},
      async () => {
        try {
          await setupCommand();
        } catch (error) {
          handleError(error);
        }
      }
    )
    .command(
      'welcome',
      'Show welcome screen and setup guide',
      () => {},
      async () => {
        try {
          await welcomeCommand();
        } catch (error) {
          handleError(error);
        }
      }
    )
    .command(
      'init',
      'Initialize CodeVF in your project',
      () => {},
      async () => {
        try {
          await initCommand();
        } catch (error) {
          handleError(error);
        }
      }
    )
    .command(
      'sync',
      'Sync your local changes with CodeVF',
      (yargs) => {
        return yargs.option('force', {
          alias: 'f',
          type: 'boolean',
          description: 'Force sync even with uncommitted changes',
          default: false,
        });
      },
      async (argv) => {
        try {
          await syncCommand({ force: argv.force });
        } catch (error) {
          handleError(error);
        }
      }
    )
    .command(
      'tasks',
      'List open tasks (use /cancel <id> inside interactive mode)',
      () => {},
      async () => {
        try {
          await tasksCommand(undefined);
        } catch (error) {
          handleError(error);
        }
      }
    )
    .command(
      'fix <issue>',
      'Start a live debugging session',
      (yargs) => {
        return yargs
          .positional('issue', {
            type: 'string',
            describe:
              'Description of the issue to fix (or type commands like /human need help with X)',
            demandOption: true,
          })
          .option('ai', {
            type: 'boolean',
            default: false,
            describe: 'Route through local AI (opencode SDK) if enabled',
          })
          .option('no-start-server', {
            type: 'boolean',
            default: false,
            describe: 'Do not auto-start opencode server; require existing server',
          });
      },
      async (argv) => {
        try {
          if (argv.ai) {
            const configManager = new ConfigManager();
            const aiAgent = new AiAgent(configManager);
            await aiAgent.run(argv.issue as string, { startServer: !argv['no-start-server'] });
            return;
          }
          await fixCommand(argv.issue as string);
        } catch (error) {
          handleError(error);
        }
      }
    )
    .demandCommand(1, chalk.yellow('Run a command, e.g., "codevf fix \"need help with X\""'))
    .recommendCommands()
    .strict()
    .help()
    .alias('help', 'h')
    .alias('version', 'v')
    .epilogue(
      chalk.dim(
        'For more information, visit: https://docs.codevf.com\n' +
          'Report issues: https://github.com/codevf/cli/issues'
      )
    )
    .parse();
}
