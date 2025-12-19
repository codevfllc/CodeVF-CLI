/**
 * Tunnel manager for creating and managing localtunnel connections
 */

import localtunnel from 'localtunnel';
import type { Tunnel } from 'localtunnel';
import { EventEmitter } from 'events';
import { ActiveTunnel } from '../types/index.js';
import https from 'https';

export interface TunnelOptions {
  port: number;
  subdomain?: string;
  taskId: string;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

export class TunnelManager extends EventEmitter {
  private tunnel: Tunnel | null = null;
  private activeTunnel: ActiveTunnel | null = null;

  /**
   * Fetch the localtunnel password for bypassing the landing page
   * Retries up to 3 times to ensure we always get a password
   */
  private async fetchTunnelPassword(): Promise<string> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const password = await new Promise<string>((resolve, reject) => {
          https
            .get('https://loca.lt/mytunnelpassword', (res) => {
              let data = '';
              res.on('data', (chunk) => {
                data += chunk;
              });
              res.on('end', () => {
                const trimmed = data.trim();
                if (trimmed) {
                  resolve(trimmed);
                } else {
                  reject(new Error('Empty password received'));
                }
              });
            })
            .on('error', (err) => {
              reject(err);
            });
        });

        return password;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.error(`Failed to fetch tunnel password (attempt ${attempt}/${maxRetries}):`, err);
        
        // Wait before retry if not the last attempt (exponential backoff: 500ms, 1s, 2s)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt - 1)));
        }
      }
    }

    // If we exit the loop, all retries failed
    throw new Error(`Could not fetch tunnel password after multiple attempts: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Create a new localtunnel for a task session
   */
  async createTunnel(options: TunnelOptions): Promise<ActiveTunnel> {
    // Close existing tunnel if any
    if (this.tunnel) {
      await this.closeTunnel();
    }

    const tunnelOptions: any = { port: options.port };
    if (options.subdomain) {
      tunnelOptions.subdomain = options.subdomain;
    }

    try {
      this.tunnel = await localtunnel(tunnelOptions);

      // Fetch the tunnel password (with retries to ensure we always get one)
      const password = await this.fetchTunnelPassword();

      this.activeTunnel = {
        url: this.tunnel.url,
        port: options.port,
        subdomain: options.subdomain,
        createdAt: new Date(),
        taskId: options.taskId,
        password, // Password is always present (method throws if unavailable)
      };

      // Handle tunnel errors
      this.tunnel.on('error', (err) => {
        console.error('Tunnel error:', err);
        this.emit('error', err);
        options.onError?.(err);
      });

      // Handle tunnel close
      this.tunnel.on('close', () => {
        console.log('Tunnel closed');
        this.emit('close');
        options.onClose?.();
        this.activeTunnel = null;
      });

      this.emit('created', this.activeTunnel);
      return this.activeTunnel;
    } catch (error: any) {
      console.error('Failed to create tunnel:', error);
      throw new Error(`Tunnel creation failed: ${error.message}`);
    }
  }

  /**
   * Close the active tunnel
   */
  async closeTunnel(): Promise<void> {
    if (this.tunnel) {
      this.tunnel.close();
      this.tunnel = null;
      const prevTunnel = this.activeTunnel;
      this.activeTunnel = null;
      this.emit('closed', prevTunnel);
    }
  }

  /**
   * Get the currently active tunnel
   */
  getActiveTunnel(): ActiveTunnel | null {
    return this.activeTunnel;
  }

  /**
   * Check if tunnel is active
   */
  isActive(): boolean {
    return this.activeTunnel !== null && this.tunnel !== null;
  }
}
