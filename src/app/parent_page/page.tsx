"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";

interface StudentInfo {
  id: string;
  name: string;
  email: string;
  studentNumber: string;
  profileImage?: string;
}

interface ClassInfo {
  id: string;
  name: string;
  classCode: string;
  teacher: {
    name: string;
    email: string;
  };
  courseYear: string;
}

interface AssessmentResult {
  id: string;
  title: string;
  type: 'quiz' | 'exam';
  score: number;
  totalPoints: number;
  percentage: number;
  submittedAt: string;
  className: string;
}

interface ActivitySummary {
  totalClasses: number;
  completedQuizzes: number;
  completedExams: number;
  completedActivities: number;
  averageScore: number;
  totalPoints: number;
  recentActivity: AssessmentResult[];
}

export default function ParentPage() {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [activity, setActivity] = useState<ActivitySummary | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const savedDarkMode = localStorage.getItem('parentDarkMode') === 'true';
    setIsDarkMode(savedDarkMode);
    if (savedDarkMode) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  useEffect(() => {
    fetchParentData();
  }, []);

  const fetchParentData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      
      console.log('Fetching parent data...');
      const response = await fetch('/api/parent/overview', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const result = await response.json();
      console.log('Parent data response:', result);
      
      if (result.success) {
        setStudent(result.data.student);
        setClasses(result.data.classes);
        setActivity(result.data.activity);
        console.log('Data loaded successfully:', {
          student: result.data.student.name,
          classesCount: result.data.classes.length,
          avgScore: result.data.activity.averageScore
        });
      } else {
        console.error('API error:', result.error);
        showError(result.error || 'Failed to load data');
      }
    } catch (error) {
      console.error('Error fetching parent data:', error);
      showError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    localStorage.setItem('parentDarkMode', String(newDarkMode));
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
    window.location.href = '/auth/login?reason=logout';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-400 mb-4">No student linked to this parent account</p>
          <button
            onClick={() => router.push('/auth/login')}
            className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Parent Portal</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">Monitor your child's academic progress</p>
            </div>
            
            <div className="flex items-center gap-4">
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                {isDarkMode ? '☀️' : '🌙'}
              </button>

              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowProfileMenu(!showProfileMenu);
                  }}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white font-semibold">
                    P
                  </div>
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-2 z-50">
                    <button
                      onClick={() => setShowLogoutModal(true)}
                      className="w-full px-4 py-2 text-left text-red-600 dark:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Student Info Card */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white text-2xl font-bold">
              {student.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{student.name}</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">{student.email}</p>
              <p className="text-sm text-slate-500 dark:text-slate-500">Student #: {student.studentNumber}</p>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        {activity && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">Total Classes</h3>
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    📚
                  </div>
                </div>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{activity.totalClasses}</p>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">Average Score</h3>
                  <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    ✅
                  </div>
                </div>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{activity.averageScore.toFixed(1)}%</p>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">Completed</h3>
                  <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    📝
                  </div>
                </div>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{activity.completedQuizzes + activity.completedExams}</p>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400">Total Points</h3>
                  <div className="w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                    ⭐
                  </div>
                </div>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{activity.totalPoints}</p>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-8">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Recent Activity</h3>
              {activity.recentActivity.length > 0 ? (
                <div className="space-y-4">
                  {activity.recentActivity.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900 dark:text-white">{item.title}</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{item.className}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-500">
                          {new Date(item.submittedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{item.percentage.toFixed(0)}%</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{item.score}/{item.totalPoints}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-600 dark:text-slate-400 text-center py-8">No recent activity</p>
              )}
            </div>
          </>
        )}

        {/* Classes */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Enrolled Classes</h3>
          {classes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {classes.map((cls) => (
                <div key={cls.id} className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <h4 className="font-semibold text-slate-900 dark:text-white">{cls.name}</h4>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Code: {cls.classCode}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Teacher: {cls.teacher.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-500">{cls.courseYear}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-600 dark:text-slate-400 text-center py-8">No classes enrolled</p>
          )}
        </div>
      </main>

      {/* Logout Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Confirm Logout</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">Are you sure you want to logout?</p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
