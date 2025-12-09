/**
 * Welcome screen for first-time users
 */

import chalk from 'chalk';
import prompts from 'prompts';
import { setupCommand } from './setup.js';
import { ConfigManager } from '../lib/config/manager.js';

const WELCOME_ART = `
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   █████╗  ██████╗ ██████╗ ███████╗██╗   ██╗███████╗      ║
║  ██╔══██╗██╔═══██╗██╔══██╗██╔════╝██║   ██║██╔════╝      ║
║  ██║  ╚═╝██║   ██║██║  ██║█████╗  ╚██╗ ██╔╝█████╗        ║
║  ██║  ██╗██║   ██║██║  ██║██╔══╝   ╚████╔╝ ██╔══╝        ║
║  ╚█████╔╝╚██████╔╝██████╔╝███████╗  ╚██╔╝  ██║           ║
║   ╚════╝  ╚═════╝ ╚═════╝ ╚══════╝   ╚═╝   ╚═╝           ║
║                                                           ║
║          Live Debugging with Vetted Engineers            ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`;

export async function welcomeCommand(): Promise<void> {
  console.clear();
  console.log(chalk.cyan(WELCOME_ART));

  console.log(chalk.bold('\n👋 Welcome to CodeVF!\n'));
  console.log('Get help from expert engineers when you need it most.\n');

  const { setupType } = await prompts({
    type: 'select',
    name: 'setupType',
    message: 'How would you like to use CodeVF?',
    choices: [
      {
        title: chalk.bold.green('🤖 Claude Code Integration') + chalk.dim(' (Recommended)'),
        description: 'Add CodeVF tools to Claude Code - ask Claude to consult engineers',
        value: 'mcp',
      },
      {
        title: chalk.bold.blue('💻 Standalone CLI') + chalk.dim(' (Beta)'),
        description: 'Use CodeVF directly from your terminal for live debugging sessions',
        value: 'cli',
      },
      {
        title: chalk.dim('ℹ️  Learn More'),
        description: 'Show me what CodeVF can do',
        value: 'info',
      },
      {
        title: chalk.dim('❌ Exit'),
        description: 'Exit setup',
        value: 'exit',
      },
    ],
    initial: 0,
  });

  if (!setupType || setupType === 'exit') {
    console.log(chalk.dim('\n👋 Run `codevf` anytime to get started!\n'));
    return;
  }

  switch (setupType) {
    case 'mcp':
      await setupMCPFlow();
      break;
    case 'cli':
      await setupCLIFlow();
      break;
    case 'info':
      await showInfo();
      break;
  }
}

async function setupMCPFlow(): Promise<void> {
  console.log(chalk.bold.cyan('\n🤖 Claude Code Integration Setup\n'));

  console.log(chalk.dim('This will:'));
  console.log(chalk.dim('  1. Authenticate with CodeVF'));
  console.log(chalk.dim('  2. Configure Claude Code to use CodeVF tools'));
  console.log(chalk.dim('  3. Enable codevf-instant and codevf-chat commands\n'));

  const { proceed } = await prompts({
    type: 'confirm',
    name: 'proceed',
    message: 'Ready to set up?',
    initial: true,
  });

  if (!proceed) {
    console.log(chalk.dim('\n👋 Run `codevf setup` anytime to configure!\n'));
    return;
  }

  // Run the setup command
  await setupCommand();

  console.log(chalk.bold.green('\n✨ All set! Here\'s what you can do:\n'));
  console.log(chalk.cyan('In Claude Code, you can now ask:\n'));
  console.log(chalk.dim('  "Use codevf-instant to ask an engineer if this fix works"'));
  console.log(chalk.dim('  "Use codevf-chat to debug this complex issue with an engineer"\n'));

  console.log(chalk.bold('Available Tools:'));
  console.log(chalk.green('  • codevf-instant') + chalk.dim(' - Quick validation (1-10 credits, ~2 min)'));
  console.log(chalk.green('  • codevf-chat') + chalk.dim(' - Extended session (4-1920 credits, up to 16 hours)\n'));
}

