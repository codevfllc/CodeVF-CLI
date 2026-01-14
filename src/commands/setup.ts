/**
 * Setup command for CodeVF MCP Server configuration
 */

import chalk from 'chalk';
import prompts from 'prompts';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ConfigManager } from '../lib/config/manager.js';
import { OAuthFlow } from '../lib/auth/oauth-flow.js';
import { commandContent } from './cvf-command-content.js';
import { chatCommandContent } from './cvf-chat-command-content.js';
import { CLI_VERSION } from '../modules/constants.js';
import { checkForUpdates } from '../utils/version-check.js';

type McpServerConfig = {
  command: string;
  args: string[];
};

type ClaudeConfig = {
  mcpServers?: Record<string, McpServerConfig>;
};

type GeminiConfig = {
  mcpServers?: Record<string, McpServerConfig>;
  mcp_servers?: Record<string, McpServerConfig>;
};

/**
 * Get Claude Code config path based on platform
 */
function getClaudeCodeConfigPath(): string | null {
  const platform = os.platform();
  const homeDir = os.homedir();

  if (platform === 'darwin' || platform === 'linux') {
    return path.join(homeDir, '.claude.json');
  } else if (platform === 'win32') {
    return path.join(homeDir, '.claude.json');
  }

  return null;
}

/**
 * Get Codex MCP config path
 */
function getCodexConfigPath(): string {
  return path.join(os.homedir(), '.codex', 'config.toml');
}

/**
 * Resolve Gemini CLI settings path based on platform and existing files.
 * Supports common locations used by gemini-cli and legacy config paths.
 */
function getGeminiConfigPath(): string {
  const homeDir = os.homedir();
  const platform = os.platform();
  const candidates: string[] = [];

  if (platform === 'win32') {
    const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
    candidates.push(path.join(homeDir, '.gemini', 'settings.json'));
    candidates.push(path.join(appData, 'gemini-cli', 'settings.json'));
    candidates.push(path.join(appData, 'gemini-cli', 'config.json'));
    candidates.push(path.join(homeDir, '.gemini', 'config.json'));
  } else {
    candidates.push(path.join(homeDir, '.gemini', 'settings.json'));
    candidates.push(path.join(homeDir, '.config', 'gemini-cli', 'settings.json'));
    candidates.push(path.join(homeDir, '.config', 'gemini', 'settings.json'));
    candidates.push(path.join(homeDir, '.config', 'gemini-cli', 'config.json'));
    candidates.push(path.join(homeDir, '.config', 'gemini', 'config.json'));
    candidates.push(path.join(homeDir, '.gemini', 'config.json'));
  }

  const settingsCandidates = candidates.filter((candidate) => candidate.endsWith('settings.json'));
  const existingSettings = settingsCandidates.find((candidate) => fs.existsSync(candidate));
  return existingSettings || settingsCandidates[0] || candidates[0];
}

/**
 * Resolve installed MCP server path
 */
function getMcpServerPath(): string {
  const codevfPath = process.argv[1]; // Path to codevf binary
  let resolvedPath = codevfPath;
  try {
    // Follow npm/yarn/pnpm bin symlinks to the actual package entrypoint.
    resolvedPath = fs.realpathSync(codevfPath);
  } catch {
    // Fall back to argv path if it cannot be resolved (e.g. permissions or missing file).
  }

  const packageDir = path.dirname(path.dirname(resolvedPath)); // Go up from dist/index.js
  return path.join(packageDir, 'dist', 'mcp', 'index.js');
}

/**
 * Create /cvf slash command for Claude Code
 */
