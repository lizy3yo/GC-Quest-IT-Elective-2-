"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import useAuth from '@/hooks/useAuth';
import { authManager } from '@/utils/auth';
import { 
  FileText, BookOpen, ClipboardCheck, Trash2, Edit, Plus,
  Clock, Calendar, Filter, TrendingUp, Award, RefreshCw,
  Folder, Star, FolderEdit, User, Lock, GraduationCap, Video
} from 'lucide-react';

// Activity type matching the Activity model
type Activity = {
  _id: string;
  type?: string;
  action?: string;
  meta?: any;
  progress?: number;
  createdAt?: string;
};

type ActivityGroup = {
  date: string;
  activities: Activity[];
};

type FilterType = 'all' | 'assessment' | 'class' | 'live-session' | 'flashcard' | 'summary';
type TimeRange = '7days' | '30days' | '90days' | 'all';

const activityIcons: Record<string, any> = {
  'assessment.create': Plus,
  'assessment.update': Edit,
  'assessment.delete': Trash2,
  'assessment.publish': ClipboardCheck,
  'class.create': GraduationCap,
  'class.update': Edit,
  'class.delete': Trash2,
  'live-session.create': Video,
  'live-session.start': Video,
  'live-session.end': Video,
  'flashcard.create': Plus,
  'flashcard.update': Edit,
  'flashcard.delete': Trash2,
  'summary.create': FileText,
  'summary.update': Edit,
  'summary.delete': Trash2,
};

const activityColors: Record<string, string> = {
  'assessment.create': 'text-purple-600 bg-purple-50 dark:bg-purple-900/20',
  'assessment.update': 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
  'assessment.delete': 'text-red-600 bg-red-50 dark:bg-red-900/20',
  'assessment.publish': 'text-green-600 bg-green-50 dark:bg-green-900/20',
  'class.create': 'text-teal-600 bg-teal-50 dark:bg-teal-900/20',
  'class.update': 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
  'class.delete': 'text-red-600 bg-red-50 dark:bg-red-900/20',
  'live-session.create': 'text-red-600 bg-red-50 dark:bg-red-900/20',
  'live-session.start': 'text-orange-600 bg-orange-50 dark:bg-orange-900/20',
  'live-session.end': 'text-slate-600 bg-slate-50 dark:bg-slate-900/20',
  'flashcard.create': 'text-orange-600 bg-orange-50 dark:bg-orange-900/20',
  'flashcard.update': 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
  'flashcard.delete': 'text-red-600 bg-red-50 dark:bg-red-900/20',
  'summary.create': 'text-green-600 bg-green-50 dark:bg-green-900/20',
  'summary.update': 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
  'summary.delete': 'text-red-600 bg-red-50 dark:bg-red-900/20',
};

