import prompts from 'prompts';
import chalk from 'chalk';
import { shouldWarnAboutFile } from '../utils/upload.js';

export class PermissionManager {
  async requestCommandPermission(command: string, reason?: string): Promise<boolean> {
    console.log('\n' + chalk.yellow('━'.repeat(60)));
    console.log(chalk.bold.yellow('Engineer requests to run:'));
    console.log(chalk.white(`  ${command}`));
    if (reason) {
      console.log(chalk.dim(`  Reason: ${reason}`));
    }
    console.log(chalk.yellow('━'.repeat(60)));

    const response = await prompts({
      type: 'confirm',
      name: 'approved',
      message: `Allow command: "${command}"?`,
      initial: false,
    });

    return response.approved ?? false;
  }

  async requestFilePermission(filePath: string, reason?: string): Promise<boolean> {
    console.log('\n' + chalk.yellow('━'.repeat(60)));
    console.log(chalk.bold.yellow('Engineer requests file:'));
    console.log(chalk.white(`  ${filePath}`));
    if (reason) {
      console.log(chalk.dim(`  Reason: ${reason}`));
    }

    const isSensitive = shouldWarnAboutFile(filePath);
    if (isSensitive) {
      console.log(
        chalk.red.bold('  ⚠ WARNING: This file may contain sensitive information!')
      );
    }

    console.log(chalk.yellow('━'.repeat(60)));

    const response = await prompts({
      type: 'confirm',
      name: 'approved',
      message: `Allow file access: "${filePath}"?${isSensitive ? ' ⚠ SENSITIVE' : ''}`,
      initial: false,
    });

    return response.approved ?? false;
  }
}
