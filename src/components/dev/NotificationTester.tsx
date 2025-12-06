"use client";

import React from 'react';
import { 
  recordStudySession, 
  setPendingTests, 
  clearDismissedNotifications,
  resetSessionNotification,
  getStudyStreak,
  getTotalFlashcardsStudied,
  getPendingTests
} from '@/lib/notifications/study-tracker';
import { useNotifications } from '@/contexts/NotificationContext';

/**
 * Development tool for testing notifications
 * Add this component to any page to test different notification scenarios
 * 
 * Usage:
 * import NotificationTester from '@/components/dev/NotificationTester';
 * <NotificationTester />
 */
export default function NotificationTester() {
  const { refreshNotifications } = useNotifications();
  const [stats, setStats] = React.useState({
    streak: 0,
    flashcards: 0,
    pendingTests: 0,
  });

  const updateStats = () => {
    setStats({
      streak: getStudyStreak(),
      flashcards: getTotalFlashcardsStudied(),
      pendingTests: getPendingTests(),
    });
  };

  React.useEffect(() => {
    updateStats();
  }, []);

  const handleSetStreak = (days: number) => {
    localStorage.setItem('studyStreak', days.toString());
    localStorage.setItem('lastStudyDate', new Date().toISOString().split('T')[0]);
    updateStats();
    refreshNotifications();
  };

  const handleSetFlashcards = (count: number) => {
    localStorage.setItem('totalFlashcardsStudied', count.toString());
    updateStats();
    refreshNotifications();
  };

  const handleSetPendingTests = (count: number) => {
    setPendingTests(count);
    updateStats();
    refreshNotifications();
  };

  const handleRecordSession = () => {
    recordStudySession(10, 1, 25);
    updateStats();
    refreshNotifications();
  };

  const handleClearDismissed = () => {
    clearDismissedNotifications();
    resetSessionNotification();
    refreshNotifications();
  };

  const handleResetAll = () => {
    localStorage.removeItem('studyStreak');
    localStorage.removeItem('lastStudyDate');
    localStorage.removeItem('totalFlashcardsStudied');
    localStorage.removeItem('pendingTests');
    localStorage.removeItem('dismissedNotifications');
    localStorage.removeItem('studySessions');
    sessionStorage.removeItem('hasDismissedNotification');
    updateStats();
    refreshNotifications();
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999] bg-white dark:bg-slate-900 border-2 border-purple-500 rounded-lg shadow-2xl p-4 max-w-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-purple-600 dark:text-purple-400">
          🧪 Notification Tester
        </h3>
        <span className="inline-flex items-center px-2 py-0.5 text-[0.6875rem] font-semibold rounded-full bg-[#E8F5E9] text-[#2E7D32] dark:bg-[#1C2B1C] dark:text-[#04C40A]">
          DEV
        </span>
      </div>

      {/* Current Stats */}
      <div className="mb-3 p-2 bg-slate-50 dark:bg-slate-800 rounded text-xs space-y-1">
        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-400">Streak:</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">{stats.streak} days</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-400">Flashcards:</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">{stats.flashcards}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600 dark:text-slate-400">Pending Tests:</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">{stats.pendingTests}</span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
          Quick Actions:
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleSetStreak(7)}
            className="px-2 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
          >
            7-Day Streak
          </button>
          <button
            onClick={() => handleSetStreak(3)}
            className="px-2 py-1 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
          >
            3-Day Streak
          </button>
          <button
            onClick={() => handleSetFlashcards(100)}
            className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
          >
            100 Flashcards
          </button>
          <button
            onClick={() => handleSetPendingTests(3)}
            className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            3 Pending Tests
          </button>
        </div>

        <button
          onClick={handleRecordSession}
          className="w-full px-2 py-1 text-xs bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
        >
          Record Study Session
        </button>

        <button
          onClick={handleClearDismissed}
          className="w-full px-2 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors"
        >
          Reset Session
        </button>

        <button
          onClick={handleResetAll}
          className="w-full px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
        >
          Reset All
        </button>
      </div>

      <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Remove this component in production
        </p>
      </div>
    </div>
  );
}
