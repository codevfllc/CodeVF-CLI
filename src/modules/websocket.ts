import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { WebSocketMessage, NetworkError, ActiveTunnel } from '../types/index.js';
import { TunnelManager } from './tunnel.js';
import { PermissionManager } from './permissions.js';

export class WebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private tunnelManager: TunnelManager | null = null;
  private permissionManager: PermissionManager | null = null;
  private taskId: string | null = null;

  constructor(url: string, token: string) {
    super();
    this.url = url;
    this.token = token;
  }

  /**
   * Enable tunnel support for this WebSocket connection
   */
  enableTunnelSupport(
    tunnelManager: TunnelManager,
    permissionManager: PermissionManager,
    taskId: string
  ): void {
    this.tunnelManager = tunnelManager;
    this.permissionManager = permissionManager;
    this.taskId = taskId;

    // Listen for tunnel requests
    this.on('tunnel_request', async (message: WebSocketMessage) => {
      if (!this.tunnelManager || !this.permissionManager || !this.taskId) {
        console.error('Tunnel support not properly configured');
        return;
      }

      const { suggestedPort, reason } = message.payload;

      const result = await this.permissionManager.handleTunnelRequest(
        suggestedPort,
        reason,
        this.taskId,
        this.tunnelManager
      );

      if (result.approved && result.tunnelUrl) {
        // Send approval with tunnel URL
        this.send({
          type: 'approve_tunnel',
          timestamp: new Date().toISOString(),
          payload: {
            tunnelUrl: result.tunnelUrl,
            port: suggestedPort,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
          },
        });

        this.emit('tunnel_created', this.tunnelManager.getActiveTunnel());
      } else {
        // Send denial
        this.send({
          type: 'deny_tunnel',
          timestamp: new Date().toISOString(),
          payload: {
            reason: result.error || 'Tunnel access denied',
          },
        });
      }
    });

    // Handle tunnel approval confirmation
    this.on('tunnel_approved', (message: WebSocketMessage) => {
      console.log(`Tunnel approved: ${message.payload.tunnelUrl}`);
      this.emit('tunnel_approved', message.payload);
    });

    // Handle tunnel denial
    this.on('tunnel_denied', (message: WebSocketMessage) => {
      console.log(`Tunnel denied: ${message.payload.reason}`);
      this.emit('tunnel_denied', message.payload);
    });

    // Handle tunnel closure
    this.on('tunnel_closed', (message: WebSocketMessage) => {
      console.log(`Tunnel closed by ${message.payload.closedBy}`);
      this.emit('tunnel_closed', message.payload);
    });

    // Auto-close tunnel when session ends
    tunnelManager.on('closed', (tunnel: ActiveTunnel) => {
      if (this.isConnected()) {
        this.send({
          type: 'close_tunnel',
          timestamp: new Date().toISOString(),
          payload: {
            tunnelUrl: tunnel.url,
          },
        });
      }
    });
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url, {
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        });

        this.ws.on('open', () => {
          this.reconnectAttempts = 0;
          this.emit('connected');
          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString()) as WebSocketMessage;
            this.emit('message', message);
            this.emit(message.type, message);
          } catch (error) {
            this.emit('error', new Error(`Failed to parse message: ${error}`));
          }
        });

        this.ws.on('close', () => {
          this.emit('disconnected');
          this.attemptReconnect();
        });

        this.ws.on('error', (error) => {
          this.emit('error', new NetworkError(`WebSocket error: ${error.message}`));
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  send(message: WebSocketMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new NetworkError('WebSocket is not connected');
    }

    this.ws.send(JSON.stringify(message));
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emit('error', new NetworkError('Max reconnection attempts reached'));
      return;
    }

    this.reconnectAttempts++;
    this.emit('reconnecting', this.reconnectAttempts);

    setTimeout(() => {
      this.connect().catch((error) => {
        this.emit('error', error);
      });
    }, this.reconnectDelay * this.reconnectAttempts);
  }
}
