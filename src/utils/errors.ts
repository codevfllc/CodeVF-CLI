import chalk from 'chalk';
import { CodeVFError } from '../lib/utils/errors.js';
import { logger } from '../lib/utils/logger.js';

export function handleError(error: unknown): void {
  if (error instanceof CodeVFError) {
    logger.error(chalk.red(`\nError: ${error.message}`));

    if ('code' in error) {
      logger.error(chalk.dim(`Code: ${String((error as { code?: string }).code ?? '')}`));
    }

    // Provide helpful hints based on error type
    switch (error.name) {
      case 'AuthError':
        logger.error(chalk.yellow('\nPlease run: npx codevf setup'));
        break;
      case 'ConfigError':
        logger.error(chalk.yellow('\nPlease run: npx codevf setup'));
        break;
      case 'NetworkError':
        logger.error(chalk.yellow('\nPlease check your internet connection.'));
        break;
    }
  } else if (error instanceof Error) {
    logger.error(chalk.red(`\nError: ${error.message}`));
  } else {
    logger.error(chalk.red('\nAn unexpected error occurred.'));
  }

  process.exit(1);
}

export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
