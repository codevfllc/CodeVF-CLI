import * as fs from 'fs';
import * as path from 'path';
import { Config, ConfigError, LastSync } from '../types/index.js';

const CONFIG_DIR = '.codevf';
const CONFIG_FILE = 'config.json';
const LAST_SYNC_FILE = 'last_sync.json';
const CACHE_DIR = 'cache';

export class ConfigManager {
  private cwd: string;
  private configPath: string;
  private lastSyncPath: string;
  private cachePath: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
    this.configPath = path.join(cwd, CONFIG_DIR, CONFIG_FILE);
    this.lastSyncPath = path.join(cwd, CONFIG_DIR, LAST_SYNC_FILE);
    this.cachePath = path.join(cwd, CONFIG_DIR, CACHE_DIR);
  }

  isInitialized(): boolean {
    return fs.existsSync(this.configPath);
  }

  ensureConfigDir(): void {
    const configDir = path.join(this.cwd, CONFIG_DIR);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    if (!fs.existsSync(this.cachePath)) {
      fs.mkdirSync(this.cachePath, { recursive: true });
    }
  }

  loadConfig(): Config {
    if (!this.isInitialized()) {
      throw new ConfigError(
        'No CodeVF project found in this directory.\n\nPlease run: codevf init'
      );
    }

    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      return JSON.parse(content) as Config;
    } catch (error) {
      throw new ConfigError(`Failed to read config file: ${error}`);
    }
  }

  saveConfig(config: Config): void {
    this.ensureConfigDir();

    try {
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
      throw new ConfigError(`Failed to write config file: ${error}`);
    }
  }

  loadLastSync(): LastSync | null {
    if (!fs.existsSync(this.lastSyncPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(this.lastSyncPath, 'utf-8');
      return JSON.parse(content) as LastSync;
    } catch (error) {
      return null;
    }
  }

  saveLastSync(lastSync: LastSync): void {
    this.ensureConfigDir();

    try {
      fs.writeFileSync(this.lastSyncPath, JSON.stringify(lastSync, null, 2), 'utf-8');
    } catch (error) {
      throw new ConfigError(`Failed to write last sync file: ${error}`);
    }
  }

  getConfigDir(): string {
    return path.join(this.cwd, CONFIG_DIR);
  }

  getCacheDir(): string {
    return this.cachePath;
  }
}
