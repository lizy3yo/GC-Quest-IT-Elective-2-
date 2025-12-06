/**
 * ORGANISM: NotificationList
 * Complete notification listing with actions
 * Uses custom hooks and molecules
 */

import React from 'react';
import { 
  useNotifications, 
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification 
} from '@/hooks/useNotificationRequest';
import { DataContainer } from '@/components/molecules/DataContainer';
import { NotificationItem } from '@/components/molecules/NotificationItem';
import type { NotificationFilters } from '@/interfaces/notification.interface';

interface NotificationListProps {
  filters?: NotificationFilters;
  showMarkAllRead?: boolean;
  className?: string;
}

export const NotificationList: React.FC<NotificationListProps> = ({
  filters,
  showMarkAllRead = true,
  className = ''
}) => {
  const { data, state, error, refetch } = useNotifications(filters);
  const { mutate: markRead } = useMarkNotificationRead();
  const { mutate: markAllRead } = useMarkAllNotificationsRead();
  const { mutate: deleteNotification } = useDeleteNotification();

  const handleMarkRead = (id: string) => {
    markRead(id, {
      onSuccess: () => refetch?.()
    });
  };

  const handleMarkAllRead = () => {
    markAllRead(undefined, {
      onSuccess: () => refetch?.()
    });
  };

  const handleDelete = (id: string) => {
    deleteNotification(id, {
      onSuccess: () => refetch?.()
    });
  };

  const unreadCount = data?.notifications?.filter(n => !n.isRead).length || 0;

  return (
    <div className={className}>
      {showMarkAllRead && unreadCount > 0 && (
        <div className="mb-4 flex justify-between items-center">
          <p className="text-sm text-gray-600">{unreadCount} unread notifications</p>
          <button
            onClick={handleMarkAllRead}
            className="text-sm text-blue-600 hover:underline"
          >
            Mark all as read
          </button>
        </div>
      )}

      <DataContainer
        state={state as any}
        error={error}
        emptyMessage="No notifications"
        loadingMessage="Loading notifications..."
      >
        <div className="space-y-3">
          {data?.notifications?.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkRead={handleMarkRead}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </DataContainer>
    </div>
  );
};
