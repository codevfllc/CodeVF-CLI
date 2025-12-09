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
 * Create /cvf slash command for Claude Code
 */
function createCvfSlashCommand(): boolean {
  try {
    const homeDir = os.homedir();
    const commandsDir = path.join(homeDir, '.claude', 'commands');
    const cvfCommandPath = path.join(commandsDir, 'cvf.md');

    // Create commands directory if it doesn't exist
    if (!fs.existsSync(commandsDir)) {
      fs.mkdirSync(commandsDir, { recursive: true, mode: 0o755 });
    }

    // Check if cvf.md already exists
    if (fs.existsSync(cvfCommandPath)) {
      console.log(chalk.green('✅ /cvf slash command already exists'));
      return true;
    }

    // Create the slash command file
    const commandContent = `---
description: Ask a CodeVF engineer for help with code validation, debugging, or technical questions
---

# CodeVF Engineer Assistance

Please help me with the following question or task by consulting a CodeVF engineer using the appropriate MCP tool:

**My request:**
{{PROMPT}}

---

**Instructions for Claude:**

1. **Analyze the request** to determine which CodeVF tool is most appropriate:
   - Use \`codevf-instant\` for:
     - Quick validation questions (1-10 credits, ~2 min response)
     - "Does this fix work?"
     - "Is this approach correct?"
     - "Can you identify the error?"
     - Simple technical questions

   - Use \`codevf-chat\` for:
     - Complex debugging requiring back-and-forth (4-1920 credits, 2 credits/min)
     - Multi-step troubleshooting
     - Architecture discussions
     - Extended collaboration

2. **Use the appropriate tool:**
   - For instant queries: Call \`codevf-instant\` with the message and appropriate maxCredits (1-10)
   - For extended sessions: Call \`codevf-chat\` with the message and appropriate maxCredits (suggest 240 for ~2 hours)

3. **Present the response:**
   - For instant queries: Share the engineer's response directly
   - For chat sessions: Provide the session URL so the user can monitor the conversation

**Credit Guidelines:**
- Instant validation: 1-10 credits (typically 3-5 credits per question)
- Extended chat: 2 credits per minute (240 credits = 2 hours)

**Example Usage:**
- \`/cvf Does this authentication fix prevent the timing attack?\` → Use codevf-instant
- \`/cvf Complex race condition in WebSocket reconnection needs debugging\` → Use codevf-chat
`;

    fs.writeFileSync(cvfCommandPath, commandContent, { mode: 0o644 });
    console.log(chalk.green('✅ Created /cvf slash command for Claude Code'));
    return true;
  } catch (error) {
    console.log(chalk.yellow('⚠️  Could not create /cvf slash command:'), (error as Error).message);
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
    let config: any = {};
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      config = JSON.parse(content);
    }

    // Get the installed codevf path
    const codevfPath = process.argv[1]; // Path to codevf binary
    const packageDir = path.dirname(path.dirname(codevfPath)); // Go up from dist/index.js
    const mcpServerPath = path.join(packageDir, 'dist', 'mcp', 'index.js');

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
 * Setup command - configures MCP server for Claude Code
 */
export async function setupCommand(): Promise<void> {
  console.log(chalk.bold.blue('\n╔═══════════════════════════════════════╗'));
  console.log(chalk.bold.blue('║   CodeVF MCP Server Setup             ║'));
  console.log(chalk.bold.blue('╚═══════════════════════════════════════╝\n'));

  const mcpConfigManager = new ConfigManager('mcp-config.json');

  // Check if already configured and reuse base URL if present
  let baseUrl = process.env.CODEVF_API_URL || 'https://app.codevf.com';

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
      // Just update Claude Code config
      await autoConfigureClaudeCode();
      console.log(chalk.green('\n🎉 Setup complete!\n'));
      return;
    }

    // Reuse existing base URL when reconfiguring (unless env override)
    if (!process.env.CODEVF_API_URL && existingConfig.baseUrl) {
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

    // Prompt for default project ID
    const { projectId } = await prompts({
      type: 'text',
      name: 'projectId',
      message: 'Default project ID (optional):',
      initial: '1',
    });

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

    // Configure Claude Code
    const configured = await autoConfigureClaudeCode();

    console.log(chalk.bold.green('\n🎉 Setup complete!\n'));

    if (configured) {
      console.log(chalk.bold('Next steps:'));
      console.log(chalk.dim('1. Restart Claude Code to load the MCP server'));
      console.log(chalk.dim('2. Use the /cvf slash command in Claude Code:'));
      console.log(chalk.dim('   Example: ') + chalk.white('/cvf Does this fix work?'));
      console.log(chalk.dim('3. Or ask Claude to use codevf-instant or codevf-chat tools\n'));
    }
  } catch (error) {
    spinner.fail('Setup failed');
    console.error(chalk.red('\n❌ Error:'), (error as Error).message);
    process.exit(1);
  }
}
