"use client";

import React, { useState, useEffect, useCallback } from "react";
import useAuth from "@/hooks/useAuth";
import { authManager } from "@/utils/auth";

interface LeaderboardStudent {
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
  };
}

type LeaderboardView = 'overall' | 'class' | 'weekly' | 'monthly';
type SortBy = 'points' | 'average' | 'completed' | 'streak';

export default function StudentLeaderboardsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [view, setView] = useState<LeaderboardView>('overall');
  const [sortBy, setSortBy] = useState<SortBy>('points');
  const [leaderboard, setLeaderboard] = useState<LeaderboardStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRank, setMyRank] = useState<number | null>(null);

  const loadLeaderboard = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const response = await authManager.makeAuthenticatedRequest(
        `/api/student_page/leaderboards?view=${view}&sortBy=${sortBy}`,
        { method: 'GET', credentials: 'include' }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setLeaderboard(data.students || []);
          // Find current user's rank
          const currentUserIndex = (data.students || []).findIndex(
            (s: LeaderboardStudent) => s._id === (user as any)._id
          );
          setMyRank(currentUserIndex >= 0 ? currentUserIndex + 1 : null);
        }
      }
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setLoading(false);
    }
  }, [view, sortBy, user]);

  useEffect(() => {
    if (!authLoading && user) {
      loadLeaderboard();
    }
  }, [loadLeaderboard, authLoading, user]);


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

  const isCurrentUser = (studentId: string) => {
    return (user as any)?._id === studentId;
  };

  // Skeleton Loading Component
  const SkeletonLoader = () => (
    <div className="space-y-6">
      {/* Podium Skeleton */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-8">
        <div className="flex items-end justify-center gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center animate-pulse">
              <div className="w-20 h-20 bg-slate-200 dark:bg-slate-700 rounded-full mb-3"></div>
              <div className="h-5 w-24 bg-slate-200 dark:bg-slate-700 rounded mb-2"></div>
              <div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded-full mb-2"></div>
              <div className="h-24 w-32 bg-slate-200 dark:bg-slate-700 rounded-2xl"></div>
            </div>
          ))}
        </div>
      </div>
      {/* Rankings Skeleton */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-6 border-b-2 border-slate-200 dark:border-slate-700">
          <div className="h-6 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="p-5 border-b border-slate-100 dark:border-slate-700 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
              <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
              <div className="flex-1">
                <div className="h-5 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-2"></div>
                <div className="h-4 w-48 bg-slate-200 dark:bg-slate-700 rounded"></div>
              </div>
              <div className="h-16 w-24 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300" style={{ padding: '1.5rem' }}>
      <div style={{ maxWidth: '80rem', marginLeft: 'auto', marginRight: 'auto' }}>
        {/* Header Card */}
        <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-8 mb-8 overflow-hidden">
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#2E7D32]/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-400/5 rounded-full blur-3xl" />
          
          <div className="relative flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2">
                Leaderboards
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-lg">
                See how you rank among your peers
              </p>
            </div>
            {myRank && (
              <div className="bg-[#2E7D32]/10 dark:bg-[#4CAF50]/20 rounded-2xl p-4 border-2 border-[#2E7D32]/20 dark:border-[#4CAF50]/30">
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Your Rank</p>
                <p className="text-3xl font-black text-[#2E7D32] dark:text-[#4CAF50]">
                  {getRankEmoji(myRank)}
                </p>
              </div>
            )}
          </div>
        </div>


        {/* View Tabs */}
        <div className="mb-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex gap-8">
            {[
              { key: 'overall', label: 'Overall' },
              { key: 'class', label: 'My Classes' },
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
        {loading || authLoading ? (
          <SkeletonLoader />
        ) : leaderboard.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border-2 border-slate-200 dark:border-slate-700 p-12 text-center">
            <div className="text-6xl mb-4">🏆</div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Rankings Yet</h3>
            <p className="text-slate-600 dark:text-slate-400">
              Complete quizzes and assessments to appear on the leaderboard!
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Top 3 Podium Card */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-8 overflow-hidden relative">
              {/* Decorative Background */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#2E7D32]/10 rounded-full blur-2xl" />
              
              <div className="relative">
                <div className="text-center mb-8">
                  <div className="text-6xl mb-4">🏆</div>
                  <h2 className="text-3xl font-black text-slate-900 dark:text-white">Top Performers</h2>
                </div>
                
                <div className="flex items-end justify-center gap-6">
                  {/* 2nd Place */}
                  {leaderboard[1] && (
                    <div className={`flex flex-col items-center flex-1 max-w-[200px] ${isCurrentUser(leaderboard[1]._id) ? 'ring-4 ring-[#2E7D32] rounded-3xl p-2' : ''}`}>
                      <div className="w-20 h-20 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center text-3xl mb-3 ring-4 ring-slate-300 dark:ring-slate-600 shadow-lg">
                        {leaderboard[1].avatar || '👤'}
                      </div>
                      <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1 text-center">
                        {leaderboard[1].name}
                        {isCurrentUser(leaderboard[1]._id) && <span className="ml-2 text-[#2E7D32]">(You)</span>}
                      </div>
                      <div className="text-4xl mb-2">🥈</div>
                      <div className="bg-slate-100 dark:bg-slate-700 rounded-2xl p-4 w-full border-2 border-slate-200 dark:border-slate-600">
                        <div className="text-2xl font-black text-[#2E7D32] dark:text-emerald-400 text-center">{leaderboard[1].stats.totalPoints.toLocaleString()}</div>
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">points</div>
                        <div className="text-sm text-slate-600 dark:text-slate-300 text-center mt-2">
                          {leaderboard[1].stats.averageScore}% avg
                        </div>
                      </div>
                    </div>
                  )}


                  {/* 1st Place */}
                  {leaderboard[0] && (
                    <div className={`flex flex-col items-center flex-1 max-w-[240px] transform scale-105 ${isCurrentUser(leaderboard[0]._id) ? 'ring-4 ring-[#2E7D32] rounded-3xl p-2' : ''}`}>
                      <div className="w-28 h-28 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center text-5xl mb-3 ring-4 ring-amber-300 dark:ring-amber-600 shadow-xl">
                        {leaderboard[0].avatar || '👤'}
                      </div>
                      <div className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-1 text-center">
                        {leaderboard[0].name}
                        {isCurrentUser(leaderboard[0]._id) && <span className="ml-2 text-[#2E7D32]">(You)</span>}
                      </div>
                      <div className="text-5xl mb-2">🥇</div>
                      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-5 w-full border-2 border-amber-200 dark:border-amber-700">
                        <div className="text-3xl font-black text-[#2E7D32] dark:text-emerald-400 text-center">{leaderboard[0].stats.totalPoints.toLocaleString()}</div>
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">points</div>
                        <div className="text-sm text-slate-600 dark:text-slate-300 text-center mt-2">
                          {leaderboard[0].stats.averageScore}% avg
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 3rd Place */}
                  {leaderboard[2] && (
                    <div className={`flex flex-col items-center flex-1 max-w-[200px] ${isCurrentUser(leaderboard[2]._id) ? 'ring-4 ring-[#2E7D32] rounded-3xl p-2' : ''}`}>
                      <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center text-3xl mb-3 ring-4 ring-orange-300 dark:ring-orange-700 shadow-lg">
                        {leaderboard[2].avatar || '👤'}
                      </div>
                      <div className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1 text-center">
                        {leaderboard[2].name}
                        {isCurrentUser(leaderboard[2]._id) && <span className="ml-2 text-[#2E7D32]">(You)</span>}
                      </div>
                      <div className="text-4xl mb-2">🥉</div>
                      <div className="bg-orange-50 dark:bg-orange-900/20 rounded-2xl p-4 w-full border-2 border-orange-200 dark:border-orange-700">
                        <div className="text-2xl font-black text-[#2E7D32] dark:text-emerald-400 text-center">{leaderboard[2].stats.totalPoints.toLocaleString()}</div>
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">points</div>
                        <div className="text-sm text-slate-600 dark:text-slate-300 text-center mt-2">
                          {leaderboard[2].stats.averageScore}% avg
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Rest of Rankings Card */}
            {leaderboard.length > 3 && (
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
                  {leaderboard.slice(3).map((student, index) => (
                    <div
                      key={student._id}
                      className={`p-5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex items-center gap-4 ${
                        isCurrentUser(student._id) ? 'bg-[#2E7D32]/5 dark:bg-[#4CAF50]/10 border-l-4 border-[#2E7D32]' : ''
                      }`}
                    >
                      <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center">
                        <span className="text-lg font-black text-slate-500 dark:text-slate-400">#{index + 4}</span>
                      </div>
                      <div className="w-12 h-12 bg-[#2E7D32]/10 rounded-full flex items-center justify-center text-xl">{student.avatar || '👤'}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="text-base font-bold text-slate-900 dark:text-white truncate">
                            {student.name}
                            {isCurrentUser(student._id) && <span className="ml-2 text-[#2E7D32] font-semibold">(You)</span>}
                          </div>
                          {student.stats.streak > 3 && (
                            <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 text-xs font-bold rounded-lg">🔥 {student.stats.streak}</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                          <span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg">📊 {student.stats.averageScore}%</span>
                          <span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg">✅ {student.stats.assessmentsCompleted}</span>
                          <span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg">📝 {student.stats.quizzesCompleted}</span>
                        </div>
                        {student.stats.badges && student.stats.badges.length > 0 && (
                          <div className="flex gap-1 mt-2">{student.stats.badges.slice(0, 5).map((badge, i) => (<span key={i} className="text-base" title={badge}>{getBadgeEmoji(badge)}</span>))}</div>
                        )}
                      </div>
                      <div className="text-right bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 border-2 border-emerald-200 dark:border-emerald-800">
                        <div className="text-xl font-black text-[#2E7D32] dark:text-emerald-400">{student.stats.totalPoints.toLocaleString()}</div>
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">points</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}