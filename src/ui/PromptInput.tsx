import React, { useState, useRef, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import chalk from 'chalk';
import { RoutingMode } from '../modules/constants.js';

interface PromptInputProps {
  routingMode: RoutingMode;
  aiEnabled: boolean;
  autoAcceptMode: boolean;
  onSubmit: (value: string) => void;
  onToggleMode: (mode: RoutingMode) => void;
  onToggleAutoAccept: (autoAccept: boolean) => void;
  history?: string[];
}

export const PromptInput: React.FC<PromptInputProps> = ({
  routingMode,
  aiEnabled,
  autoAcceptMode,
  onSubmit,
  onToggleMode,
  onToggleAutoAccept,
  history = [],
}) => {
  const [input, setInput] = useState('');
  const [historyIndex, setHistoryIndex] = useState(history.length);
  const [ctrlCPressed, setCtrlCPressed] = useState(0);
  const [recentPasteTime, setRecentPasteTime] = useState<number | null>(null);
  const [lastInputTime, setLastInputTime] = useState(Date.now());
  const pasteTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const ctrlCTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (pasteTimeoutRef.current) {
        clearTimeout(pasteTimeoutRef.current);
      }
      if (ctrlCTimeoutRef.current) {
        clearTimeout(ctrlCTimeoutRef.current);
      }
    };
  }, []);

  useInput((inputStr, key) => {
    const now = Date.now();

    // Detect paste by multi-character input arriving at once
    const isPaste = inputStr.length > 1;

    if (isPaste && !key.ctrl && !key.meta) {
      setRecentPasteTime(now);
      const newInput = input + inputStr;
      setInput(newInput);
      setLastInputTime(now);

      // Debug: Log paste
      if (process.env.CODEVF_DEBUG) {
        console.error(`[DEBUG] Pasted ${inputStr.length} chars, total now: ${newInput.length}`);
      }

      // Clear paste protection after 40ms
      if (pasteTimeoutRef.current) {
        clearTimeout(pasteTimeoutRef.current);
      }
      pasteTimeoutRef.current = setTimeout(() => {
        setRecentPasteTime(null);
        pasteTimeoutRef.current = null;
      }, 40);
      return;
    }

    setLastInputTime(now);

    // Ctrl+C handling
    if (key.ctrl && inputStr === 'c') {
      if (input.length > 0) {
        // Clear input on first Ctrl+C
        setInput('');
        setCtrlCPressed(1);
      } else if (ctrlCPressed >= 2) {
        // Exit on third or subsequent Ctrl+C
        console.log(chalk.dim('  Exiting...'));
        process.exit(0);
      } else {
        // Increment Ctrl+C press count for empty input
        setCtrlCPressed(ctrlCPressed + 1);
        if (ctrlCPressed === 1) {
          console.log(chalk.dim('  Press Ctrl+C again to exit'));
        }
      }

      // Reset counter after 2 seconds of no Ctrl+C
      if (ctrlCTimeoutRef.current) {
        clearTimeout(ctrlCTimeoutRef.current);
      }
      ctrlCTimeoutRef.current = setTimeout(() => {
        setCtrlCPressed(0);
      }, 2000);
      return;
    }

    // Tab - toggle routing mode
    if (key.tab && !key.shift) {
      if (!aiEnabled) {
        console.log(chalk.yellow('\n  [!] AI mode not available'));
        console.log(chalk.dim('  Run ') + chalk.white('codevf init') + chalk.dim(' to enable'));
        return;
      }

      // Cycle: hybrid -> ai -> human -> hybrid
      let newMode: RoutingMode;
      if (routingMode === 'hybrid') {
        newMode = 'ai';
      } else if (routingMode === 'ai') {
        newMode = 'human';
      } else {
        newMode = aiEnabled ? 'hybrid' : 'human';
      }
      onToggleMode(newMode);
      return;
    }

    // Shift+Tab - toggle auto-accept
    if (key.tab && key.shift) {
      onToggleAutoAccept(!autoAcceptMode);
      console.log(
        chalk.yellow(`\n  [!] Auto-accept mode ${!autoAcceptMode ? 'activated' : 'deactivated'}`)
      );
      console.log(
        !autoAcceptMode
          ? chalk.dim('  AI responses will be automatically accepted')
          : chalk.dim('  AI responses will ask for confirmation')
      );
      return;
    }

    // Return/Enter - submit
    if (key.return) {
      // Check for recent paste to prevent accidental submission
      if (recentPasteTime !== null) {
        // Paste occurred recently, treat Enter as newline in buffer
        setInput((prev) => prev + '\n');
        return;
      }

      if (input.trim()) {
        onSubmit(input.trim());
        setInput('');
        setHistoryIndex(history.length);
      }
      return;
    }

    // Backspace
    if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1));
      return;
    }

    // Up arrow - history navigation
    if (key.upArrow) {
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      }
      return;
    }

    // Down arrow - history navigation
    if (key.downArrow) {
      if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      } else if (historyIndex === history.length - 1) {
        setHistoryIndex(history.length);
        setInput('');
      }
      return;
    }

    // Regular character input
    if (inputStr && !key.ctrl && !key.meta) {
      setInput((prev) => prev + inputStr);
    }
  });

  // Get mode indicator
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

  // Split input into lines manually for proper rendering
  const terminalWidth = process.stdout.columns || 80;
  const promptWidth = 13; // "  [Hybrid] › " length
  const maxLineWidth = terminalWidth - promptWidth - 2;

  // Break input into display lines
  const lines: string[] = [];
  if (input.length === 0) {
    lines.push('');
  } else {
    let currentLine = '';
    for (const char of input) {
      if (char === '\n') {
        lines.push(currentLine);
        currentLine = '';
      } else if (currentLine.length >= maxLineWidth) {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine += char;
      }
    }
    if (currentLine.length > 0 || input[input.length - 1] === '\n') {
      lines.push(currentLine);
    }
  }

  return (
    <Box flexDirection="column" minHeight={lines.length + 1}>
      {lines.map((line, index) => (
        <Box key={`line-${index}`} height={1}>
          {index === 0 ? (
            <>
              <Text dimColor> </Text>
              <Text>{getModeIndicator()}</Text>
              <Text dimColor> › </Text>
              <Text>{line}</Text>
            </>
          ) : (
            <>
              <Text dimColor> </Text>
              <Text>{line}</Text>
            </>
          )}
        </Box>
      ))}
      <Box height={1}>
        <Text dimColor>
          Tab to switch modes • Shift+Tab auto-accept: {autoAcceptMode ? 'on' : 'off'}
        </Text>
      </Box>
    </Box>
  );
};
