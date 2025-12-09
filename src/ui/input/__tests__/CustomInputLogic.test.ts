import { cycleRoutingMode, toggleAgentMode } from '../helpers.js';

describe('CustomInput hotkey helpers', () => {
  it('cycles routing mode hybrid → ai → human → hybrid when AI is enabled', () => {
    expect(cycleRoutingMode('hybrid', true)).toBe('ai');
    expect(cycleRoutingMode('ai', true)).toBe('human');
    expect(cycleRoutingMode('human', true)).toBe('hybrid');
  });

  it('returns null when attempting to cycle routing mode without AI access', () => {
    expect(cycleRoutingMode('human', false)).toBeNull();
    expect(cycleRoutingMode('hybrid', false)).toBeNull();
  });

  it('toggles agent mode between build and plan', () => {
    expect(toggleAgentMode('build')).toBe('plan');
    expect(toggleAgentMode('plan')).toBe('build');
  });
});
