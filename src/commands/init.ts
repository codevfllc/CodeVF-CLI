import prompts from 'prompts';
import ora from 'ora';
import chalk from 'chalk';
import { AuthManager } from '../modules/auth.js';
import { ConfigManager } from '../modules/config.js';
import { ApiClient } from '../modules/api.js';
import { detectProjectType } from '../utils/detect.js';
import { createRepoZip } from '../utils/upload.js';
import { Config } from '../types/index.js';
import { execSync } from 'child_process';
import { loginCommand } from './login.js';

async function getRepoUrl(): Promise<string> {
  try {
    const remoteUrl = execSync('git config --get remote.origin.url', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();

    // Clean up SSH URLs to HTTPS format
    if (remoteUrl.startsWith('git@')) {
      return remoteUrl.replace('git@github.com:', 'https://github.com/').replace('.git', '');
    }

    return remoteUrl.replace('.git', '');
  } catch (error) {
    return '';
  }
}

export async function initCommand(): Promise<void> {
  const authManager = new AuthManager();
  const configManager = new ConfigManager();

  console.log(chalk.bold.blue('\n🚀 CodeVF Project Initialization\n'));

  // Check authentication - if not authenticated, prompt to login
  if (!authManager.isAuthenticated()) {
    console.log(chalk.yellow('⚠ Not authenticated.'));
    const { shouldLogin } = await prompts({
      type: 'confirm',
      name: 'shouldLogin',
      message: 'Would you like to login now?',
      initial: true,
    });

    if (!shouldLogin) {
      console.log(chalk.dim('\nInitialization cancelled. Please run "codevf login" when ready.\n'));
      process.exit(1);
    }

    // Run login flow
    await loginCommand();

    // Check if login was successful
    if (!authManager.isAuthenticated()) {
      console.log(chalk.red('\n✖ Login failed or was cancelled.\n'));
      process.exit(1);
    }

    console.log(chalk.green('\n✓ Login successful! Continuing with initialization...\n'));
  }

  // Check if already initialized
  if (configManager.isInitialized()) {
    console.log(chalk.yellow('⚠ This project is already initialized.'));
    const { reinit } = await prompts({
      type: 'confirm',
      name: 'reinit',
      message: 'Do you want to reinitialize?',
      initial: false,
    });

    if (!reinit) {
      console.log(chalk.dim('\nInitialization cancelled.\n'));
      return;
    }
  }

  const apiClient = new ApiClient(authManager);

  // Ask: Link to existing project or create new one?
  let { linkMode } = await prompts({
    type: 'select',
    name: 'linkMode',
    message: 'Do you want to link to an existing project or create a new one?',
    choices: [
      { title: 'Link to existing project', value: 'existing' },
      { title: 'Create new project', value: 'new' },
    ],
  });

  if (!linkMode) {
    console.log(chalk.dim('\nInitialization cancelled.\n'));
    return;
  }

  let projectId: string | undefined;
  let repoUrl: string | undefined;

  if (linkMode === 'existing') {
    // Fetch existing projects
    const spinner = ora('Fetching your projects...').start();
    try {
      const { projects } = await apiClient.getProjects();
      spinner.stop();

      if (projects.length === 0) {
        console.log(chalk.yellow('\n⚠ You have no existing projects. Creating a new one...\n'));
        linkMode = 'new'; // Fall through to new project creation
      } else {
        const { selectedProject } = await prompts({
          type: 'select',
          name: 'selectedProject',
          message: 'Select a project to link:',
          choices: projects.map((p: any) => ({
            title: `${p.repoUrl} (ID: ${p.id})`,
            value: p.id.toString(),
          })),
        });

        if (!selectedProject) {
          console.log(chalk.dim('\nInitialization cancelled.\n'));
          return;
        }

        projectId = selectedProject;
        const selectedProjectData = projects.find((p: any) => p.id.toString() === selectedProject);
        repoUrl = selectedProjectData?.repoUrl || '';
        console.log(chalk.green(`\n✓ Linked to project: ${repoUrl} (ID: ${projectId})\n`));
      }
    } catch (error) {
      spinner.fail('Failed to fetch projects');
      throw error;
    }
  }

  if (linkMode === 'new') {
    // Create new project
    const detectedRepoUrl = await getRepoUrl();

    const { newRepoUrl, problemDescription } = await prompts([
      {
        type: 'text',
        name: 'newRepoUrl',
        message: 'Repository URL:',
        initial: detectedRepoUrl,
        validate: (value) => (value.trim() ? true : 'Repository URL is required'),
      },
      {
        type: 'text',
        name: 'problemDescription',
        message: 'Project description (optional):',
        initial: '',
      },
    ]);

    if (!newRepoUrl) {
      console.log(chalk.dim('\nInitialization cancelled.\n'));
      return;
    }

    const spinner = ora('Creating new project...').start();
    try {
      const { project } = await apiClient.createProject(newRepoUrl, problemDescription);
      projectId = project.id.toString();
      repoUrl = project.repoUrl;
      spinner.succeed(chalk.green(`Created project: ${repoUrl} (ID: ${projectId})`));
    } catch (error) {
      spinner.fail('Failed to create project');
      throw error;
    }
  }

  // Detect project type
  console.log(chalk.cyan('\nDetecting project type...'));
  const detection = detectProjectType();

  if (detection.type !== 'unknown') {
    console.log(
      chalk.green(`✓ Detected: ${detection.type} project (${detection.confidence}% confidence)`)
    );
    console.log(chalk.dim(`  Indicators: ${detection.indicators.join(', ')}\n`));
  } else {
    console.log(chalk.yellow('⚠ Could not auto-detect project type\n'));
  }

  // Interactive wizard
  const answers = await prompts([
    {
      type: 'select',
      name: 'projectType',
      message: 'Select your project type:',
      choices: [
        { title: 'Node.js', value: 'node' },
        { title: 'Python', value: 'python' },
        { title: 'Go', value: 'go' },
        { title: 'Ruby', value: 'ruby' },
        { title: 'Java', value: 'java' },
        { title: 'Rust', value: 'rust' },
        { title: 'Other', value: 'unknown' },
      ],
      initial:
        detection.type === 'unknown'
          ? 0
          : ['node', 'python', 'go', 'ruby', 'java', 'rust'].indexOf(detection.type),
    },
    {
      type: 'text',
      name: 'testCommand',
      message: 'Test command:',
      initial: detection.suggestedTestCommand || '',
    },
    {
      type: 'text',
      name: 'buildCommand',
      message: 'Build command (leave empty if not applicable):',
      initial: detection.suggestedBuildCommand || '',
    },
    {
      type: 'multiselect',
      name: 'allowedTools',
      message: 'Which AI tools should engineers be allowed to use?',
      choices: [
        { title: 'Claude (Anthropic)', value: 'claude', selected: true },
        { title: 'Gemini (Google)', value: 'gemini', selected: true },
        { title: 'GPT (OpenAI)', value: 'gpt', selected: false },
        { title: 'None', value: 'none', selected: false },
      ],
      hint: 'Space to select, Enter to confirm',
    },
    {
      type: 'confirm',
      name: 'enableAi',
      message: 'Enable local AI for faster responses?',
      initial: true,
    },
    {
      type: 'confirm',
      name: 'uploadCode',
      message: 'Upload code snapshot for faster debugging?',
      initial: true,
    },
    {
      type: 'confirm',
      name: 'allowBranchAccess',
      message: 'Allow engineers to access the "codevf" branch only?',
      initial: true,
    },
    {
      type: 'number',
      name: 'devServerPort',
      message: 'What port is your dev server running on? (for tunnel support)',
      initial: 3000,
      validate: (value) =>
        value > 0 && value < 65536 ? true : 'Port must be between 1 and 65535',
    },
    {
      type: 'confirm',
      name: 'allowTunnels',
      message: 'Allow engineers to request tunnel access to your local dev server?',
      initial: true,
    },
  ]);

  // Handle cancellation
  if (Object.keys(answers).length === 0) {
    console.log(chalk.dim('\nInitialization cancelled.\n'));
    return;
  }

  // Ensure projectId is set
  if (!projectId || !repoUrl) {
    console.log(chalk.red('Error: Failed to get project ID. Please try again.\n'));
    process.exit(1);
  }

  const spinner = ora('Finalizing project setup...').start();

  try {
    // Upload code if requested
    if (answers.uploadCode) {
      spinner.text = 'Creating code snapshot...';
      const zipBuffer = await createRepoZip(process.cwd());

      spinner.text = 'Uploading code snapshot...';
      await apiClient.uploadRepoSnapshot(projectId, zipBuffer);
    }

    // Save config
    const config: Config = {
      projectId,
      allowedTools: answers.allowedTools.includes('none') ? [] : answers.allowedTools,
      testCommand: answers.testCommand,
      buildCommand: answers.buildCommand,
      repoUploaded: answers.uploadCode,
      branchMode: answers.allowBranchAccess ? 'codevf' : 'all',
      createdAt: new Date().toISOString(),
      version: '1',
      devServerPort: answers.devServerPort || 3000,
      tunnel: {
        allowTunnels: answers.allowTunnels,
        autoApprove: false, // Never auto-approve for security
        allowedPorts: [answers.devServerPort || 3000],
        maxDuration: 86400000, // 24 hours in milliseconds
      },
      ai: answers.enableAi
        ? {
            enabled: true,
            provider: 'opencode',
            sdk: {
              apiKeyEnv: 'OPENCODE_API_KEY',
              baseUrlEnv: 'OPENCODE_BASE_URL',
              model: null,
              defaultArgs: {},
            },
            defaultArgs: {},
            maxRunMs: null,
            logTranscripts: true,
            tools: {
              consultEngineer: {
                enabled: true,
                maxCreditsPerCall: 10,
                highUrgencyCredits: 20,
              },
            },
          }
        : {
            enabled: false,
            provider: 'opencode',
            sdk: {
              apiKeyEnv: 'OPENCODE_API_KEY',
              baseUrlEnv: 'OPENCODE_BASE_URL',
              model: null,
              defaultArgs: {},
            },
            defaultArgs: {},
            maxRunMs: null,
            logTranscripts: false,
          },
    };

    configManager.saveConfig(config);
    spinner.succeed(chalk.green('Project initialized successfully!'));

    // Print summary
    console.log(chalk.bold('\n📋 Configuration Summary:'));
    console.log(chalk.dim('━'.repeat(60)));
    console.log(`${chalk.cyan('Project ID:')} ${config.projectId}`);
    console.log(`${chalk.cyan('Repository:')} ${repoUrl}`);
    console.log(`${chalk.cyan('Project Type:')} ${answers.projectType}`);
    console.log(`${chalk.cyan('Test Command:')} ${config.testCommand || chalk.dim('(none)')}`);
    console.log(`${chalk.cyan('Build Command:')} ${config.buildCommand || chalk.dim('(none)')}`);
    console.log(
      `${chalk.cyan('Allowed Tools:')} ${config.allowedTools.length > 0 ? config.allowedTools.join(', ') : chalk.dim('none')}`
    );
    console.log(
      `${chalk.cyan('Local AI (opencode):')} ${config.ai?.enabled ? 'Enabled' : chalk.dim('Disabled')}`
    );
    if (config.ai?.enabled) {
      console.log(
        `${chalk.cyan('AI Model:')} ${config.ai.sdk.model || chalk.dim('(none specified)')}`
      );
      console.log(
        `${chalk.cyan('AI API Key Env:')} ${config.ai.sdk.apiKeyEnv || chalk.dim('(not set)')}`
      );
      console.log(
        `${chalk.cyan('AI Logs:')} ${config.ai.logTranscripts ? 'Local transcripts on' : 'Off'}`
      );
      console.log(
        `${chalk.cyan('Tools:')} consultEngineer (10 credits/call)`
      );
    }
    console.log(`${chalk.cyan('Code Uploaded:')} ${config.repoUploaded ? 'Yes' : 'No'}`);
    console.log(`${chalk.cyan('Branch Mode:')} ${config.branchMode}`);
    console.log(
      `${chalk.cyan('Tunnel Support:')} ${config.tunnel?.allowTunnels ? `Enabled (port ${config.devServerPort})` : chalk.dim('Disabled')}`
    );
    console.log(chalk.dim('━'.repeat(60)));

    console.log(chalk.dim('\nNext steps:'));
    console.log(chalk.dim('  • Start a debug session: codevf'));
    console.log(chalk.dim('  • Sync your changes: codevf sync\n'));
  } catch (error) {
    spinner.fail('Initialization failed');
    throw error;
  }
}
