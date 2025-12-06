"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";
import ConfirmModal from "@/components/molecules/ConfirmModal";

type Quiz = {
  _id: string;
  title: string;
  description?: string;
  category: string;
  published?: boolean;
  classId?: string;
  className?: string;
  createdAt?: string;
  updatedAt?: string;
  dueDate?: string;
  totalPoints?: number;
  questions?: unknown[];
  timeLimitMins?: number;
  settings?: {
    lockdown?: boolean;
    showProgress?: boolean;
    allowBacktrack?: boolean;
  };
};

export default function QuizPage() {
  const router = useRouter();
  const { showError, showSuccess } = useToast();

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "published" | "drafts" | "scheduled">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    isDangerous?: boolean;
    onConfirm: (() => void) | null;
  }>({ open: false, title: "", message: "", isDangerous: false, onConfirm: null });

  const loadQuizzes = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/teacher_page/assessment?category=Quiz`, { 
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        cache: "no-store" 
      });
      
      if (!res.ok) throw new Error(`Failed to load quizzes (${res.status})`);
      const json = await res.json();
      setQuizzes(Array.isArray(json?.data?.assessments) ? json.data.assessments : []);
    } catch (err) {
      showError("Failed to load quizzes", "Load Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuizzes();
  }, [loadQuizzes]);

  const filtered = quizzes.filter((quiz) => {
    if (activeTab === "published") return quiz.published;
    if (activeTab === "drafts") return !quiz.published;
    if (activeTab === "scheduled") return quiz.dueDate && new Date(quiz.dueDate) > new Date();
    return true;
  }).filter((quiz) => {
    if (!searchQuery) return true;
    return quiz.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
           quiz.description?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleDelete = (quizId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmState({
      open: true,
      title: "Delete quiz",
      message: "Are you sure you want to delete this quiz? This cannot be undone.",
      isDangerous: true,
      onConfirm: async () => {
        try {
          const token = localStorage.getItem('accessToken');
          const res = await fetch(`/api/teacher_page/assessment/${quizId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          
          if (res.ok) {
            showSuccess("Quiz deleted successfully", "Success");
            await loadQuizzes();
          } else {
            throw new Error("Failed to delete");
          }
        } catch {
          showError("Failed to delete quiz", "Delete Error");
        }
      },
    });
  };

  const handleDuplicate = async (quiz: Quiz, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/teacher_page/assessment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...quiz,
          title: `${quiz.title} (Copy)`,
          published: false,
          _id: undefined,
          createdAt: undefined,
          updatedAt: undefined,
        }),
      });
      
      if (res.ok) {
        showSuccess("Quiz duplicated successfully", "Success");
        loadQuizzes();
      } else {
        throw new Error("Failed to duplicate");
      }
    } catch (err) {
      showError("Failed to duplicate quiz", "Duplicate Error");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900" style={{ padding: '1.5rem' }}>
      <div style={{ maxWidth: '80rem', marginLeft: 'auto', marginRight: 'auto' }}>
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 style={{ margin: '0 0 0.25rem 0', fontSize: '1.875rem', lineHeight: '2.25rem', fontWeight: 800, color: '#0f172a' }} className="dark:text-[var(--dark-text-primary)]">
                Quizzes
              </h1>
              <p style={{ margin: 0, fontSize: '0.9375rem', color: '#64748b' }} className="dark:text-[var(--dark-text-secondary)]">
                AI-generated interactive quizzes for quick assessments
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/teacher_page/ai-studio?type=quiz')}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-300 flex items-center gap-2"
              >
                <span className="text-xl">✨</span>
                AI Studio - Create Quiz
              </button>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <input
                type="text"
                placeholder="🔍 Search quizzes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
            <div className="flex gap-2 bg-white dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
              {[
                { key: "all", label: "All", icon: "📚" },
                { key: "published", label: "Published", icon: "✅" },
                { key: "drafts", label: "Drafts", icon: "✏️" },
                { key: "scheduled", label: "Scheduled", icon: "📅" }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as "all" | "published" | "drafts" | "scheduled")}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    activeTab === tab.key
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quiz Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 animate-pulse">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                    <div>
                      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-12 mb-1"></div>
                      <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-20"></div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                    <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                  </div>
                </div>
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full mb-1"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-4"></div>
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
                  <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
                  <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-12"></div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
                  <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-full w-24"></div>
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-20"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-700">
            <div className="text-6xl mb-4">📝</div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">No quizzes found</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              {searchQuery ? "Try adjusting your search" : "Create your first quiz to get started!"}
            </p>
            {!searchQuery && (
              <button
                onClick={() => router.push('/teacher_page/ai-studio?type=quiz')}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center gap-2"
              >
                <span className="text-xl">✨</span>
                Generate Quiz with AI Studio
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((quiz) => (
              <div
                key={quiz._id}
                onClick={() => router.push(`/teacher_page/quiz/${quiz._id}`)}
                className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-md hover:shadow-2xl transition-all duration-300 cursor-pointer border border-slate-200 dark:border-slate-700 group hover:-translate-y-1"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center text-xl">
                      📋
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                        QUIZ
                      </div>
                      {quiz.className && (
                        <div className="text-xs text-slate-500">{quiz.className}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => handleDuplicate(quiz, e)}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      title="Duplicate"
                    >
                      📋
                    </button>
                    <button
                      onClick={(e) => handleDelete(quiz._id, e)}
                      className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-blue-600 transition-colors">
                  {quiz.title}
                </h3>
                {quiz.description && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
                    {quiz.description}
                  </p>
                )}

                {/* Stats */}
                <div className="flex items-center gap-4 mb-4 text-sm flex-wrap">
                  <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                    <span>📝</span>
                    <span>{quiz.questions?.length || 0} questions</span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                    <span>⭐</span>
                    <span>{quiz.totalPoints || 0} pts</span>
                  </div>
                  {quiz.timeLimitMins && (
                    <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                      <span>⏱️</span>
                      <span>{quiz.timeLimitMins}m</span>
                    </div>
                  )}
                  {quiz.settings?.lockdown && (
                    <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                      <span>🔒</span>
                      <span>Secure</span>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    {quiz.published ? (
                      <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-semibold">
                        ✅ Published
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-400 rounded-full text-xs font-semibold">
                        ✏️ Draft
                      </span>
                    )}
                    {quiz.dueDate && (
                      <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full text-xs font-semibold">
                        📅 {new Date(quiz.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">
                    {quiz.updatedAt && new Date(quiz.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        isDangerous={confirmState.isDangerous}
        onClose={() => setConfirmState((prev) => ({ ...prev, open: false, onConfirm: null }))}
        onConfirm={() => {
          if (confirmState.onConfirm) {
            void confirmState.onConfirm();
          }
        }}
      />
    </div>
  );
}
