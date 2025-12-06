import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocketEvent, useWebSocketSend } from './useWebSocket';
import { QUERY_KEYS } from '@/constants/api.constants';

/**
 * Teacher-specific real-time hooks
 */

/**
 * Real-time updates for teacher dashboard
 */
export const useRealtimeTeacherDashboard = () => {
  const queryClient = useQueryClient();
  const { send } = useWebSocketSend();

  useEffect(() => {
    // Subscribe to teacher-specific channels
    send('subscribe', { channel: 'teacher-dashboard' });
    send('subscribe', { channel: 'teacher-classes' });
    send('subscribe', { channel: 'teacher-assessments' });
    send('subscribe', { channel: 'teacher-submissions' });

    return () => {
      send('unsubscribe', { channel: 'teacher-dashboard' });
      send('unsubscribe', { channel: 'teacher-classes' });
      send('unsubscribe', { channel: 'teacher-assessments' });
      send('unsubscribe', { channel: 'teacher-submissions' });
    };
  }, [send]);

  // Dashboard metrics updated
  useWebSocketEvent('teacher:dashboard-updated', () => {
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.TEACHER.ANALYTICS.DASHBOARD 
    });
  });

  // Recent activity updated
  useWebSocketEvent('teacher:activity-updated', () => {
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.TEACHER.ACTIVITY.RECENT 
    });
  });
};

/**
 * Real-time updates for teacher classes
 */
export const useRealtimeTeacherClasses = (classId?: string) => {
  const queryClient = useQueryClient();

  useWebSocketEvent('teacher:class-created', (payload: { classId: string; className: string }) => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TEACHER.CLASSES.ALL });
  });

  useWebSocketEvent('teacher:class-updated', (payload: { classId: string; data: any }) => {
    if (!classId || payload.classId === classId) {
      queryClient.invalidateQueries({ 
        queryKey: classId 
          ? QUERY_KEYS.TEACHER.CLASSES.DETAIL(classId)
          : QUERY_KEYS.TEACHER.CLASSES.ALL 
      });
    }
  });

  useWebSocketEvent('teacher:student-enrolled', (payload: { classId: string; studentId: string; studentName: string }) => {
    if (!classId || payload.classId === classId) {
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.TEACHER.CLASSES.DETAIL(payload.classId) 
      });
      // Optional: Show notification
      console.log(`${payload.studentName} enrolled in class`);
    }
  });

  useWebSocketEvent('teacher:student-dropped', (payload: { classId: string; studentId: string }) => {
    if (!classId || payload.classId === classId) {
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.TEACHER.CLASSES.DETAIL(payload.classId) 
      });
    }
  });
};

/**
 * Real-time updates for teacher assessments
 */
export const useRealtimeTeacherAssessments = (assessmentId?: string) => {
  const queryClient = useQueryClient();

  useWebSocketEvent('teacher:assessment-created', (payload: { assessmentId: string; title: string }) => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TEACHER.ASSESSMENTS.ALL });
  });

  useWebSocketEvent('teacher:assessment-updated', (payload: { assessmentId: string; data: any }) => {
    if (!assessmentId || payload.assessmentId === assessmentId) {
      queryClient.invalidateQueries({ 
        queryKey: assessmentId
          ? QUERY_KEYS.TEACHER.ASSESSMENTS.DETAIL(assessmentId)
          : QUERY_KEYS.TEACHER.ASSESSMENTS.ALL
      });
    }
  });

  useWebSocketEvent('teacher:assessment-deleted', (payload: { assessmentId: string }) => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TEACHER.ASSESSMENTS.ALL });
  });
};

/**
 * Real-time updates for submissions
 */
export const useRealtimeTeacherSubmissions = () => {
  const queryClient = useQueryClient();

  useWebSocketEvent('teacher:submission-received', (payload: { 
    assessmentId: string; 
    studentId: string; 
    studentName: string;
    submittedAt: string;
  }) => {
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.TEACHER.SUBMISSIONS.PENDING 
    });
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.TEACHER.ASSESSMENTS.DETAIL(payload.assessmentId) 
    });
    // Optional: Show notification
    console.log(`New submission from ${payload.studentName}`);
  });

  useWebSocketEvent('teacher:submission-updated', (payload: { 
    submissionId: string; 
    assessmentId: string;
  }) => {
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.TEACHER.SUBMISSIONS.PENDING 
    });
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.TEACHER.ASSESSMENTS.DETAIL(payload.assessmentId) 
    });
  });

  useWebSocketEvent('teacher:grading-completed', (payload: { 
    submissionId: string; 
    assessmentId: string;
    studentId: string;
  }) => {
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.TEACHER.SUBMISSIONS.PENDING 
    });
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.TEACHER.ASSESSMENTS.DETAIL(payload.assessmentId) 
    });
  });
};

/**
 * Real-time updates for class analytics
 */
export const useRealtimeTeacherAnalytics = (classId?: string) => {
  const queryClient = useQueryClient();

  useWebSocketEvent('teacher:analytics-updated', (payload: { classId?: string; type: string }) => {
    if (!classId || payload.classId === classId) {
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.TEACHER.ANALYTICS.DASHBOARD 
      });
      
      if (classId) {
        queryClient.invalidateQueries({ 
          queryKey: QUERY_KEYS.TEACHER.ANALYTICS.CLASS(classId) 
        });
      }
    }
  });

  useWebSocketEvent('teacher:leaderboard-updated', (payload: { classId?: string }) => {
    if (!classId || payload.classId === classId) {
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.TEACHER.LEADERBOARDS 
      });
    }
  });

  useWebSocketEvent('teacher:performance-alert', (payload: { 
    studentId: string; 
    studentName: string;
    alertType: string;
    message: string;
  }) => {
    // Optional: Show alert notification
    console.log(`Performance alert: ${payload.message}`);
  });
};

/**
 * Real-time updates for student progress
 */
export const useRealtimeStudentProgress = (studentId?: string) => {
  const queryClient = useQueryClient();

  useWebSocketEvent('teacher:student-progress-updated', (payload: { 
    studentId: string; 
    classId: string;
    metric: string;
  }) => {
    if (!studentId || payload.studentId === studentId) {
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.TEACHER.STUDENTS.DETAIL(payload.studentId) 
      });
    }
  });

  useWebSocketEvent('teacher:student-activity', (payload: { 
    studentId: string; 
    activityType: string;
    timestamp: string;
  }) => {
    if (!studentId || payload.studentId === studentId) {
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.TEACHER.ACTIVITY.RECENT 
      });
    }
  });
};

/**
 * Real-time updates for flashcards and summaries
 */
export const useRealtimeTeacherContent = () => {
  const queryClient = useQueryClient();

  useWebSocketEvent('teacher:flashcard-created', (payload: { flashcardId: string; classId?: string }) => {
    if (payload.classId) {
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.TEACHER.CLASSES.DETAIL(payload.classId) 
      });
    }
  });

  useWebSocketEvent('teacher:summary-created', (payload: { summaryId: string; classId?: string }) => {
    if (payload.classId) {
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.TEACHER.CLASSES.DETAIL(payload.classId) 
      });
    }
  });
};

/**
 * Complete teacher real-time setup
 */
export const useRealtimeTeacher = (options?: { classId?: string; assessmentId?: string }) => {
  useRealtimeTeacherDashboard();
  useRealtimeTeacherClasses(options?.classId);
  useRealtimeTeacherAssessments(options?.assessmentId);
  useRealtimeTeacherSubmissions();
  useRealtimeTeacherAnalytics(options?.classId);
  useRealtimeTeacherContent();
};