async function setupCLIFlow(): Promise<void> {
  console.log(chalk.bold.blue('\n💻 Standalone CLI Setup\n'));

  console.log(chalk.yellow('⚠️  The CLI is currently in beta. For the best experience, we recommend'));
  console.log(chalk.yellow('   using Claude Code integration instead.\n'));

  console.log(chalk.dim('CLI Features:'));
  console.log(chalk.dim('  • Live debugging sessions with engineers'));
  console.log(chalk.dim('  • Real-time chat and screen sharing'));
  console.log(chalk.dim('  • Project initialization and sync\n'));

  const { proceed } = await prompts({
    type: 'confirm',
    name: 'proceed',
    message: 'Continue with CLI setup?',
    initial: false,
  });

  if (!proceed) {
    console.log(chalk.dim('\n💡 Tip: Try `codevf` again and choose Claude Code Integration!\n'));
    return;
  }

  console.log(chalk.bold('\n📚 CLI Commands:\n'));
  console.log(chalk.cyan('  codevf login') + chalk.dim('   - Authenticate with CodeVF'));
  console.log(chalk.cyan('  codevf init') + chalk.dim('    - Initialize project'));
  console.log(chalk.cyan('  codevf fix') + chalk.dim('     - Start live debugging session'));
  console.log(chalk.cyan('  codevf sync') + chalk.dim('    - Sync your code\n'));

  const { startLogin } = await prompts({
    type: 'confirm',
    name: 'startLogin',
    message: 'Start with login?',
    initial: true,
  });

  if (startLogin) {
    console.log(chalk.dim('\nRun: codevf login\n'));
  }
}

async function showInfo(): Promise<void> {
  console.log(chalk.bold.cyan('\n📖 What is CodeVF?\n'));

  console.log('CodeVF connects you with vetted software engineers for live debugging');
  console.log('and code review. Get expert help when you need it most.\n');

  console.log(chalk.bold('🎯 Use Cases:\n'));
  console.log(chalk.green('  ✓ ') + 'Complex bugs that AI can\'t solve alone');
  console.log(chalk.green('  ✓ ') + 'Architecture and design decisions');
  console.log(chalk.green('  ✓ ') + 'Code review and security audits');
  console.log(chalk.green('  ✓ ') + 'Performance optimization');
  console.log(chalk.green('  ✓ ') + 'Learning from experienced developers\n');

  console.log(chalk.bold('💰 Credit-Based Pricing:\n'));
  console.log(chalk.dim('  • Quick questions: 1-10 credits (~$0.10-$1.00)'));
  console.log(chalk.dim('  • Extended sessions: 2 credits/minute (~$0.20/min)\n'));

  console.log(chalk.bold('🔒 Security:\n'));
  console.log(chalk.dim('  • Engineers only see what you share'));
  console.log(chalk.dim('  • All sessions are private and secure'));
  console.log(chalk.dim('  • No code is stored after sessions\n'));

  const { next } = await prompts({
    type: 'select',
    name: 'next',
    message: 'What would you like to do?',
    choices: [
      { title: 'Set up Claude Code Integration', value: 'mcp' },
      { title: 'Set up Standalone CLI', value: 'cli' },
      { title: 'Exit', value: 'exit' },
    ],
  });

  switch (next) {
    case 'mcp':
      await setupMCPFlow();
      break;
    case 'cli':
      await setupCLIFlow();
      break;
  }
}

/**
 * Check if this is the first run
 */
export function isFirstRun(): boolean {
  const mcpConfig = new ConfigManager('mcp-config.json');
  const cliConfig = new ConfigManager('config.json');

  // First run if neither config exists
  return !mcpConfig.exists() && !cliConfig.exists();
}
