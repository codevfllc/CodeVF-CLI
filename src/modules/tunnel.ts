/**
 * Tunnel manager for creating and managing localtunnel connections
 */

import localtunnel from 'localtunnel';
import type { Tunnel } from 'localtunnel';
import { EventEmitter } from 'events';
import { ActiveTunnel } from '../types/index.js';

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

      this.activeTunnel = {
        url: this.tunnel.url,
        port: options.port,
        subdomain: options.subdomain,
        createdAt: new Date(),
        taskId: options.taskId,
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
