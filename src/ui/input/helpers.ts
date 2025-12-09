import { AgentMode, RoutingMode } from '../../modules/constants.js';

export function cycleRoutingMode(current: RoutingMode, aiEnabled: boolean): RoutingMode | null {
  if (!aiEnabled) return null;
  if (current === 'hybrid') return 'ai';
  if (current === 'ai') return 'human';
  return 'hybrid';
}

export function toggleAgentMode(current: AgentMode): AgentMode {
  return current === 'build' ? 'plan' : 'build';
}
