/**
 * Application-wide constants and configuration values
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

function loadPackageVersion(): string {
  try {
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    const packageJsonPath = path.resolve(moduleDir, '..', '..', 'package.json');
    const content = fs.readFileSync(packageJsonPath, 'utf8');
    const parsed = JSON.parse(content) as { version?: string };
    if (parsed.version && typeof parsed.version === 'string') {
      return parsed.version;
    }
  } catch {
    // Best-effort: fall back to an unknown version string.
  }
  return '0.0.0';
}

export const CLI_VERSION = loadPackageVersion();

/**
 * Paste detection configuration
 */
export const PASTE_DETECTION = {
  /** Keys arriving faster than this threshold (ms) are likely pasted */
  THRESHOLD_MS: 10,
  /** Gap to treat paste as ended for non-bracketed paste mode (ms) */
  GAP_MS: 500,
  /** Block return key processing for this duration after text input (ms) */
  BLOCK_RETURNS_MS: 100,
  /** Extended block period for paste mode (ms) */
  EXTENDED_BLOCK_MS: 1000,
  /** Additional block period after paste end (ms) */
  POST_PASTE_BLOCK_MS: 200,
} as const;

/**
 * Keyboard input configuration
 */
export const KEYBOARD = {
  /** Double Ctrl+C timeout window (ms) */
  CTRL_C_TIMEOUT_MS: 1000,
  /** Rapid key detection threshold for paste (ms) */
  RAPID_KEY_THRESHOLD_MS: 30,
} as const;

/**
 * Credit and billing configuration
 */
export const CREDITS = {
  /** Human engineer rate (credits per minute) */
  HUMAN_RATE_PER_MIN: 2,
  /** Default max credits for hybrid fallback */
  DEFAULT_HYBRID_MAX: 10,
  /** Vibe mode consultation credits */
  VIBE_CONSULTATION: 3,
  /** Minimum allowed max credits */
  MIN_MAX_CREDITS: 1,
  /** Maximum allowed max credits */
  MAX_MAX_CREDITS: 100,
} as const;

/**
 * UI rendering configuration
 */
export const UI = {
  /** Mode indicator text width calculation offset */
  MODE_INDICATOR_WIDTH: 2,
  /** Prompt separator width */
  PROMPT_SEPARATOR_WIDTH: 3,
  /** Box drawing width for headers */
  BOX_WIDTH: 60,
} as const;

/**
 * Mode labels for display
 */
export const MODE_LABELS = {
  hybrid: '[Hybrid]',
  ai: '[AI]',
  human: '[Human]',
  build: '[Build]',
  plan: '[Plan]',
} as const;

/**
 * Command prefixes
 */
export const COMMAND_PREFIXES = {
  SLASH: '/',
  HELP_COMMANDS: ['/?', '/help', '/commands'],
  MODE_COMMANDS: ['/hybrid', '/ai', '/human', '/build', '/plan'],
  EXIT_COMMANDS: ['/exit', '/quit'],
  SHELL_RESUME_COMMANDS: ['/resume', '/session', '/codevf'],
} as const;

/**
 * Agent mode types
 */
export type AgentMode = 'build' | 'plan';

/**
 * Routing mode types
 */
export type RoutingMode = 'ai' | 'human' | 'hybrid';
