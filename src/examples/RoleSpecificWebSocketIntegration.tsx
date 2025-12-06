/**
 * Role-Specific WebSocket Integration Examples
 * 
 * This file shows how to integrate WebSocket functionality
 * for each user role: Student, Teacher, Coordinator, and Parent
 */

'use client';

import React from 'react';
import {
  useRealtimeStudent,
  useRealtimeTeacher,
  useRealtimeCoordinator,
  useRealtimeParent,
} from '@/hooks';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import { WebSocketStatus } from '@/components/molecules/WebSocketStatus';
import { RealtimeNotificationBell } from '@/components/organisms/RealtimeNotificationBell';

/**
 * STUDENT LAYOUT INTEGRATION
 * 
 * Add this to your student layout or dashboard page
 */
export function StudentRealtimeLayout({ children }: { children: React.ReactNode }) {
  // Enable all student real-time features
  useRealtimeStudent();
  
  // Enable real-time notifications with sound
  useRealtimeNotifications({
    onNewNotification: (notification) => {
      console.log('Student notification:', notification);
    },
    playSound: true,
    showToast: true,
  });

  return (
    <div className="student-layout">
      <header className="flex items-center justify-between p-4 bg-white shadow">
        <h1 className="text-xl font-bold">Student Dashboard</h1>
        <div className="flex items-center gap-4">
          <WebSocketStatus showText={false} />
          <RealtimeNotificationBell />
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

/**
 * STUDENT CLASS PAGE INTEGRATION
 * 
 * Add this to individual class pages for live updates
 */
export function StudentClassPage({ classId }: { classId: string }) {
  // Enable real-time updates for this specific class
  useRealtimeStudent();

  return (
    <div className="class-page">
      <h2>Class Content</h2>
      {/* Your class content here - will update automatically */}
    </div>
  );
}

/**
 * TEACHER LAYOUT INTEGRATION
 * 
 * Add this to your teacher layout or dashboard page
 */
export function TeacherRealtimeLayout({ children }: { children: React.ReactNode }) {
  // Enable all teacher real-time features
  useRealtimeTeacher();
  
  // Enable real-time notifications
  useRealtimeNotifications({
    onNewNotification: (notification) => {
      console.log('Teacher notification:', notification);
      // Could show different UI for submission notifications
    },
    playSound: true,
    showToast: true,
  });

  return (
    <div className="teacher-layout">
      <header className="flex items-center justify-between p-4 bg-white shadow">
        <h1 className="text-xl font-bold">Teacher Dashboard</h1>
        <div className="flex items-center gap-4">
          <WebSocketStatus showText={true} />
          <RealtimeNotificationBell />
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

/**
 * TEACHER ASSESSMENT PAGE INTEGRATION
 * 
 * Add this to assessment pages for live submission tracking
 */
export function TeacherAssessmentPage({ assessmentId }: { assessmentId: string }) {
  // Enable real-time updates for this specific assessment
  useRealtimeTeacher({ assessmentId });

  return (
    <div className="assessment-page">
      <h2>Assessment Details</h2>
      {/* Submissions will update automatically */}
    </div>
  );
}

/**
 * TEACHER CLASS PAGE INTEGRATION
 * 
 * Add this to class pages for live student enrollment updates
 */
export function TeacherClassPage({ classId }: { classId: string }) {
  // Enable real-time updates for this specific class
  useRealtimeTeacher({ classId });

  return (
    <div className="class-page">
      <h2>Class Management</h2>
      {/* Student list and class data will update automatically */}
    </div>
  );
}

/**
 * COORDINATOR LAYOUT INTEGRATION
 * 
 * Add this to your coordinator layout or dashboard page
 */
export function CoordinatorRealtimeLayout({ children }: { children: React.ReactNode }) {
  // Enable all coordinator real-time features
  useRealtimeCoordinator();
  
  // Enable real-time notifications
  useRealtimeNotifications({
    onNewNotification: (notification) => {
      console.log('Coordinator notification:', notification);
    },
    playSound: true,
    showToast: true,
  });

  return (
    <div className="coordinator-layout">
      <header className="flex items-center justify-between p-4 bg-white shadow">
        <h1 className="text-xl font-bold">Coordinator Dashboard</h1>
        <div className="flex items-center gap-4">
          <WebSocketStatus showText={true} />
          <RealtimeNotificationBell />
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

/**
 * COORDINATOR USER MANAGEMENT PAGE
 * 
 * Add this to user management pages for live updates
 */
export function CoordinatorUserManagementPage({ 
  userType 
}: { 
  userType: 'teacher' | 'student' | 'parent' 
}) {
  // Enable real-time updates for user management
  useRealtimeCoordinator();

  return (
    <div className="user-management-page">
      <h2>{userType.charAt(0).toUpperCase() + userType.slice(1)} Management</h2>
      {/* User lists will update automatically when users are added/removed */}
    </div>
  );
}

/**
 * PARENT LAYOUT INTEGRATION
 * 
 * Add this to your parent layout or dashboard page
 */
export function ParentRealtimeLayout({ children }: { children: React.ReactNode }) {
  // Enable all parent real-time features
  useRealtimeParent();
  
  // Enable real-time notifications
  useRealtimeNotifications({
    onNewNotification: (notification) => {
      console.log('Parent notification:', notification);
      // Parents might want more prominent notifications about their children
    },
    playSound: true,
    showToast: true,
  });

  return (
    <div className="parent-layout">
      <header className="flex items-center justify-between p-4 bg-white shadow">
        <h1 className="text-xl font-bold">Parent Dashboard</h1>
        <div className="flex items-center gap-4">
          <WebSocketStatus showText={true} />
          <RealtimeNotificationBell />
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

/**
 * PARENT CHILD PROGRESS PAGE
 * 
 * Add this to child progress pages for live grade updates
 */
export function ParentChildProgressPage({ childId }: { childId: string }) {
  // Enable real-time updates for specific child
  useRealtimeParent(childId);

  return (
    <div className="child-progress-page">
      <h2>Child Progress</h2>
      {/* Grades, attendance, and achievements will update automatically */}
    </div>
  );
}

/**
 * COMPLETE INTEGRATION EXAMPLE
 * 
 * This shows how to integrate WebSocket in your main app layout
 * with role-based real-time features
 */
export function AppLayoutWithWebSocket({ 
  children,
  userRole 
}: { 
  children: React.ReactNode;
  userRole: 'student' | 'teacher' | 'coordinator' | 'parent';
}) {
  // Enable role-specific real-time features
  switch (userRole) {
    case 'student':
      useRealtimeStudent();
      break;
    case 'teacher':
      useRealtimeTeacher();
      break;
    case 'coordinator':
      useRealtimeCoordinator();
      break;
    case 'parent':
      useRealtimeParent();
      break;
  }

  // Enable notifications for all roles
  useRealtimeNotifications({
    playSound: true,
    showToast: true,
  });

  return (
    <div className="app-layout">
      <header className="flex items-center justify-between p-4 bg-white shadow">
        <h1 className="text-xl font-bold">
          {userRole.charAt(0).toUpperCase() + userRole.slice(1)} Portal
        </h1>
        <div className="flex items-center gap-4">
          <WebSocketStatus showText={true} />
          <RealtimeNotificationBell />
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

/**
 * USAGE IN ACTUAL LAYOUTS
 * 
 * Example: src/app/student_page/layout.tsx
 */
/*
'use client';

import { WebSocketProvider } from '@/contexts/WebSocketContext';
import { useRealtimeStudent } from '@/hooks';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';

export default function StudentLayout({ children }) {
  return (
    <WebSocketProvider autoConnect={true} requireAuth={true}>
      <StudentRealtimeFeatures>
        {children}
      </StudentRealtimeFeatures>
    </WebSocketProvider>
  );
}

function StudentRealtimeFeatures({ children }) {
  useRealtimeStudent();
  useRealtimeNotifications({ playSound: true, showToast: true });
  
  return <>{children}</>;
}
*/

/**
 * Example: src/app/teacher_page/layout.tsx
 */
/*
'use client';

import { WebSocketProvider } from '@/contexts/WebSocketContext';
import { useRealtimeTeacher } from '@/hooks';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';

export default function TeacherLayout({ children }) {
  return (
    <WebSocketProvider autoConnect={true} requireAuth={true}>
      <TeacherRealtimeFeatures>
        {children}
      </TeacherRealtimeFeatures>
    </WebSocketProvider>
  );
}

function TeacherRealtimeFeatures({ children }) {
  useRealtimeTeacher();
  useRealtimeNotifications({ playSound: true, showToast: true });
  
  return <>{children}</>;
}
*/

/**
 * Example: src/app/coordinator/layout.tsx
 */
/*
'use client';

import { WebSocketProvider } from '@/contexts/WebSocketContext';
import { useRealtimeCoordinator } from '@/hooks';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';

export default function CoordinatorLayout({ children }) {
  return (
    <WebSocketProvider autoConnect={true} requireAuth={true}>
      <CoordinatorRealtimeFeatures>
        {children}
      </CoordinatorRealtimeFeatures>
    </WebSocketProvider>
  );
}

function CoordinatorRealtimeFeatures({ children }) {
  useRealtimeCoordinator();
  useRealtimeNotifications({ playSound: true, showToast: true });
  
  return <>{children}</>;
}
*/

/**
 * Example: src/app/parent/layout.tsx
 */
/*
'use client';

import { WebSocketProvider } from '@/contexts/WebSocketContext';
import { useRealtimeParent } from '@/hooks';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';

export default function ParentLayout({ children }) {
  return (
    <WebSocketProvider autoConnect={true} requireAuth={true}>
      <ParentRealtimeFeatures>
        {children}
      </ParentRealtimeFeatures>
    </WebSocketProvider>
  );
}

function ParentRealtimeFeatures({ children }) {
  useRealtimeParent();
  useRealtimeNotifications({ playSound: true, showToast: true });
  
  return <>{children}</>;
}
*/
