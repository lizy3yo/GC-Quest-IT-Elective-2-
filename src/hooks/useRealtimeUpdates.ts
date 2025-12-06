import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocketEvent } from './useWebSocket';
import { QUERY_KEYS } from '@/constants/api.constants';

/**
 * Hook for real-time class updates
 */
export const useRealtimeClassUpdates = (classId?: string) => {
  const queryClient = useQueryClient();

  useWebSocketEvent('class:updated', (payload: { classId: string; data: any }) => {
    if (!classId || payload.classId === classId) {
      // Invalidate class queries
      queryClient.invalidateQueries({ 
        queryKey: classId 
          ? QUERY_KEYS.STUDENT.CLASSES.DETAIL(classId)
          : QUERY_KEYS.STUDENT.CLASSES.ALL 
      });
    }
  });

  useWebSocketEvent('class:student-joined', (payload: { classId: string; studentId: string }) => {
    if (!classId || payload.classId === classId) {
      queryClient.invalidateQueries({ 
        queryKey: classId 
          ? QUERY_KEYS.STUDENT.CLASSES.DETAIL(classId)
          : QUERY_KEYS.STUDENT.CLASSES.ALL 
      });
    }
  });

  useWebSocketEvent('class:student-left', (payload: { classId: string; studentId: string }) => {
    if (!classId || payload.classId === classId) {
      queryClient.invalidateQueries({ 
        queryKey: classId 
          ? QUERY_KEYS.STUDENT.CLASSES.DETAIL(classId)
          : QUERY_KEYS.STUDENT.CLASSES.ALL 
      });
    }
  });
};

/**
 * Hook for real-time assessment updates
 */
export const useRealtimeAssessmentUpdates = (assessmentId?: string) => {
  const queryClient = useQueryClient();

  useWebSocketEvent('assessment:updated', (payload: { assessmentId: string; data: any }) => {
    if (!assessmentId || payload.assessmentId === assessmentId) {
      queryClient.invalidateQueries({ 
        queryKey: assessmentId
          ? QUERY_KEYS.TEACHER.ASSESSMENTS.DETAIL(assessmentId)
          : QUERY_KEYS.TEACHER.ASSESSMENTS.ALL
      });
    }
  });

  useWebSocketEvent('assessment:submission', (payload: { assessmentId: string; studentId: string }) => {
    if (!assessmentId || payload.assessmentId === assessmentId) {
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.TEACHER.SUBMISSIONS.PENDING
      });
      
      if (assessmentId) {
        queryClient.invalidateQueries({ 
          queryKey: QUERY_KEYS.TEACHER.ASSESSMENTS.DETAIL(assessmentId)
        });
      }
    }
  });

  useWebSocketEvent('assessment:graded', (payload: { assessmentId: string; studentId: string; grade: number }) => {
    if (!assessmentId || payload.assessmentId === assessmentId) {
      queryClient.invalidateQueries({ 
        queryKey: assessmentId
          ? QUERY_KEYS.STUDENT.ASSESSMENTS.DETAIL(assessmentId)
          : QUERY_KEYS.STUDENT.CLASSES.ALL
      });
    }
  });
};

/**
 * Hook for real-time study room updates
 */
export const useRealtimeStudyRoom = (roomId?: string) => {
  const queryClient = useQueryClient();

  useWebSocketEvent('study-room:user-joined', (payload: { roomId: string; userId: string; userName: string }) => {
    if (!roomId || payload.roomId === roomId) {
      queryClient.invalidateQueries({ 
        queryKey: roomId
          ? QUERY_KEYS.STUDENT.STUDY_ROOMS.DETAIL(roomId)
          : QUERY_KEYS.STUDENT.STUDY_ROOMS.ALL
      });
    }
  });

  useWebSocketEvent('study-room:user-left', (payload: { roomId: string; userId: string }) => {
    if (!roomId || payload.roomId === roomId) {
      queryClient.invalidateQueries({ 
        queryKey: roomId
          ? QUERY_KEYS.STUDENT.STUDY_ROOMS.DETAIL(roomId)
          : QUERY_KEYS.STUDENT.STUDY_ROOMS.ALL
      });
    }
  });

  useWebSocketEvent('study-room:message', (payload: { roomId: string; message: any }) => {
    if (!roomId || payload.roomId === roomId) {
      // Update messages in cache
      queryClient.setQueryData(
        ['study-room-messages', roomId],
        (old: any[] = []) => [...old, payload.message]
      );
    }
  });
};

/**
 * Hook for real-time analytics updates
 */
export const useRealtimeAnalytics = () => {
  const queryClient = useQueryClient();

  useWebSocketEvent('analytics:updated', (payload: { type: string; data: any }) => {
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.TEACHER.ANALYTICS.DASHBOARD
    });
  });

  useWebSocketEvent('leaderboard:updated', () => {
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.TEACHER.LEADERBOARDS
    });
  });
};

/**
 * Hook for real-time user presence
 */
export const useRealtimePresence = (onPresenceUpdate?: (users: any[]) => void) => {
  useWebSocketEvent('presence:update', (payload: { users: any[] }) => {
    onPresenceUpdate?.(payload.users);
  });
};

/**
 * Hook for real-time typing indicators
 */
export const useRealtimeTyping = (roomId: string, onTypingUpdate?: (users: string[]) => void) => {
  const { send } = useWebSocketSend();

  const startTyping = useCallback(() => {
    send('typing:start', { roomId });
  }, [send, roomId]);

  const stopTyping = useCallback(() => {
    send('typing:stop', { roomId });
  }, [send, roomId]);

  useWebSocketEvent('typing:update', (payload: { roomId: string; users: string[] }) => {
    if (payload.roomId === roomId) {
      onTypingUpdate?.(payload.users);
    }
  });

  return { startTyping, stopTyping };
};

// Re-export for convenience
import { useWebSocketSend } from './useWebSocket';
