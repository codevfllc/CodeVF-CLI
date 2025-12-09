import { InputState, HistoryState } from '../types.js';

/**
 * Handles command history navigation (up/down arrows)
 * Simplified for single-line input
 */

/**
 * Navigate backward through history (up arrow)
 */
export function handleHistoryUp(
  state: InputState,
  history: HistoryState
): InputState {
  const { entries } = history;
  const { historyIndex, input } = state;

  // No history available
  if (entries.length === 0) {
    return state;
  }

  // First time accessing history - save current input
  if (historyIndex === -1) {
    const newIndex = 0;

    return {
      ...state,
      input: entries[newIndex],
      cursorCol: entries[newIndex].length,
      historyIndex: newIndex,
      tempInput: input,
    };
  }

  // Already in history - navigate backward
  if (historyIndex < entries.length - 1) {
    const newIndex = historyIndex + 1;

    return {
      ...state,
      input: entries[newIndex],
      cursorCol: entries[newIndex].length,
      historyIndex: newIndex,
    };
  }

  // At oldest entry - no change
  return state;
}

/**
 * Navigate forward through history (down arrow)
 */
export function handleHistoryDown(
  state: InputState,
  history: HistoryState
): InputState {
  const { entries } = history;
  const { historyIndex, tempInput } = state;

  // Not in history mode - no-op
  if (historyIndex === -1) {
    return state;
  }

  // Navigate forward
  if (historyIndex > 0) {
    const newIndex = historyIndex - 1;

    return {
      ...state,
      input: entries[newIndex],
      cursorCol: entries[newIndex].length,
      historyIndex: newIndex,
    };
  }

  // At newest entry - restore tempInput
  if (historyIndex === 0) {
    return {
      ...state,
      input: tempInput,
      cursorCol: tempInput.length,
      historyIndex: -1,
      tempInput: '',
    };
  }

  return state;
}

/**
 * Add entry to history (called on submit)
 */
export function addToHistory(
  history: HistoryState,
  entry: string
): HistoryState {
  // Don't add empty entries or duplicates
  if (!entry.trim() || entry === history.entries[0]) {
    return history;
  }

  const newEntries = [entry, ...history.entries].slice(0, history.maxSize);

  return {
    ...history,
    entries: newEntries,
  };
}
