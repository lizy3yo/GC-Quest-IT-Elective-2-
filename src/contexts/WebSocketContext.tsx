'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { getWebSocketService, WebSocketService } from '@/services/websocket.service';
import type { WebSocketEventHandler, ConnectionStatusHandler } from '@/services/websocket.service';

interface WebSocketContextValue {
  isConnected: boolean;
  status: 'connected' | 'disconnected' | 'reconnecting' | 'error';
  send: (type: string, payload?: any) => void;
  subscribe: (eventType: string, handler: WebSocketEventHandler) => () => void;
  connect: () => void;
  disconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

interface WebSocketProviderProps {
  children: React.ReactNode;
  autoConnect?: boolean;
  requireAuth?: boolean;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
  autoConnect = true,
  requireAuth = true,
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'reconnecting' | 'error'>('disconnected');
  const wsServiceRef = useRef<WebSocketService | null>(null);
  const statusUnsubscribeRef = useRef<(() => void) | null>(null);

  // Initialize WebSocket service
  useEffect(() => {
    wsServiceRef.current = getWebSocketService();

    // Subscribe to status changes
    statusUnsubscribeRef.current = wsServiceRef.current.onStatusChange((newStatus) => {
      setStatus(newStatus);
      setIsConnected(newStatus === 'connected');
    });

    return () => {
      if (statusUnsubscribeRef.current) {
        statusUnsubscribeRef.current();
      }
    };
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && wsServiceRef.current) {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      
      if (!requireAuth || token) {
        wsServiceRef.current.connect(token || undefined);
      }
    }

    return () => {
      if (wsServiceRef.current && autoConnect) {
        wsServiceRef.current.disconnect();
      }
    };
  }, [autoConnect, requireAuth]);

  const send = useCallback((type: string, payload?: any) => {
    wsServiceRef.current?.send(type, payload);
  }, []);

  const subscribe = useCallback((eventType: string, handler: WebSocketEventHandler) => {
    if (!wsServiceRef.current) {
      return () => {};
    }
    return wsServiceRef.current.on(eventType, handler);
  }, []);

  const connect = useCallback(() => {
    if (wsServiceRef.current) {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      wsServiceRef.current.connect(token || undefined);
    }
  }, []);

  const disconnect = useCallback(() => {
    wsServiceRef.current?.disconnect();
  }, []);

  const value: WebSocketContextValue = {
    isConnected,
    status,
    send,
    subscribe,
    connect,
    disconnect,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketContext = (): WebSocketContextValue => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within WebSocketProvider');
  }
  return context;
};
