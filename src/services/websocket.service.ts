type WebSocketEventHandler = (data: any) => void;
type ConnectionStatusHandler = (status: 'connected' | 'disconnected' | 'reconnecting' | 'error') => void;

interface WebSocketMessage {
  type: string;
  payload?: any;
  timestamp?: number;
}

interface WebSocketConfig {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  debug?: boolean;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private eventHandlers: Map<string, Set<WebSocketEventHandler>> = new Map();
  private statusHandlers: Set<ConnectionStatusHandler> = new Set();
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isIntentionallyClosed = false;
  private messageQueue: WebSocketMessage[] = [];
  private isConnected = false;

  constructor(config: WebSocketConfig) {
    this.config = {
      url: config.url,
      reconnectInterval: config.reconnectInterval || 3000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      heartbeatInterval: config.heartbeatInterval || 30000,
      debug: config.debug || false,
    };
  }

  /**
   * Connect to WebSocket server
   */
  connect(token?: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.log('Already connected');
      return;
    }

    this.isIntentionallyClosed = false;
    const url = token ? `${this.config.url}?token=${token}` : this.config.url;

    try {
      this.ws = new WebSocket(url);
      this.setupEventListeners();
    } catch (error) {
      this.log('Connection error:', error);
      this.notifyStatusChange('error');
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.isIntentionallyClosed = true;
    this.clearReconnectTimeout();
    this.clearHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.messageQueue = [];
    this.notifyStatusChange('disconnected');
  }

  /**
   * Send message to server
   */
  send(type: string, payload?: any): void {
    const message: WebSocketMessage = {
      type,
      payload,
      timestamp: Date.now(),
    };

    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      this.log('Sent message:', message);
    } else {
      // Queue message for later
      this.messageQueue.push(message);
      this.log('Message queued:', message);
    }
  }

  /**
   * Subscribe to specific event type
   */
  on(eventType: string, handler: WebSocketEventHandler): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);

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
      if (handlers.size === 0) {
        this.eventHandlers.delete(eventType);
      }
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
    if (this.isConnected) return 'connected';
    if (this.reconnectTimeout) return 'reconnecting';
    return 'disconnected';
  }

  /**
   * Check if connected
   */
  isSocketConnected(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  private setupEventListeners(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.log('Connected to WebSocket');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.notifyStatusChange('connected');
      this.startHeartbeat();
      this.flushMessageQueue();
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.log('Received message:', message);
        this.handleMessage(message);
      } catch (error) {
        this.log('Failed to parse message:', error);
      }
    };

    this.ws.onerror = (error) => {
      this.log('WebSocket error:', error);
      this.notifyStatusChange('error');
    };

    this.ws.onclose = (event) => {
      this.log('WebSocket closed:', event.code, event.reason);
      this.isConnected = false;
      this.clearHeartbeat();
      this.notifyStatusChange('disconnected');

      if (!this.isIntentionallyClosed) {
        this.scheduleReconnect();
      }
    };
  }

  private handleMessage(message: WebSocketMessage): void {
    const handlers = this.eventHandlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(message.payload);
        } catch (error) {
          this.log('Error in event handler:', error);
        }
      });
    }

    // Also trigger wildcard handlers
    const wildcardHandlers = this.eventHandlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          this.log('Error in wildcard handler:', error);
        }
      });
    }
  }

  private scheduleReconnect(): void {
    if (this.isIntentionallyClosed) return;
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.log('Max reconnect attempts reached');
      this.notifyStatusChange('error');
      return;
    }

    this.clearReconnectTimeout();
    this.notifyStatusChange('reconnecting');

    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts),
      30000 // Max 30 seconds
    );

    this.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private startHeartbeat(): void {
    this.clearHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected) {
        this.send('ping');
      }
    }, this.config.heartbeatInterval);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message.type, message.payload);
      }
    }
  }

  private notifyStatusChange(status: 'connected' | 'disconnected' | 'reconnecting' | 'error'): void {
    this.statusHandlers.forEach(handler => {
      try {
        handler(status);
      } catch (error) {
        this.log('Error in status handler:', error);
      }
    });
  }

  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log('[WebSocket]', ...args);
    }
  }
}

// Singleton instance
let websocketService: WebSocketService | null = null;

export const getWebSocketService = (): WebSocketService => {
  // Check if we should use Pusher (for Vercel deployment)
  if (process.env.NEXT_PUBLIC_PUSHER_KEY) {
    // Use Pusher service instead
    const { getWebSocketService: getPusherService } = require('./pusher.service');
    return getPusherService();
  }

  // Use native WebSocket for local development
  if (!websocketService) {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 
                  (typeof window !== 'undefined' 
                    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
                    : 'ws://localhost:3000/ws');

    websocketService = new WebSocketService({
      url: wsUrl,
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      debug: process.env.NODE_ENV === 'development',
    });
  }
  return websocketService;
};

export { WebSocketService };
export type { WebSocketMessage, WebSocketConfig, WebSocketEventHandler, ConnectionStatusHandler };
