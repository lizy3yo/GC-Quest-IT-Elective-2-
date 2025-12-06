"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface QuickStats {
  totalClasses: number;
  totalStudents: number;
  activeAssessments: number;
  recentActivity: number;
}

export default function TeacherPage() {
  const router = useRouter();
  const [stats, setStats] = useState<QuickStats>({
    totalClasses: 0,
    totalStudents: 0,
    activeAssessments: 0,
    recentActivity: 0
  });

  useEffect(() => {
    const loadQuickStats = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const response = await fetch('/api/teacher_page/quick-stats', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });
        const data = await response.json();
        if (data.success) {
          setStats(data.stats);
        }
      } catch (error) {
        console.error('Failed to load stats:', error);
      }
    };
    loadQuickStats();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 p-6 transition-colors duration-300">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
            Welcome to GC Quest 🎓
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-400">
            Your AI-powered teaching platform for creating engaging content
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {[
            { label: 'Classes', value: stats.totalClasses, icon: '🎓', color: 'from-blue-500 to-cyan-500' },
            { label: 'Students', value: stats.totalStudents, icon: '👥', color: 'from-purple-500 to-pink-500' },
            { label: 'Assessments', value: stats.activeAssessments, icon: '📝', color: 'from-orange-500 to-red-500' },
            { label: 'This Week', value: stats.recentActivity, icon: '📊', color: 'from-green-500 to-teal-500' }
          ].map((stat, idx) => (
            <div key={idx} className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-700">
              <div className={`w-12 h-12 bg-gradient-to-br ${stat.color} rounded-xl flex items-center justify-center text-2xl mb-4`}>
                {stat.icon}
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{stat.value}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* AI Studio - Featured */}
        <div className="bg-gradient-to-br from-purple-900 via-pink-800 to-orange-700 rounded-3xl p-8 shadow-2xl transform hover:scale-[1.02] transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-white/20 backdrop-blur-lg rounded-2xl flex items-center justify-center text-5xl">
                ✨
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">AI Studio</h2>
                <p className="text-white/90 text-lg mb-4">
                  Generate quizzes, exams, flashcards, and live sessions with AI
                </p>
                <div className="flex gap-3 flex-wrap">
                  <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm">
                    📝 Quizzes
                  </span>
                  <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm">
                    🎓 Exams
                  </span>
                  <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm">
                    🗂️ Flashcards
                  </span>
                  <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white text-sm">
                    🔴 Live Sessions
                  </span>
                </div>
              </div>
            </div>
            <Link
              href="/teacher_page/ai-studio"
              className="bg-white text-purple-600 px-8 py-4 rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl transform hover:scale-110 transition-all"
            >
              Launch AI Studio →
            </Link>
          </div>
        </div>

        {/* Main Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Classes */}
          <Link href="/teacher_page/dashboard" className="group">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-md hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
              <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">
                🎓
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Manage Classes
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                Create and organize your classes, add students, and share resources
              </p>
              <div className="flex items-center text-green-600 dark:text-green-400 font-semibold">
                Go to Dashboard →
              </div>
            </div>
          </Link>

          {/* Live Sessions */}
          <Link href="/teacher_page/ai-studio?type=live" className="group">
            <div className="bg-white dark:bg-slate-800 border-2 border-red-200 dark:border-red-800 rounded-2xl p-6 shadow-md hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20">
              <div className="w-14 h-14 bg-gradient-to-br from-red-500 to-pink-500 rounded-2xl flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform animate-pulse">
                🔴
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Live Quiz Sessions
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                Host interactive Kahoot-style live quizzes with real-time leaderboards
              </p>
              <div className="flex items-center text-red-600 dark:text-red-400 font-semibold">
                Create Live Session →
              </div>
            </div>
          </Link>

          {/* Leaderboards */}
          <Link href="/teacher_page/leaderboards" className="group">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-md hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
              <div className="w-14 h-14 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">
                🏆
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Student Leaderboards
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                Track student performance, rankings, and achievements
              </p>
              <div className="flex items-center text-yellow-600 dark:text-yellow-400 font-semibold">
                View Rankings →
              </div>
            </div>
          </Link>

          {/* Quizzes */}
          <Link href="/teacher_page/quiz" className="group">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-md hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">
                🎯
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Quizzes
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                Create quick quizzes with live sessions and instant feedback
              </p>
              <div className="flex items-center text-emerald-600 dark:text-emerald-400 font-semibold">
                Create Quiz →
              </div>
            </div>
          </Link>

          {/* Exams */}
          <Link href="/teacher_page/exam" className="group">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-md hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
              <div className="w-14 h-14 bg-gradient-to-br from-rose-500 to-pink-500 rounded-2xl flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">
                📋
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Exams
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                Create comprehensive exams with advanced settings and security
              </p>
              <div className="flex items-center text-rose-600 dark:text-rose-400 font-semibold">
                Create Exam →
              </div>
            </div>
          </Link>

          {/* History */}
          <Link href="/teacher_page/history" className="group">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-md hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">
                📚
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Activity History
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                View past activities with AI-powered insights and analytics
              </p>
              <div className="flex items-center text-blue-600 dark:text-blue-400 font-semibold">
                View History →
              </div>
            </div>
          </Link>

          {/* Analytics */}
          <Link href="/teacher_page/analytics" className="group">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-md hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
              <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">
                📊
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Analytics
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                Comprehensive analytics and insights on student performance
              </p>
              <div className="flex items-center text-indigo-600 dark:text-indigo-400 font-semibold">
                View Analytics →
              </div>
            </div>
          </Link>
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-700">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button 
              onClick={() => router.push('/teacher_page/ai-studio?type=quiz')}
              className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-center"
            >
              <div className="text-3xl mb-2">📝</div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">Quick Quiz</div>
            </button>
            <button 
              onClick={() => router.push('/teacher_page/ai-studio?type=live')}
              className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-center"
            >
              <div className="text-3xl mb-2">🔴</div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">Start Live</div>
            </button>
            <button 
              onClick={() => router.push('/teacher_page/ai-studio?type=flashcards')}
              className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors text-center"
            >
              <div className="text-3xl mb-2">🗂️</div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">Flashcards</div>
            </button>
            <button 
              onClick={() => router.push('/teacher_page/dashboard')}
              className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors text-center"
            >
              <div className="text-3xl mb-2">➕</div>
              <div className="text-sm font-medium text-slate-900 dark:text-white">New Class</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}