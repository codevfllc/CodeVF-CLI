#!/usr/bin/env node

// Load environment variables from .env before any other modules run
import 'dotenv/config';

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import prompts from 'prompts';
import { loginCommand } from './commands/login.js';
import { logoutCommand } from './commands/logout.js';
import { initCommand } from './commands/init.js';
import { syncCommand } from './commands/sync.js';
import { fixCommand } from './commands/fix.js';
import { handleError } from './utils/errors.js';

const CLI_VERSION = '1.0.0';

// Check if no command was provided (just "codevf")
const args = hideBin(process.argv);
if (args.length === 0) {
  // Interactive mode - just typing "codevf"
  (async () => {
    try {
      console.log(chalk.bold.blue('\n💬 CodeVF - Live Debugging Assistant\n'));

      const response = await prompts({
        type: 'text',
        name: 'issue',
        message: 'What issue are you facing?',
        validate: (value) => (value.length > 0 ? true : 'Please describe your issue'),
      });

      if (!response.issue) {
        console.log(chalk.dim('\nCancelled.\n'));
        process.exit(0);
      }

      await fixCommand(response.issue);
    } catch (error) {
      handleError(error);
    }
  })();
} else {
  // Command mode - traditional CLI
  yargs(args)
    .scriptName('codevf')
    .version(CLI_VERSION)
    .usage('$0 <command> [options]')
    .command(
      'login',
      'Authenticate with CodeVF',
      () => {},
      async () => {
        try {
          await loginCommand();
        } catch (error) {
          handleError(error);
        }
      }
    )
    .command(
      'logout',
      'Clear local authentication',
      () => {},
      async () => {
        try {
          await logoutCommand();
        } catch (error) {
          handleError(error);
        }
      }
    )
    .command(
      'init',
      'Initialize CodeVF in your project',
      () => {},
      async () => {
        try {
          await initCommand();
        } catch (error) {
          handleError(error);
        }
      }
    )
    .command(
      'sync',
      'Sync your local changes with CodeVF',
      (yargs) => {
        return yargs.option('force', {
          alias: 'f',
          type: 'boolean',
          description: 'Force sync even with uncommitted changes',
          default: false,
        });
      },
      async (argv) => {
        try {
          await syncCommand({ force: argv.force });
        } catch (error) {
          handleError(error);
        }
      }
    )
    .command(
      'fix <issue>',
      'Start a live debugging session',
      (yargs) => {
        return yargs.positional('issue', {
          type: 'string',
          describe: 'Description of the issue to fix',
          demandOption: true,
        });
      },
      async (argv) => {
        try {
          await fixCommand(argv.issue as string);
        } catch (error) {
          handleError(error);
        }
      }
    )
    .demandCommand(1, chalk.yellow('Please specify a command or just type "codevf" to start'))
    .recommendCommands()
    .strict()
    .help()
    .alias('help', 'h')
    .alias('version', 'v')
    .epilogue(
      chalk.dim(
        'For more information, visit: https://docs.codevf.com\n' +
          'Report issues: https://github.com/codevf/cli/issues'
      )
    )
    .parse();
}
