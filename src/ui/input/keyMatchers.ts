import { Key } from 'ink';
import { Command } from './Command.js';
import { KeyMatcher } from './types.js';

/**
 * Key matcher object following gemini-cli's pattern
 * Usage: if (keyMatchers[Command.PASTE](key)) { handlePaste(); }
 */
export const keyMatchers: Record<Command, KeyMatcher> = {
  [Command.SUBMIT]: (key: Key) => key.return === true,

  [Command.PASTE]: (key: Key, inputChar?: string) => {
    // Detect paste by multi-character input
    return inputChar ? inputChar.length > 1 : false;
  },

  [Command.HISTORY_UP]: (key: Key) => key.upArrow === true,

  [Command.HISTORY_DOWN]: (key: Key) => key.downArrow === true,

  [Command.CURSOR_LEFT]: (key: Key) => key.leftArrow === true,

  [Command.CURSOR_RIGHT]: (key: Key) => key.rightArrow === true,

  [Command.HOME]: (key: Key, inputChar?: string) => {
    // Ctrl+A (standard terminal shortcut for Home)
    return key.ctrl === true && inputChar === 'a';
  },

  [Command.END]: (key: Key, inputChar?: string) => {
    // Ctrl+E (standard terminal shortcut for End)
    return key.ctrl === true && inputChar === 'e';
  },

  [Command.BACKSPACE]: (key: Key) => key.backspace === true || key.delete === true,

  [Command.DELETE]: (key: Key) => key.delete === true,

  [Command.INSERT_CHAR]: (key: Key, inputChar?: string) => {
    // Regular character input (not a control key)
    return Boolean(inputChar && !key.ctrl && !key.meta && inputChar.length === 1);
  },

  [Command.EXIT]: (key: Key, inputChar?: string) => {
    // Ctrl+C
    return key.ctrl === true && inputChar === 'c';
  },

  [Command.ESCAPE]: (key: Key) => key.escape === true,

  [Command.CYCLE_MODE]: (key: Key) => key.tab === true && key.shift !== true,

  [Command.TOGGLE_AGENT_MODE]: (key: Key) => key.tab === true && key.shift === true,
};

/**
 * Helper to match a command against a key press
 * Extended signature to support inputChar for paste detection
 */
export function matchCommand(command: Command, key: Key, inputChar?: string): boolean {
  const matcher = keyMatchers[command];
  if (!matcher) return false;

  // Pass inputChar to matcher for commands that need it (PASTE, INSERT_CHAR)
  return matcher(key, inputChar);
}