export default function HistoryPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('30days');
  const [searchQuery, setSearchQuery] = useState("");

  const fetchActivities = async (userId: string) => {
    try {
      setLoading(true);

      const res = await authManager.makeAuthenticatedRequest(
        `/api/teacher_page/history?userId=${encodeURIComponent(userId)}&filter=${filter}&timeRange=${timeRange}`,
        { method: 'GET', credentials: 'include' }
      );

      if (!res.ok) {
        setActivities([]);
        return;
      }
      const data = await res.json();
      console.debug('Teacher History: fetched activities', data.activities);
      setActivities(data.activities || []);
    } catch (err) {
      console.error('Failed to load teacher activities', err);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoading && user && (user as any)._id) {
      fetchActivities((user as any)._id);
    }
  }, [user, isLoading, filter, timeRange]);

  // Resolve activity type from the activity object
  const resolveActivityType = (act: Activity) => {
    if (!act) return '';
    if (act.type) return act.type;
    const action = (act.action || '').toString().toLowerCase();
    if (act.meta && typeof act.meta.type === 'string') return act.meta.type;
    return action || '';
  };

  // Group activities by date
  const groupedActivities = useMemo(() => {
    if (!activities) return [];

    const resolvedMap = new Map<string, string>();
    activities.forEach(act => {
      resolvedMap.set(act._id, resolveActivityType(act));
    });

    let filtered = activities;

    // Filter by type
    if (filter !== 'all') {
      const ft = filter.toLowerCase();
      filtered = filtered.filter(act => {
        const resolved = (resolvedMap.get(act._id) || '').toLowerCase();
        return resolved.includes(ft);
      });
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(act => {
        const title = act.meta?.title || '';
        const className = act.meta?.className || '';
        return title.toLowerCase().includes(searchQuery.toLowerCase()) ||
               className.toLowerCase().includes(searchQuery.toLowerCase());
      });
    }

    // Group by date
    const groups: Record<string, Activity[]> = {};
    const UNKNOWN_KEY = 'Unknown Date';
    filtered.forEach(act => {
      if (!act.createdAt) {
        if (!groups[UNKNOWN_KEY]) groups[UNKNOWN_KEY] = [];
        groups[UNKNOWN_KEY].push(act);
        return;
      }
      const date = new Date(act.createdAt);
      if (isNaN(date.getTime())) {
        if (!groups[UNKNOWN_KEY]) groups[UNKNOWN_KEY] = [];
        groups[UNKNOWN_KEY].push(act);
        return;
      }
      const dateKey = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(act);
    });

    const entries = Object.entries(groups).map(([date, activities]) => ({ date, activities }));
    entries.sort((a, b) => {
      if (a.date === UNKNOWN_KEY) return -1;
      if (b.date === UNKNOWN_KEY) return 1;
      const ad = new Date(a.date).getTime();
      const bd = new Date(b.date).getTime();
      return bd - ad;
    });

    return entries;
  }, [activities, filter, timeRange, searchQuery]);

  // Calculate stats
  const stats = useMemo(() => {
    if (!activities) return { total: 0, assessments: 0, classes: 0, liveSessions: 0 };
    let assessments = 0, classes = 0, liveSessions = 0;
    activities.forEach(a => {
      const rt = resolveActivityType(a);
      if (rt.startsWith('assessment')) assessments++;
      if (rt.startsWith('class')) classes++;
      if (rt.startsWith('live-session')) liveSessions++;
    });
    return {
      total: activities.length,
      assessments,
      classes,
      liveSessions,
    };
  }, [activities]);

  const formatActivityLabel = (type: string | undefined, action: string | undefined) => {
    const t = (type || '').toString();
    const parts = t.split('.');
    const category = (parts[0] || '').replace('_', ' ');
    const actionPart = action || parts[1] ? (parts[1] || '').replace(/_/g, ' ') : '';
    const titleCategory = category ? `${category.charAt(0).toUpperCase() + category.slice(1)}` : '';
    return `${titleCategory} ${actionPart}`.trim();
  };

  const getActivityIcon = (type: string) => {
    const Icon = activityIcons[type] || activityIcons[type.toLowerCase?.()] || Clock;
    return Icon;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900" style={{ padding: '1.5rem' }}>
      <div style={{ maxWidth: '80rem', marginLeft: 'auto', marginRight: 'auto' }}>
        {/* Header Card - matching library page style */}
        <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-8 mb-8 overflow-hidden">
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#2E7D32]/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-400/5 rounded-full blur-3xl" />
          
          <div className="relative flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2">
                Activity History
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-lg">
                Track all your teaching activities and content creation
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => user && (user as any)._id && fetchActivities((user as any)._id)}
                className="p-3 rounded-xl bg-slate-100 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                disabled={loading}
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <Link
                href="/teacher_page/ai-studio"
                className="px-5 py-2.5 bg-[#2E7D32] text-white rounded-xl hover:bg-[#1B5E20] dark:bg-[hsl(142.1,76.2%,36.3%)] dark:hover:bg-[hsl(142.1,76.2%,30%)] text-sm font-semibold flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create New
              </Link>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-4 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Total</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-[#2E7D32]/10 dark:bg-[#4CAF50]/20 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-[#2E7D32] dark:text-[#4CAF50]" />
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-4 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Assessments</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.assessments}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <ClipboardCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-4 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Classes</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.classes}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-teal-600 dark:text-teal-400" />
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-4 hover:shadow-lg transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Live Sessions</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.liveSessions}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Video className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters Card - matching library page style */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border-2 border-slate-200 dark:border-slate-700 p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            {/* Search */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search activities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/50 focus:border-[#2E7D32] font-medium"
              />
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Type</span>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as FilterType)}
                className="text-sm border-2 border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/50 focus:border-[#2E7D32] font-medium"
              >
                <option value="all">All Activities</option>
                <option value="assessment">Assessments</option>
                <option value="class">Classes</option>
                <option value="live-session">Live Sessions</option>
                <option value="flashcard">Flashcards</option>
                <option value="summary">Summaries</option>
              </select>
            </div>

            {/* Time Range */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Time</span>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                className="text-sm border-2 border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/50 focus:border-[#2E7D32] font-medium"
              >
                <option value="7days">Last 7 days</option>
                <option value="30days">Last 30 days</option>
                <option value="90days">Last 90 days</option>
                <option value="all">All time</option>
              </select>
            </div>
          </div>
        </div>

        {/* Activity Timeline */}
        {loading || isLoading ? (
          <div className="space-y-6">
            {/* Stats Cards Skeleton */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 -mt-6 mb-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-4 animate-pulse">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-16 mb-2"></div>
                      <div className="h-7 bg-slate-200 dark:bg-slate-700 rounded w-10"></div>
                    </div>
                    <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Date Group Skeletons */}
            {[1, 2].map((group) => (
              <div key={group} className="space-y-3">
                {/* Date Header Skeleton */}
                <div className="flex items-center gap-3 animate-pulse">
                  <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                  <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-full w-32"></div>
                  <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                </div>

                {/* Activity Cards Skeleton */}
                <div className="space-y-3">
                  {[1, 2, 3].map((card) => (
                    <div key={card} className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-5 animate-pulse">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-lg flex-shrink-0"></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-40 mb-2"></div>
                              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-64 mb-3"></div>
                              <div className="flex gap-3">
                                <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
                                <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-20"></div>
                                <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
                              </div>
                            </div>
                            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : groupedActivities.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border-2 border-slate-200 dark:border-slate-700 p-12 text-center">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Clock className="w-10 h-10 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">No activities found</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
              {searchQuery || filter !== 'all' || timeRange !== 'all'
                ? 'No activities found for the selected filters. Try adjusting your filters.'
                : 'Start creating assessments, classes, or live sessions to see your activity here.'}
            </p>
            {(searchQuery || filter !== 'all' || timeRange !== 'all') && (
              <button
                onClick={() => {
                  setFilter('all');
                  setTimeRange('all');
                  setSearchQuery('');
                }}
                className="mb-4 px-6 py-3 bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors font-semibold"
              >
                Clear Filters
              </button>
            )}
            <Link
              href="/teacher_page/ai-studio"
              className="inline-block px-6 py-3 bg-[#2E7D32] text-white rounded-xl font-semibold hover:bg-[#1B5E20] shadow-md hover:shadow-lg transition-all"
            >
              Create Activity
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedActivities.map((group) => (
              <div key={group.date} className="space-y-3">
                {/* Date Header */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">
                    {group.date}
                  </h3>
                  <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                </div>

                {/* Activities */}
                <div className="space-y-3">
                  {group.activities.map((activity) => {
                    const resolvedType = resolveActivityType(activity);
                    const Icon = getActivityIcon(resolvedType);
                    const colorClass = activityColors[resolvedType] || 'text-slate-600 bg-slate-50 dark:bg-slate-800';

                    return (
                      <div
                        key={activity._id}
                        className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-5 hover:shadow-xl hover:border-[#2E7D32]/30 transition-all"
                      >
                        <div className="flex items-start gap-4">
                          <div className={`p-2.5 rounded-lg ${colorClass} flex-shrink-0`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <h4 className="font-semibold text-slate-800 dark:text-white">
                                  {formatActivityLabel(resolvedType, activity.action)}
                                </h4>
                                {activity.meta?.title && (
                                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                    {activity.meta.title}
                                  </p>
                                )}
                                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500 dark:text-slate-400">
                                  {activity.meta?.className && (
                                    <span className="flex items-center gap-1">
                                      <GraduationCap className="w-3 h-3" />
                                      {activity.meta.className}
                                    </span>
                                  )}
                                  {activity.meta?.studentCount !== undefined && (
                                    <span className="flex items-center gap-1">
                                      <User className="w-3 h-3" />
                                      {activity.meta.studentCount} students
                                    </span>
                                  )}
                                  {activity.meta?.questionCount !== undefined && (
                                    <span className="flex items-center gap-1">
                                      <ClipboardCheck className="w-3 h-3" />
                                      {activity.meta.questionCount} questions
                                    </span>
                                  )}
                                  {activity.meta?.subject && (
                                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs">
                                      {activity.meta.subject}
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                <Clock className="w-3 h-3" />
                                {activity.createdAt ? new Date(activity.createdAt).toLocaleTimeString('en-US', { 
                                  hour: 'numeric', 
                                  minute: '2-digit' 
                                }) : ''}
                              </div>
                            </div>

                            {typeof activity.progress === 'number' && activity.progress < 100 && (
                              <div className="mt-3">
                                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                                  <span>Progress</span>
                                  <span>{activity.progress}%</span>
                                </div>
                                <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                  <div 
                                    className="h-2 bg-purple-500 rounded-full transition-all"
                                    style={{ width: `${Math.min(100, Math.max(0, activity.progress))}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}