function createCvfSlashCommand(): boolean {
  try {
    const homeDir = os.homedir();
    const commandsDir = path.join(homeDir, '.claude', 'commands');
    const cvfCommandPath = path.join(commandsDir, 'cvf.md');
    const cvfChatCommandPath = path.join(commandsDir, 'cvf-chat.md');

    // Create commands directory if it doesn't exist
    if (!fs.existsSync(commandsDir)) {
      fs.mkdirSync(commandsDir, { recursive: true, mode: 0o755 });
    }

    // Check if cvf.md already exists
    if (fs.existsSync(cvfCommandPath)) {
      console.log(chalk.green('✅ /cvf slash command already exists'));
    } else {
      fs.writeFileSync(cvfCommandPath, commandContent, { mode: 0o644 });
      console.log(chalk.green('✅ Created /cvf slash command for Claude Code'));
    }

    // Check if cvf-chat.md already exists
    if (fs.existsSync(cvfChatCommandPath)) {
      console.log(chalk.green('✅ /cvf-chat slash command already exists'));
      return true;
    }

    fs.writeFileSync(cvfChatCommandPath, chatCommandContent, { mode: 0o644 });
    console.log(chalk.green('✅ Created /cvf-chat slash command for Claude Code'));
    return true;
  } catch (error) {
    console.log(chalk.yellow('⚠️  Could not create /cvf slash command:'), (error as Error).message);
    return false;
  }
}

/**
 * Auto-configure Codex with MCP server
 */
async function autoConfigureCodex(): Promise<boolean> {
  console.log(chalk.bold('\n📋 Codex Configuration\n'));

  const configPath = getCodexConfigPath();

  const { shouldConfigure } = await prompts({
    type: 'confirm',
    name: 'shouldConfigure',
    message: 'Configure Codex to use CodeVF MCP server?',
    initial: true,
  });

  if (!shouldConfigure) {
    console.log(chalk.dim('\n💡 To configure manually, add to ~/.codex/config.toml:'));
    console.log(chalk.dim('   [mcp_servers.codevf]'));
    console.log(chalk.dim('   command = "node"'));
    console.log(chalk.dim('   args = ["<path>/dist/mcp/index.js"]'));
    return false;
  }

  try {
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true, mode: 0o755 });
    }

    let configContent = '';
    if (fs.existsSync(configPath)) {
      configContent = fs.readFileSync(configPath, 'utf8');
    }

    const hasCodevf = /^\s*\[mcp_servers\.codevf\]\s*$/m.test(configContent);
    if (hasCodevf) {
      console.log(chalk.green('✅ CodeVF MCP server already configured for Codex!'));
      return true;
    }

    const mcpServerPath = getMcpServerPath();
    const block = [
      '[mcp_servers.codevf]',
      'command = "node"',
      `args = ["${mcpServerPath}"]`,
      '',
    ].join('\n');

    const nextContent =
      configContent.trim().length === 0
        ? `${block}\n`
        : `${configContent.trimEnd()}\n\n${block}\n`;

    fs.writeFileSync(configPath, nextContent, { mode: 0o600 });
    console.log(chalk.green('✅ Codex configured successfully!'));
    return true;
  } catch (error) {
    console.error(chalk.red('\n❌ Codex auto-config failed:'), (error as Error).message);
    return false;
  }
}

/**
 * Auto-configure Gemini CLI with MCP server
 */
