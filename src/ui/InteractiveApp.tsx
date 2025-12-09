import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';
import { AgentMode, RoutingMode } from '../modules/constants.js';
import { shouldShowAiSpinner } from './spinner.js';
import { CustomInput } from './input/CustomInput.js';

interface InteractiveAppProps {
  initialRoutingMode: RoutingMode;
  initialAgentMode: AgentMode;
  aiEnabled: boolean;
  onSubmit: (text: string, mode: RoutingMode) => Promise<void>;
  onModeChange: (mode: RoutingMode) => void;
  onAgentModeChange: (mode: AgentMode) => void;
}

export const InteractiveApp: React.FC<InteractiveAppProps> = ({
  initialRoutingMode,
  initialAgentMode,
  aiEnabled,
  onSubmit,
  onModeChange,
  onAgentModeChange,
}) => {
  const [routingMode, setRoutingMode] = useState(initialRoutingMode);
  const [agentMode, setAgentMode] = useState(initialAgentMode);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [spinnerIndex, setSpinnerIndex] = useState(0);
  const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  useEffect(() => {
    if (!isAiProcessing) {
      setSpinnerIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setSpinnerIndex((prev) => (prev + 1) % spinnerFrames.length);
    }, 80);

    return () => clearInterval(interval);
  }, [isAiProcessing, spinnerFrames.length]);

  const handleSubmit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (shouldShowAiSpinner(trimmed, routingMode, aiEnabled)) {
      setIsAiProcessing(true);
    }

    try {
      await onSubmit(trimmed, routingMode);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const getModeIndicator = () => {
    switch (routingMode) {
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

  const getAgentIndicator = () => {
    switch (agentMode) {
      case 'build':
        return chalk.cyan('[Build]');
      case 'plan':
        return chalk.yellow('[Plan]');
      default:
        return chalk.white('[Unknown]');
    }
  };

  return (
    <Box flexDirection="column">
      {isAiProcessing && (
        <Box marginBottom={1}>
          <Text color="cyan">
            {spinnerFrames[spinnerIndex]} Working on it (AI)
          </Text>
        </Box>
      )}
      <Box borderStyle="round" borderColor="cyan" paddingX={1} minHeight={3} flexDirection="row">
        <Text>
          {getModeIndicator()} {getAgentIndicator()} ›{' '}
        </Text>
        <Box flexGrow={1}>
          <CustomInput
            placeholder={isAiProcessing ? 'AI is processing...' : 'Type your message...'}
            onSubmit={handleSubmit}
            routingMode={routingMode}
            aiEnabled={aiEnabled}
            agentMode={agentMode}
            isAiProcessing={isAiProcessing}
            onModeChange={(mode) => {
              setRoutingMode(mode);
              onModeChange(mode);
            }}
            onAgentModeChange={(mode) => {
              setAgentMode(mode);
              onAgentModeChange(mode);
            }}
          />
        </Box>
      </Box>
      <Box>
        <Text dimColor>
          Tab: switch Hybrid/AI/Human • Shift+Tab:{' '}
          {agentMode === 'build' ? 'Build agent' : 'Plan agent'}
        </Text>
      </Box>
    </Box>
  );
};
