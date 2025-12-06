import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';

interface UseSessionTimeoutOptions {
  /**
   * Idle timeout in milliseconds (default: 30 minutes)
   * User will be logged out after this period of inactivity
   */
  idleTimeout?: number;
  
  /**
   * Warning time before logout in milliseconds (default: 2 minutes)
   * Show warning this many ms before auto-logout
   */
  warningTime?: number;
  
  /**
   * Callback when user is about to be logged out
   */
  onWarning?: () => void;
  
  /**
   * Callback when user is logged out
   */
  onLogout?: () => void;
}

const DEFAULT_IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const DEFAULT_WARNING_TIME = 2 * 60 * 1000; // 2 minutes

export function useSessionTimeout(options: UseSessionTimeoutOptions = {}) {
  const {
    idleTimeout = DEFAULT_IDLE_TIMEOUT,
    warningTime = DEFAULT_WARNING_TIME,
    onWarning,
    onLogout,
  } = options;

  const router = useRouter();
  const { data: session, status } = useSession();
  
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const logout = useCallback(async () => {
    // Clear all timers
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);

    // Call logout callback
    onLogout?.();

    // Sign out and redirect to login
    await signOut({ redirect: false });
    router.push('/auth/login?reason=session_expired');
  }, [router, onLogout]);

  const resetIdleTimer = useCallback(() => {
    lastActivityRef.current = Date.now();

    // Clear existing timers
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);

    // Set warning timer
    warningTimerRef.current = setTimeout(() => {
      onWarning?.();
    }, idleTimeout - warningTime);

    // Set logout timer
    idleTimerRef.current = setTimeout(() => {
      logout();
    }, idleTimeout);
  }, [idleTimeout, warningTime, onWarning, logout]);

  useEffect(() => {
    // Only track activity if user is authenticated
    if (status !== 'authenticated') return;

    // Events that indicate user activity
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ];

    // Throttle activity tracking to avoid excessive resets
    let throttleTimeout: NodeJS.Timeout | null = null;
    const handleActivity = () => {
      if (throttleTimeout) return;
      
      throttleTimeout = setTimeout(() => {
        resetIdleTimer();
        throttleTimeout = null;
      }, 1000); // Throttle to once per second
    };

    // Add event listeners
    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    // Initialize timer
    resetIdleTimer();

    // Cleanup
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (throttleTimeout) clearTimeout(throttleTimeout);
    };
  }, [status, resetIdleTimer]);

  // Check for token expiration
  useEffect(() => {
    if (status !== 'authenticated' || !session) return;

    const checkTokenExpiry = () => {
      const accessToken = (session as any).accessToken;
      if (!accessToken) return;

      try {
        // Decode JWT to check expiry (without verification)
        const payload = JSON.parse(atob(accessToken.split('.')[1]));
        const expiryTime = payload.exp * 1000; // Convert to milliseconds
        const now = Date.now();

        // If token is expired or will expire in next 5 minutes, logout
        if (expiryTime - now < 5 * 60 * 1000) {
          logout();
        }
      } catch (error) {
        console.error('Error checking token expiry:', error);
      }
    };

    // Check immediately
    checkTokenExpiry();

    // Check every minute
    const interval = setInterval(checkTokenExpiry, 60 * 1000);

    return () => clearInterval(interval);
  }, [session, status, logout]);

  return {
    resetTimer: resetIdleTimer,
    lastActivity: lastActivityRef.current,
  };
}
