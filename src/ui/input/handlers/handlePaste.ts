import { InputState } from '../types.js';

/**
 * Handles paste operations with placeholder
 * SIMPLIFIED: Show "[Pasted content]" placeholder only for multi-line pastes, allow typing after
 *
 * Algorithm:
 * 1. Detect paste by inputChar.length > 1
 * 2. Store full pasted content in pastedContent only if it contains newlines
 * 3. Display placeholder "[Pasted content]" + any typed text (only for multi-line)
 * 4. For single-line pastes, insert directly into input
 * 5. User can type more text after the placeholder
 * 6. On submit, combine pasted content + typed text
 */
export function handlePaste(state: InputState, pastedText: string): InputState {
  // Check if pasted text contains newlines (multi-line)
  const isMultiLine = pastedText.includes('\n') || pastedText.includes('\r');
  if (isMultiLine) {
    // Multi-line paste: use placeholder
    return {
      ...state,
      input: '', // Clear any existing input when pasting
      cursorCol: 0,
      pastedContent: pastedText,
      historyIndex: -1, // Reset history navigation
    };
  } else {
    // Single-line paste: insert directly into input
    const newInput =
      state.input.slice(0, state.cursorCol) + pastedText + state.input.slice(state.cursorCol);
    return {
      ...state,
      input: newInput,
      cursorCol: state.cursorCol + pastedText.length,
      pastedContent: null, // No placeholder for single-line
      historyIndex: -1, // Reset history navigation
    };
  }
}

/**
 * Clear pasted content and return to normal input
 */
export function clearPaste(state: InputState): InputState {
  return {
    ...state,
    input: '',
    cursorCol: 0,
    pastedContent: null,
  };
}
