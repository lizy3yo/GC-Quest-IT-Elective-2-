import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requestService } from '@/services/request.service';
import { API_ENDPOINTS, QUERY_KEYS, STALE_TIME } from '@/constants/api.constants';
import type {
  Notification,
  NotificationFilters,
  NotificationListResponse,
  MarkNotificationReadData,
} from '@/interfaces/notification.interface';
import { createComponentProps, transformMutationResult } from './useQueryHook';

// Get notifications list
export const useNotifications = (filters?: NotificationFilters) => {
  const result = useQuery({
    queryKey: QUERY_KEYS.NOTIFICATIONS.LIST(filters),
    queryFn: async () => {
      const response = await requestService.get<NotificationListResponse>(
        API_ENDPOINTS.NOTIFICATIONS.LIST,
        { params: filters }
      );
      return response.data;
    },
    staleTime: STALE_TIME.SHORT,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  return createComponentProps(result);
};

// Mark notification as read
export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await requestService.patch(
        `${API_ENDPOINTS.NOTIFICATIONS.LIST}/${notificationId}/read`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NOTIFICATIONS.ALL });
    },
  });

  return transformMutationResult(mutation);
};

// Mark all notifications as read
export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await requestService.post(
        `${API_ENDPOINTS.NOTIFICATIONS.LIST}/mark-all-read`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NOTIFICATIONS.ALL });
    },
  });

  return transformMutationResult(mutation);
};

// Delete notification
export const useDeleteNotification = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await requestService.delete(
        `${API_ENDPOINTS.NOTIFICATIONS.LIST}/${notificationId}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NOTIFICATIONS.ALL });
    },
  });

  return transformMutationResult(mutation);
};
