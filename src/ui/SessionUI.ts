import chalk from 'chalk';
import ora, { Ora } from 'ora';
import readline from 'readline';
import { CLI_VERSION, UI, RoutingMode, AgentMode } from '../modules/constants.js';
import { Config } from '../types/index.js';

/**
 * Renders the application header with version and status
 */
export function renderHeader(isInitialized: boolean, config: Config | null): void {
  console.log();
  console.log(chalk.bold.cyan('  ╭─────────────────────────────────────────╮'));
  console.log(
    chalk.bold.cyan('  │') +
      chalk.bold.white('  CodeVF CLI ') +
      chalk.dim(`v${CLI_VERSION}`) +
      chalk.bold.cyan('                      │')
  );
  console.log(chalk.bold.cyan('  ╰─────────────────────────────────────────╯'));
  console.log();

  const boxInfo = isInitialized ? chalk.green('[initialized]') : chalk.yellow('[not initialized]');
  const statusItems = [boxInfo];

  if (config) {
    const aiEnabled = config.ai?.enabled;

    if (aiEnabled) {
      const toolsEnabled = config.ai?.tools?.consultEngineer?.enabled !== false;
      const modeLabel = toolsEnabled
        ? `🤖 [Hybrid: AI + consultEngineer tool]`
        : `🧠 [AI - OpenCode only]`;
      statusItems.push(chalk.green.bold(modeLabel));
    } else {
      statusItems.push(chalk.magenta.bold('👨‍💻 [Human - 2 credits/min]'));
    }
  }

  console.log('  ' + statusItems.join(chalk.dim(' • ')) + '\n');

  // Claude Code Integration tip
  if (!isInitialized) {
    console.log(
      chalk.cyan('  💡 Tip: ') +
      chalk.white('Use CodeVF from Claude Code! Run: ') +
      chalk.green.bold('codevf setup')
    );
    console.log(
      chalk.dim('     Add codevf-instant & codevf-chat tools to Claude Code')
    );
    console.log();
  }

  // Credit info
  if (config?.ai?.enabled || !config?.ai?.enabled) {
    console.log(
      chalk.dim('  AI=OpenCode (free w/ limits), consultEngineer=10 credits, Human=2 credits/min • /? for info')
    );
    console.log();
  }
}

/**
 * Renders quick commands help
 */
export function renderQuickCommands(
  isInitialized: boolean,
  hybridEnabled: boolean,
  aiEnabled: boolean,
  agentMode: AgentMode
): void {
  console.log(chalk.dim('  Quick commands:'));

  if (!isInitialized) {
    console.log(
      chalk.white('  /setup') + chalk.dim('   - Set up Claude Code integration') + chalk.cyan(' (recommended)')
    );
    console.log(
      chalk.white('  /init') + chalk.dim('    - Initialize CodeVF CLI') + chalk.dim(' (beta)')
    );
  }

  if (aiEnabled) {
    console.log(
      chalk.white('  /hybrid') +
        chalk.dim(' - AI with consultEngineer tool') +
        (hybridEnabled ? chalk.green(' (active)') : '')
    );
  }

  console.log(
    chalk.white('  /ai') +
      chalk.dim('     - Use AI mode only') +
      (aiEnabled && !hybridEnabled ? chalk.green(' (active)') : '')
  );

  console.log(
    chalk.white('  /human') +
      chalk.dim('  - Request human engineer') +
      (!aiEnabled ? chalk.green(' (active)') : '')
  );

  console.log(
    chalk.white('  /build') +
      chalk.dim('  - Use build agent') +
      (agentMode === 'build' ? chalk.green(' (active)') : '')
  );

  console.log(
    chalk.white('  /plan') +
      chalk.dim('   - Use plan agent') +
      (agentMode === 'plan' ? chalk.green(' (active)') : '')
  );

  console.log(chalk.white('  /cvf') + chalk.dim('        - CodeVF engineer tools menu'));
  console.log(chalk.white('  /cvf-instant') + chalk.dim(' - Quick engineer validation (1-10 credits)'));
  console.log(chalk.white('  /cvf-chat') + chalk.dim(' - Extended debugging session (4-1920 credits)'));

  console.log(chalk.white('  /?') + chalk.dim('      - Show all commands'));
  console.log(chalk.white('  /exit') + chalk.dim('   - Quit'));
  console.log();
}

/**
 * Renders the full help menu
 */
