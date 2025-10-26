/*
 * Copyright 2025 Kharl Ryan M. De Jesus
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useState, useEffect, useCallback } from 'react';
import { authManager } from '@/utils/auth';

interface User {
  _id: string;
  email?: string;
  name?: string; // fallback full name for some auth flows
  username?: string;
  role?: 'student' | 'teacher' | 'admin';
  firstName?: string;
  lastName?: string;
}

interface UseAuthReturn {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCurrentUser = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const token = authManager.getAccessToken();
      if (!token) {
        setUser(null);
        return;
      }

      // Check if token needs refresh before making the request
      if (authManager.shouldRefreshToken(token)) {
        await authManager.refreshAccessToken();
      }

      const response = await authManager.makeAuthenticatedRequest('/api/v1/users/current');
      
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else if (response.status === 401) {
        // Token is invalid, clear it
        authManager.clearTokens();
        setUser(null);
      } else {
        throw new Error(`Failed to fetch user: ${response.status}`);
      }
    } catch (err) {
      console.error('Failed to fetch current user:', err);
      const message = err instanceof Error ? err.message : 'Failed to authenticate';
      setError(message);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    authManager.clearTokens();
    setUser(null);
    setError(null);
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/login';
    }
  }, []);

  const refreshUser = useCallback(async () => {
    await fetchCurrentUser();
  }, [fetchCurrentUser]);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    error,
    refreshUser,
    logout,
  };
}

export default useAuth;