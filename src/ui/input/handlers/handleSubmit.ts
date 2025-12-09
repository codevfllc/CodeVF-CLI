import { InputState } from '../types.js';

/**
 * Handles submission (Enter key) and state reset
 * Returns pasted content if present, otherwise regular input
 */

/**
 * Handle submit (Enter key)
 * Returns the submitted text and the reset state
 */
export function handleSubmit(state: InputState): {
  text: string;
  newState: InputState;
} {
  const { input, pastedContent } = state;

  // Combine pasted content with typed text if both present
  let text: string;
  if (pastedContent !== null && input.length > 0) {
    text = pastedContent + '\n' + input;
  } else if (pastedContent !== null) {
    text = pastedContent;
  } else {
    text = input;
  }

  // Reset to initial empty state
  const newState: InputState = {
    input: '',
    cursorCol: 0,
    historyIndex: -1,
    tempInput: '',
    pastedContent: null,
  };

  return { text, newState };
}

/**
 * Check if the current input is empty
 */
export function isInputEmpty(state: InputState): boolean {
  const { input, pastedContent } = state;
  return pastedContent === null && input.trim() === '';
}
