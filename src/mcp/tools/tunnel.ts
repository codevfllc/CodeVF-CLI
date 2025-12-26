/**
 * Tunnel Tool - Create localtunnel for local dev server access
 */

import { TunnelManager } from '../../modules/tunnel.js';
import { logger } from '../../lib/utils/logger.js';
import { nanoid } from 'nanoid';

export interface TunnelArgs {
  port: number;
  subdomain?: string;
  reason?: string;
}

export class TunnelTool {
  private tunnelManager: TunnelManager;
  private activeTunnels: Map<string, { url: string; port: number; closeFn: () => void }>;

  constructor() {
    this.tunnelManager = new TunnelManager();
    this.activeTunnels = new Map();
  }

  async execute(args: TunnelArgs) {
    const { port, subdomain, reason } = args;

    try {
      logger.info(`Creating tunnel for port ${port}`, { subdomain, reason });

      // Validate port
      if (!port || port < 1 || port > 65535) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Invalid port: ${port}. Must be between 1 and 65535.`,
            },
          ],
          isError: true,
        };
      }

      // Create tunnel using a unique task ID
      const taskId = nanoid();
      const tunnel = await this.tunnelManager.createTunnel({
        port,
        subdomain,
        taskId,
        onError: (error) => {
          logger.error('Tunnel error', error);
        },
        onClose: () => {
          logger.info(`Tunnel closed for port ${port}`);
          this.activeTunnels.delete(taskId);
        },
      });

      // Store tunnel reference
      this.activeTunnels.set(taskId, {
        url: tunnel.url,
        port: tunnel.port,
        closeFn: async () => {
          await this.tunnelManager.closeTunnel();
        },
      });

      const message = [
        `✅ Tunnel created successfully!`,
        ``,
        `🔗 **Tunnel URL:** ${tunnel.url}`,
        `📍 **Local Port:** ${tunnel.port}`,
        `🔑 **Password:** ${tunnel.password}`,
        `⏰ **Created:** ${tunnel.createdAt.toISOString()}`,
        ``,
        `The tunnel will remain open for this session.`,
        `Engineers or external services can now access your local server at this URL.`,
      ].join('\n');

      logger.info('Tunnel created', { url: tunnel.url, port: tunnel.port });

      return {
        content: [
          {
            type: 'text',
            text: message,
          },
        ],
      };
    } catch (error: any) {
      logger.error('Failed to create tunnel', error);

      return {
        content: [
          {
            type: 'text',
            text: `❌ Failed to create tunnel: ${error.message}\n\nCommon issues:\n- Port ${port} may not be in use\n- Firewall blocking connections\n- Localtunnel service temporarily unavailable`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Close all active tunnels
   */
  async closeAll() {
    for (const [taskId, tunnel] of this.activeTunnels.entries()) {
      try {
        await tunnel.closeFn();
        logger.info(`Closed tunnel: ${tunnel.url}`);
      } catch (error) {
        logger.error(`Failed to close tunnel ${taskId}`, error);
      }
    }
    this.activeTunnels.clear();
  }

  /**
   * Get list of active tunnels
   */
  getActiveTunnels() {
    return Array.from(this.activeTunnels.values()).map((t) => ({
      url: t.url,
      port: t.port,
    }));
  }
}
