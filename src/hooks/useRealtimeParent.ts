import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocketEvent, useWebSocketSend } from './useWebSocket';
import { QUERY_KEYS } from '@/constants/api.constants';

/**
 * Parent-specific real-time hooks
 */

/**
 * Real-time updates for parent dashboard
 */
export const useRealtimeParentDashboard = () => {
  const queryClient = useQueryClient();
  const { send } = useWebSocketSend();

  useEffect(() => {
    // Subscribe to parent-specific channels
    send('subscribe', { channel: 'parent-dashboard' });
    send('subscribe', { channel: 'parent-children' });
    send('subscribe', { channel: 'parent-notifications' });

    return () => {
      send('unsubscribe', { channel: 'parent-dashboard' });
      send('unsubscribe', { channel: 'parent-children' });
      send('unsubscribe', { channel: 'parent-notifications' });
    };
  }, [send]);

  // Dashboard overview updated
  useWebSocketEvent('parent:overview-updated', () => {
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.PARENT.OVERVIEW 
    });
  });

  // Summary stats updated
  useWebSocketEvent('parent:stats-updated', (payload: { 
    childId?: string;
  }) => {
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.PARENT.OVERVIEW 
    });
  });
};

/**
 * Real-time updates for child progress
 */
export const useRealtimeChildProgress = (childId?: string) => {
  const queryClient = useQueryClient();

  useWebSocketEvent('parent:child-grade-updated', (payload: { 
    childId: string; 
    childName: string;
    assessmentTitle: string;
    grade: number;
    subject: string;
  }) => {
    if (!childId || payload.childId === childId) {
      queryClient.invalidateQueries({ 
        queryKey: ['parent', 'child', payload.childId, 'grades'] 
      });
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.PARENT.OVERVIEW 
      });
      // Optional: Show notification
      console.log(`${payload.childName} received grade ${payload.grade} in ${payload.assessmentTitle}`);
    }
  });

  useWebSocketEvent('parent:child-assessment-assigned', (payload: { 
    childId: string; 
    childName: string;
    assessmentTitle: string;
    dueDate: string;
    subject: string;
  }) => {
    if (!childId || payload.childId === childId) {
      queryClient.invalidateQueries({ 
        queryKey: ['parent', 'child', payload.childId, 'assessments'] 
      });
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.PARENT.OVERVIEW 
      });
      // Optional: Show notification
      console.log(`New assessment assigned to ${payload.childName}: ${payload.assessmentTitle}`);
    }
  });

  useWebSocketEvent('parent:child-assessment-submitted', (payload: { 
    childId: string; 
    childName: string;
    assessmentTitle: string;
    submittedAt: string;
  }) => {
    if (!childId || payload.childId === childId) {
      queryClient.invalidateQueries({ 
        queryKey: ['parent', 'child', payload.childId, 'assessments'] 
      });
      // Optional: Show notification
      console.log(`${payload.childName} submitted ${payload.assessmentTitle}`);
    }
  });

  useWebSocketEvent('parent:child-assessment-overdue', (payload: { 
    childId: string; 
    childName: string;
    assessmentTitle: string;
    dueDate: string;
  }) => {
    if (!childId || payload.childId === childId) {
      queryClient.invalidateQueries({ 
        queryKey: ['parent', 'child', payload.childId, 'assessments'] 
      });
      // Optional: Show alert notification
      console.log(`Alert: ${payload.childName} has overdue assessment: ${payload.assessmentTitle}`);
    }
  });
};

/**
 * Real-time updates for child attendance
 */
export const useRealtimeChildAttendance = (childId?: string) => {
  const queryClient = useQueryClient();

  useWebSocketEvent('parent:child-attendance-marked', (payload: { 
    childId: string; 
    childName: string;
    classId: string;
    className: string;
    status: 'present' | 'absent' | 'late';
    date: string;
  }) => {
    if (!childId || payload.childId === childId) {
      queryClient.invalidateQueries({ 
        queryKey: ['parent', 'child', payload.childId, 'attendance'] 
      });
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.PARENT.OVERVIEW 
      });
      
      // Optional: Show notification for absences
      if (payload.status === 'absent') {
        console.log(`${payload.childName} was marked absent in ${payload.className}`);
      }
    }
  });

  useWebSocketEvent('parent:child-attendance-alert', (payload: { 
    childId: string; 
    childName: string;
    alertType: 'low-attendance' | 'consecutive-absences';
    message: string;
  }) => {
    if (!childId || payload.childId === childId) {
      // Optional: Show alert notification
      console.log(`Attendance alert for ${payload.childName}: ${payload.message}`);
    }
  });
};

/**
 * Real-time updates for child behavior and achievements
 */
