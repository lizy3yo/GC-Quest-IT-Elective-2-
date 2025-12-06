import { useEffect, useCallback, useRef } from 'react';
import { useWebSocketContext } from '@/contexts/WebSocketContext';
import type { WebSocketEventHandler } from '@/services/websocket.service';

/**
 * Hook for subscribing to WebSocket events
 */
export const useWebSocketEvent = (
  eventType: string,
  handler: WebSocketEventHandler,
  dependencies: any[] = []
) => {
  const { subscribe } = useWebSocketContext();
  const handlerRef = useRef(handler);

  // Update handler ref when it changes
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const wrappedHandler = (data: any) => handlerRef.current(data);
    const unsubscribe = subscribe(eventType, wrappedHandler);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventType, subscribe, ...dependencies]);
};

/**
 * Hook for sending WebSocket messages
 */
export const useWebSocketSend = () => {
  const { send, isConnected } = useWebSocketContext();

  const sendMessage = useCallback(
    (type: string, payload?: any) => {
      if (!isConnected) {
        console.warn('WebSocket not connected. Message will be queued.');
      }
      send(type, payload);
    },
    [send, isConnected]
  );

  return { send: sendMessage, isConnected };
};

/**
 * Hook for WebSocket connection status
 */
export const useWebSocketStatus = () => {
  const { isConnected, status, connect, disconnect } = useWebSocketContext();

  return {
    isConnected,
    status,
    connect,
    disconnect,
  };
};

/**
 * Hook for subscribing to multiple events
 */
export const useWebSocketEvents = (
  events: Record<string, WebSocketEventHandler>,
  dependencies: any[] = []
) => {
  const { subscribe } = useWebSocketContext();
  const eventsRef = useRef(events);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    const unsubscribers = Object.entries(eventsRef.current).map(([eventType, handler]) => {
      const wrappedHandler = (data: any) => handler(data);
      return subscribe(eventType, wrappedHandler);
    });

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe, ...dependencies]);
};
