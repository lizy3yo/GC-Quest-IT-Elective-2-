import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requestService } from '@/services/request.service';
import { API_ENDPOINTS, QUERY_KEYS, STALE_TIME } from '@/constants/api.constants';
import type {
  LoginCredentials,
  RegisterData,
  AuthResponse,
  AuthUser,
  ResetPasswordData,
  ConfirmResetPasswordData,
  ChangePasswordData,
} from '@/interfaces/auth.interface';
import { createComponentProps, transformMutationResult } from './useQueryHook';

// Login mutation
export const useLogin = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const response = await requestService.post<AuthResponse>(
        API_ENDPOINTS.AUTH.LOGIN,
        credentials
      );
      return response.data;
    },
    onSuccess: (data) => {
      // Store token
      if (typeof window !== 'undefined' && data.token) {
        localStorage.setItem('auth_token', data.token);
        if (data.refreshToken) {
          localStorage.setItem('refresh_token', data.refreshToken);
        }
      }
      // Update cache
      queryClient.setQueryData(QUERY_KEYS.AUTH.USER, data.user);
    },
  });

  return transformMutationResult(mutation);
};

// Register mutation
export const useRegister = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: RegisterData) => {
      const response = await requestService.post<AuthResponse>(
        API_ENDPOINTS.AUTH.REGISTER,
        data
      );
      return response.data;
    },
    onSuccess: (data) => {
      // Store token
      if (typeof window !== 'undefined' && data.token) {
        localStorage.setItem('auth_token', data.token);
        if (data.refreshToken) {
          localStorage.setItem('refresh_token', data.refreshToken);
        }
      }
      // Update cache
      queryClient.setQueryData(QUERY_KEYS.AUTH.USER, data.user);
    },
  });

  return transformMutationResult(mutation);
};

// Logout mutation
export const useLogout = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      await requestService.post(API_ENDPOINTS.AUTH.LOGOUT);
    },
    onSuccess: () => {
      // Clear tokens
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
      }
      // Clear all queries
      queryClient.clear();
    },
  });

  return transformMutationResult(mutation);
};

// Get current user query
export const useCurrentUser = () => {
  const result = useQuery({
    queryKey: QUERY_KEYS.AUTH.USER,
    queryFn: async () => {
      const response = await requestService.get<AuthUser>(
        API_ENDPOINTS.USER.PROFILE
      );
      return response.data;
    },
    staleTime: STALE_TIME.MEDIUM,
    retry: false,
  });

  return createComponentProps(result);
};

// Reset password mutation
export const useResetPassword = () => {
  const mutation = useMutation({
    mutationFn: async (data: ResetPasswordData) => {
      const response = await requestService.post(
        API_ENDPOINTS.AUTH.RESET_PASSWORD,
        data
      );
      return response.data;
    },
  });

  return transformMutationResult(mutation);
};

// Confirm reset password mutation
export const useConfirmResetPassword = () => {
  const mutation = useMutation({
    mutationFn: async (data: ConfirmResetPasswordData) => {
      const response = await requestService.post(
        API_ENDPOINTS.AUTH.RESET_PASSWORD,
        data
      );
      return response.data;
    },
  });

  return transformMutationResult(mutation);
};

// Change password mutation
export const useChangePassword = () => {
  const mutation = useMutation({
    mutationFn: async (data: ChangePasswordData) => {
      const response = await requestService.post(
        API_ENDPOINTS.USER.CHANGE_PASSWORD,
        data
      );
      return response.data;
    },
  });

  return transformMutationResult(mutation);
};

// Verify email mutation
export const useVerifyEmail = () => {
  const mutation = useMutation({
    mutationFn: async (token: string) => {
      const response = await requestService.post(
        API_ENDPOINTS.AUTH.VERIFY_EMAIL,
        { token }
      );
      return response.data;
    },
  });

  return transformMutationResult(mutation);
};

// Resend verification email mutation
export const useResendVerification = () => {
  const mutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await requestService.post(
        API_ENDPOINTS.AUTH.SEND_VERIFICATION,
        { email }
      );
      return response.data;
    },
  });

  return transformMutationResult(mutation);
};
