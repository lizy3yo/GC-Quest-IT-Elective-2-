import React from 'react';
import type { Notification } from '@/interfaces/notification.interface';

interface NotificationItemProps {
  notification: Notification;
  onMarkRead?: (id: string) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onMarkRead,
  onDelete,
  className = ''
}) => {
  const typeColors = {
    info: 'bg-blue-50 border-blue-200',
    success: 'bg-green-50 border-green-200',
    warning: 'bg-yellow-50 border-yellow-200',
    error: 'bg-red-50 border-red-200'
  };

  const typeTextColors = {
    info: 'text-blue-900',
    success: 'text-green-900',
    warning: 'text-yellow-900',
    error: 'text-red-900'
  };

  return (
    <div
      className={`border rounded-lg p-4 ${typeColors[notification.type]} ${
        !notification.isRead ? 'border-l-4' : ''
      } ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className={`font-semibold ${typeTextColors[notification.type]}`}>
            {notification.title}
          </h4>
          <p className="text-sm text-gray-700 mt-1">{notification.message}</p>
          <p className="text-xs text-gray-500 mt-2">
            {new Date(notification.createdAt).toLocaleString()}
          </p>
        </div>

        <div className="flex gap-2 ml-4">
          {!notification.isRead && onMarkRead && (
            <button
              onClick={() => onMarkRead(notification.id)}
              className="text-xs text-blue-600 hover:underline"
            >
              Mark read
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(notification.id)}
              className="text-xs text-red-600 hover:underline"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {notification.link && (
        <a
          href={notification.link}
          className="text-sm text-blue-600 hover:underline mt-2 inline-block"
        >
          View details →
        </a>
      )}
    </div>
  );
};
