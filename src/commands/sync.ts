import ora from 'ora';
import chalk from 'chalk';
import { AuthManager } from '../modules/auth.js';
import { ConfigManager } from '../modules/config.js';
import { ApiClient } from '../modules/api.js';
import { GitManager } from '../modules/git.js';
import { SyncProjectRequest, LastSync } from '../types/index.js';

export async function syncCommand(options: { force?: boolean } = {}): Promise<void> {
  const authManager = new AuthManager();
  const configManager = new ConfigManager();
  const gitManager = new GitManager();

  console.log(chalk.bold.blue('\n🔄 CodeVF Sync\n'));

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

  // Check if git repo
  if (!(await gitManager.isGitRepo())) {
    console.log(chalk.red('Error: Not a git repository.'));
    console.log(chalk.yellow('Please initialize git first: git init\n'));
    process.exit(1);
  }

  const spinner = ora('Checking git status...').start();

  try {
    // Check for uncommitted changes
    const hasChanges = await gitManager.hasUncommittedChanges();
    if (hasChanges && !options.force) {
      spinner.fail('Working directory has uncommitted changes');
      console.log(chalk.yellow('\nPlease commit or stash your changes before syncing.'));
      console.log(chalk.dim('\nTo commit changes:'));
      console.log(chalk.dim('  git add .'));
      console.log(chalk.dim('  git commit -m "Your message"'));
      console.log(chalk.dim('\nOr use --force to sync anyway (not recommended)\n'));
      process.exit(1);
    }

    // Check current branch
    const currentBranch = await gitManager.getCurrentBranch();
    const expectedBranch = config.branchMode;

    if (currentBranch !== expectedBranch && config.branchMode !== 'all') {
      spinner.warn(`Not on ${expectedBranch} branch (currently on ${currentBranch})`);
      console.log(chalk.yellow(`\nPlease switch to the '${expectedBranch}' branch.`));
      console.log(chalk.dim('\nTo create and switch:'));
      console.log(chalk.dim(`  git checkout -b ${expectedBranch}`));
      console.log(chalk.dim('\nOr to switch if it exists:'));
      console.log(chalk.dim(`  git checkout ${expectedBranch}\n`));
      process.exit(1);
    }

    // Get commit hash
    spinner.text = 'Getting commit information...';
    const commitHash = await gitManager.getCommitHash();

    if (!commitHash) {
      spinner.fail('No commits found');
      console.log(chalk.yellow('\nPlease make at least one commit before syncing.\n'));
      process.exit(1);
    }

    // Sync with backend
    spinner.text = 'Syncing with CodeVF...';
    const apiClient = new ApiClient(authManager);

    const syncRequest: SyncProjectRequest = {
      projectId: config.projectId,
      commitHash,
      branch: currentBranch,
    };

    await apiClient.syncProject(syncRequest);

    // Save last sync
    const lastSync: LastSync = {
      timestamp: new Date().toISOString(),
      commitHash,
      branch: currentBranch,
    };
    configManager.saveLastSync(lastSync);

    spinner.succeed(chalk.green('Sync completed successfully!'));

    console.log(chalk.dim('\n━'.repeat(60)));
    console.log(`${chalk.cyan('Branch:')} ${currentBranch}`);
    console.log(`${chalk.cyan('Commit:')} ${commitHash.substring(0, 8)}`);
    console.log(`${chalk.cyan('Synced at:')} ${new Date().toLocaleString()}`);
    console.log(chalk.dim('━'.repeat(60)));
    console.log(chalk.dim('\nEngineers can now access your latest changes.\n'));
  } catch (error) {
    spinner.fail('Sync failed');
    throw error;
  }
}