export function renderHelpMenu(): void {
  console.log();
  console.log(chalk.bold.cyan('  ╭─────────────────────────────────────────╮'));
  console.log(
    chalk.bold.cyan('  │') +
      chalk.bold.white('           📚 Available Commands           ') +
      chalk.bold.cyan('│')
  );
  console.log(chalk.bold.cyan('  ╰─────────────────────────────────────────╯'));
  console.log();

  console.log(chalk.bold.magenta('  🎮 Mode Control:'));
  console.log(
    chalk.white('    /hybrid') + chalk.dim('   ') + chalk.cyan('Hybrid mode (AI → Human fallback)')
  );
  console.log(chalk.white('    /ai') + chalk.dim('       ') + chalk.blue('AI mode only'));
  console.log(chalk.white('    /human') + chalk.dim('    ') + chalk.green('Human mode only'));
  console.log(
    chalk.white('    /human <text>') + chalk.dim(' ') + chalk.yellow('Request help from engineer')
  );
  console.log();

  console.log(chalk.bold.magenta('  📋 Task Management:'));
  console.log(chalk.white('    /tasks') + chalk.dim('    ') + chalk.cyan('List open tasks'));
  console.log(chalk.white('    /cancel <id>') + chalk.dim(' ') + chalk.red('Cancel a task'));
  console.log();

  console.log(chalk.bold.magenta('  🤝 MCP Tools (requires setup):'));
  console.log(chalk.white('    /cvf') + chalk.dim('         ') + chalk.cyan('Show engineer tools menu'));
  console.log(chalk.white('    /cvf <msg>') + chalk.dim('    ') + chalk.cyan('Quick validation with message'));
  console.log(chalk.white('    /cvf-instant') + chalk.dim(' ') + chalk.cyan('Quick engineer validation (1-10 credits)'));
  console.log(chalk.white('    /cvf-chat') + chalk.dim('    ') + chalk.blue('Extended debugging session (4-1920 credits)'));
  console.log();

  console.log(chalk.bold.magenta('  🛠️  Setup & Project:'));
  console.log(chalk.white('    /setup') + chalk.dim('    ') + chalk.cyan('Set up Claude Code integration') + chalk.green(' (recommended)'));
  console.log(chalk.white('    /init') + chalk.dim('     ') + chalk.yellow('Initialize CodeVF CLI') + chalk.dim(' (beta)'));
  console.log(chalk.white('    /shell') + chalk.dim('    ') + chalk.yellow('Enter local shell'));
  console.log();

  console.log(chalk.bold.magenta('  ⚙️  Other:'));
  console.log(chalk.white('    /?') + chalk.dim('         ') + chalk.cyan('Show this help'));
  console.log(chalk.white('    /exit') + chalk.dim('      ') + chalk.red('Quit CLI'));
  console.log();

  console.log(chalk.bold.magenta('  💰 Credits & AI:'));
  console.log(chalk.dim('    • 🧠 AI=OpenCode ') + chalk.green('(free with usage limits)'));
  console.log(chalk.dim('    • 🤝 Vibe mode=') + chalk.yellow('2-3 credits per use'));
  console.log(chalk.dim('    • 👨‍💻 Human engineer=') + chalk.red('2 credits/minute'));
  console.log(
    chalk.dim('    • ⚙️  You can configure any AI provider in ') + chalk.white('.codevf/config.json')
  );
  console.log(chalk.dim('    • ❤️  Support OpenCode: ') + chalk.underline.blue('opencode.ai/auth'));
  console.log();
}

/**
 * Displays mode switch notification
 */
export function showModeSwitched(mode: RoutingMode): void {
  const modeLabel = getModeLabel(mode);
  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0);
  console.log(chalk.dim('  Switched to ') + modeLabel);
}

/**
 * Gets the colored label for a routing mode
 */
export function getModeLabel(mode: RoutingMode): string {
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
}

/**
 * Creates a cancelable spinner with ESC key support
 */
export async function runWithCancelableSpinner<T>(
  task: (abortSignal: AbortSignal, spinner: Ora) => Promise<T>,
  spinnerText: string
): Promise<T | null> {
  const spinner = ora({
    text: spinnerText,
    color: 'cyan',
    spinner: 'dots12',
    indent: 2,
    prefixText: '',
  }).start();

  const abortController = new AbortController();
  let cancelled = false;

  const setupEscapeListener = () => {
    if (!process.stdin.isTTY) return () => {};

    readline.emitKeypressEvents(process.stdin);
    const wasRaw = process.stdin.isRaw;
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }

    const onKeyPress = (_str: string, key: readline.Key) => {
      if (key.name === 'escape') {
        cancelled = true;
        abortController.abort();
        spinner.stop();
        console.log(chalk.yellow('  [!] Cancelled by user'));
        cleanup();
      }
    };

    const cleanup = () => {
      process.stdin.removeListener('keypress', onKeyPress);
      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(wasRaw || false);
      }
    };

    process.stdin.on('keypress', onKeyPress);
    spinner.text = `${spinnerText} ${chalk.yellow('(ESC to cancel)')}`;

    return cleanup;
  };

  const cleanup = setupEscapeListener();

  try {
    const result = await task(abortController.signal, spinner);
    spinner.stop();
    cleanup();
    return result;
  } catch (error: any) {
    spinner.stop();
    cleanup();
    if (cancelled || error.name === 'AbortError') {
      return null;
    }
    throw error;
  }
}

/**
 * Renders tunnel status in the session UI
 */
export function renderTunnelStatus(tunnel: { url: string; port: number; createdAt: Date } | null): string {
  if (!tunnel) {
    return '';
  }

  const duration = Math.floor((Date.now() - tunnel.createdAt.getTime()) / 60000);
  return chalk.dim(
    `🌐 Tunnel active • Port ${tunnel.port} • ${duration} min • ${chalk.cyan(tunnel.url)}`
  );
}

/**
 * Renders tunnel notification message
 */
export function renderTunnelNotification(type: 'created' | 'closed', url?: string): void {
  if (type === 'created' && url) {
    console.log(chalk.green(`\n✓ Tunnel created: ${chalk.cyan(url)}`));
    console.log(chalk.dim('  Engineer can now access your local server\n'));
  } else if (type === 'closed') {
    console.log(chalk.yellow('\n✓ Tunnel closed'));
    console.log(chalk.dim('  Local server is no longer accessible\n'));
  }
}
