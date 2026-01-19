/**
 * HTTP client with automatic authentication
 */

import { TokenManager } from '../auth/token-manager.js';
import { NetworkError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  warning?: string;
} & (T extends object ? Partial<T> : {});

export class ApiClient {
  private baseUrl: string;
  private tokenManager: TokenManager;

  constructor(baseUrl: string, tokenManager: TokenManager) {
    this.baseUrl = baseUrl;
    this.tokenManager = tokenManager;
  }

  /**
   * Make authenticated request
   */
  async request<T = unknown>(
    path: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const token = await this.tokenManager.getValidToken();

    const url = `${this.baseUrl}${path}`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    };

    logger.debug('API request', { method: options.method || 'GET', url });

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = (await response.json()) as ApiResponse<T>;

      if (!response.ok) {
        logger.warn('API request failed', {
          status: response.status,
          error: data.error,
        });

        if (response.status === 401) {
          throw new NetworkError(
            'Authentication failed. Please run: npx codevf setup'
          );
        }

        throw new NetworkError(data.error || `Request failed: ${response.status}`);
      }

      logger.debug('API response', { success: data.success });
      return data;
    } catch (error) {
      if (error instanceof NetworkError) {
        throw error;
      }

      logger.error('API request error', error);
      throw new NetworkError(`Request failed: ${(error as Error).message}`);
    }
  }

  /**
   * GET request
   */
  async get<T = unknown>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T = unknown>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Get authentication token (for WebSocket connections)
   */
  async getToken(): Promise<string> {
    return await this.tokenManager.getValidToken();
  }
}
