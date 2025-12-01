import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AuthToken, AuthError } from '../types/index.js';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'codevf');
const AUTH_FILE = 'auth.json';

export class AuthManager {
  private authPath: string;

  constructor() {
    this.authPath = path.join(CONFIG_DIR, AUTH_FILE);
  }

  isAuthenticated(): boolean {
    if (!fs.existsSync(this.authPath)) {
      return false;
    }

    try {
      const token = this.loadToken();
      return !this.isTokenExpired(token);
    } catch {
      return false;
    }
  }

  loadToken(): AuthToken {
    if (!fs.existsSync(this.authPath)) {
      throw new AuthError('Not authenticated.\n\nPlease run: codevf login');
    }

    try {
      const content = fs.readFileSync(this.authPath, 'utf-8');
      const token = JSON.parse(content) as AuthToken;

      if (this.isTokenExpired(token)) {
        throw new AuthError('Authentication expired.\n\nPlease run: codevf login');
      }

      return token;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError(`Failed to read auth token: ${error}`);
    }
  }

  saveToken(token: AuthToken): void {
    this.ensureConfigDir();

    try {
      fs.writeFileSync(this.authPath, JSON.stringify(token, null, 2), 'utf-8');
      // Set file permissions to 0600 (read/write owner only)
      fs.chmodSync(this.authPath, 0o600);
    } catch (error) {
      throw new AuthError(`Failed to save auth token: ${error}`);
    }
  }

  clearToken(): void {
    if (fs.existsSync(this.authPath)) {
      try {
        fs.unlinkSync(this.authPath);
      } catch (error) {
        throw new AuthError(`Failed to clear auth token: ${error}`);
      }
    }
  }

  getAccessToken(): string {
    const token = this.loadToken();
    return token.accessToken;
  }

  private isTokenExpired(token: AuthToken): boolean {
    const expiresAt = new Date(token.expiresAt);
    const now = new Date();
    // Consider expired if less than 5 minutes remaining
    const bufferTime = 5 * 60 * 1000;
    return expiresAt.getTime() - now.getTime() < bufferTime;
  }

  private ensureConfigDir(): void {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    }
  }
}
