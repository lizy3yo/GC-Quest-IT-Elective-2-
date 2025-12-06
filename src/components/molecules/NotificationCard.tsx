"use client";

import React from 'react';
import Link from 'next/link';
import { useNotifications } from '@/contexts/NotificationContext';

/**
 * NotificationCard Component
 * 
 * Displays dynamic notifications in the sidebar based on user activity.
 * Supports multiple notification types with consistent styling.
 * 
 * Features:
 * - Multiple notification types (streak, achievement, reminder, tip, update)
 * - Consistent badge styling matching CategoryBadge component
 * - Dismissible notifications
 * - Action buttons with navigation
 * - Dark mode support
 * - Smooth animations
 * 
 * Badge Styling:
 * - Light mode: #E8F5E9 background, #2E7D32 text
 * - Dark mode: #1C2B1C background, #04C40A text
 * 
 * @example
 * ```tsx
 * import NotificationCard from '@/components/molecules';
 * 
 * <NotificationCard />
 * ```
 */
export default function NotificationCard() {
  const { currentNotification, dismissNotification } = useNotifications();

  if (!currentNotification) {
    return null;
  }

  const handleAction = () => {
    if (currentNotification.actionUrl) {
      // Navigation will happen via Link component
      dismissNotification();
    } else {
      dismissNotification();
    }
  };

  const getBadgeStyles = () => {
    // All badges use the same consistent styling as the original hardcoded badge
    // Matches CategoryBadge component styling
    return 'bg-[#E8F5E9] text-[#2E7D32] dark:bg-[#1C2B1C] dark:text-[#04C40A]';
  };

  const getCardStyles = () => {
    // Consistent styling for all notification cards to match the original design
    return 'border-slate-200 dark:border-slate-800 bg-transparent';
  };

  return (
    <div className={`notification-card rounded-2xl p-4 border ${getCardStyles()} transition-all duration-300 hover:shadow-lg`}>
      <div className="flex items-start gap-3">
        <div className="flex-1">
          {/* Badge */}
          {currentNotification.badge && (
            <div className={`notification-badge inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold mb-2 ${getBadgeStyles()}`}>
              {currentNotification.badge}
            </div>
          )}

          {/* Title */}
          <h3 className="text-slate-800 dark:text-white text-sm font-semibold mb-1">
            {currentNotification.title}
          </h3>

          {/* Message */}
          <p className="text-slate-600 dark:text-[#BCBCBC] text-xs leading-relaxed mb-3">
            {currentNotification.message}
          </p>

          {/* Action Button */}
          {currentNotification.actionUrl ? (
            <Link
              href={currentNotification.actionUrl}
              onClick={handleAction}
              className="notification-action block w-full bg-transparent border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-600 focus:ring-offset-2 focus:ring-offset-transparent text-center no-underline"
            >
              {currentNotification.actionText || 'View'}
            </Link>
          ) : (
            <button
              onClick={handleAction}
              className="notification-action w-full bg-transparent border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-600 focus:ring-offset-2 focus:ring-offset-transparent text-center"
            >
              {currentNotification.actionText || 'OK'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
