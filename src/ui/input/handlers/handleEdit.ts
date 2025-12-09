import { InputState } from '../types.js';

/**
 * Handles text editing operations (insert/backspace/delete)
 * Simplified for single-line input
 */

/**
 * Insert a character at cursor position
 */
export function handleInsertChar(
  state: InputState,
  char: string
): InputState {
  const { input, cursorCol } = state;

  const beforeCursor = input.slice(0, cursorCol);
  const afterCursor = input.slice(cursorCol);
  const newInput = beforeCursor + char + afterCursor;

  return {
    ...state,
    input: newInput,
    cursorCol: cursorCol + 1,
    historyIndex: -1,
  };
}

/**
 * Handle backspace (delete character before cursor)
 */
export function handleBackspace(state: InputState): InputState {
  const { input, cursorCol } = state;

  if (cursorCol > 0) {
    const beforeCursor = input.slice(0, cursorCol - 1);
    const afterCursor = input.slice(cursorCol);
    const newInput = beforeCursor + afterCursor;

    return {
      ...state,
      input: newInput,
      cursorCol: cursorCol - 1,
      historyIndex: -1,
    };
  }

  return state;
}

/**
 * Handle delete (delete character at cursor)
 */
export function handleDelete(state: InputState): InputState {
  const { input, cursorCol } = state;

  if (cursorCol < input.length) {
    const beforeCursor = input.slice(0, cursorCol);
    const afterCursor = input.slice(cursorCol + 1);
    const newInput = beforeCursor + afterCursor;

    return {
      ...state,
      input: newInput,
      historyIndex: -1,
    };
  }

  return state;
}
