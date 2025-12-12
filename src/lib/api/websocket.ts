/**
 * WebSocket client with reconnection support
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { SessionError, TimeoutError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export interface WebSocketMessage {
  type: string;
  timestamp?: string;
  payload: any;
}

export interface EngineerMessage {
  text: string;
  userId: string;
}

export interface BillingUpdate {
  creditsUsed: number;
  duration: number;
}

export class WebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isClosedManually = false;

  constructor(url: string) {
    super();
    this.url = url;
  }

  /**
   * Connect to WebSocket server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.info('Connecting to WebSocket', { url: this.url });

      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        logger.info('WebSocket connected');
        this.reconnectAttempts = 0;
        this.emit('connected');
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          logger.debug('Received message', { type: message.type });

          // Emit specific events based on message type
          switch (message.type) {
            case 'engineer_message':
              this.emit('engineer_message', message.payload as EngineerMessage);
              break;
            case 'billing_update':
              this.emit('billing_update', message.payload as BillingUpdate);
              break;
            case 'closure_request':
              this.emit('closure_request', message.payload);
              break;
            case 'engineer_connected':
              this.emit('engineer_connected');
              break;
            default:
              this.emit('message', message);
          }
        } catch (error) {
          logger.error('Failed to parse message', error);
        }
      });

      this.ws.on('close', () => {
        logger.info('WebSocket closed');
        this.emit('disconnected');

        if (!this.isClosedManually && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.attemptReconnect();
        }
      });

      this.ws.on('error', (error) => {
        logger.error('WebSocket error', error);
        this.emit('error', error);
        reject(new SessionError(`WebSocket error: ${error.message}`));
      });
    });
  }

  /**
   * Send message to server
   */
  send(message: WebSocketMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new SessionError('WebSocket not connected');
    }

    logger.debug('Sending message', { type: message.type });
    this.ws.send(JSON.stringify(message));
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    this.isClosedManually = true;

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    logger.info('WebSocket disconnected manually');
  }

  /**
   * Attempt reconnection with exponential backoff
   */
  private attemptReconnect(): void {
    this.reconnectAttempts++;

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);

    logger.info('Attempting reconnection', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
      delay,
    });

    setTimeout(() => {
      this.connect().catch((error) => {
        logger.error('Reconnection failed', error);
      });
    }, delay);
  }

  /**
   * Wait for engineer response with timeout
   */
  async waitForResponse(timeoutMs: number = 300000): Promise<{
    text: string;
    creditsUsed: number;
    duration: string;
  }> {
    return new Promise((resolve, reject) => {
      let responseText = '';
      let creditsUsed = 0;
      const startTime = Date.now();
      let hasReceivedMessage = false;

      const onEngineerMessage = (msg: EngineerMessage) => {
        responseText += msg.text + '\n';
        hasReceivedMessage = true;
        // Wait for closure request instead of auto-resolving after 2 seconds
        console.log('[WebSocket] Received engineer message, waiting for task completion...');
      };

      const onBillingUpdate = (update: BillingUpdate) => {
        creditsUsed = update.creditsUsed;
      };

      const onClosureRequest = () => {
        if (!hasResolvedOrRejected) {
          cleanup();
          const duration = Math.ceil((Date.now() - startTime) / 60000);
          hasResolvedOrRejected = true;
          logger.info('[WebSocket] Received closure request, resolving response', {
            duration,
            creditsUsed,
            textLength: responseText.length,
          });
          resolve({
            text: responseText.trim(),
            creditsUsed,
            duration: `${duration} min`,
          });
        }
      };

      const onError = (error: Error) => {
        if (!hasResolvedOrRejected) {
          cleanup();
          hasResolvedOrRejected = true;
          logger.error('[WebSocket] Connection error while waiting for response', error);
          reject(new SessionError(`WebSocket error: ${error.message}`));
        }
      };

      let hasResolvedOrRejected = false;

      const cleanup = () => {
        this.off('engineer_message', onEngineerMessage);
        this.off('billing_update', onBillingUpdate);
        this.off('closure_request', onClosureRequest);
        this.off('error', onError);
        clearTimeout(timeoutHandle);
      };

      this.on('engineer_message', onEngineerMessage);
      this.on('billing_update', onBillingUpdate);
      this.on('closure_request', onClosureRequest);
      this.on('error', onError);

      const timeoutHandle = setTimeout(() => {
        if (!hasResolvedOrRejected) {
          cleanup();
          hasResolvedOrRejected = true;
          logger.warn('[WebSocket] Timeout waiting for closure request', { 
            hasReceivedMessage, 
            timeoutMs,
            receivedText: responseText.substring(0, 100) 
          });
          if (hasReceivedMessage) {
            // If we got a message but timed out waiting for closure, return what we have
            const duration = Math.ceil((Date.now() - startTime) / 60000);
            resolve({
              text: responseText.trim(),
              creditsUsed,
              duration: `${duration} min`,
            });
          } else {
            reject(new TimeoutError('Timeout waiting for engineer response'));
          }
        }
      }, timeoutMs);
    });
  }
}
