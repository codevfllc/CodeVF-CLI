import React, { useState, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import chalk from 'chalk';
import { Command } from './Command.js';
import { matchCommand } from './keyMatchers.js';
import { InputState, HistoryState } from './types.js';
import { handlePaste, clearPaste } from './handlers/handlePaste.js';
import { handleHistoryUp, handleHistoryDown, addToHistory } from './handlers/handleHistory.js';
import {
  handleCursorLeft,
  handleCursorRight,
  handleHome,
  handleEnd,
} from './handlers/handleCursor.js';
import { handleInsertChar, handleBackspace, handleDelete } from './handlers/handleEdit.js';
import { handleSubmit, isInputEmpty } from './handlers/handleSubmit.js';
import { AgentMode, RoutingMode } from '../../modules/constants.js';
import { cycleRoutingMode, toggleAgentMode } from './helpers.js';

interface CustomInputProps {
  placeholder?: string;
  onSubmit: (text: string) => void;
  routingMode: RoutingMode;
  aiEnabled: boolean;
  agentMode: AgentMode;
  onModeChange: (mode: RoutingMode) => void;
  onAgentModeChange: (mode: AgentMode) => void;
  isAiProcessing?: boolean;
}

export const CustomInput: React.FC<CustomInputProps> = ({
  placeholder = 'Type your message...',
  onSubmit,
  routingMode,
  aiEnabled,
  agentMode,
  onModeChange,
  onAgentModeChange,
  isAiProcessing = false,
}) => {
  const { exit } = useApp();

  // State management
  const [inputState, setInputState] = useState<InputState>({
    input: '',
    cursorCol: 0,
    historyIndex: -1,
    tempInput: '',
    pastedContent: null,
  });

  const [history, setHistory] = useState<HistoryState>({
    entries: [],
    maxSize: 100,
  });

  // Centralized input router
  const handleInputEvent = useCallback(
    (inputChar: string, key: any) => {
      // Exit (Ctrl+C)
      if (matchCommand(Command.EXIT, key, inputChar)) {
        exit();
        process.exit(0);
        return;
      }

      // Escape - clear paste if present
      if (matchCommand(Command.ESCAPE, key, inputChar)) {
        if (inputState.pastedContent !== null) {
          setInputState(clearPaste);
        }
        return;
      }

      // Tab - toggle routing mode
      if (matchCommand(Command.CYCLE_MODE, key, inputChar)) {
        const newMode = cycleRoutingMode(routingMode, aiEnabled);
        if (!newMode) {
          console.log(chalk.yellow('\n  [!] AI mode not available'));
          console.log(chalk.dim('  Run ') + chalk.white('codevf init') + chalk.dim(' to enable'));
          return;
        }

        onModeChange(newMode);
        return;
      }

      // Shift+Tab - toggle agent mode between build and plan
      if (matchCommand(Command.TOGGLE_AGENT_MODE, key, inputChar)) {
        const nextAgentMode = toggleAgentMode(agentMode);
        onAgentModeChange(nextAgentMode);
        console.log(
          chalk.yellow(
            `\n  [!] Agent mode switched to ${nextAgentMode === 'build' ? 'build' : 'plan'}`
          )
        );
        return;
      }

      // Backspace - delete typed text first, then clear paste if no typed text
      if (matchCommand(Command.BACKSPACE, key, inputChar)) {
        if (inputState.pastedContent !== null && inputState.input.length === 0) {
          // No typed text - clear the paste placeholder
          setInputState(clearPaste);
        } else {
          // Has typed text - delete last character
          setInputState(handleBackspace);
        }
        return;
      }

      // Submit (Enter)
      if (matchCommand(Command.SUBMIT, key, inputChar)) {
        const { text, newState } = handleSubmit(inputState);

        if (!isInputEmpty(inputState)) {
          // Add to history
          setHistory((prev) => addToHistory(prev, text));

          // Call onSubmit callback
          onSubmit(text);

          // Reset state
          setInputState(newState);
        }
        return;
      }

      // Paste detection (multi-character input) - ONLY if not already showing placeholder
      if (matchCommand(Command.PASTE, key, inputChar) && inputState.pastedContent === null) {
        setInputState((prev) => handlePaste(prev, inputChar));
        return;
      }

      // History navigation
      if (matchCommand(Command.HISTORY_UP, key, inputChar)) {
        setInputState((prev) => handleHistoryUp(prev, history));
        return;
      }

      if (matchCommand(Command.HISTORY_DOWN, key, inputChar)) {
        setInputState((prev) => handleHistoryDown(prev, history));
        return;
      }

      // Cursor movement
      if (matchCommand(Command.CURSOR_LEFT, key, inputChar)) {
        setInputState(handleCursorLeft);
        return;
      }

      if (matchCommand(Command.CURSOR_RIGHT, key, inputChar)) {
        setInputState(handleCursorRight);
        return;
      }

      if (matchCommand(Command.HOME, key, inputChar)) {
        setInputState(handleHome);
        return;
      }

      if (matchCommand(Command.END, key, inputChar)) {
        setInputState(handleEnd);
        return;
      }

      // Delete
      if (matchCommand(Command.DELETE, key, inputChar)) {
        setInputState(handleDelete);
        return;
      }

      // Insert character (regular typing)
      if (matchCommand(Command.INSERT_CHAR, key, inputChar)) {
        setInputState((prev) => handleInsertChar(prev, inputChar));
        return;
      }
    },
    [
      agentMode,
      aiEnabled,
      inputState,
      history,
      onAgentModeChange,
      onModeChange,
      onSubmit,
      routingMode,
      exit,
    ]
  );

  useInput(handleInputEvent, { isActive: !isAiProcessing });

  // Rendering logic
  const renderInput = () => {
    const { input, cursorCol, pastedContent } = inputState;

    // Paste placeholder with optional additional text
    if (pastedContent !== null) {
      const lines = pastedContent.split('\n').length;
      const chars = pastedContent.length;
      const placeholder = `[Pasted ${lines} lines, ${chars} chars]`;

      // Show placeholder + typed text
      if (input.length > 0) {
        const beforeCursor = input.slice(0, cursorCol);
        const atCursor = input[cursorCol] || ' ';
        const afterCursor = input.slice(cursorCol + 1);

        return (
          <Text>
            {chalk.yellow(placeholder)} {beforeCursor}
            {chalk.inverse(atCursor)}
            {afterCursor}
          </Text>
        );
      }

      // Just placeholder with cursor
      return (
        <Text>
          {chalk.yellow(placeholder)}
          {chalk.inverse(' ')}
          <Text dimColor> Type to add more, Enter to send, Esc/Backspace to clear</Text>
        </Text>
      );
    }

    // Empty input - show placeholder with cursor
    if (input === '') {
      return (
        <Text>
          {chalk.inverse(' ')}
          <Text dimColor> {placeholder}</Text>
        </Text>
      );
    }

    // Regular input with cursor
    const beforeCursor = input.slice(0, cursorCol);
    const atCursor = input[cursorCol] || ' ';
    const afterCursor = input.slice(cursorCol + 1);

    return (
      <Text>
        {beforeCursor}
        {chalk.inverse(atCursor)}
        {afterCursor}
      </Text>
    );
  };

  return <Box>{renderInput()}</Box>;
};
