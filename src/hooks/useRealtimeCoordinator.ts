import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocketEvent, useWebSocketSend } from './useWebSocket';
import { QUERY_KEYS } from '@/constants/api.constants';

/**
 * Coordinator-specific real-time hooks
 */

/**
 * Real-time updates for coordinator dashboard
 */
export const useRealtimeCoordinatorDashboard = () => {
  const queryClient = useQueryClient();
  const { send } = useWebSocketSend();

  useEffect(() => {
    // Subscribe to coordinator-specific channels
    send('subscribe', { channel: 'coordinator-dashboard' });
    send('subscribe', { channel: 'coordinator-classes' });
    send('subscribe', { channel: 'coordinator-users' });
    send('subscribe', { channel: 'coordinator-analytics' });

    return () => {
      send('unsubscribe', { channel: 'coordinator-dashboard' });
      send('unsubscribe', { channel: 'coordinator-classes' });
      send('unsubscribe', { channel: 'coordinator-users' });
      send('unsubscribe', { channel: 'coordinator-analytics' });
    };
  }, [send]);

  // Dashboard overview updated
  useWebSocketEvent('coordinator:overview-updated', () => {
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.COORDINATOR.OVERVIEW 
    });
  });

  // System metrics updated
  useWebSocketEvent('coordinator:metrics-updated', (payload: { 
    metric: string; 
    value: number;
  }) => {
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.COORDINATOR.OVERVIEW 
    });
  });
};

/**
 * Real-time updates for coordinator classes
 */
export const useRealtimeCoordinatorClasses = (classId?: string) => {
  const queryClient = useQueryClient();

  useWebSocketEvent('coordinator:class-created', (payload: { 
    classId: string; 
    className: string;
    teacherId: string;
  }) => {
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.COORDINATOR.CLASSES.ALL 
    });
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.COORDINATOR.OVERVIEW 
    });
    // Optional: Show notification
    console.log(`New class created: ${payload.className}`);
  });

  useWebSocketEvent('coordinator:class-updated', (payload: { 
    classId: string; 
    data: any;
  }) => {
    if (!classId || payload.classId === classId) {
      queryClient.invalidateQueries({ 
        queryKey: classId 
          ? QUERY_KEYS.COORDINATOR.CLASSES.DETAIL(classId)
          : QUERY_KEYS.COORDINATOR.CLASSES.ALL 
      });
    }
  });

  useWebSocketEvent('coordinator:class-archived', (payload: { classId: string }) => {
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.COORDINATOR.CLASSES.ALL 
    });
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.COORDINATOR.OVERVIEW 
    });
  });

  useWebSocketEvent('coordinator:class-enrollment-changed', (payload: { 
    classId: string; 
    enrollmentCount: number;
  }) => {
    if (!classId || payload.classId === classId) {
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.COORDINATOR.CLASSES.DETAIL(payload.classId) 
      });
    }
  });
};

/**
 * Real-time updates for teachers
 */
export const useRealtimeCoordinatorTeachers = (teacherId?: string) => {
  const queryClient = useQueryClient();

  useWebSocketEvent('coordinator:teacher-created', (payload: { 
    teacherId: string; 
    teacherName: string;
    email: string;
  }) => {
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.COORDINATOR.TEACHERS.ALL 
    });
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.COORDINATOR.OVERVIEW 
    });
    // Optional: Show notification
    console.log(`New teacher added: ${payload.teacherName}`);
  });

  useWebSocketEvent('coordinator:teacher-updated', (payload: { 
    teacherId: string; 
    data: any;
  }) => {
    if (!teacherId || payload.teacherId === teacherId) {
      queryClient.invalidateQueries({ 
        queryKey: teacherId 
          ? QUERY_KEYS.COORDINATOR.TEACHERS.DETAIL(teacherId)
          : QUERY_KEYS.COORDINATOR.TEACHERS.ALL 
      });
    }
  });

  useWebSocketEvent('coordinator:teacher-deleted', (payload: { teacherId: string }) => {
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.COORDINATOR.TEACHERS.ALL 
    });
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.COORDINATOR.OVERVIEW 
    });
  });

  useWebSocketEvent('coordinator:teacher-status-changed', (payload: { 
    teacherId: string; 
    status: string;
    isActive: boolean;
  }) => {
    if (!teacherId || payload.teacherId === teacherId) {
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.COORDINATOR.TEACHERS.DETAIL(payload.teacherId) 
      });
    }
  });
};

/**
 * Real-time updates for students
 */
