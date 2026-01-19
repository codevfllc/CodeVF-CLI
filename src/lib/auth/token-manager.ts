/**
 * Token management with automatic refresh
 */

import { ConfigManager } from '../config/manager.js';
import { AuthenticationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export class TokenManager {
  private configManager: ConfigManager;
  private refreshThresholdMs = 60 * 60 * 1000; // 1 hour before expiry

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  /**
   * Get a valid access token (auto-refreshes if needed)
   */
  async getValidToken(): Promise<string> {
    const config = this.configManager.load();

    if (!config.auth) {
      throw new AuthenticationError('Not authenticated. Run: npx codevf setup');
    }

    // Check if token expires soon
    const expiresAt = new Date(config.auth.expiresAt);
    const now = new Date();
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();
    const isExpiryInvalid = Number.isNaN(timeUntilExpiry);

    if (isExpiryInvalid || timeUntilExpiry < this.refreshThresholdMs) {
      logger.info('Token expiring soon, refreshing...', {
        expiresAt: config.auth.expiresAt,
        isExpiryInvalid,
      });
      await this.refresh();
      return this.configManager.load().auth!.accessToken;
    }

    return config.auth.accessToken;
  }

  /**
   * Refresh access token using refresh token
   */
  async refresh(): Promise<void> {
    const config = this.configManager.load();

    if (!config.auth?.refreshToken) {
      throw new AuthenticationError('No refresh token available');
    }

    try {
      const response = await fetch(`${config.baseUrl}/api/cli/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.auth.refreshToken}`,
        },
        body: JSON.stringify({ refreshToken: config.auth.refreshToken }),
      });

      if (!response.ok) {
        throw new Error(`Refresh failed: ${response.status}`);
      }

      const data = (await response.json()) as {
        success: boolean;
        token?: string;
        accessToken?: string;
        refreshToken?: string;
        expiresIn?: number;
        expiresAt?: string;
      };

      const nextAccessToken = data.accessToken || data.token;
      if (!data.success || !nextAccessToken) {
        throw new Error('Invalid refresh response');
      }

      // Calculate new expiration time
      const expiresAt = data.expiresAt ? new Date(data.expiresAt) : new Date();
      if (!data.expiresAt) {
        expiresAt.setSeconds(expiresAt.getSeconds() + (data.expiresIn || 86400));
      }

      this.configManager.updateAuth({
        accessToken: nextAccessToken,
        refreshToken: data.refreshToken || config.auth.refreshToken,
        expiresAt: expiresAt.toISOString(),
        userId: config.auth.userId,
      });

      logger.info('Token refreshed successfully');
    } catch (error) {
      logger.error('Token refresh failed', error);
      throw new AuthenticationError(`Token refresh failed. Please re-authenticate: npx codevf setup`);
    }
  }

  /**
   * Validate token format (basic check)
   */
  validateTokenFormat(token: string): boolean {
    // JWT format: header.payload.signature
    const parts = token.split('.');
    return parts.length === 3;
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    try {
      const config = this.configManager.load();
      return !!config.auth?.accessToken;
    } catch {
      return false;
    }
  }
}
