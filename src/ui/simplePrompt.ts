import readline from 'readline';
import chalk from 'chalk';
import { RoutingMode } from '../modules/constants.js';

interface SimplePromptOptions {
  routingMode: RoutingMode;
}

export async function simplePrompt(options: SimplePromptOptions): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: getPrompt(options.routingMode),
    });

    rl.prompt();

    rl.on('line', (line) => {
      rl.close();
      resolve(line);
    });

    rl.on('close', () => {
      // If closed without input, resolve empty string
      resolve('');
    });
  });
}

function getPrompt(mode: RoutingMode): string {
  let indicator: string;
  switch (mode) {
    case 'hybrid':
      indicator = chalk.green('[Hybrid]');
      break;
    case 'ai':
      indicator = chalk.cyan('[AI]');
      break;
    case 'human':
      indicator = chalk.magenta('[Human]');
      break;
    default:
      indicator = chalk.white('[Unknown]');
  }
  return `  ${indicator} ${chalk.dim('›')} `;
}
