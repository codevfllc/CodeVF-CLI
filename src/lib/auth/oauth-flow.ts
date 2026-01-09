/**
 * OAuth polling flow for CLI authentication
 */

import { AuthenticationError, NetworkError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export interface OAuthPollResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  userId: string;
}

export class OAuthFlow {
  private baseUrl: string;
  private clientType: string;
  private maxPollAttempts = 60; // 2 minutes (60 * 2 seconds)
  private pollIntervalMs = 2000; // 2 seconds

  constructor(baseUrl: string, clientType: string = 'cli') {
    this.baseUrl = baseUrl;
    this.clientType = clientType;
  }

  /**
   * Initiate OAuth flow
   */
  async init(): Promise<{ pollToken: string; authUrl: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/cli/auth/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientType: this.clientType }),
      });

      if (!response.ok) {
        throw new Error(`Init failed: ${response.status}`);
      }

      const data = (await response.json()) as {
        success: boolean;
        data?: { pollToken: string; authUrl: string };
      };

      if (!data.success || !data.data) {
        throw new Error('Invalid init response');
      }

      const baseOrigin = new URL(this.baseUrl).origin;
      let authUrl = data.data.authUrl;

      try {
        const authOrigin = new URL(authUrl).origin;
        const baseHost = new URL(this.baseUrl).hostname;
        const isLocalBase = baseHost === 'localhost' || baseHost === '127.0.0.1';

        if (isLocalBase && authOrigin !== baseOrigin) {
          const authUrlParsed = new URL(authUrl);
          authUrlParsed.protocol = new URL(this.baseUrl).protocol;
          authUrlParsed.host = new URL(this.baseUrl).host;
          authUrl = authUrlParsed.toString();

          logger.warn('Auth URL host differs from base URL; using base URL for local auth', {
            originalAuthUrl: data.data.authUrl,
            authUrl,
          });
        }
      } catch (error) {
        logger.warn('Failed to normalize auth URL', error);
      }

      logger.info('OAuth flow initiated', {
        authUrl,
      });

      return {
        pollToken: data.data.pollToken,
        authUrl,
      };
    } catch (error) {
      logger.error('OAuth init failed', error);
      throw new NetworkError(`Failed to initialize OAuth: ${(error as Error).message}`);
    }
  }

  /**
   * Open authorization URL in browser
   */
  async openAuthUrl(authUrl: string): Promise<void> {
    try {
      // Dynamic import for ESM-only module
      const open = (await import('open')).default;
      await open(authUrl);
      logger.info('Opened authorization URL in browser');
    } catch (error) {
      logger.warn('Failed to open browser automatically', error);
      console.log(`\nPlease open this URL in your browser:\n${authUrl}\n`);
    }
  }

  /**
   * Poll for authentication tokens
   */
  async poll(pollToken: string): Promise<OAuthPollResult> {
    let attempts = 0;

    while (attempts < this.maxPollAttempts) {
      attempts++;

      try {
        const response = await fetch(
          `${this.baseUrl}/api/cli/auth/token?pollToken=${pollToken}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          }
        );

        if (!response.ok) {
          if (response.status === 404 || response.status === 400) {
            // Still waiting for authorization
            await this.sleep(this.pollIntervalMs);
            continue;
          }
          throw new Error(`Poll failed: ${response.status}`);
        }

        const data = (await response.json()) as {
          success: boolean;
          data?: {
            accessToken: string;
            refreshToken: string;
            expiresAt: string;
            userId: string;
          };
        };

        if (!data.success || !data.data) {
          // Still waiting
          await this.sleep(this.pollIntervalMs);
          continue;
        }

        // Success!
        logger.info('Authentication successful');
        return {
          accessToken: data.data.accessToken,
          refreshToken: data.data.refreshToken,
          expiresAt: data.data.expiresAt,
          userId: data.data.userId,
        };
      } catch (error) {
        if (attempts >= this.maxPollAttempts) {
          throw error;
        }
        await this.sleep(this.pollIntervalMs);
      }
    }

    throw new AuthenticationError('Authentication timeout. Please try again.');
  }

  /**
   * Complete OAuth flow
   */
  async authenticate(): Promise<OAuthPollResult> {
    // Step 1: Initialize
    const { pollToken, authUrl } = await this.init();

    // Step 2: Open browser
    await this.openAuthUrl(authUrl);

    console.log('\nWaiting for authorization...');
    console.log('(Complete the authorization in your browser)\n');

    // Step 3: Poll for tokens
    return await this.poll(pollToken);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