export const useRealtimeCoordinatorStudents = (studentId?: string) => {
  const queryClient = useQueryClient();

  useWebSocketEvent('coordinator:student-created', (payload: { 
    studentId: string; 
    studentName: string;
    email: string;
  }) => {
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.COORDINATOR.STUDENTS.ALL 
    });
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.COORDINATOR.OVERVIEW 
    });
    // Optional: Show notification
    console.log(`New student added: ${payload.studentName}`);
  });

  useWebSocketEvent('coordinator:student-updated', (payload: { 
    studentId: string; 
    data: any;
  }) => {
    if (!studentId || payload.studentId === studentId) {
      queryClient.invalidateQueries({ 
        queryKey: studentId 
          ? QUERY_KEYS.COORDINATOR.STUDENTS.DETAIL(studentId)
          : QUERY_KEYS.COORDINATOR.STUDENTS.ALL 
      });
    }
  });

  useWebSocketEvent('coordinator:student-deleted', (payload: { studentId: string }) => {
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.COORDINATOR.STUDENTS.ALL 
    });
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.COORDINATOR.OVERVIEW 
    });
  });

  useWebSocketEvent('coordinator:student-enrollment-changed', (payload: { 
    studentId: string; 
    classId: string;
    action: 'enrolled' | 'dropped';
  }) => {
    if (!studentId || payload.studentId === studentId) {
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.COORDINATOR.STUDENTS.DETAIL(payload.studentId) 
      });
    }
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.COORDINATOR.CLASSES.DETAIL(payload.classId) 
    });
  });
};

/**
 * Real-time updates for parents
 */
export const useRealtimeCoordinatorParents = (parentId?: string) => {
  const queryClient = useQueryClient();

  useWebSocketEvent('coordinator:parent-created', (payload: { 
    parentId: string; 
    parentName: string;
    email: string;
  }) => {
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.COORDINATOR.PARENTS.ALL 
    });
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.COORDINATOR.OVERVIEW 
    });
    // Optional: Show notification
    console.log(`New parent added: ${payload.parentName}`);
  });

  useWebSocketEvent('coordinator:parent-updated', (payload: { 
    parentId: string; 
    data: any;
  }) => {
    if (!parentId || payload.parentId === parentId) {
      queryClient.invalidateQueries({ 
        queryKey: parentId 
          ? QUERY_KEYS.COORDINATOR.PARENTS.DETAIL(parentId)
          : QUERY_KEYS.COORDINATOR.PARENTS.ALL 
      });
    }
  });

  useWebSocketEvent('coordinator:parent-deleted', (payload: { parentId: string }) => {
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.COORDINATOR.PARENTS.ALL 
    });
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.COORDINATOR.OVERVIEW 
    });
  });

  useWebSocketEvent('coordinator:parent-child-linked', (payload: { 
    parentId: string; 
    studentId: string;
  }) => {
    if (!parentId || payload.parentId === parentId) {
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.COORDINATOR.PARENTS.DETAIL(payload.parentId) 
      });
    }
  });
};

/**
 * Real-time system alerts and notifications
 */
export const useRealtimeCoordinatorAlerts = () => {
  useWebSocketEvent('coordinator:system-alert', (payload: { 
    type: 'warning' | 'error' | 'info';
    message: string;
    severity: number;
  }) => {
    // Optional: Show system alert
    console.log(`System alert [${payload.type}]: ${payload.message}`);
  });

  useWebSocketEvent('coordinator:user-report', (payload: { 
    reportType: string;
    userId: string;
    userName: string;
    reason: string;
  }) => {
    // Optional: Show report notification
    console.log(`User report: ${payload.userName} - ${payload.reason}`);
  });

  useWebSocketEvent('coordinator:bulk-operation-completed', (payload: { 
    operationType: string;
    successCount: number;
    failureCount: number;
  }) => {
    // Optional: Show completion notification
    console.log(`Bulk operation completed: ${payload.successCount} succeeded, ${payload.failureCount} failed`);
  });
};

/**
 * Real-time analytics for coordinator
 */
export const useRealtimeCoordinatorAnalytics = () => {
  const queryClient = useQueryClient();

  useWebSocketEvent('coordinator:analytics-updated', (payload: { 
    metric: string;
    period: string;
  }) => {
    queryClient.invalidateQueries({ 
      queryKey: QUERY_KEYS.COORDINATOR.OVERVIEW 
    });
  });

  useWebSocketEvent('coordinator:performance-report-ready', (payload: { 
    reportId: string;
    reportType: string;
  }) => {
    // Optional: Show notification that report is ready
    console.log(`Performance report ready: ${payload.reportType}`);
  });
};

/**
 * Complete coordinator real-time setup
 */
export const useRealtimeCoordinator = (options?: { 
  classId?: string; 
  teacherId?: string;
  studentId?: string;
  parentId?: string;
}) => {
  useRealtimeCoordinatorDashboard();
  useRealtimeCoordinatorClasses(options?.classId);
  useRealtimeCoordinatorTeachers(options?.teacherId);
  useRealtimeCoordinatorStudents(options?.studentId);
  useRealtimeCoordinatorParents(options?.parentId);
  useRealtimeCoordinatorAlerts();
  useRealtimeCoordinatorAnalytics();
};
