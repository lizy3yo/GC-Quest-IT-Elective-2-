import Pusher from 'pusher-js';

type WebSocketEventHandler = (data: any) => void;
type ConnectionStatusHandler = (status: 'connected' | 'disconnected' | 'reconnecting' | 'error') => void;

interface WebSocketMessage {
  type: string;
  payload?: any;
  timestamp?: number;
}

/**
 * Pusher-based WebSocket Service for Vercel Deployment
 * This replaces the native WebSocket implementation
 */
class PusherWebSocketService {
  private pusher: Pusher | null = null;
  private channels: Map<string, any> = new Map();
  private eventHandlers: Map<string, Set<WebSocketEventHandler>> = new Map();
  private statusHandlers: Set<ConnectionStatusHandler> = new Set();
  private isConnected = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializePusher();
    }
  }

  private initializePusher(): void {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!key || !cluster) {
      console.error('Pusher credentials not found in environment variables');
      return;
    }

    this.pusher = new Pusher(key, {
      cluster: cluster,
      forceTLS: true,
    });

    // Connection state listeners
    this.pusher.connection.bind('connected', () => {
      this.isConnected = true;
      this.notifyStatusChange('connected');
      console.log('[Pusher] Connected');
    });

    this.pusher.connection.bind('disconnected', () => {
      this.isConnected = false;
      this.notifyStatusChange('disconnected');
      console.log('[Pusher] Disconnected');
    });

    this.pusher.connection.bind('connecting', () => {
      this.notifyStatusChange('reconnecting');
      console.log('[Pusher] Connecting...');
    });

    this.pusher.connection.bind('unavailable', () => {
      this.notifyStatusChange('error');
      console.log('[Pusher] Connection unavailable');
    });

    this.pusher.connection.bind('failed', () => {
      this.notifyStatusChange('error');
      console.log('[Pusher] Connection failed');
    });
  }

  /**
   * Connect to Pusher (auto-connects on initialization)
   */
  connect(token?: string): void {
    if (!this.pusher) {
      this.initializePusher();
    }
    // Pusher connects automatically
    console.log('[Pusher] Connection initiated');
  }

  /**
   * Disconnect from Pusher
   */
  disconnect(): void {
    if (this.pusher) {
      this.pusher.disconnect();
      this.channels.clear();
      this.isConnected = false;
    }
  }

  /**
   * Send message to server via API route
   */
  send(type: string, payload?: any): void {
    const message: WebSocketMessage = {
      type,
      payload,
      timestamp: Date.now(),
    };

    // Send via API route which uses Pusher server SDK
    fetch('/api/pusher/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    }).catch(err => console.error('[Pusher] Send error:', err));
  }

  /**
   * Subscribe to specific event type
   */
  on(eventType: string, handler: WebSocketEventHandler): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);

    // Subscribe to Pusher channel and bind event
    const channel = this.getChannel('notifications');
    channel.bind(eventType, handler);

    // Return unsubscribe function
    return () => this.off(eventType, handler);
  }

  /**
   * Unsubscribe from event
   */
  off(eventType: string, handler: WebSocketEventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      const channel = this.getChannel('notifications');
      channel.unbind(eventType, handler);
    }
  }

  /**
   * Subscribe to connection status changes
   */
  onStatusChange(handler: ConnectionStatusHandler): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  /**
   * Get current connection status
   */
  getStatus(): 'connected' | 'disconnected' | 'reconnecting' | 'error' {
    if (!this.pusher) return 'disconnected';
    
    const state = this.pusher.connection.state;
    switch (state) {
      case 'connected':
        return 'connected';
      case 'connecting':
      case 'unavailable':
        return 'reconnecting';
      case 'failed':
        return 'error';
      default:
        return 'disconnected';
    }
  }

  /**
   * Check if connected
   */
  isSocketConnected(): boolean {
    return this.isConnected && this.pusher?.connection.state === 'connected';
  }

  /**
   * Get or create a Pusher channel
   */
  private getChannel(channelName: string) {
    if (!this.channels.has(channelName)) {
      if (!this.pusher) {
        throw new Error('Pusher not initialized');
      }
      const channel = this.pusher.subscribe(channelName);
      this.channels.set(channelName, channel);
      console.log(`[Pusher] Subscribed to channel: ${channelName}`);
    }
    return this.channels.get(channelName);
  }

  /**
   * Notify status change handlers
   */
  private notifyStatusChange(status: 'connected' | 'disconnected' | 'reconnecting' | 'error'): void {
    this.statusHandlers.forEach(handler => {
      try {
        handler(status);
      } catch (error) {
        console.error('[Pusher] Error in status handler:', error);
      }
    });
  }
}

// Singleton instance
let pusherService: PusherWebSocketService | null = null;

export const getWebSocketService = (): PusherWebSocketService => {
  if (!pusherService) {
    pusherService = new PusherWebSocketService();
  }
  return pusherService;
};

export { PusherWebSocketService };
export type { WebSocketMessage, WebSocketEventHandler, ConnectionStatusHandler };
