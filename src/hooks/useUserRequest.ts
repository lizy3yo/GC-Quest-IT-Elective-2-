import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requestService } from '@/services/request.service';
import { API_ENDPOINTS, QUERY_KEYS, STALE_TIME } from '@/constants/api.constants';
import type { AuthUser } from '@/interfaces/auth.interface';
import { createComponentProps, transformMutationResult } from './useQueryHook';

export interface UpdateProfileData {
  name?: string;
  email?: string;
  avatar?: string;
}

// Get user profile
export const useUserProfile = () => {
  const result = useQuery({
    queryKey: QUERY_KEYS.USER.PROFILE,
    queryFn: async () => {
      const response = await requestService.get<AuthUser>(
        API_ENDPOINTS.USER.PROFILE
      );
      return response.data;
    },
    staleTime: STALE_TIME.MEDIUM,
  });

  return createComponentProps(result);
};

// Update user profile
export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: UpdateProfileData) => {
      const response = await requestService.put<AuthUser>(
        API_ENDPOINTS.USER.UPDATE_PROFILE,
        data
      );
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEYS.USER.PROFILE, data);
      queryClient.setQueryData(QUERY_KEYS.AUTH.USER, data);
    },
  });

  return transformMutationResult(mutation);
};

// Upload avatar
export const useUploadAvatar = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('avatar', file);
      
      const response = await requestService.upload<{ avatarUrl: string }>(
        API_ENDPOINTS.USER.AVATAR,
        formData
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USER.PROFILE });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.AUTH.USER });
    },
  });

  return transformMutationResult(mutation);
};
