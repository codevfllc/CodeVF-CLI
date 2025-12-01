import chalk from 'chalk';
import { CodeVFError } from '../types/index.js';

export function handleError(error: unknown): void {
  if (error instanceof CodeVFError) {
    console.error(chalk.red(`\nError: ${error.message}`));

    if (error.code) {
      console.error(chalk.dim(`Code: ${error.code}`));
    }

    // Provide helpful hints based on error type
    switch (error.name) {
      case 'AuthError':
        console.error(chalk.yellow('\nPlease run: codevf login'));
        break;
      case 'ConfigError':
        console.error(chalk.yellow('\nPlease run: codevf init'));
        break;
      case 'NetworkError':
        console.error(chalk.yellow('\nPlease check your internet connection.'));
        break;
    }
  } else if (error instanceof Error) {
    console.error(chalk.red(`\nError: ${error.message}`));
  } else {
    console.error(chalk.red('\nAn unexpected error occurred.'));
  }

  process.exit(1);
}

export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
