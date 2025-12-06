export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  isRead: boolean;
  link?: string;
  createdAt: string;
}

export interface NotificationFilters {
  isRead?: boolean;
  type?: string;
  page?: number;
  limit?: number;
}

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  unreadCount: number;
  page: number;
  totalPages: number;
}

export interface MarkNotificationReadData {
  notificationId: string;
}

export interface MarkAllReadData {
  userId: string;
}
