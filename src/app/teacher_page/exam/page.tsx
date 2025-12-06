"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";
import ConfirmModal from "@/components/molecules/ConfirmModal";

type Exam = {
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

export default function ExamPage() {
  const router = useRouter();
  const { showError, showSuccess } = useToast();

  const [exams, setExams] = useState<Exam[]>([]);
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

  const loadExams = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/teacher_page/assessment?category=Exam`, { 
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        cache: "no-store" 
      });
      
      if (!res.ok) throw new Error(`Failed to load exams (${res.status})`);
      const json = await res.json();
      setExams(Array.isArray(json?.data?.assessments) ? json.data.assessments : []);
    } catch (err) {
      showError("Failed to load exams", "Load Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExams();
  }, [loadExams]);

  const filtered = exams.filter((exam) => {
    if (activeTab === "published") return exam.published;
    if (activeTab === "drafts") return !exam.published;
    if (activeTab === "scheduled") return exam.dueDate && new Date(exam.dueDate) > new Date();
    return true;
  }).filter((exam) => {
    if (!searchQuery) return true;
    return exam.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
           exam.description?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleDelete = (examId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmState({
      open: true,
      title: "Delete exam",
      message: "Are you sure you want to delete this exam? This cannot be undone.",
      isDangerous: true,
      onConfirm: async () => {
        try {
          const token = localStorage.getItem('accessToken');
          const res = await fetch(`/api/teacher_page/assessment/${examId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          
          if (res.ok) {
            showSuccess("Exam deleted successfully", "Success");
            await loadExams();
          } else {
            throw new Error("Failed to delete");
          }
        } catch {
          showError("Failed to delete exam", "Delete Error");
        }
      },
    });
  };

  const handleDuplicate = async (exam: Exam, e: React.MouseEvent) => {
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
          ...exam,
          title: `${exam.title} (Copy)`,
          published: false,
          _id: undefined,
          createdAt: undefined,
          updatedAt: undefined,
        }),
      });
      
      if (res.ok) {
        showSuccess("Exam duplicated successfully", "Success");
        loadExams();
      } else {
        throw new Error("Failed to duplicate");
      }
    } catch (err) {
      showError("Failed to duplicate exam", "Duplicate Error");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900" style={{ padding: '1.5rem' }}>
      <div style={{ maxWidth: '80rem', marginLeft: 'auto', marginRight: 'auto' }}>
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 style={{ margin: '0 0 0.25rem 0', fontSize: '1.875rem', lineHeight: '2.25rem', fontWeight: 800, color: '#0f172a' }} className="dark:text-[var(--dark-text-primary)]">
                Exams
              </h1>
              <p style={{ margin: 0, fontSize: '0.9375rem', color: '#64748b' }} className="dark:text-[var(--dark-text-secondary)]">
                AI-generated comprehensive exams with advanced security and analytics
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/teacher_page/ai-studio?type=exam')}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 text-white rounded-xl font-semibold hover:shadow-lg hover:scale-105 transition-all duration-300 flex items-center gap-2"
              >
                <span className="text-xl">✨</span>
                AI Studio - Create Exam
              </button>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <input
                type="text"
                placeholder="🔍 Search exams..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all"
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
                      ? "bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-md"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Exam Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-rose-500 border-t-transparent"></div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-700">
            <div className="text-6xl mb-4">📝</div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">No exams found</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              {searchQuery ? "Try adjusting your search" : "Create your first exam to get started!"}
            </p>
            {!searchQuery && (
              <button
                onClick={() => router.push('/teacher_page/ai-studio?type=exam')}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center gap-2"
              >
                <span className="text-xl">✨</span>
                Generate Exam with AI Studio
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((exam) => (
              <div
                key={exam._id}
                onClick={() => router.push(`/teacher_page/exam/${exam._id}`)}
                className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-md hover:shadow-2xl transition-all duration-300 cursor-pointer border border-slate-200 dark:border-slate-700 group hover:-translate-y-1"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-pink-500 rounded-lg flex items-center justify-center text-xl">
                      📋
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                        EXAM
                      </div>
                      {exam.className && (
                        <div className="text-xs text-slate-500">{exam.className}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => handleDuplicate(exam, e)}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      title="Duplicate"
                    >
                      📋
                    </button>
                    <button
                      onClick={(e) => handleDelete(exam._id, e)}
                      className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-rose-600 transition-colors">
                  {exam.title}
                </h3>
                {exam.description && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
                    {exam.description}
                  </p>
                )}

                {/* Stats */}
                <div className="flex items-center gap-4 mb-4 text-sm flex-wrap">
                  <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                    <span>📝</span>
                    <span>{exam.questions?.length || 0} questions</span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                    <span>⭐</span>
                    <span>{exam.totalPoints || 0} pts</span>
                  </div>
                  {exam.timeLimitMins && (
                    <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                      <span>⏱️</span>
                      <span>{exam.timeLimitMins}m</span>
                    </div>
                  )}
                  {exam.settings?.lockdown && (
                    <div className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                      <span>🔒</span>
                      <span>Secure</span>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    {exam.published ? (
                      <span className="px-3 py-1 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-full text-xs font-semibold">
                        ✅ Published
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-400 rounded-full text-xs font-semibold">
                        ✏️ Draft
                      </span>
                    )}
                    {exam.dueDate && (
                      <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-semibold">
                        📅 {new Date(exam.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">
                    {exam.updatedAt && new Date(exam.updatedAt).toLocaleDateString()}
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
