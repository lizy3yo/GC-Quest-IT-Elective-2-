'use client';

/**
 * WebSocket Usage Examples
 * 
 * This file contains practical examples of how to use WebSocket features
 * in your application. Copy and adapt these examples as needed.
 */

import React, { useState, useEffect } from 'react';
import { 
  useWebSocketEvent, 
  useWebSocketSend, 
  useWebSocketStatus 
} from '@/hooks/useWebSocket';
import {
  useRealtimeNotifications,
  useRealtimeNotificationCount,
} from '@/hooks/useRealtimeNotifications';
import {
  useRealtimeClassUpdates,
  useRealtimeAssessmentUpdates,
  useRealtimeStudyRoom,
  useRealtimeAnalytics,
  useRealtimePresence,
  useRealtimeTyping,
} from '@/hooks/useRealtimeUpdates';
import { WebSocketStatus } from '@/components/molecules/WebSocketStatus';

/**
 * Example 1: Basic Connection Status Display
 */
export function ConnectionStatusExample() {
  const { isConnected, status, connect, disconnect } = useWebSocketStatus();

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Connection Status</h3>
      <WebSocketStatus showText={true} />
      <div className="mt-4 space-x-2">
        <button 
          onClick={connect}
          disabled={isConnected}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          Connect
        </button>
        <button 
          onClick={disconnect}
          disabled={!isConnected}
          className="px-4 py-2 bg-red-500 text-white rounded disabled:opacity-50"
        >
          Disconnect
        </button>
      </div>
      <p className="mt-2 text-sm text-gray-600">Status: {status}</p>
    </div>
  );
}

/**
 * Example 2: Real-time Notifications with Toast
 */
