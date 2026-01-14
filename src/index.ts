#!/usr/bin/env node

// Load environment variables from .env before any other modules run
import 'dotenv/config';

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import chalk from 'chalk';
import { setupCommand } from './commands/setup.js';
import { startMcpHttp, startMcpStdio } from './commands/mcp.js';
import { handleError } from './utils/errors.js';
import { CLI_VERSION } from './modules/constants.js';

const args = hideBin(process.argv);
const isNpxInvocation =
  process.env.npm_config_user_agent?.includes('npx') ||
  process.env.npm_execpath?.includes('npx');

/**
 * Command-line argument mode - handle specific commands
 */
if (args.length === 0) {
  if (isNpxInvocation) {
    setupCommand().catch(handleError);
  } else {
    console.log(chalk.dim('Available commands:'));
    console.log(chalk.dim('  codevf setup'));
    console.log(chalk.dim('  codevf mcp stdio'));
    console.log(chalk.dim('  codevf mcp http --port 3333'));
    process.exit(0);
  }
} else {
  const cli = yargs(args)
    .scriptName('codevf')
    .version(CLI_VERSION)
    .usage('$0 <command> [options]')
    .epilogue('Documentation: https://docs.codevf.com');

  cli
    .command(
      'setup',
      'Configure MCP server for Claude Code, Codex, or Gemini integration',
      (yargs) => {
        return yargs.option('base-url', {
          type: 'string',
          describe: 'Override CodeVF API base URL (e.g. http://localhost:3000)',
        });
      },
      async (argv) => {
        try {
          await setupCommand({
            baseUrl: argv.baseUrl as string | undefined,
          });
        } catch (error) {
          handleError(error);
        }
      }
    )
    .command(
      'mcp <mode>',
      'Start the MCP server (stdio or HTTP)',
      (yargs) => {
        return yargs
          .positional('mode', {
            type: 'string',
            choices: ['stdio', 'http'],
            describe: 'MCP transport to serve',
          })
          .option('port', {
            type: 'number',
            default: 3333,
            describe: 'Port for HTTP mode',
          })
          .option('host', {
            type: 'string',
            default: '127.0.0.1',
            describe: 'Host to bind HTTP mode',
          });
      },
      async (argv) => {
        try {
          if (argv.mode === 'http') {
            await startMcpHttp({
              host: argv.host as string,
              port: argv.port as number,
            });
            return;
          }
          await startMcpStdio();
        } catch (error) {
          handleError(error);
        }
      }
    )
    .demandCommand(1, chalk.yellow('Run "codevf setup" or "codevf mcp <mode>" to start MCP.'))
    .help()
    .alias('help', 'h')
    .alias('version', 'v')
    .epilogue(
      chalk.dim(
        'For more information, visit: https://docs.codevf.com\n' +
          'Report issues: https://github.com/codevf/cli/issues'
      )
    )
    .strict();

  cli.parse();
}
