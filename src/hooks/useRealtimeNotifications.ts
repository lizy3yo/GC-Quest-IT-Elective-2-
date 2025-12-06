import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocketEvent, useWebSocketSend } from './useWebSocket';
import { QUERY_KEYS } from '@/constants/api.constants';
import type { Notification } from '@/interfaces/notification.interface';

interface NotificationEventPayload {
  notification: Notification;
  action: 'created' | 'updated' | 'deleted';
}

interface UseRealtimeNotificationsOptions {
  onNewNotification?: (notification: Notification) => void;
  onNotificationUpdate?: (notification: Notification) => void;
  onNotificationDelete?: (notificationId: string) => void;
  playSound?: boolean;
  showToast?: boolean;
}

/**
 * Hook for real-time notification updates via WebSocket
 */
export const useRealtimeNotifications = (options: UseRealtimeNotificationsOptions = {}) => {
  const queryClient = useQueryClient();
  const { send } = useWebSocketSend();

  // Handle new notifications
  const handleNotificationEvent = useCallback(
    (payload: NotificationEventPayload) => {
      const { notification, action } = payload;

      // Invalidate notification queries to refetch
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NOTIFICATIONS.ALL });

      // Call custom handlers
      switch (action) {
        case 'created':
          options.onNewNotification?.(notification);
          
          // Play notification sound
          if (options.playSound) {
            playNotificationSound();
          }
          
          // Show browser notification
          if (options.showToast && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(notification.title || 'New Notification', {
              body: notification.message,
              icon: '/favicon.ico',
            });
          }
          break;

        case 'updated':
          options.onNotificationUpdate?.(notification);
          break;

        case 'deleted':
          options.onNotificationDelete?.(notification.id);
          break;
      }
    },
    [queryClient, options]
  );

  // Subscribe to notification events
  useWebSocketEvent('notification', handleNotificationEvent);

  // Subscribe to notification channel on mount
  useEffect(() => {
    send('subscribe', { channel: 'notifications' });

    return () => {
      send('unsubscribe', { channel: 'notifications' });
    };
  }, [send]);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }, []);

  return {
    requestNotificationPermission,
  };
};

/**
 * Play notification sound
 */
const playNotificationSound = () => {
  try {
    const audio = new Audio('/notification-sound.mp3');
    audio.volume = 0.5;
    audio.play().catch(err => console.warn('Failed to play notification sound:', err));
  } catch (error) {
    console.warn('Notification sound not available:', error);
  }
};

/**
 * Hook for real-time notification count
 */
export const useRealtimeNotificationCount = () => {
  const queryClient = useQueryClient();

  useWebSocketEvent('notification:count', (payload: { count: number; unreadCount: number }) => {
    // Update cached notification count
    queryClient.setQueryData(['notification-count'], payload);
  });
};