export const useRealtimeChildBehavior = (childId?: string) => {
  const queryClient = useQueryClient();

  useWebSocketEvent('parent:child-achievement-unlocked', (payload: { 
    childId: string; 
    childName: string;
    achievementTitle: string;
    achievementDescription: string;
  }) => {
    if (!childId || payload.childId === childId) {
      queryClient.invalidateQueries({ 
        queryKey: ['parent', 'child', payload.childId, 'achievements'] 
      });
      // Optional: Show celebration notification
      console.log(`${payload.childName} unlocked achievement: ${payload.achievementTitle}`);
    }
  });

  useWebSocketEvent('parent:child-behavior-note', (payload: { 
    childId: string; 
    childName: string;
    noteType: 'positive' | 'negative' | 'neutral';
    note: string;
    teacherName: string;
  }) => {
    if (!childId || payload.childId === childId) {
      queryClient.invalidateQueries({ 
        queryKey: ['parent', 'child', payload.childId, 'behavior'] 
      });
      // Optional: Show notification
      console.log(`Behavior note for ${payload.childName} from ${payload.teacherName}: ${payload.note}`);
    }
  });

  useWebSocketEvent('parent:child-points-earned', (payload: { 
    childId: string; 
    childName: string;
    points: number;
    reason: string;
  }) => {
    if (!childId || payload.childId === childId) {
      queryClient.invalidateQueries({ 
        queryKey: ['parent', 'child', payload.childId, 'points'] 
      });
    }
  });
};

/**
 * Real-time updates for child classes
 */
export const useRealtimeChildClasses = (childId?: string) => {
  const queryClient = useQueryClient();

  useWebSocketEvent('parent:child-enrolled-in-class', (payload: { 
    childId: string; 
    childName: string;
    classId: string;
    className: string;
    teacherName: string;
  }) => {
    if (!childId || payload.childId === childId) {
      queryClient.invalidateQueries({ 
        queryKey: ['parent', 'child', payload.childId, 'classes'] 
      });
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.PARENT.OVERVIEW 
      });
      // Optional: Show notification
      console.log(`${payload.childName} enrolled in ${payload.className}`);
    }
  });

  useWebSocketEvent('parent:child-dropped-from-class', (payload: { 
    childId: string; 
    childName: string;
    classId: string;
    className: string;
  }) => {
    if (!childId || payload.childId === childId) {
      queryClient.invalidateQueries({ 
        queryKey: ['parent', 'child', payload.childId, 'classes'] 
      });
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.PARENT.OVERVIEW 
      });
    }
  });

  useWebSocketEvent('parent:class-announcement', (payload: { 
    childId: string;
    classId: string;
    className: string;
    announcement: string;
    teacherName: string;
  }) => {
    if (!childId || payload.childId === childId) {
      // Optional: Show notification
      console.log(`Class announcement in ${payload.className}: ${payload.announcement}`);
    }
  });
};

/**
 * Real-time updates for teacher communications
 */
export const useRealtimeTeacherCommunications = (childId?: string) => {
  const queryClient = useQueryClient();

  useWebSocketEvent('parent:teacher-message', (payload: { 
    childId: string;
    messageId: string;
    teacherId: string;
    teacherName: string;
    subject: string;
    preview: string;
    urgent: boolean;
  }) => {
    if (!childId || payload.childId === childId) {
      queryClient.invalidateQueries({ 
        queryKey: ['parent', 'messages'] 
      });
      // Optional: Show notification, especially if urgent
      if (payload.urgent) {
        console.log(`Urgent message from ${payload.teacherName}: ${payload.subject}`);
      }
    }
  });

  useWebSocketEvent('parent:meeting-scheduled', (payload: { 
    childId: string;
    meetingId: string;
    teacherName: string;
    scheduledDate: string;
    purpose: string;
  }) => {
    if (!childId || payload.childId === childId) {
      queryClient.invalidateQueries({ 
        queryKey: ['parent', 'meetings'] 
      });
      // Optional: Show notification
      console.log(`Meeting scheduled with ${payload.teacherName} on ${payload.scheduledDate}`);
    }
  });

  useWebSocketEvent('parent:meeting-reminder', (payload: { 
    meetingId: string;
    teacherName: string;
    scheduledDate: string;
    minutesUntil: number;
  }) => {
    // Optional: Show reminder notification
    console.log(`Reminder: Meeting with ${payload.teacherName} in ${payload.minutesUntil} minutes`);
  });
};

/**
 * Real-time updates for child performance alerts
 */
export const useRealtimeChildPerformanceAlerts = (childId?: string) => {
  useWebSocketEvent('parent:performance-alert', (payload: { 
    childId: string; 
    childName: string;
    alertType: 'grade-drop' | 'improvement' | 'at-risk' | 'excellence';
    subject: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
  }) => {
    if (!childId || payload.childId === childId) {
      // Optional: Show alert notification based on severity
      console.log(`Performance alert for ${payload.childName} [${payload.severity}]: ${payload.message}`);
    }
  });

  useWebSocketEvent('parent:progress-report-available', (payload: { 
    childId: string; 
    childName: string;
    reportType: string;
    period: string;
  }) => {
    if (!childId || payload.childId === childId) {
      // Optional: Show notification
      console.log(`Progress report available for ${payload.childName}: ${payload.reportType}`);
    }
  });
};

/**
 * Complete parent real-time setup
 */
export const useRealtimeParent = (childId?: string) => {
  useRealtimeParentDashboard();
  useRealtimeChildProgress(childId);
  useRealtimeChildAttendance(childId);
  useRealtimeChildBehavior(childId);
  useRealtimeChildClasses(childId);
  useRealtimeTeacherCommunications(childId);
  useRealtimeChildPerformanceAlerts(childId);
};
