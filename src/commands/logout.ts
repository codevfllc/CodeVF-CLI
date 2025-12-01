import chalk from 'chalk';
import { AuthManager } from '../modules/auth.js';

export async function logoutCommand(): Promise<void> {
  const authManager = new AuthManager();

  console.log(chalk.bold.blue('\n👋 CodeVF Logout\n'));

  if (!authManager.isAuthenticated()) {
    console.log(chalk.yellow('Not currently logged in.'));
    return;
  }

  authManager.clearToken();
  console.log(chalk.green('✓ Successfully logged out'));
  console.log(chalk.dim('\nTo login again, run: codevf login\n'));
}