async function autoConfigureGemini(): Promise<boolean> {
  console.log(chalk.bold('\n📋 Gemini Configuration\n'));

  const configPath = getGeminiConfigPath();

  const { shouldConfigure } = await prompts({
    type: 'confirm',
    name: 'shouldConfigure',
    message: 'Configure Gemini to use CodeVF MCP server?',
    initial: true,
  });

  if (!shouldConfigure) {
    console.log(chalk.dim(`\n💡 To configure manually, add to ${configPath}:`));
    console.log(chalk.dim('   {'));
    console.log(chalk.dim('     "mcpServers": {'));
    console.log(chalk.dim('       "codevf": {'));
    console.log(chalk.dim('         "command": "node",'));
    console.log(chalk.dim('         "args": ["<path>/dist/mcp/index.js"]'));
    console.log(chalk.dim('       }'));
    console.log(chalk.dim('     }'));
    console.log(chalk.dim('   }'));
    return false;
  }

  try {
    // Backup existing config
    if (fs.existsSync(configPath)) {
      const backupPath = `${configPath}.backup`;
      console.log(chalk.dim('\n📋 Backing up existing config...'));
      fs.copyFileSync(configPath, backupPath);
      console.log(chalk.dim(`   Backup: ${backupPath}`));
    }

    // Read or create config
    let config: GeminiConfig = {};
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      config = JSON.parse(content);
    }

    const mcpServerPath = getMcpServerPath();
    const mcpKey = config.mcpServers ? 'mcpServers' : config.mcp_servers ? 'mcp_servers' : 'mcpServers';

    if (!config[mcpKey]) {
      config[mcpKey] = {};
    }

    if (config[mcpKey].codevf) {
      console.log(chalk.green('✅ CodeVF MCP server already configured for Gemini!'));
      return true;
    }

    config[mcpKey].codevf = {
      command: 'node',
      args: [mcpServerPath],
    };

    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true, mode: 0o755 });
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
    console.log(chalk.green('✅ Gemini configured successfully!'));
    return true;
  } catch (error) {
    console.error(chalk.red('\n❌ Gemini auto-config failed:'), (error as Error).message);
    return false;
  }
}

/**
 * Auto-configure Claude Code with MCP server
 */
async function autoConfigureClaudeCode(): Promise<boolean> {
  console.log(chalk.bold('\n📋 Claude Code Configuration\n'));

  const configPath = getClaudeCodeConfigPath();

  if (!configPath) {
    console.log(chalk.yellow('⚠️  Could not detect Claude Code config path'));
    console.log(chalk.dim('   Please configure manually'));
    return false;
  }

  // Ask user if they want auto-config
  const { shouldConfigure } = await prompts({
    type: 'confirm',
    name: 'shouldConfigure',
    message: 'Configure Claude Code to use CodeVF MCP server?',
    initial: true,
  });

  if (!shouldConfigure) {
    console.log(chalk.dim('\n💡 To configure manually, add to ~/.claude.json:'));
    console.log(chalk.dim('   {'));
    console.log(chalk.dim('     "mcpServers": {'));
    console.log(chalk.dim('       "codevf": {'));
    console.log(chalk.dim('         "command": "node",'));
    console.log(chalk.dim('         "args": ["<path>/dist/mcp/index.js"]'));
    console.log(chalk.dim('       }'));
    console.log(chalk.dim('     }'));
    console.log(chalk.dim('   }'));
    return false;
  }

  try {
    // Backup existing config
    if (fs.existsSync(configPath)) {
      const backupPath = `${configPath}.backup`;
      console.log(chalk.dim('\n📋 Backing up existing config...'));
      fs.copyFileSync(configPath, backupPath);
      console.log(chalk.dim(`   Backup: ${backupPath}`));
    }

    // Read or create config
    let config: ClaudeConfig = {};
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      config = JSON.parse(content);
    }

    const mcpServerPath = getMcpServerPath();

    // Add or update codevf server
    if (!config.mcpServers) {
      config.mcpServers = {};
    }

    if (config.mcpServers.codevf) {
      console.log(chalk.green('✅ CodeVF MCP server already configured!'));
    } else {
      config.mcpServers.codevf = {
        command: 'node',
        args: [mcpServerPath],
      };

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
      console.log(chalk.green('✅ Claude Code configured successfully!'));
    }

    // Create /cvf slash command
    createCvfSlashCommand();

    return true;
  } catch (error) {
    console.error(chalk.red('\n❌ Auto-config failed:'), (error as Error).message);
    return false;
  }
}

/**
 * Setup command - configures MCP server for Claude Code, Codex, and Gemini
 */
export interface SetupCommandOptions {
  baseUrl?: string;
}

