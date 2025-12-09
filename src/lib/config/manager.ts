/**
 * Configuration file management for CodeVF
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { ConfigError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export interface CodeVFConfig {
  baseUrl: string;
  auth?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
    userId: string;
  };
  defaults?: {
    maxCredits: number;
    projectId?: string;
  };
}

export class ConfigManager {
  private configPath: string;
  private configDir: string;

  constructor(configFileName: string = 'config.json') {
    this.configDir = path.join(os.homedir(), '.codevf');
    this.configPath = path.join(this.configDir, configFileName);
  }

  /**
   * Ensure config directory exists
   */
  private ensureConfigDir(): void {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true, mode: 0o700 });
      logger.debug('Created config directory', { path: this.configDir });
    }
  }

  /**
   * Check if config file exists
   */
  exists(): boolean {
    return fs.existsSync(this.configPath);
  }

  /**
   * Load configuration from file
   */
  load(): CodeVFConfig {
    if (!this.exists()) {
      throw new ConfigError(
        `Configuration file not found. Run: codevf setup`
      );
    }

    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      const config = JSON.parse(content);
      logger.debug('Loaded config', { path: this.configPath });
      return config;
    } catch (error) {
      throw new ConfigError(`Failed to load config: ${(error as Error).message}`);
    }
  }

  /**
   * Save configuration to file
   */
  save(config: CodeVFConfig): void {
    this.ensureConfigDir();

    try {
      const content = JSON.stringify(config, null, 2);
      fs.writeFileSync(this.configPath, content, { mode: 0o600 });
      logger.debug('Saved config', { path: this.configPath });
    } catch (error) {
      throw new ConfigError(`Failed to save config: ${(error as Error).message}`);
    }
  }

  /**
   * Update auth tokens in config
   */
  updateAuth(auth: CodeVFConfig['auth']): void {
    const config = this.load();
    config.auth = auth;
    this.save(config);
  }

  /**
   * Clear configuration file
   */
  clear(): void {
    if (this.exists()) {
      fs.unlinkSync(this.configPath);
      logger.info('Cleared config', { path: this.configPath });
    }
  }

  /**
   * Get config file path
   */
  getPath(): string {
    return this.configPath;
  }
}
