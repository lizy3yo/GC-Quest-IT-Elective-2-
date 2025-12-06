'use client';

import { useState, useEffect } from 'react';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { useSession } from 'next-auth/react';

export function SessionTimeoutWarning() {
  const { status } = useSession();
  const [showWarning, setShowWarning] = useState(false);
  
  // Get timeout values from environment or use defaults
  const idleTimeout = parseInt(process.env.NEXT_PUBLIC_IDLE_TIMEOUT || '1800000'); // 30 minutes
  const warningTime = parseInt(process.env.NEXT_PUBLIC_WARNING_TIME || '120000'); // 2 minutes
  const warningSeconds = Math.floor(warningTime / 1000);
  
  const [countdown, setCountdown] = useState(warningSeconds);

  const { resetTimer } = useSessionTimeout({
    idleTimeout,
    warningTime,
    onWarning: () => {
      setShowWarning(true);
      setCountdown(warningSeconds);
    },
    onLogout: () => {
      setShowWarning(false);
    },
  });

  useEffect(() => {
    if (!showWarning) return;

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showWarning]);

  const handleStayLoggedIn = () => {
    setShowWarning(false);
    resetTimer();
  };

  // Don't show if not authenticated
  if (status !== 'authenticated' || !showWarning) return null;

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-yellow-600 dark:text-yellow-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Session Timeout Warning
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              You've been inactive for a while
            </p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-gray-700 dark:text-gray-300 mb-3">
            Your session will expire in:
          </p>
          <div className="text-center">
            <div className="text-4xl font-bold text-yellow-600 dark:text-yellow-500 tabular-nums">
              {minutes}:{seconds.toString().padStart(2, '0')}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              minutes remaining
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleStayLoggedIn}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Stay Logged In
          </button>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
          Click anywhere or move your mouse to stay logged in
        </p>
      </div>
    </div>
  );
}
