import open from 'open';
import ora from 'ora';
import chalk from 'chalk';
import { AuthManager } from '../modules/auth.js';
import { ApiClient } from '../modules/api.js';
import { AuthToken } from '../types/index.js';

export async function loginCommand(): Promise<void> {
  const authManager = new AuthManager();
  const apiClient = new ApiClient(authManager);

  console.log(chalk.bold.blue('\n🔐 CodeVF Login\n'));

  // Check if already logged in
  if (authManager.isAuthenticated()) {
    console.log(chalk.green('✓ Already logged in!'));
    console.log(chalk.dim('\nTo logout, run: codevf logout'));
    return;
  }

  const spinner = ora('Initializing authentication...').start();

  try {
    // Initialize OAuth flow
    const { authUrl, pollToken } = await apiClient.initAuth();
    spinner.stop();

    console.log(chalk.cyan('\nOpening browser for authentication...'));
    console.log(chalk.dim(`If browser doesn't open, visit: ${authUrl}\n`));

    // Open browser
    await open(authUrl);

    // Poll for token
    const pollSpinner = ora('Waiting for authentication...').start();

    let attempts = 0;
    const maxAttempts = 60; // 5 minutes (60 * 5 seconds)

    while (attempts < maxAttempts) {
      try {
        const authData = await apiClient.pollAuth(pollToken);

        // Calculate expiration time
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + authData.expiresIn);

        // Save token
        const token: AuthToken = {
          accessToken: authData.accessToken,
          refreshToken: authData.refreshToken,
          expiresAt: expiresAt.toISOString(),
          userId: 'user-id', // This should come from the API
        };

        authManager.saveToken(token);
        pollSpinner.succeed(chalk.green('Authentication successful!'));

        console.log(chalk.dim('\nYou can now use CodeVF CLI commands.'));
        console.log(chalk.dim('Next step: Run "codevf init" in your project directory.\n'));
        return;
      } catch (error) {
        // Continue polling
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    pollSpinner.fail('Authentication timeout. Please try again.');
    process.exit(1);
  } catch (error) {
    spinner.fail('Authentication failed');
    throw error;
  }
}
