import { InputState } from '../types.js';

/**
 * Handles cursor movement (left/right/home/end)
 * Simplified for single-line input only
 */

/**
 * Move cursor left
 */
export function handleCursorLeft(state: InputState): InputState {
  const { cursorCol } = state;

  if (cursorCol > 0) {
    return {
      ...state,
      cursorCol: cursorCol - 1,
      historyIndex: -1,
    };
  }

  return state;
}

/**
 * Move cursor right
 */
export function handleCursorRight(state: InputState): InputState {
  const { cursorCol, input } = state;

  if (cursorCol < input.length) {
    return {
      ...state,
      cursorCol: cursorCol + 1,
      historyIndex: -1,
    };
  }

  return state;
}

/**
 * Move cursor to start of line (Home / Ctrl+A)
 */
export function handleHome(state: InputState): InputState {
  return {
    ...state,
    cursorCol: 0,
    historyIndex: -1,
  };
}

/**
 * Move cursor to end of line (End / Ctrl+E)
 */
export function handleEnd(state: InputState): InputState {
  return {
    ...state,
    cursorCol: state.input.length,
    historyIndex: -1,
  };
}
