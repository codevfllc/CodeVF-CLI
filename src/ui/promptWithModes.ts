import prompts from 'prompts';
import chalk from 'chalk';
import { RoutingMode } from '../modules/constants.js';

interface PromptWithModesOptions {
  routingMode: RoutingMode;
  aiEnabled: boolean;
  autoAcceptMode: boolean;
  history?: string[];
  onToggle: (mode: RoutingMode) => void;
  onAutoAcceptToggle: (autoAccept: boolean) => void;
}

export async function promptWithModes(options: PromptWithModesOptions): Promise<string> {
  const getModeIndicator = (mode: RoutingMode) => {
    switch (mode) {
      case 'hybrid':
        return chalk.green('[Hybrid]');
      case 'ai':
        return chalk.cyan('[AI]');
      case 'human':
        return chalk.magenta('[Human]');
      default:
        return chalk.white('[Unknown]');
    }
  };

  const { value } = await prompts({
    type: 'text',
    name: 'value',
    message: `${getModeIndicator(options.routingMode)} ›`,
    initial: '',
  });

  return value || '';
}
