"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Certificate from "@/components/organisms/leaderboard/leaderboard/Certificate";

interface Student {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  stats: {
    totalPoints: number;
    quizzesCompleted: number;
    examsCompleted: number;
    activitiesCompleted: number;
    assessmentsCompleted: number;
    averageScore: number;
    streak: number;
    rank: number;
    badges: string[];
    achievements: string[];
  };
  // optional detailed data that can be fetched on demand
  quizzes?: Array<{
    _id: string;
    title: string;
    score: number;
    maxScore?: number;
    date?: string;
  }>;
  activities?: Array<{
    _id: string;
    type: string;
    points: number;
    date?: string;
    description?: string;
  }>;
}

interface ClassLeaderboard {
  _id: string;
  name: string;
  subject: string;
  students: Student[];
}

type LeaderboardView = 'overall' | 'class' | 'weekly' | 'monthly';
type SortBy = 'points' | 'average' | 'completed' | 'streak';

export default function LeaderboardsPage() {
  const router = useRouter();
  const [view, setView] = useState<LeaderboardView>('overall');
  const [sortBy, setSortBy] = useState<SortBy>('points');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [classes, setClasses] = useState<ClassLeaderboard[]>([]);
  const [overallLeaderboard, setOverallLeaderboard] = useState<Student[]>([]);
  const [expandedStudentIds, setExpandedStudentIds] = useState<Record<string, boolean>>({});
  const [studentDetails, setStudentDetails] = useState<Record<string, { quizzes?: Student['quizzes']; activities?: Student['activities']; loading: boolean; error?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [certificateStudent, setCertificateStudent] = useState<Student | null>(null);

  const loadLeaderboards = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(
        `/api/teacher_page/leaderboards?view=${view}&sortBy=${sortBy}${selectedClass ? `&classId=${selectedClass}` : ''}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        }
      );

      const data = await response.json();
      if (data.success) {
        if (view === 'overall') {
          setOverallLeaderboard(data.students || []);
        } else if (view === 'class') {
          setClasses(data.classes || []);
        }
      }
    } catch (error) {
      console.error('Failed to load leaderboards:', error);
    } finally {
      setLoading(false);
    }
  }, [view, sortBy, selectedClass]);

  const fetchStudentDetails = useCallback(async (studentId: string) => {
    if (!studentId) return;

    setStudentDetails((s) => ({ ...s, [studentId]: { loading: true } }));

    try {
      // 1) Get classes for this student (teacher-scoped)
      const classesRes = await fetch(`/api/teacher_page/student/${studentId}/classes`, { credentials: 'include' });
      const classesJson = await classesRes.json();
      if (!classesRes.ok || !classesJson.success) {
        throw new Error(classesJson.error || 'Failed to fetch student classes');
      }

      const studentClasses = classesJson.data?.classes || [];

      // 2) For each class, fetch assessments
      const assessmentsPerClass = await Promise.all(
        studentClasses.map(async (cls: any) => {
          const res = await fetch(`/api/teacher_page/assessment?classId=${cls.classId}&limit=500`, { credentials: 'include' });
          const json = await res.json();
          return (json && json.success && json.data && json.data.assessments) ? json.data.assessments : [];
        })
      );

      const allAssessments = assessmentsPerClass.flat();

      // 3) For each assessment, fetch submissions for this student
      const submissionsPromises = allAssessments.map(async (assessment: any) => {
        try {
          const res = await fetch(`/api/teacher_page/assessment/${assessment._id}/submissions?studentId=${studentId}`, { credentials: 'include' });
          const json = await res.json();
          if (res.ok && json.success && json.data) {
            return json.data.submissions.map((s: any) => ({ submission: s, assessment }));
          }
        } catch (e) {
          // ignore single assessment errors
        }
        return [];
      });

      const submissionsArrays = await Promise.all(submissionsPromises);
      const allSubmissions = submissionsArrays.flat();

      // Separate into quizzes/exams (assessments with category 'Quiz' or 'Exam') and activities (category 'Activity')
      const quizzes = allSubmissions
        .filter((item: any) => (item.assessment.category || item.assessment.type || '').toString().toLowerCase().includes('quiz') || (item.assessment.category === 'Quiz'))
        .map((item: any) => ({
          _id: item.submission._id,
          title: item.assessment.title,
          score: item.submission.score ?? 0,
          maxScore: item.submission.maxScore,
          date: item.submission.submittedAt
        }));

      const activities = allSubmissions
        .filter((item: any) => (item.assessment.category || '').toString() === 'Activity' || (item.assessment.category || '').toString().toLowerCase() === 'activity')
        .map((item: any) => ({
          _id: item.submission._id,
          type: item.assessment.title || 'Activity',
          points: item.submission.score ?? 0,
          date: item.submission.submittedAt,
          description: item.submission.type || ''
        }));

      setStudentDetails((s) => ({
        ...s,
        [studentId]: {
          loading: false,
          quizzes,
          activities
        }
      }));

    } catch (err: any) {
      setStudentDetails((s) => ({ ...s, [studentId]: { loading: false, error: String(err) } }));
    }
  }, []);

  useEffect(() => {
    loadLeaderboards();
  }, [loadLeaderboards]);

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'from-yellow-400 to-orange-500';
    if (rank === 2) return 'from-gray-400 to-gray-500';
    if (rank === 3) return 'from-orange-600 to-orange-700';
    return 'from-slate-600 to-slate-700';
  };

  const getRankEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getBadgeEmoji = (badge: string) => {
    const badges: Record<string, string> = {
      'perfect_score': '💯',
      'speed_demon': '⚡',
      'consistent': '📈',
      'helper': '🤝',
      'achiever': '🎯',
      'scholar': '📚'
    };
    return badges[badge] || '🏅';
  };

  const getViewLabel = () => {
    if (view === 'overall') return 'Overall';
    if (view === 'weekly') return 'This Week';
    if (view === 'monthly') return 'This Month';
    return 'Class';
  };

  return (
    <>
      {/* Certificate Modal */}
      {certificateStudent && (
        <Certificate
          studentName={certificateStudent.name}
          rank={certificateStudent.stats.rank}
          totalPoints={certificateStudent.stats.totalPoints}
          averageScore={certificateStudent.stats.averageScore}
          assessmentsCompleted={certificateStudent.stats.assessmentsCompleted}
          period={getViewLabel()}
          date={new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          onClose={() => setCertificateStudent(null)}
        />
      )}

    {/* Main Content */}
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300" style={{ padding: '1.5rem' }}>
      <div style={{ maxWidth: '80rem', marginLeft: 'auto', marginRight: 'auto' }}>
        {/* Header Card */}
        <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-8 mb-8 overflow-hidden">
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#2E7D32]/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-400/5 rounded-full blur-3xl" />
          
          <div className="relative">
            <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2">
              Student Leaderboards
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              Track student performance, achievements, and rankings across your classes
            </p>
          </div>
        </div>

        {/* View Tabs */}
        <div className="mb-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex gap-8">
            {[
              { key: 'overall', label: 'Overall' },
              { key: 'class', label: 'By Class' },
              { key: 'weekly', label: 'This Week' },
              { key: 'monthly', label: 'This Month' }
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setView(t.key as LeaderboardView)}
                className={`py-3 text-sm font-medium transition-colors relative ${
                  view === t.key
                    ? 'text-[#2E7D32] dark:text-[#4CAF50]'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {t.label}
                {view === t.key && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2E7D32] dark:bg-[#4CAF50] rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Sort Controls Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border-2 border-slate-200 dark:border-slate-700 p-4 mb-6">
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Sort by</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="text-sm border-2 border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/50 focus:border-[#2E7D32] font-medium"
            >
              <option value="points">⭐ Points</option>
              <option value="average">📊 Average score</option>
              <option value="completed">✅ Assessments completed</option>
              <option value="streak">🔥 Streak</option>
            </select>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="space-y-6">
            {/* Top 3 Podium Skeleton */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl border-2 border-slate-200 dark:border-slate-700 p-8">
              <div className="text-center mb-8">
                <div className="h-16 w-16 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-4 animate-pulse"></div>
                <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-48 mx-auto animate-pulse"></div>
              </div>
              <div className="flex items-end justify-center gap-6">
                {/* 2nd Place Skeleton */}
                <div className="flex flex-col items-center flex-1 max-w-[200px]">
                  <div className="w-20 h-20 bg-slate-200 dark:bg-slate-700 rounded-full mb-3 animate-pulse"></div>
                  <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-24 mb-2 animate-pulse"></div>
                  <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded-full mb-2 animate-pulse"></div>
                  <div className="bg-slate-100 dark:bg-slate-700 rounded-2xl p-4 w-full animate-pulse">
                    <div className="h-8 bg-slate-200 dark:bg-slate-600 rounded w-20 mx-auto mb-2"></div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-600 rounded w-12 mx-auto"></div>
                  </div>
                </div>
                {/* 1st Place Skeleton */}
                <div className="flex flex-col items-center flex-1 max-w-[240px] transform scale-105">
                  <div className="w-28 h-28 bg-slate-200 dark:bg-slate-700 rounded-full mb-3 animate-pulse"></div>
                  <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-28 mb-2 animate-pulse"></div>
                  <div className="h-12 w-12 bg-slate-200 dark:bg-slate-700 rounded-full mb-2 animate-pulse"></div>
                  <div className="bg-slate-100 dark:bg-slate-700 rounded-2xl p-5 w-full animate-pulse">
                    <div className="h-10 bg-slate-200 dark:bg-slate-600 rounded w-24 mx-auto mb-2"></div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-600 rounded w-12 mx-auto"></div>
                  </div>
                </div>
                {/* 3rd Place Skeleton */}
                <div className="flex flex-col items-center flex-1 max-w-[200px]">
                  <div className="w-20 h-20 bg-slate-200 dark:bg-slate-700 rounded-full mb-3 animate-pulse"></div>
                  <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-24 mb-2 animate-pulse"></div>
                  <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded-full mb-2 animate-pulse"></div>
                  <div className="bg-slate-100 dark:bg-slate-700 rounded-2xl p-4 w-full animate-pulse">
                    <div className="h-8 bg-slate-200 dark:bg-slate-600 rounded w-20 mx-auto mb-2"></div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-600 rounded w-12 mx-auto"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Full Rankings Skeleton */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-6 border-b-2 border-slate-200 dark:border-slate-700 flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse"></div>
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-32 animate-pulse"></div>
              </div>
              <div className="divide-y-2 divide-slate-100 dark:divide-slate-700">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="p-5 flex items-center gap-4 animate-pulse">
                    <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
                    <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                    <div className="flex-1 min-w-0">
                      <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-32 mb-2"></div>
                      <div className="flex gap-2">
                        <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
                        <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-12"></div>
                        <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-12"></div>
                      </div>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-700 rounded-xl p-3">
                      <div className="h-6 bg-slate-200 dark:bg-slate-600 rounded w-16 mb-1"></div>
                      <div className="h-3 bg-slate-200 dark:bg-slate-600 rounded w-10"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Overall/Weekly/Monthly View */}
            {(view === 'overall' || view === 'weekly' || view === 'monthly') && (
              <div className="space-y-6 mb-6">
                {/* Top 3 Podium Card */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl border-2 border-slate-200 dark:border-slate-700 p-8 overflow-hidden relative">
                  {/* Decorative Background */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl" />
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#2E7D32]/10 rounded-full blur-2xl" />
                  
                  <div className="relative">
                    <div className="text-center mb-8">
                      <div className="text-6xl mb-4">🏆</div>
                      <h2 className="text-4xl font-black text-slate-900 dark:text-white">Top Performers</h2>
                    </div>
                    
                    <div className="flex items-end justify-center gap-6">
                      {/* 2nd Place */}
                      {overallLeaderboard[1] && (
                        <div className="flex flex-col items-center flex-1 max-w-[200px]">
                          <div className="w-20 h-20 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-3xl mb-3 ring-4 ring-slate-300 dark:ring-slate-600 shadow-lg">
                            {overallLeaderboard[1].avatar || '👤'}
                          </div>
                          <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1 text-center">{overallLeaderboard[1].name}</div>
                          <div className="text-4xl mb-2">🥈</div>
                          <div className="bg-slate-100 dark:bg-slate-700 rounded-2xl p-4 w-full border-2 border-slate-200 dark:border-slate-600">
                            <div className="text-2xl font-black text-[#2E7D32] dark:text-emerald-400 text-center">{overallLeaderboard[1].stats.totalPoints.toLocaleString()}</div>
                            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">points</div>
                            <div className="text-sm text-slate-600 dark:text-slate-300 text-center mt-2">
                              {overallLeaderboard[1].stats.averageScore}% avg
                            </div>
                          </div>
                          <button
                            onClick={() => setCertificateStudent(overallLeaderboard[1])}
                            className="mt-3 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold transition-colors border-2 border-slate-200 dark:border-slate-600"
                          >
                            📜 Certificate
                          </button>
                        </div>
                      )}

                      {/* 1st Place */}
                      {overallLeaderboard[0] && (
                        <div className="flex flex-col items-center flex-1 max-w-[240px] transform scale-105">
                          <div className="w-28 h-28 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center text-5xl mb-3 ring-4 ring-amber-300 dark:ring-amber-600 shadow-xl">
                            {overallLeaderboard[0].avatar || '👤'}
                          </div>
                          <div className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-1 text-center">{overallLeaderboard[0].name}</div>
                          <div className="text-5xl mb-2">🥇</div>
                          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-5 w-full border-2 border-amber-200 dark:border-amber-700">
                            <div className="text-4xl font-black text-[#2E7D32] dark:text-emerald-400 text-center">{overallLeaderboard[0].stats.totalPoints.toLocaleString()}</div>
                            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">points</div>
                            <div className="text-sm text-slate-600 dark:text-slate-300 text-center mt-2">
                              {overallLeaderboard[0].stats.averageScore}% avg
                            </div>
                          </div>
                          <button
                            onClick={() => setCertificateStudent(overallLeaderboard[0])}
                            className="mt-3 px-5 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl text-sm font-semibold transition-colors shadow-lg"
                          >
                            📜 Certificate
                          </button>
                        </div>
                      )}

                      {/* 3rd Place */}
                      {overallLeaderboard[2] && (
                        <div className="flex flex-col items-center flex-1 max-w-[200px]">
                          <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center text-3xl mb-3 ring-4 ring-orange-300 dark:ring-orange-700 shadow-lg">
                            {overallLeaderboard[2].avatar || '👤'}
                          </div>
                          <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1 text-center">{overallLeaderboard[2].name}</div>
                          <div className="text-4xl mb-2">🥉</div>
                          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-2xl p-4 w-full border-2 border-orange-200 dark:border-orange-700">
                            <div className="text-2xl font-black text-[#2E7D32] dark:text-emerald-400 text-center">{overallLeaderboard[2].stats.totalPoints.toLocaleString()}</div>
                            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">points</div>
                            <div className="text-sm text-slate-600 dark:text-slate-300 text-center mt-2">
                              {overallLeaderboard[2].stats.averageScore}% avg
                            </div>
                          </div>
                          <button
                            onClick={() => setCertificateStudent(overallLeaderboard[2])}
                            className="mt-3 px-4 py-2 bg-orange-100 dark:bg-orange-900/30 hover:bg-orange-200 dark:hover:bg-orange-900/50 text-orange-700 dark:text-orange-300 rounded-xl text-sm font-semibold transition-colors border-2 border-orange-200 dark:border-orange-700"
                          >
                            📜 Certificate
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Rest of Rankings Card */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="p-6 border-b-2 border-slate-200 dark:border-slate-700 flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#2E7D32]/10 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-[#2E7D32]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      Full Rankings
                    </h3>
                  </div>
                  <div className="divide-y-2 divide-slate-100 dark:divide-slate-700">
                    {overallLeaderboard.length > 3 ? (
                      overallLeaderboard.slice(3).map((student, index) => (
                      <div key={student._id}>
                        <button
                          type="button"
                          onClick={async () => {
                            setExpandedStudentIds((s) => ({ ...s, [student._id]: !s[student._id] }));
                            if (!expandedStudentIds[student._id]) await fetchStudentDetails(student._id);
                          }}
                          className="w-full text-left p-5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex items-center gap-4"
                        >
                          <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center">
                            <span className="text-lg font-black text-slate-500 dark:text-slate-400">#{index + 4}</span>
                          </div>
                          <div className="w-12 h-12 bg-[#2E7D32]/10 rounded-full flex items-center justify-center text-xl">{student.avatar || '👤'}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="text-base font-bold text-slate-900 dark:text-white truncate">{student.name}</div>
                              {student.stats.streak > 3 && (
                                <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs font-bold rounded-lg">🔥 {student.stats.streak}</span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                              <span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg">📊 {student.stats.averageScore}%</span>
                              <span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg">✅ {student.stats.assessmentsCompleted}</span>
                              <span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg">📝 {student.stats.quizzesCompleted}</span>
                              <span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg">📋 {student.stats.examsCompleted}</span>
                            </div>
                            {student.stats.badges.length > 0 && (
                              <div className="flex gap-1 mt-2">{student.stats.badges.slice(0, 5).map((badge, i) => (<span key={i} className="text-base" title={badge}>{getBadgeEmoji(badge)}</span>))}</div>
                            )}
                          </div>
                          <div className="text-right bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 border-2 border-emerald-200 dark:border-emerald-800">
                            <div className="text-xl font-black text-[#2E7D32] dark:text-emerald-400">{student.stats.totalPoints.toLocaleString()}</div>
                            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">points</div>
                          </div>
                        </button>

                        {expandedStudentIds[student._id] && (
                          <div className="p-5 bg-slate-50 dark:bg-slate-900/50 border-t-2 border-slate-100 dark:border-slate-700">
                            {studentDetails[student._id]?.loading ? (
                              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                <div className="w-4 h-4 border-2 border-[#2E7D32] border-t-transparent rounded-full animate-spin"></div>
                                Loading details...
                              </div>
                            ) : studentDetails[student._id]?.error ? (
                              <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{studentDetails[student._id]?.error}</div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border-2 border-slate-200 dark:border-slate-700">
                                  <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                                    <span className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center text-xs">📝</span>
                                    Recent Quizzes
                                  </h4>
                                  {studentDetails[student._id]?.quizzes && studentDetails[student._id]!.quizzes!.length > 0 ? (
                                    <ul className="text-sm space-y-2">
                                      {studentDetails[student._id]!.quizzes!.slice(0,5).map((q) => (
                                        <li key={q._id} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                                          <span className="text-slate-700 dark:text-slate-300 truncate">{q.title}</span>
                                          <span className="font-bold text-[#2E7D32] dark:text-emerald-400">{q.score}{q.maxScore ? `/${q.maxScore}` : ''}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <div className="text-sm text-slate-500 text-center py-4">No recent quizzes found.</div>
                                  )}
                                </div>
                                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border-2 border-slate-200 dark:border-slate-700">
                                  <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                                    <span className="w-6 h-6 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center text-xs">🎯</span>
                                    Recent Activities
                                  </h4>
                                  {studentDetails[student._id]?.activities && studentDetails[student._id]!.activities!.length > 0 ? (
                                    <ul className="text-sm space-y-2">
                                      {studentDetails[student._id]!.activities!.slice(0,5).map((a) => (
                                        <li key={a._id} className="flex justify-between items-center p-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                                          <span className="text-slate-700 dark:text-slate-300 truncate">{a.type}{a.description ? ` — ${a.description}` : ''}</span>
                                          <span className="font-bold text-[#2E7D32] dark:text-emerald-400">{a.points} pts</span>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <div className="text-sm text-slate-500 text-center py-4">No recent activity found.</div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                    ) : (
                      <div className="p-8 text-center">
                        <div className="text-slate-400 dark:text-slate-500 text-lg mb-2">📊</div>
                        <p className="text-slate-600 dark:text-slate-400 font-medium">
                          {overallLeaderboard.length === 0 
                            ? 'No students found in the leaderboard' 
                            : 'All students are shown in the Top Performers section above'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Class View */}
            {view === 'class' && (
              <div className="space-y-6">
                {classes.map((cls) => (
                  <div
                    key={cls._id}
                    className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden"
                  >
                    <div className="p-6 border-b-2 border-slate-200 dark:border-slate-700 flex items-center gap-4">
                      <div className="w-14 h-14 bg-[#2E7D32]/10 rounded-2xl flex items-center justify-center">
                        <svg className="w-7 h-7 text-[#2E7D32]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      </div>
                      <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white">{cls.name}</h2>
                        <p className="text-slate-600 dark:text-slate-400 font-medium">{cls.subject} • {cls.students.length} students</p>
                      </div>
                    </div>
                    <div className="divide-y-2 divide-slate-100 dark:divide-slate-700">
                      {cls.students.map((student, index) => (
                        <div
                          key={student._id}
                          className={`p-5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                            index < 3 ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                              index === 0 ? 'bg-amber-100 dark:bg-amber-900/30' :
                              index === 1 ? 'bg-slate-200 dark:bg-slate-700' :
                              index === 2 ? 'bg-orange-100 dark:bg-orange-900/30' :
                              'bg-slate-100 dark:bg-slate-700'
                            }`}>
                              {getRankEmoji(index + 1)}
                            </div>
                            <div className="w-12 h-12 bg-[#2E7D32]/10 rounded-full flex items-center justify-center text-xl">
                              {student.avatar || '👤'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-base font-bold text-slate-900 dark:text-white mb-1 truncate">
                                {student.name}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                <span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg">📊 {student.stats.averageScore}%</span>
                                <span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg">✅ {student.stats.assessmentsCompleted}</span>
                                <span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg">📝 {student.stats.quizzesCompleted}</span>
                                {student.stats.streak > 0 && (
                                  <span className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-2 py-1 rounded-lg font-bold">🔥 {student.stats.streak}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 border-2 border-emerald-200 dark:border-emerald-800">
                                <div className="text-xl font-black text-[#2E7D32] dark:text-emerald-400">
                                  {student.stats.totalPoints.toLocaleString()}
                                </div>
                                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">points</div>
                              </div>
                              {index < 3 && (
                                <button
                                  onClick={() => setCertificateStudent(student)}
                                  className="px-3 py-3 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl text-sm font-semibold transition-colors shadow-md"
                                >
                                  📜
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Export Options */}
        <div className="mt-8 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border-2 border-slate-200 dark:border-slate-700 p-6">
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button
              onClick={() => {
                // Determine which data to export based on current view
                const dataToExport = view === 'class' 
                  ? classes.flatMap(cls => cls.students.map(s => ({ ...s, className: cls.name, classSubject: cls.subject })))
                  : overallLeaderboard;
                
                if (dataToExport.length === 0) {
                  alert('No data to export');
                  return;
                }
                
                // Build CSV content
                const headers = ['Rank', 'Name', 'Email', 'Total Points', 'Average Score', 'Quizzes Completed', 'Exams Completed', 'Assessments Completed', 'Streak', 'Badges'];
                if (view === 'class') {
                  headers.push('Class Name', 'Subject');
                }
                
                const rows = dataToExport.map((student: any, index: number) => {
                  const row = [
                    student.stats?.rank || index + 1,
                    `"${(student.name || '').replace(/"/g, '""')}"`,
                    `"${(student.email || '').replace(/"/g, '""')}"`,
                    student.stats?.totalPoints || 0,
                    student.stats?.averageScore || 0,
                    student.stats?.quizzesCompleted || 0,
                    student.stats?.examsCompleted || 0,
                    student.stats?.assessmentsCompleted || 0,
                    student.stats?.streak || 0,
                    `"${(student.stats?.badges || []).join(', ')}"`
                  ];
                  if (view === 'class') {
                    row.push(`"${(student.className || '').replace(/"/g, '""')}"`);
                    row.push(`"${(student.classSubject || '').replace(/"/g, '""')}"`);
                  }
                  return row.join(',');
                });
                
                const csvContent = [headers.join(','), ...rows].join('\n');
                
                // Create and download file
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `leaderboard_${view}_${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
              }}
              className="flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 px-6 py-3 rounded-xl font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all hover:shadow-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export to CSV
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}