export async function setupCommand(options: SetupCommandOptions = {}): Promise<void> {
  console.log(chalk.bold.blue('\n╔═══════════════════════════════════════╗'));
  console.log(chalk.bold.blue('║   CodeVF MCP Server Setup             ║'));
  console.log(chalk.bold.blue('╚═══════════════════════════════════════╝\n'));

  const updateCheck = await checkForUpdates({ currentVersion: CLI_VERSION });
  if (updateCheck?.isOutdated) {
    console.log(
      chalk.yellow(
        `⚠️  Update available: ${updateCheck.currentVersion} → ${updateCheck.latestVersion}`
      )
    );
    console.log(chalk.dim('   Run: npm install -g codevf@latest'));
    console.log(chalk.dim('   Or: npx codevf@latest setup'));
    console.log('');
  }

  const mcpConfigManager = new ConfigManager('mcp-config.json');

  // Check if already configured and reuse base URL if present
  const baseUrlOverride = options.baseUrl?.trim();
  let baseUrl = baseUrlOverride || process.env.CODEVF_API_URL || 'https://codevf.com';

  if (mcpConfigManager.exists()) {
    const existingConfig = mcpConfigManager.load();
    console.log(chalk.yellow('⚠️  MCP configuration already exists'));
    console.log(chalk.dim(`   User ID: ${existingConfig.auth?.userId || 'unknown'}`));
    console.log(chalk.dim(`   Base URL: ${existingConfig.baseUrl}\n`));

    const { reconfigure } = await prompts({
      type: 'confirm',
      name: 'reconfigure',
      message: 'Reconfigure authentication?',
      initial: false,
    });

    if (!reconfigure) {
      // Update client configs without re-authenticating
      await autoConfigureClaudeCode();
      await autoConfigureCodex();
      await autoConfigureGemini();
      console.log(chalk.green('\n🎉 Setup complete!\n'));
      return;
    }

    // Reuse existing base URL when reconfiguring (unless env override)
    if (!baseUrlOverride && !process.env.CODEVF_API_URL && existingConfig.baseUrl) {
      baseUrl = existingConfig.baseUrl;
    }
  }

  console.log(chalk.dim(`Using CodeVF at: ${baseUrl}\n`));

  const spinner = ora('Initializing authentication...').start();

  try {
    // Run OAuth flow with MCP type
    spinner.text = 'Opening browser for authentication...';
    const oauthFlow = new OAuthFlow(baseUrl, 'mcp');
    const authResult = await oauthFlow.authenticate();

    spinner.succeed('Authentication successful!');

    // Fetch existing projects for selection
    let projectId;
    try {
      spinner.start('Fetching your projects...');
      
      const response = await fetch(`${baseUrl}/api/cli/projects`, {
        headers: {
          'Authorization': `Bearer ${authResult.accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json() as {
          success: boolean;
          selectionOptions?: Array<{
            value: string;
            label: string;
            description: string;
          }>;
          message?: string;
        };
        spinner.succeed('Projects loaded');

        if (data.success && data.selectionOptions) {
          console.log(chalk.dim('\n' + (data.message || '')));

          const { selectedProject } = await prompts({
            type: 'select',
            name: 'selectedProject',
            message: 'Choose a default project:',
            choices: data.selectionOptions.map((option) => ({
              title: option.label,
              description: option.description,
              value: option.value
            })),
            initial: 0,
          });

          projectId = selectedProject === 'new' ? undefined : selectedProject;
        } else {
          // Provide user-friendly fallback when API fails
          spinner.warn('Could not load existing projects from server');

          const { projectChoice } = await prompts({
            type: 'select',
            name: 'projectChoice',
            message: 'How would you like to configure the default project?',
            choices: [
              {
                title: '🆕 Create a new project when needed',
                description: 'The CLI will create a new project automatically',
                value: 'new'
              },
              {
                title: '📝 Enter a specific project ID',
                description: 'If you know the ID of an existing project',
                value: 'manual'
              },
              {
                title: '⏩ Skip for now',
                description: 'You can configure this later',
                value: 'skip'
              }
            ],
            initial: 0,
          });

          if (projectChoice === 'manual') {
            const { manualProjectId } = await prompts({
              type: 'text',
              name: 'manualProjectId',
              message: 'Enter project ID:',
              initial: '',
              validate: (value) => {
                if (!value.trim()) return 'Project ID cannot be empty';
                if (!/^\d+$/.test(value.trim())) return 'Project ID must be a number';
                return true;
              }
            });
            projectId = manualProjectId?.trim();
          } else {
            projectId = undefined; // Either 'new' or 'skip' - both result in no default project
          }
        }
      } else {
        spinner.warn('Could not connect to CodeVF servers');

        await prompts({
          type: 'select',
          name: 'offlineChoice',
          message: 'Unable to fetch projects. How would you like to proceed?',
          choices: [
            {
              title: '🆕 Create new projects automatically',
              description: 'The CLI will create projects as needed',
              value: 'auto'
            },
            {
              title: '⏩ Skip project configuration',
              description: 'Configure later when connection is available',
              value: 'skip'
            }
          ],
          initial: 0,
        });

        projectId = undefined; // No default project in offline mode
      }
    } catch (error) {
      spinner.warn('Connection error while loading projects');
      console.log(chalk.dim(`   Error: ${(error as Error).message}`));

      await prompts({
        type: 'select',
        name: 'errorChoice',
        message: 'Unable to connect to CodeVF. How would you like to proceed?',
        choices: [
          {
            title: '🆕 Create new projects automatically',
            description: 'The CLI will create projects when needed',
            value: 'auto'
          },
          {
            title: '⏩ Skip project configuration',
            description: 'Configure later when connection is restored',
            value: 'skip'
          }
        ],
        initial: 0,
      });

      projectId = undefined; // No default project when connection fails
    }

    // Save MCP configuration
    mcpConfigManager.save({
      baseUrl,
      auth: {
        accessToken: authResult.accessToken,
        refreshToken: authResult.refreshToken,
        expiresAt: authResult.expiresAt,
        userId: authResult.userId,
      },
      defaults: {
        maxCredits: 240,
        projectId: projectId || undefined,
      },
    });

    console.log(chalk.green('\n✅ Authentication complete!'));
    console.log(chalk.dim('Configuration saved to:'), mcpConfigManager.getPath());

    const configuredClaude = await autoConfigureClaudeCode();
    const configuredCodex = await autoConfigureCodex();
    const configuredGemini = await autoConfigureGemini();

    console.log(chalk.bold.green('\n🎉 Setup complete!\n'));

    if (configuredClaude || configuredCodex || configuredGemini) {
      console.log(chalk.bold('Next steps:'));

      if (configuredClaude) {
        console.log(chalk.dim('1. Restart Claude Code to load the MCP server'));
        console.log(chalk.dim('2. Use the /cvf slash command in Claude Code:'));
        console.log(chalk.dim('   Example: ') + chalk.white('/cvf Does this fix work?'));
        console.log(chalk.dim('   Example: ') + chalk.white('/cvf Create tunnel to port 3000'));
        console.log(chalk.dim('3. Or ask Claude to use MCP tools directly:'));
        console.log(chalk.dim('   - codevf-instant: Quick validation (1-10 credits)'));
        console.log(chalk.dim('   - codevf-chat: Extended debugging (2 credits/min)'));
        console.log(chalk.dim('   - codevf-tunnel: Expose local dev server (free)\n'));
      }

      if (configuredCodex) {
        console.log(chalk.dim('1. Restart Codex to load the MCP server'));
        console.log(chalk.dim('2. Use /mcp in Codex to confirm CodeVF is connected\n'));
      }

      if (configuredGemini) {
        console.log(chalk.dim('1. Restart Gemini to load the MCP server'));
        console.log(chalk.dim('2. Confirm CodeVF MCP tools are available\n'));
      }
    }
  } catch (error) {
    spinner.fail('Setup failed');
    console.error(chalk.red('\n❌ Error:'), (error as Error).message);
    process.exit(1);
  }
}
