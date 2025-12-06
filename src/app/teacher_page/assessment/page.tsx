"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";
import { Edit2, Trash2, Archive, Download, CheckCircle2 } from "lucide-react";
import ConfirmModal from "@/components/molecules/ConfirmModal";
import Modal from "@/components/molecules/Modal";

type AssessmentItem = {
  _id: string;
  title: string;
  description?: string;
  category: string;
  published?: boolean;
  classId?: string;
  createdAt?: string;
  updatedAt?: string;
  attachments?: unknown[];
  questions?: unknown[];
  totalPoints?: number;
  timeLimitMins?: number;
  dueDate?: string;
  maxAttempts?: number;
  passingScore?: number;
};

type ClassItem = {
  _id: string;
  name?: string;
  subject?: string;
};

export default function AssessmentPage() {
  const router = useRouter();
  const { showError, showSuccess } = useToast();

  const [assessments, setAssessments] = useState<AssessmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "quiz" | "exam" | "drafts">("all");
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    isDangerous?: boolean;
    onConfirm: (() => void) | null;
  }>({ open: false, title: "", message: "", isDangerous: false, onConfirm: null });
  
  const [renameModal, setRenameModal] = useState<{
    open: boolean;
    assessmentId: string;
    currentTitle: string;
  }>({ open: false, assessmentId: "", currentTitle: "" });
  const [newTitle, setNewTitle] = useState("");

  // Check URL parameters or sessionStorage to set initial tab and class
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlTab = params.get('tab');
    const storedTab = sessionStorage.getItem('assessment_tab');
    
    // Priority: URL param > sessionStorage
    const tab = urlTab || storedTab;
    if (tab === 'drafts' || tab === 'quiz' || tab === 'exam' || tab === 'all') {
      setActiveTab(tab as typeof activeTab);
    }
    
    // Auto-select class if classId is provided in URL
    const classId = params.get('classId');
    if (classId) {
      setSelectedClass(classId);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch(`/api/teacher_page/assessment`, {
          cache: "no-store",
          headers: {
            Authorization: token ? `Bearer ${token}` : ''
          }
        });

        if (!res.ok) throw new Error(`Failed to load assessments (${res.status})`);
        const json = await res.json();
        if (!isMounted) return;
        
        // Ensure we have valid assessment data with proper category field
        const assessmentData = Array.isArray(json?.data?.assessments) ? json.data.assessments : [];
        console.log('Loaded assessments:', assessmentData.length, 'items');
        console.log('Assessment details:', assessmentData.map((a: AssessmentItem) => ({ 
          id: a._id, 
          title: a.title, 
          category: a.category,
          questions: a.questions?.length || 0,
          totalPoints: a.totalPoints || 0,
          timeLimitMins: a.timeLimitMins || 0,
          hasDescription: !!a.description
        })));
        
        setAssessments(assessmentData);
      } catch (error) {
        console.error('Error loading assessments:', error);
        showError("Failed to load assessments", "Load Error");
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();

    // load classes for display/filter
    (async function loadClasses() {
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch('/api/teacher_page/class', {
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });
        if (!res.ok) return;
        const json = await res.json();
        const classList = json?.data?.classes || [];
        setClasses(classList);
      } catch {
        // ignore class load errors silently
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [showError]);

  const filtered = assessments.filter((a) => {
    if (selectedClass !== 'all' && (a.classId || '') !== selectedClass) return false;
    if (activeTab === "quiz") return a.category === "Quiz";
    if (activeTab === "exam") return a.category === "Exam";
    if (activeTab === "drafts") return !a.published;
    return true;
  });

  const classMap = useMemo(() => {
    const m = new Map<string, { _id: string; name?: string }>();
    classes.forEach((c) => m.set(c._id, { _id: c._id, name: c.name }));
    return m;
  }, [classes]);

  // Action handlers (placeholder API calls)
  const handleRename = (id: string) => {
    const assessment = assessments.find(a => a._id === id);
    if (!assessment) return;
    setRenameModal({ open: true, assessmentId: id, currentTitle: assessment.title });
    setNewTitle(assessment.title);
    setOpenMenuId(null);
  };

  const handleRenameSubmit = async () => {
    if (!newTitle.trim()) return;
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/teacher_page/assessment/${renameModal.assessmentId}/rename`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ title: newTitle })
      });
      if (!res.ok) throw new Error('Failed to rename');
      setAssessments(prev => prev.map(p => p._id === renameModal.assessmentId ? { ...p, title: newTitle } : p));
      setRenameModal({ open: false, assessmentId: "", currentTitle: "" });
      setNewTitle("");
      showSuccess('Renamed successfully', 'Success');
    } catch {
      showError('Failed to rename assessment', 'Rename Error');
    }
  };

  const handleDelete = (id: string) => {
    setConfirmState({
      open: true,
      title: "Delete assessment",
      message: "Delete this assessment? This cannot be undone.",
      isDangerous: true,
      onConfirm: async () => {
        try {
          const token = localStorage.getItem('accessToken');
          const res = await fetch(`/api/teacher_page/assessment/${id}`, {
            method: 'DELETE',
            headers: { Authorization: token ? `Bearer ${token}` : '' }
          });
          if (!res.ok) throw new Error('Failed to delete');
          setAssessments(prev => prev.filter(p => p._id !== id));
          setOpenMenuId(null);
          showSuccess('Deleted', 'Success');
        } catch {
          showError('Failed to delete assessment', 'Delete Error');
        }
      }
    });
  };

  const handleArchive = (id: string) => {
    setConfirmState({
      open: true,
      title: "Archive assessment",
      message: "Archive this assessment? You can still find it in archived items.",
      isDangerous: false,
      onConfirm: async () => {
        try {
          const token = localStorage.getItem('accessToken');
          const res = await fetch(`/api/teacher_page/assessment/${id}/archive`, {
            method: 'POST',
            headers: { Authorization: token ? `Bearer ${token}` : '' }
          });
          if (!res.ok) throw new Error('Failed to archive');
          // For now, remove from list to simulate archiving
          setAssessments(prev => prev.filter(p => p._id !== id));
          setOpenMenuId(null);
          showSuccess('Archived', 'Success');
        } catch {
          showError('Failed to archive assessment', 'Archive Error');
        }
      }
    });
  };

  const handleExport = async (id: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/teacher_page/assessment/${id}/export-results`, {
        method: 'GET',
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      });
      if (!res.ok) throw new Error('Failed to export');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${id}-results.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setOpenMenuId(null);
      showSuccess('Export started', 'Success');
    } catch {
      showError('Failed to export results', 'Export Error');
    }
  };

  const handleTogglePublish = (id: string, currentStatus: boolean | undefined) => {
    const nextStatus = !currentStatus;
    const confirmMessage = nextStatus
      ? 'Publish this assessment? Students will be able to access it.'
      : 'Unpublish this assessment? Students will no longer be able to access it.';
    setConfirmState({
      open: true,
      title: nextStatus ? "Publish assessment" : "Unpublish assessment",
      message: confirmMessage,
      isDangerous: !nextStatus,
      onConfirm: async () => {
        try {
          const token = localStorage.getItem('accessToken');
          const res = await fetch(`/api/teacher_page/assessment/${id}/publish`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({ published: nextStatus })
          });

          if (!res.ok) throw new Error('Failed to update publish status');
          await res.json();

          setAssessments(prev =>
            prev.map(p => (p._id === id ? { ...p, published: nextStatus } : p))
          );
          setOpenMenuId(null);
          showSuccess(nextStatus ? 'Published successfully' : 'Unpublished successfully');
        } catch {
          showError('Failed to update publish status', 'Publish Error');
        }
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900" style={{ padding: '1.5rem' }}>
      <div style={{ maxWidth: '80rem', marginLeft: 'auto', marginRight: 'auto' }}>
        {/* Header Card */}
        <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-8 mb-8 overflow-hidden">
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#2E7D32]/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-400/5 rounded-full blur-3xl" />
          
          <div className="relative">
            <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2">
              Assessments
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              Create, upload, and manage quizzes and exams. AI Studio-generated quizzes and exams open here.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex gap-8">
            {[
              { key: "all", label: "All" },
              { key: "quiz", label: "Quiz" },
              { key: "exam", label: "Exam" },
              { key: "drafts", label: "Drafts" }
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key as typeof activeTab)}
                className={`py-3 text-sm font-medium transition-colors relative ${
                  activeTab === t.key
                    ? 'text-[#2E7D32] dark:text-[#4CAF50]'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {t.label}
                {activeTab === t.key && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2E7D32] dark:bg-[#4CAF50] rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Filter & Create Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border-2 border-slate-200 dark:border-slate-700 p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Filter by class</span>
              <select
                id="assessment-class-filter"
                className="text-sm border-2 border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/50 focus:border-[#2E7D32] font-medium"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
              >
                <option value="all">All classes</option>
                {classes.map((cls) => (
                  <option key={cls._id} value={cls._id}>
                    {cls.name}{cls.subject ? ` - ${cls.subject}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Create Button */}
            <button
              onClick={() => router.push('/teacher_page/ai-studio')}
              className="px-5 py-2.5 bg-[#2E7D32] text-white rounded-xl hover:bg-[#1B5E20] dark:bg-[hsl(142.1,76.2%,36.3%)] dark:hover:bg-[hsl(142.1,76.2%,30%)] text-sm font-semibold flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create
            </button>
          </div>
        </div>

      <div>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-5 animate-pulse"
              >
                {/* Header badges skeleton */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-full w-14"></div>
                    <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-full w-24"></div>
                  </div>
                  <div className="h-6 w-6 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                </div>

                {/* Title skeleton */}
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2"></div>

                {/* Description skeleton */}
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full mb-1"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-3"></div>

                {/* Details skeleton */}
                <div className="flex gap-3 mb-2">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-20"></div>
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
                </div>

                {/* Date skeleton */}
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24 mb-3"></div>

                {/* Footer skeleton */}
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-20"></div>
                  <div className="h-7 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            {filtered.length === 0 ? (
              <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border-2 border-slate-200 dark:border-slate-700 p-12 text-center">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">No assessments found</h3>
                <p className="text-slate-600 dark:text-slate-400 mb-6">No assessments found for the selected tab. Create one using AI Studio.</p>
                <button onClick={() => router.push('/teacher_page/ai-studio')} className="px-6 py-3 bg-[#2E7D32] text-white rounded-xl font-semibold hover:bg-[#1B5E20] shadow-md hover:shadow-lg transition-all">Open AI Studio</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filtered.map((a) => {
                  // Route to quiz/exam detail pages based on category
                  const detailPath = a.category === 'Quiz' 
                    ? `/teacher_page/quiz/${a._id}`
                    : a.category === 'Exam'
                    ? `/teacher_page/exam/${a._id}`
                    : `/teacher_page/assessment/${a._id}`;
                  
                  return (
                    <div key={a._id} className="relative bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-5 hover:shadow-xl hover:border-[#2E7D32]/30 transition-all cursor-pointer group" onClick={() => {
                      // Store current tab before navigating
                      sessionStorage.setItem('assessment_tab', activeTab);
                      router.push(detailPath);
                    }}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 overflow-hidden">
                          {/* Assessment type badge (amber) */}
                          <span
                            className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                          >
                            {a.category}
                          </span>
                          {/* Class name badge (blue) */}
                          {(a.classId && classMap.get(a.classId)) || a.classId ? (
                            <span
                              className="inline-flex max-w-sm flex-none items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 whitespace-nowrap overflow-hidden text-ellipsis"
                              title={(a.classId && classMap.get(a.classId)?.name) || a.classId}
                            >
                              {(a.classId && classMap.get(a.classId)?.name) || a.classId}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <button
                              onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === a._id ? null : a._id); }}
                              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 dark:text-gray-500 hover:text-[#2E7D32] dark:hover:text-[hsl(142.1,76.2%,36.3%)] transition-all"
                              aria-label="More"
                            >
                              <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                            </button>
                            {openMenuId === a._id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg z-20"
                              >
                                <button
                                  onClick={() => handleRename(a._id)}
                                  className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-white hover:bg-[#E8F5E9] hover:text-[#2E7D32] dark:hover:bg-[#1C2B1C] dark:hover:text-[#04C40A] rounded-t-xl flex items-center gap-2"
                                >
                                  <Edit2 className="w-4 h-4" />
                                  Rename
                                </button>
                                <button
                                  onClick={() => handleTogglePublish(a._id, a.published)}
                                  className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-white hover:bg-[#E8F5E9] hover:text-[#2E7D32] dark:hover:bg-[#1C2B1C] dark:hover:text-[#04C40A] flex items-center gap-2"
                                >
                                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                                  {a.published ? 'Unpublish' : 'Publish'}
                                </button>
                                <button
                                  onClick={() => handleArchive(a._id)}
                                  className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-white hover:bg-[#E8F5E9] hover:text-[#2E7D32] dark:hover:bg-[#1C2B1C] dark:hover:text-[#04C40A] flex items-center gap-2"
                                >
                                  <Archive className="w-4 h-4" />
                                  Archive
                                </button>
                                <button
                                  onClick={() => handleExport(a._id)}
                                  className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-white hover:bg-[#E8F5E9] hover:text-[#2E7D32] dark:hover:bg-[#1C2B1C] dark:hover:text-[#04C40A] flex items-center gap-2"
                                >
                                  <Download className="w-4 h-4" />
                                  Export results
                                </button>
                                <div className="h-px bg-gray-100 dark:bg-slate-700 mx-2" />
                                <button
                                  onClick={() => handleDelete(a._id)}
                                  className="w-full text-left px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-b-xl flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <h3 className="font-semibold text-lg mb-1">{a.title}</h3>
                      
                      {/* Description */}
                      {a.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2 line-clamp-2">
                          {a.description}
                        </p>
                      )}
                      
                      {/* Assessment details */}
                      <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400 mb-2">
                        {a.questions && a.questions.length > 0 && (
                          <div className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span>{a.questions.length} question{a.questions.length !== 1 ? 's' : ''}</span>
                          </div>
                        )}
                        {a.totalPoints !== undefined && a.totalPoints > 0 && (
                          <div className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                            <span>{a.totalPoints} pts</span>
                          </div>
                        )}
                        {a.timeLimitMins !== undefined && a.timeLimitMins > 0 && (
                          <div className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{a.timeLimitMins} min{a.timeLimitMins !== 1 ? 's' : ''}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="text-xs text-slate-400 mb-2">
                        {a.updatedAt ? new Date(a.updatedAt).toLocaleDateString() : 'recent'}
                      </div>
                      
                      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs px-2 py-1 rounded ${a.published
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                            }`}
                          >
                            {a.published ? '✓ Published' : 'Draft'}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePublish(a._id, a.published);
                          }}
                          className={`text-xs px-3 py-1.5 rounded transition-colors ${
                            a.published
                              ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                              : 'bg-[#2E7D32] text-white hover:bg-[#1B5E20] dark:bg-[hsl(142.1,76.2%,36.3%)] dark:hover:bg-[hsl(142.1,76.2%,30%)]'
                          }`}
                        >
                          {a.published ? 'Unpublish' : 'Publish'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        </div>
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

      <Modal
        isOpen={renameModal.open}
        onClose={() => {
          setRenameModal({ open: false, assessmentId: "", currentTitle: "" });
          setNewTitle("");
        }}
        title="Rename Assessment"
        maxWidth="max-w-md"
        footer={
          <div className="flex gap-3">
            <button
              onClick={() => {
                setRenameModal({ open: false, assessmentId: "", currentTitle: "" });
                setNewTitle("");
              }}
              className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleRenameSubmit}
              disabled={!newTitle.trim()}
              className="px-6 py-2 bg-[#2E7D32] text-white rounded-lg hover:bg-[#1B5E20] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="assessment-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Assessment Title
            </label>
            <input
              id="assessment-title"
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTitle.trim()) {
                  handleRenameSubmit();
                }
              }}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent"
              placeholder="Enter new title"
              autoFocus
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}