"use client";

import "./styles.css";
import { useState, useEffect, useCallback } from "react";
import { useLoading } from "@/hooks/useLoading";
import useAuth from "@/hooks/useAuth";
import { submissionApi, analyticsApi } from "@/lib/api/teacher";
import LoadingTemplate2 from "@/components/molecules/loading_template_2/loading_template_2/loading2";
import { TrendingUp, TrendingDown, Users, BookOpen, FileText, ClipboardCheck, Clock, AlertCircle, CheckCircle, UserPlus, RotateCw, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardFooter } from "@/components/atoms";
import { Badge } from "@/components/atoms";
import { GradeDistributionChart } from "@/components/organisms";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/atoms";

interface DashboardMetrics {
  totalClasses: number;
  totalStudents: number;
  pendingSubmissions: number;
  upcomingAssessments: number;
}

interface ClassPerformance {
  classId: string;
  className: string;
  averageScore: number;
  studentCount: number;
  assessmentCount: number;
  submissionCount?: number;
  gradeDistribution?: {
    excellent: number;      // 90-100%
    good: number;           // 80-89%
    satisfactory: number;   // 70-79%
    needsImprovement: number; // <70%
  };
  completionRate?: number;
  classCode?: string;
  schedule?: string;
  room?: string;
}

interface ActivityItem {
  id: string;
  type: 'enrollment' | 'submission' | 'needs-help' | 'late-submission';
  studentName: string;
  className: string;
  timestamp: Date;
  details?: string;
  score?: number;
}

