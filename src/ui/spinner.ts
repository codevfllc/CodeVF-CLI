import { RoutingMode } from '../modules/constants.js';

/**
 * Determines if the AI spinner should be shown for a given input/routing mode.
 * Exported for testing.
 */
export function shouldShowAiSpinner(input: string, mode: RoutingMode, aiEnabled: boolean): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/')) return false;
  return mode === 'ai' || (mode === 'hybrid' && aiEnabled);
}
