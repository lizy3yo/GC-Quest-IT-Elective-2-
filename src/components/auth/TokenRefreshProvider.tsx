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

'use client';

import { useEffect, useRef } from 'react';
import { authManager } from '@/utils/auth';

interface TokenRefreshProviderProps {
  children: React.ReactNode;
}

export default function TokenRefreshProvider({ children }: TokenRefreshProviderProps) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const checkAndRefreshToken = async () => {
      const token = authManager.getAccessToken();
      if (token && authManager.shouldRefreshToken(token)) {
        console.log('Proactively refreshing token...');
        await authManager.refreshAccessToken();
      }
    };

    // Check immediately
    checkAndRefreshToken();

    // Set up periodic check every 4 minutes
    intervalRef.current = setInterval(checkAndRefreshToken, 4 * 60 * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return <>{children}</>;
}