export function RealtimeNotificationsExample() {
  const [notifications, setNotifications] = useState<any[]>([]);

  useRealtimeNotifications({
    onNewNotification: (notification) => {
      setNotifications(prev => [notification, ...prev]);
      // Show toast notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.title || 'New Notification', {
          body: notification.message,
          icon: '/favicon.ico',
        });
      }
    },
    playSound: true,
    showToast: true,
  });

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Real-time Notifications</h3>
      <div className="space-y-2">
        {notifications.length === 0 ? (
          <p className="text-gray-500">No new notifications</p>
        ) : (
          notifications.map((notif, index) => (
            <div key={index} className="p-2 bg-blue-50 rounded">
              <p className="font-medium">{notif.title}</p>
              <p className="text-sm text-gray-600">{notif.message}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Example 3: Live Class Updates
 */
export function LiveClassUpdatesExample({ classId }: { classId: string }) {
  const [updates, setUpdates] = useState<string[]>([]);

  // This hook automatically invalidates React Query cache when class updates
  useRealtimeClassUpdates(classId);

  // Listen for specific class events
  useWebSocketEvent('class:updated', (data) => {
    if (data.classId === classId) {
      setUpdates(prev => [`Class updated at ${new Date().toLocaleTimeString()}`, ...prev]);
    }
  });

  useWebSocketEvent('class:student-joined', (data) => {
    if (data.classId === classId) {
      setUpdates(prev => [`Student joined: ${data.studentId}`, ...prev]);
    }
  });

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Live Class Updates</h3>
      <p className="text-sm text-gray-600 mb-2">Class ID: {classId}</p>
      <div className="space-y-1">
        {updates.length === 0 ? (
          <p className="text-gray-500">No updates yet</p>
        ) : (
          updates.slice(0, 5).map((update, index) => (
            <p key={index} className="text-sm">{update}</p>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Example 4: Study Room with Typing Indicators
 */
export function StudyRoomExample({ roomId }: { roomId: string }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const { send } = useWebSocketSend();

  // Real-time study room updates
  useRealtimeStudyRoom(roomId);

  // Typing indicators
  const { startTyping, stopTyping } = useRealtimeTyping(
    roomId,
    (users) => setTypingUsers(users)
  );

  // Listen for new messages
  useWebSocketEvent('study-room:message', (data) => {
    if (data.roomId === roomId) {
      setMessages(prev => [...prev, data.message]);
    }
  });

  const handleSendMessage = () => {
    if (inputValue.trim()) {
      send('study-room:send-message', {
        roomId,
        message: inputValue,
      });
      setInputValue('');
      stopTyping();
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Study Room</h3>
      <div className="h-64 overflow-y-auto border rounded p-2 mb-2">
        {messages.map((msg, index) => (
          <div key={index} className="mb-2">
            <span className="font-medium">{msg.userName}: </span>
            <span>{msg.text}</span>
          </div>
        ))}
      </div>
      {typingUsers.length > 0 && (
        <p className="text-sm text-gray-500 mb-2">
          {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
        </p>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={startTyping}
          onBlur={stopTyping}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Type a message..."
          className="flex-1 px-3 py-2 border rounded"
        />
        <button
          onClick={handleSendMessage}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Send
        </button>
      </div>
    </div>
  );
}

/**
 * Example 5: User Presence Tracking
 */
export function UserPresenceExample() {
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);

  useRealtimePresence((users) => {
    setOnlineUsers(users);
  });

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Online Users</h3>
      <div className="space-y-2">
        {onlineUsers.length === 0 ? (
          <p className="text-gray-500">No users online</p>
        ) : (
          onlineUsers.map((user, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>{user.name}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Example 6: Live Analytics Dashboard
 */
export function LiveAnalyticsExample() {
  const [metrics, setMetrics] = useState<any>(null);

  useRealtimeAnalytics();

  useWebSocketEvent('analytics:updated', (data) => {
    setMetrics(data.data);
  });

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Live Analytics</h3>
      {metrics ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-blue-50 rounded">
            <p className="text-sm text-gray-600">Active Users</p>
            <p className="text-2xl font-bold">{metrics.activeUsers || 0}</p>
          </div>
          <div className="p-3 bg-green-50 rounded">
            <p className="text-sm text-gray-600">Submissions</p>
            <p className="text-2xl font-bold">{metrics.submissions || 0}</p>
          </div>
        </div>
      ) : (
        <p className="text-gray-500">Waiting for data...</p>
      )}
    </div>
  );
}

/**
 * Example 7: Custom Event Handler
 */
export function CustomEventExample() {
  const [customData, setCustomData] = useState<any>(null);
  const { send, isConnected } = useWebSocketSend();

  useWebSocketEvent('custom:response', (data) => {
    setCustomData(data);
  });

  const sendCustomEvent = () => {
    send('custom:request', {
      action: 'getData',
      timestamp: Date.now(),
    });
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Custom Events</h3>
      <button
        onClick={sendCustomEvent}
        disabled={!isConnected}
        className="px-4 py-2 bg-purple-500 text-white rounded disabled:opacity-50"
      >
        Send Custom Event
      </button>
      {customData && (
        <div className="mt-2 p-2 bg-gray-50 rounded">
          <pre className="text-xs">{JSON.stringify(customData, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

/**
 * Example 8: Assessment Real-time Updates
 */
export function LiveAssessmentExample({ assessmentId }: { assessmentId: string }) {
  const [submissions, setSubmissions] = useState<number>(0);

  useRealtimeAssessmentUpdates(assessmentId);

  useWebSocketEvent('assessment:submission', (data) => {
    if (data.assessmentId === assessmentId) {
      setSubmissions(prev => prev + 1);
    }
  });

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Live Assessment</h3>
      <p className="text-sm text-gray-600 mb-2">Assessment ID: {assessmentId}</p>
      <div className="p-3 bg-green-50 rounded">
        <p className="text-sm text-gray-600">New Submissions</p>
        <p className="text-3xl font-bold">{submissions}</p>
      </div>
    </div>
  );
}

/**
 * Complete Example Page
 */
export default function WebSocketExamplesPage() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">WebSocket Examples</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ConnectionStatusExample />
        <RealtimeNotificationsExample />
        <LiveClassUpdatesExample classId="example-class-123" />
        <StudyRoomExample roomId="example-room-456" />
        <UserPresenceExample />
        <LiveAnalyticsExample />
        <CustomEventExample />
        <LiveAssessmentExample assessmentId="example-assessment-789" />
      </div>
    </div>
  );
}