// Helper function to format time ago
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function TeacherDashboardPage() {
  const { isLoading: isPageLoading, startLoading, stopLoading } = useLoading(true);
  const { isLoading: authLoading, user } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalClasses: 0,
    totalStudents: 0,
    pendingSubmissions: 0,
    upcomingAssessments: 0,
  });
  const [classPerformance, setClassPerformance] = useState<ClassPerformance[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const [activityPagination, setActivityPagination] = useState<{
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  } | null>(null);

  const fetchActivityData = useCallback(async () => {
    try {
      setActivityLoading(true);
      
      const activityRes = await submissionApi.getRecentActivity({ limit: 5, page: activityPage, days: 30 }).catch(err => {
        console.error('Activity error:', err);
        return { success: false, error: 'Failed to load activity' };
      });

      // Update recent activity - only if successful
      if (activityRes.success && 'data' in activityRes && activityRes.data?.activities) {
        console.log('[Dashboard] Activity API response:', activityRes.data);
        console.log('[Dashboard] Activities count:', activityRes.data.activities.length);
        console.log('[Dashboard] Pagination:', activityRes.data.pagination);
        
        const formattedActivity: ActivityItem[] = (activityRes.data.activities as unknown[]).map((act: unknown) => {
          const activity = act as Record<string, unknown>;
          return {
            id: (activity.id as string) || `activity-${Date.now()}-${Math.random()}`,
            type: activity.type as 'enrollment' | 'submission' | 'needs-help' | 'late-submission',
            studentName: (activity.studentName as string) || 'Unknown Student',
            className: (activity.className as string) || 'Unknown Class',
            timestamp: new Date(activity.timestamp as string),
            details: activity.details as string | undefined,
            score: activity.score as number | undefined
          };
        });
        setRecentActivity(formattedActivity);
        
        // Update pagination info
        if (activityRes.data.pagination) {
          setActivityPagination(activityRes.data.pagination);
        }
      } else {
        // If activity fetch failed, don't update state to avoid infinite loops
        console.warn('Activity fetch failed, keeping previous state');
      }
    } catch (error) {
      console.error('Activity data fetch error:', error);
    } finally {
      setActivityLoading(false);
    }
  }, [activityPage]);

  const fetchDashboardData = useCallback(async () => {
    try {
      startLoading();
      
      if (!user?._id) {
        stopLoading();
        return;
      }

      // Fetch metrics in parallel
      setMetricsLoading(true);
      setPerformanceLoading(true);

      const [metricsRes, performanceRes] = await Promise.all([
        analyticsApi.getDashboardMetrics().catch(err => {
          console.error('Metrics error:', err);
          return { success: false, error: 'Failed to load metrics' };
        }),
        analyticsApi.getClassPerformance({ limit: 20 }).catch(err => {
          console.error('Performance error:', err);
          return { success: false, error: 'Failed to load performance data' };
        })
      ]);

      // Update metrics
      if (metricsRes.success && 'data' in metricsRes && metricsRes.data) {
        setMetrics({
          totalClasses: metricsRes.data.totalClasses || 0,
          totalStudents: metricsRes.data.totalStudents || 0,
          pendingSubmissions: metricsRes.data.pendingSubmissions || 0,
          upcomingAssessments: metricsRes.data.upcomingAssessments || 0,
        });
      }
      setMetricsLoading(false);

      // Update class performance
      if (performanceRes.success && 'data' in performanceRes && performanceRes.data?.classes) {
        setClassPerformance(performanceRes.data.classes as ClassPerformance[]);
      }
      setPerformanceLoading(false);

    } catch (error) {
      console.error('Dashboard data fetch error:', error);
      setMetricsLoading(false);
      setPerformanceLoading(false);
    } finally {
      stopLoading();
    }
  }, [user?._id, startLoading, stopLoading]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (user?._id) {
      fetchActivityData();
    }
  }, [fetchActivityData, user?._id]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900" style={{ padding: '1.5rem' }}>
      <div style={{ maxWidth: '80rem', marginLeft: 'auto', marginRight: 'auto' }}>
        {/* Header Card - matching library page style */}
        <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-8 mb-8 overflow-hidden">
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#2E7D32]/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-400/5 rounded-full blur-3xl" />
          
          <div className="relative">
            <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2">
              {isPageLoading || authLoading ? 'Loading...' : `Welcome Back, ${user?.firstName?.trim() || user?.name?.trim()?.split(" ")[0] || user?.username?.trim() || "Teacher"}!`}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              Here&apos;s an overview of your classes and students
            </p>
          </div>
        </div>

        {/* Overview Metrics */}
        <section aria-label="Overview metrics" style={{ marginBottom: '1rem' }}>
          {isPageLoading || authLoading || metricsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-6 animate-pulse">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24 mb-3"></div>
                  <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-16 mb-3"></div>
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-32"></div>
                </div>
              ))}
            </div>
          ) : (
          <TooltipProvider delayDuration={0}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs">
              <Card className="@container/card">
                <CardHeader>
                  <CardDescription className="pr-20">Active Classes</CardDescription>
                  <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                    {metrics.totalClasses}
                  </CardTitle>
                  <CardAction>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="pill">
                        <BookOpen className="size-4" />
                        Active
                      </Badge>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="inline-flex items-center justify-center w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help">
                            <span className="text-xs">?</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Total number of active classes you are currently teaching</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </CardAction>
                </CardHeader>
                <CardFooter className="flex-col items-start gap-1.5 text-sm">
                  <div className="line-clamp-1 flex gap-2 font-medium text-slate-600 dark:text-[var(--dark-text-secondary)]">
                    Currently teaching <TrendingUp className="size-4" />
                  </div>
                </CardFooter>
              </Card>

              <Card className="@container/card">
                <CardHeader>
                  <CardDescription className="pr-20">Total Students</CardDescription>
                  <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                    {metrics.totalStudents}
                  </CardTitle>
                  <CardAction>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="pill">
                        <Users className="size-4" />
                        Enrolled
                      </Badge>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="inline-flex items-center justify-center w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help">
                            <span className="text-xs">?</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Total number of unique students enrolled across all your classes. Each student is counted once, even if enrolled in multiple classes.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </CardAction>
                </CardHeader>
                <CardFooter className="flex-col items-start gap-1.5 text-sm">
                  <div className="line-clamp-1 flex gap-2 font-medium text-slate-600 dark:text-[var(--dark-text-secondary)]">
                    Across all classes <TrendingUp className="size-4" />
                  </div>
                </CardFooter>
              </Card>

              <Card className="@container/card">
                <CardHeader>
                  <CardDescription className="pr-24">Pending Submissions</CardDescription>
                  <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                    {metrics.pendingSubmissions}
                  </CardTitle>
                  <CardAction>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="pill">
                        {metrics.pendingSubmissions > 0 ? (
                          <>
                            <ClipboardCheck className="size-4" />
                            To Grade
                          </>
                        ) : (
                          <>
                            <TrendingDown className="size-4" />
                            None
                          </>
                        )}
                      </Badge>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="inline-flex items-center justify-center w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help">
                            <span className="text-xs">?</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Number of student submissions waiting to be graded. Click to view and grade pending work.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </CardAction>
                </CardHeader>
                <CardFooter className="flex-col items-start gap-1.5 text-sm">
                  <div className="line-clamp-1 flex gap-2 font-medium text-slate-600 dark:text-[var(--dark-text-secondary)]">
                    {metrics.pendingSubmissions > 0 ? 'Awaiting review' : 'All caught up'}{' '}
                    {metrics.pendingSubmissions > 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                  </div>
                </CardFooter>
              </Card>

              <Card className="@container/card">
                <CardHeader>
                  <CardDescription className="pr-24">Upcoming Assessments</CardDescription>
                  <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                    {metrics.upcomingAssessments}
                  </CardTitle>
                  <CardAction>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="pill">
                        {metrics.upcomingAssessments > 0 ? (
                          <>
                            <FileText className="size-4" />
                            This Week
                          </>
                        ) : (
                          <>
                            <TrendingDown className="size-4" />
                            None
                          </>
                        )}
                      </Badge>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="inline-flex items-center justify-center w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help">
                            <span className="text-xs">?</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Number of assessments with due dates in the next 7 days across all your classes</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </CardAction>
                </CardHeader>
                <CardFooter className="flex-col items-start gap-1.5 text-sm">
                  <div className="line-clamp-1 flex gap-2 font-medium text-slate-600 dark:text-[var(--dark-text-secondary)]">
                    {metrics.upcomingAssessments > 0 ? 'Due next 7 days' : 'No upcoming deadlines'}{' '}
                    {metrics.upcomingAssessments > 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                  </div>
                </CardFooter>
              </Card>
            </div>
          </TooltipProvider>
          )}
        </section>

        {/* Performance and Activity Grid */}
        <div className="performance-activity-grid">
          {/* Grade Distribution Overview */}
          <section aria-label="Grade Distribution Overview" className="performance-chart-section relative">
            {/* Tooltip moved into GradeDistributionChart header */}
            {isPageLoading || authLoading || performanceLoading ? (
              <div className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-6 animate-pulse">
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-48 mb-2"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-64 mb-6"></div>
                <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded"></div>
              </div>
            ) : (
              <GradeDistributionChart
                data={
                  classPerformance.length > 0 && classPerformance[0].gradeDistribution
                    ? // Aggregate grade distribution across all classes
                      classPerformance.reduce(
                        (acc, cls) => {
                          if (cls.gradeDistribution) {
                            acc.excellent += cls.gradeDistribution.excellent;
                            acc.good += cls.gradeDistribution.good;
                            acc.satisfactory += cls.gradeDistribution.satisfactory;
                            acc.needsImprovement += cls.gradeDistribution.needsImprovement;
                          }
                          return acc;
                        },
                        { excellent: 0, good: 0, satisfactory: 0, needsImprovement: 0 }
                      )
                    : { excellent: 0, good: 0, satisfactory: 0, needsImprovement: 0 }
                }
                totalStudents={metrics.totalStudents}
              />
            )}
          </section>

          {/* Recent Activity Feed */}
          <section aria-label="Recent Activity" className="activity-feed-section">
            <div className="activity-feed-card relative">
              <div className="flex items-start justify-between" style={{ marginBottom: '1rem' }}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-base font-semibold text-[#0f172a] dark:text-[#FFFFFF]" style={{ margin: 0 }}>
                      Recent Activity
                    </h2>
                    <TooltipProvider delayDuration={0}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="inline-flex items-center justify-center w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help">
                            <span className="text-xs">?</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Real-time feed of student activities including enrollments, submissions, and late work</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-sm text-[#64748b] dark:text-[#BCBCBC]" style={{ margin: 0 }}>
                    Latest student submissions and enrollments
                  </p>
                </div>
                {/* Manual refresh button */}
                <button
                  className="inline-flex items-center justify-center gap-2 px-2 py-1 text-xs rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700 flex-shrink-0"
                  onClick={() => fetchActivityData()}
                  aria-label="Refresh recent activity"
                  disabled={activityLoading}
                  title="Refresh recent activity"
                >
                  <RotateCw className={`size-4 ${activityLoading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              </div>
              
              {isPageLoading || authLoading || activityLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="flex gap-3 animate-pulse">
                      <div className="size-8 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentActivity.length === 0 ? (
                <div className="activity-empty">
                  <Clock className="size-8 text-slate-400 dark:text-slate-600" />
                  <p className="activity-empty-text">No recent activity</p>
                </div>
              ) : (
                <div className="activity-feed-list">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="activity-item" data-type={activity.type}>
                      <div className="activity-icon">
                        {activity.type === 'enrollment' && <UserPlus className="size-4" />}
                        {activity.type === 'submission' && <CheckCircle className="size-4" />}
                        {activity.type === 'needs-help' && <AlertCircle className="size-4" />}
                        {activity.type === 'late-submission' && <Clock className="size-4" />}
                      </div>
                      
                      <div className="activity-content">
                        <div className="activity-header">
                          <span className="activity-student">{activity.studentName}</span>
                          {activity.type === 'enrollment' && (
                            <span className="activity-action">enrolled in</span>
                          )}
                          {activity.type === 'submission' && (
                            <span className="activity-action">submitted</span>
                          )}
                          {activity.type === 'needs-help' && (
                            <span className="activity-action">needs help with</span>
                          )}
                          {activity.type === 'late-submission' && (
                            <span className="activity-action">late submission for</span>
                          )}
                        </div>
                        
                        <div className="activity-details">
                          <span className="activity-class">{activity.className}</span>
                          {activity.details && (
                            <span className="activity-assessment"> • {activity.details}</span>
                          )}
                          {activity.score !== undefined && (
                            <span className="activity-score" data-score={activity.score >= 60 ? 'pass' : 'fail'}>
                              {' '}• {activity.score}%
                            </span>
                          )}
                        </div>
                        
                        <div className="activity-time">
                          {formatTimeAgo(activity.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Pagination Controls */}
              {activityPagination && recentActivity.length > 0 && (
                <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <button
                    onClick={() => setActivityPage(prev => Math.max(1, prev - 1))}
                    disabled={!activityPagination.hasPreviousPage || activityLoading}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  <div className="text-sm text-slate-600 dark:text-slate-400 text-center min-w-[120px]">
                    Page {activityPagination.currentPage} of {activityPagination.totalPages}
                  </div>
                  <button
                    onClick={() => setActivityPage(prev => prev + 1)}
                    disabled={!activityPagination.hasNextPage || activityLoading}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    aria-label="Next page"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Class Quick Access */}
        <section aria-label="Class Quick Access" className="class-access-section">
          <div className="flex items-center gap-2" style={{ marginBottom: '1rem' }}>
            <h2 className="section-title" style={{ margin: 0 }}>Your Classes</h2>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="inline-flex items-center justify-center w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help">
                    <span className="text-xs">?</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">The percentage shown is the class average score across all graded assessments and activities. It represents the overall performance of all students in that class.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          {isPageLoading || authLoading || performanceLoading ? (
            <div className="class-grid">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-6 animate-pulse">
                  <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-3"></div>
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-4"></div>
                  <div className="flex gap-2">
                    <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded flex-1"></div>
                    <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded flex-1"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : classPerformance.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📚</div>
              <p className="empty-title">No classes yet</p>
              <p className="empty-desc">
                Create your first class to get started
              </p>
            </div>
          ) : (
            <div className="class-grid">
              {classPerformance.map((cls) => (
                <div key={cls.classId} className="class-card">
                  <div className="class-card-header">
                    <div className="class-card-info">
                      <h3 className="class-card-title">{cls.className}</h3>
                      <div className="class-card-meta">
                        <span className="class-meta-item">
                          <FileText className="size-3" />
                          {cls.classCode || 'No code'}
                        </span>
                        <span className="class-meta-item">
                          <Clock className="size-3" />
                          {cls.schedule || 'TBD'}
                        </span>
                      </div>
                    </div>
                    <div className="class-card-score">
                      <TooltipProvider delayDuration={0}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="score-circle" data-score={cls.averageScore >= 75 ? 'good' : 'needs-attention'} style={{ cursor: 'help' }}>
                              {cls.averageScore}%
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">Class average: {cls.averageScore}% across {cls.assessmentCount} {cls.assessmentCount === 1 ? 'assessment' : 'assessments'} with {cls.studentCount} {cls.studentCount === 1 ? 'student' : 'students'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                  
                  <div className="class-card-actions">
                    <a 
                      href={`/teacher_page/classes/${cls.classId}`}
                      className="class-action-btn class-action-primary"
                    >
                      <BookOpen className="size-4" />
                      View Class
                    </a>
                    <a 
                      href={`/teacher_page/assessment/create?classId=${cls.classId}`}
                      className="class-action-btn class-action-secondary"
                    >
                      <FileText className="size-4" />
                      Create Assessment
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}