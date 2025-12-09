/**
 * Command enum for standardized keyboard actions
 * Following gemini-cli's pattern for type-safe command references
 */
export enum Command {
  // Submission
  SUBMIT = 'submit',

  // Paste operations
  PASTE = 'paste',

  // History navigation
  HISTORY_UP = 'historyUp',
  HISTORY_DOWN = 'historyDown',

  // Cursor movement
  CURSOR_LEFT = 'cursorLeft',
  CURSOR_RIGHT = 'cursorRight',
  HOME = 'home',
  END = 'end',

  // Text editing
  BACKSPACE = 'backspace',
  DELETE = 'delete',
  INSERT_CHAR = 'insertChar',

  // Control
  EXIT = 'exit',
  ESCAPE = 'escape',

  // Mode toggles
  CYCLE_MODE = 'cycleMode',
  TOGGLE_AGENT_MODE = 'toggleAgentMode',
}
