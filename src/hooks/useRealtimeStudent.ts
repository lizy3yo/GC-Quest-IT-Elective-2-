import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocketEvent, useWebSocketSend } from './useWebSocket';
import { QUERY_KEYS } from '@/constants/api.constants';

/**
 * Student-specific real-time hooks
 */

/**
 * Real-time updates for student dashboard
 */
export const useRealtimeStudentDashboard = () => {
  const queryClient = useQueryClient();
  const { send } = useWebSocketSend();

  useEffect(() => {
    // Subscribe to student-specific channels
    send('subscribe', { channel: 'student-dashboard' });
    send('subscribe', { channel: 'student-classes' });
    send('subscribe', { channel: 'student-assessments' });

    return () => {
      send('unsubscribe', { channel: 'student-dashboard' });
      send('unsubscribe', { channel: 'student-classes' });
      send('unsubscribe', { channel: 'student-assessments' });
    };
  }, [send]);

  // Dashboard stats updated
  useWebSocketEvent('student:dashboard-updated', () => {
    queryClient.invalidateQueries({ queryKey: ['student', 'dashboard'] });
  });

  // Due items updated
  useWebSocketEvent('student:due-items-updated', () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STUDENT.DUE_ITEMS });
  });
};

/**
 * Real-time updates for student classes
 */
export const useRealtimeStudentClasses = () => {
  const queryClient = useQueryClient();

  useWebSocketEvent('student:class-enrolled', (payload: { classId: string; className: string }) => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STUDENT.CLASSES.ALL });
    // Optional: Show toast notification
    console.log(`Enrolled in class: ${payload.className}`);
  });

  useWebSocketEvent('student:class-removed', (payload: { classId: string }) => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STUDENT.CLASSES.ALL });
  });

  useWebSocketEvent('student:class-material-added', (payload: { classId: string; materialType: string }) => {
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.STUDENT.CLASSES.DETAIL(payload.classId) 
    });
  });
};

/**
 * Real-time updates for student assessments
 */
export const useRealtimeStudentAssessments = () => {
  const queryClient = useQueryClient();

  useWebSocketEvent('student:assessment-assigned', (payload: { assessmentId: string; title: string; dueDate: string }) => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STUDENT.CLASSES.ALL });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STUDENT.DUE_ITEMS });
    // Optional: Show notification
    console.log(`New assessment assigned: ${payload.title}`);
  });

  useWebSocketEvent('student:assessment-graded', (payload: { assessmentId: string; grade: number; feedback?: string }) => {
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.STUDENT.ASSESSMENTS.DETAIL(payload.assessmentId) 
    });
    queryClient.invalidateQueries({ queryKey: ['student', 'grades'] });
    // Optional: Show notification
    console.log(`Assessment graded: ${payload.grade}`);
  });

  useWebSocketEvent('student:assessment-deadline-extended', (payload: { assessmentId: string; newDeadline: string }) => {
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.STUDENT.ASSESSMENTS.DETAIL(payload.assessmentId) 
    });
  });
};

/**
 * Real-time updates for student flashcards
 */
export const useRealtimeStudentFlashcards = () => {
  const queryClient = useQueryClient();

  useWebSocketEvent('student:flashcard-shared', (payload: { flashcardId: string; sharedBy: string }) => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STUDENT.FLASHCARDS.ALL });
  });

  useWebSocketEvent('student:flashcard-updated', (payload: { flashcardId: string }) => {
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.STUDENT.FLASHCARDS.DETAIL(payload.flashcardId) 
    });
  });
};

/**
 * Real-time updates for student resources
 */
export const useRealtimeStudentResources = () => {
  const queryClient = useQueryClient();

  useWebSocketEvent('student:resource-added', (payload: { resourceId: string; classId?: string }) => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STUDENT.RESOURCES.ALL });
    if (payload.classId) {
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.STUDENT.CLASSES.DETAIL(payload.classId) 
      });
    }
  });

  useWebSocketEvent('student:resource-updated', (payload: { resourceId: string }) => {
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.STUDENT.RESOURCES.DETAIL(payload.resourceId) 
    });
  });
};

/**
 * Real-time updates for student achievements
 */
export const useRealtimeStudentAchievements = () => {
  const queryClient = useQueryClient();

  useWebSocketEvent('student:achievement-unlocked', (payload: { achievement: any }) => {
    queryClient.invalidateQueries({ queryKey: ['student', 'achievements'] });
    // Optional: Show celebration animation
    console.log('Achievement unlocked:', payload.achievement);
  });

  useWebSocketEvent('student:points-earned', (payload: { points: number; reason: string }) => {
    queryClient.invalidateQueries({ queryKey: ['student', 'points'] });
  });

  useWebSocketEvent('student:leaderboard-updated', () => {
    queryClient.invalidateQueries({ queryKey: ['student', 'leaderboard'] });
  });
};

/**
 * Complete student real-time setup
 */
export const useRealtimeStudent = () => {
  useRealtimeStudentDashboard();
  useRealtimeStudentClasses();
  useRealtimeStudentAssessments();
  useRealtimeStudentFlashcards();
  useRealtimeStudentResources();
  useRealtimeStudentAchievements();
};
