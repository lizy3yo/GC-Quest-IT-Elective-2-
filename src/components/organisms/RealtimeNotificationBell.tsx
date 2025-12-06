'use client';

import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotificationRequest';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import { NotificationList } from './NotificationList';

export const RealtimeNotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { data: notifications, state } = useNotifications({ isRead: false });

  // Setup real-time notifications
  useRealtimeNotifications({
    onNewNotification: (notification) => {
      setUnreadCount(prev => prev + 1);
      // Optional: Show toast notification
      console.log('New notification:', notification);
    },
    playSound: true,
    showToast: true,
  });

  // Update unread count when notifications change
  useEffect(() => {
    if (notifications?.notifications) {
      const unread = notifications.notifications.filter(n => !n.isRead).length;
      setUnreadCount(unread);
    }
  }, [notifications]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6 text-gray-700" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl z-50 max-h-[600px] overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
              {unreadCount > 0 && (
                <p className="text-sm text-gray-600">{unreadCount} unread</p>
              )}
            </div>
            <div className="overflow-y-auto max-h-[500px]">
              {state.isLoading ? (
                <div className="p-4 text-center text-gray-500">Loading...</div>
              ) : (
                <NotificationList />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
