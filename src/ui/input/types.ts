import { Key } from 'ink';

/**
 * Core state for text input with paste placeholder
 */
export interface InputState {
  input: string;                // Current input text (single line)
  cursorCol: number;            // Cursor column position
  historyIndex: number;         // -1 = current, 0+ = history
  tempInput: string;            // Stored during history navigation
  pastedContent: string | null; // Full pasted content (shown as placeholder)
}

/**
 * Command history state
 */
export interface HistoryState {
  entries: string[];            // Last 100 commands
  maxSize: number;              // 100
}

/**
 * Key binding configuration (for future extension)
 */
export interface KeyBinding {
  key?: string;
  ctrl?: boolean;
  shift?: boolean;
  meta?: boolean;
}

/**
 * Function that matches a key press to a command
 * Extended signature supports inputChar for paste detection and Ctrl+letter combinations
 */
export type KeyMatcher = (key: Key, inputChar?: string) => boolean;
