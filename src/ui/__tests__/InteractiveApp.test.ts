import { shouldShowAiSpinner } from '../spinner.js';
import { RoutingMode } from '../../modules/constants.js';

describe('InteractiveApp spinner behavior', () => {
  it('does not show spinner for slash commands like /init', () => {
    expect(shouldShowAiSpinner('/init', 'hybrid' as RoutingMode, true)).toBe(false);
    expect(shouldShowAiSpinner('/init', 'ai' as RoutingMode, true)).toBe(false);
  });

  it('shows spinner for regular prompts in AI mode', () => {
    expect(shouldShowAiSpinner('help me', 'ai' as RoutingMode, true)).toBe(true);
  });

  it('shows spinner in hybrid mode only when AI is enabled', () => {
    expect(shouldShowAiSpinner('help me', 'hybrid' as RoutingMode, true)).toBe(true);
    expect(shouldShowAiSpinner('help me', 'hybrid' as RoutingMode, false)).toBe(false);
  });

  it('ignores empty input', () => {
    expect(shouldShowAiSpinner('   ', 'ai' as RoutingMode, true)).toBe(false);
  });
});
