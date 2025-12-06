"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";
import ConfirmModal from "@/components/molecules/ConfirmModal";

type FlashcardItem = {
  _id: string;
  title: string;
  description?: string;
  subject?: string;
  cards?: Array<{ _id: string; question: string; answer: string }>;
  createdAt?: string;
  updatedAt?: string;
  accessType?: 'private' | 'public';
};

type SummaryItem = {
  _id: string;
  title: string;
  content?: string;
  subject?: string;
  createdAt?: string;
  updatedAt?: string;
  isPublic?: boolean;
};

export default function TeacherLibraryPage() {
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  const [flashcards, setFlashcards] = useState<FlashcardItem[]>([]);
  const [summaries, setSummaries] = useState<SummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<"all" | "flashcards" | "summaries">("all");
  
  // Check URL parameters on mount to set initial tab
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlTab = params.get('tab');
    if (urlTab && ["all", "flashcards", "summaries"].includes(urlTab)) {
      setActiveTab(urlTab as "all" | "flashcards" | "summaries");
    }
  }, []);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameItemId, setRenameItemId] = useState<string | null>(null);
  const [renameItemType, setRenameItemType] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>("all");
  const [classes, setClasses] = useState<any[]>([]);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    isDangerous?: boolean;
    onConfirm: (() => void) | null;
  }>({ open: false, title: "", message: "", isDangerous: false, onConfirm: null });

  // Load teacher's classes for filtering
  useEffect(() => {
    const loadClasses = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const response = await fetch('/api/teacher_page/class', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });
        const data = await response.json();
        if (data.success) {
          setClasses(data.data?.classes || []);
        }
      } catch (error) {
        console.error('Failed to load classes:', error);
      }
    };
    loadClasses();
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (openMenuId) setOpenMenuId(null);
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuId]);

  useEffect(() => {
    let isMounted = true;

    // Read query params client-side on mount to avoid prerender-time hook issues
    let createdId: string | null = null;
    let createdType: string | null = null;
    if (typeof window !== "undefined") {
      try {
        const sp = new URLSearchParams(window.location.search);
        createdId = sp.get("createdId");
        createdType = sp.get("type");
      } catch (e) {
        // ignore
      }
    }

    async function load() {
      setLoading(true);
      try {
        // Determine user id (teacher) via JWT or localStorage fallback
        let uid: string | null = null;
        try {
          const token = localStorage.getItem("accessToken");
          if (token) {
            const currentRes = await fetch("/api/v1/users/current", {
              credentials: "include",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
            });
            if (currentRes.ok) {
              const currentJson = await currentRes.json();
              uid = currentJson?.user?._id ?? null;
            }
          }
        } catch (err) {
          // ignore
        }

        if (!uid) uid = localStorage.getItem("userId") || null;
        if (!uid) {
          // generate dev id
          uid = `temp-user-${Date.now()}`;
          localStorage.setItem("userId", uid);
        }

        // Fetch flashcards and summaries from student APIs (they accept userId)
        const [fcRes, sRes] = await Promise.all([
          fetch(`/api/student_page/flashcard?userId=${uid}`, { cache: "no-store" }),
          fetch(`/api/student_page/summary?userId=${uid}`, { cache: "no-store" })
        ]);

        if (!isMounted) return;

        if (fcRes.ok) {
          const fcJson = await fcRes.json().catch(() => ({} as any));
          setFlashcards(Array.isArray(fcJson?.flashcards) ? fcJson.flashcards : []);
        } else {
          console.warn("Failed to load flashcards for teacher library");
          setFlashcards([]);
        }

        if (sRes.ok) {
          const sJson = await sRes.json().catch(() => ({} as unknown));
          setSummaries(Array.isArray(sJson?.summaries) ? sJson.summaries : []);
        } else {
          setSummaries([]);
        }

        // If we were navigated here with a createdId, show a success toast
        if (createdId && createdType) {
          showSuccess(`New ${createdType} created — added to Library`);
        }
      } catch (err) {
        console.error(err);
        if (isMounted) showError("Failed to load library items");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const combined = useMemo(() => {
    const f = flashcards.map((fc) => ({
      id: fc._id,
      type: "flashcards",
      title: fc.title,
      subject: fc.subject,
      updatedAt: fc.updatedAt || fc.createdAt,
      isPublished: fc.accessType === 'public'
    }));
    const s = summaries.map((su) => ({
      id: su._id,
      type: "summary",
      title: su.title,
      subject: su.subject,
      updatedAt: su.updatedAt || su.createdAt,
      isPublished: su.isPublic === true
    }));
    
    let items = [...f, ...s];
    
    // Filter by selected class
    if (selectedClassFilter !== "all") {
      const selectedClass = classes.find(c => c._id === selectedClassFilter);
      if (selectedClass) {
        // Filter by matching subject with class subject (case-insensitive)
        items = items.filter(item => 
          item.subject && 
          item.subject.toLowerCase().trim() === selectedClass.subject.toLowerCase().trim()
        );
      }
    }
    
    return items.sort((a, b) => (new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()));
  }, [flashcards, summaries, selectedClassFilter, classes]);

  const handleTogglePublish = async (itemId: string, itemType: string, currentStatus: boolean) => {
    try {
      const endpoint = itemType === 'flashcards' 
        ? `/api/teacher_page/flashcard/${itemId}/publish`
        : `/api/teacher_page/summary/${itemId}/publish`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          publish: !currentStatus
        })
      });

      const result = await response.json();

      if (result.success) {
        // Update local state
        if (itemType === 'flashcards') {
          setFlashcards(prev => prev.map(fc => 
            fc._id === itemId 
              ? { ...fc, accessType: !currentStatus ? 'public' : 'private' }
              : fc
          ));
        } else {
          setSummaries(prev => prev.map(sm => 
            sm._id === itemId 
              ? { ...sm, isPublic: !currentStatus }
              : sm
          ));
        }

        showSuccess(!currentStatus ? 'Published successfully' : 'Unpublished successfully');
      } else {
        showError(result.error || 'Failed to update publish status');
      }
    } catch (error) {
      console.error('Error toggling publish status:', error);
      showError('Failed to update publish status');
    }
  };

  const handleRename = (itemId: string, itemType: string, currentTitle: string) => {
    setRenameItemId(itemId);
    setRenameItemType(itemType);
    setNewTitle(currentTitle);
    setRenameModalOpen(true);
    setOpenMenuId(null);
  };

  const handleRenameSubmit = async () => {
    if (!renameItemId || !renameItemType || !newTitle.trim()) return;

    try {
      const endpoint = renameItemType === 'flashcards'
        ? `/api/teacher_page/flashcard/${renameItemId}`
        : `/api/teacher_page/summary/${renameItemId}`;

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({ title: newTitle.trim() })
      });

      const result = await response.json();

      if (result.success) {
        if (renameItemType === 'flashcards') {
          setFlashcards(prev => prev.map(fc =>
            fc._id === renameItemId ? { ...fc, title: newTitle.trim() } : fc
          ));
        } else {
          setSummaries(prev => prev.map(sm =>
            sm._id === renameItemId ? { ...sm, title: newTitle.trim() } : sm
          ));
        }
        showSuccess('Renamed successfully');
        setRenameModalOpen(false);
      } else {
        showError(result.error || 'Failed to rename');
      }
    } catch (error) {
      console.error('Error renaming:', error);
      showError('Failed to rename');
    }
  };

  const handleDelete = (itemId: string, itemType: string) => {
    setConfirmState({
      open: true,
      title: "Delete item",
      message: "Are you sure you want to delete this item? This action cannot be undone.",
      isDangerous: true,
      onConfirm: async () => {
        try {
          const endpoint = itemType === 'flashcards'
            ? `/api/teacher_page/flashcard/${itemId}`
            : `/api/teacher_page/summary/${itemId}`;

          const response = await fetch(endpoint, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
            }
          });

          const result = await response.json();

          if (result.success) {
            if (itemType === 'flashcards') {
              setFlashcards(prev => prev.filter(fc => fc._id !== itemId));
            } else {
              setSummaries(prev => prev.filter(sm => sm._id !== itemId));
            }
            showSuccess('Deleted successfully');
            setOpenMenuId(null);
          } else {
            showError(result.error || 'Failed to delete');
          }
        } catch (error) {
          console.error('Error deleting:', error);
          showError('Failed to delete');
        }
      },
    });
  };

  const handleCreateFlashcard = (summaryId: string) => {
    // Navigate to AI Studio to create flashcards from this summary
    router.push(`/teacher_page/ai-studio-resources?type=flashcards&summaryId=${summaryId}`);
    setOpenMenuId(null);
  };

  const handleArchive = async (itemId: string, itemType: string) => {
    showError('Archive functionality coming soon');
    setOpenMenuId(null);
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
              Library
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              Manage flashcards and summaries created or uploaded by you.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex gap-8">
            {[
              { key: "all", label: "All Items" },
              { key: "flashcards", label: "Flashcards" },
              { key: "summaries", label: "Summaries" }
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key as any)}
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
                id="library-class-filter"
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="text-sm border-2 border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/50 focus:border-[#2E7D32] font-medium"
              >
                <option value="all">All Classes</option>
                {classes.map((cls) => (
                  <option key={cls._id} value={cls._id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Create Button */}
            <button
              onClick={() => {
                const type = activeTab === "summaries" ? "summary" : "flashcards";
                router.push(`/teacher_page/ai-studio-resources?type=${type}`);
              }}
              className="px-5 py-2.5 bg-[#2E7D32] text-white rounded-xl hover:bg-[#1B5E20] dark:bg-[hsl(142.1,76.2%,36.3%)] dark:hover:bg-[hsl(142.1,76.2%,30%)] text-sm font-semibold flex items-center gap-2 shadow-md hover:shadow-lg transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {activeTab === "all" ? "Create New" : `Create ${activeTab === "summaries" ? "Summary" : "Flashcards"}`}
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
                {/* Icon skeleton */}
                <div className="w-12 h-12 bg-slate-200 dark:bg-slate-700 rounded-xl mb-4"></div>

                {/* Badges skeleton */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-lg w-20"></div>
                  <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-lg w-16"></div>
                </div>

                {/* Title skeleton */}
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2"></div>

                {/* Date skeleton */}
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32 mb-4"></div>

                {/* Footer skeleton */}
                <div className="mt-4 pt-4 border-t-2 border-slate-100 dark:border-slate-700 flex items-center justify-between">
                  <div className="h-7 bg-slate-200 dark:bg-slate-700 rounded-lg w-20"></div>
                  <div className="h-9 bg-slate-200 dark:bg-slate-700 rounded-xl w-20"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {activeTab === "all" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {combined.length === 0 && (
                  <div className="col-span-full bg-white dark:bg-slate-800 rounded-3xl shadow-xl border-2 border-slate-200 dark:border-slate-700 p-12 text-center">
                    <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">No library items yet</h3>
                    <p className="text-slate-600 dark:text-slate-400 mb-6">Use AI Studio or Upload to create flashcards and summaries.</p>
                    <button onClick={() => router.push('/teacher_page/ai-studio')} className="px-6 py-3 bg-[#2E7D32] text-white rounded-xl font-semibold hover:bg-[#1B5E20] shadow-md hover:shadow-lg transition-all">Open AI Studio</button>
                  </div>
                )}

                {combined.map((item) => (
                  <div 
                    key={`${item.type}-${item.id}`} 
                    className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-5 hover:shadow-xl hover:border-[#2E7D32]/30 transition-all relative group"
                  >
                    {/* Ellipsis Menu Button */}
                    <div className="absolute top-4 right-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === item.id ? null : item.id);
                        }}
                        className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-[#2E7D32] transition-all"
                        aria-label="More"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </button>

                      {/* Dropdown Menu */}
                      {openMenuId === item.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-20 overflow-hidden">
                          <button
                            onClick={() => handleRename(item.id, item.type, item.title)}
                            className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 dark:text-white hover:bg-emerald-50 hover:text-[#2E7D32] dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400 flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            Rename
                          </button>
                          <button
                            onClick={() => {
                              handleTogglePublish(item.id, item.type, item.isPublished);
                              setOpenMenuId(null);
                            }}
                            className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 dark:text-white hover:bg-emerald-50 hover:text-[#2E7D32] dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400 flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            {item.isPublished ? 'Unpublish' : 'Publish'}
                          </button>
                          {item.type === 'summary' && (
                            <button
                              onClick={() => handleCreateFlashcard(item.id)}
                              className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 dark:text-white hover:bg-emerald-50 hover:text-[#2E7D32] dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                              Create Flashcard
                            </button>
                          )}
                          <button
                            onClick={() => handleArchive(item.id, item.type)}
                            className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 dark:text-white hover:bg-emerald-50 hover:text-[#2E7D32] dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400 flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                            Archive
                          </button>
                          <div className="h-px bg-slate-100 dark:bg-slate-700 mx-3" />
                          <button
                            onClick={() => handleDelete(item.id, item.type)}
                            className="w-full text-left px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            Delete
                          </button>
                        </div>
                      )}
                    </div>

                    <div 
                      className="cursor-pointer pr-8"
                      onClick={() => {
                        if (item.type === 'flashcards') {
                          router.push(`/teacher_page/library/${item.id}?tab=${activeTab}`);
                        } else if (item.type === 'summary') {
                          router.push(`/teacher_page/summaries/${item.id}?tab=${activeTab}`);
                        }
                      }}
                    >
                      {/* Type Icon */}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                        item.type === 'flashcards' 
                          ? 'bg-amber-100 dark:bg-amber-900/30' 
                          : 'bg-blue-100 dark:bg-blue-900/30'
                      }`}>
                        {item.type === 'flashcards' ? (
                          <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                        ) : (
                          <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        )}
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-2 flex-wrap mb-3">
                        <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          item.type === 'flashcards' 
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' 
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        }`}>
                          {item.type === 'flashcards' ? 'Flashcards' : 'Summary'}
                        </span>
                        {item.subject && (
                          <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                            {item.subject}
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2 line-clamp-2">{item.title}</h3>
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Updated {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : 'recently'}
                      </div>
                    </div>
                    
                    {/* Footer */}
                    <div className="mt-4 pt-4 border-t-2 border-slate-100 dark:border-slate-700 flex items-center justify-between">
                      <span className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${
                        item.isPublished 
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' 
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                      }`}>
                        {item.isPublished ? '✓ Published' : 'Draft'}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTogglePublish(item.id, item.type, item.isPublished);
                        }}
                        className={`text-xs px-4 py-2 rounded-xl font-semibold transition-all ${
                          item.isPublished 
                            ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                            : 'bg-[#2E7D32] text-white hover:bg-[#1B5E20] shadow-md hover:shadow-lg'
                        }`}
                      >
                        {item.isPublished ? 'Unpublish' : 'Publish'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "flashcards" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(() => {
                  let filteredFlashcards = flashcards;
                  if (selectedClassFilter !== "all") {
                    const selectedClass = classes.find(c => c._id === selectedClassFilter);
                    if (selectedClass) {
                      filteredFlashcards = flashcards.filter(fc => 
                        fc.subject && 
                        fc.subject.toLowerCase().trim() === selectedClass.subject.toLowerCase().trim()
                      );
                    }
                  }
                  return filteredFlashcards.length === 0 ? (
                    <div className="col-span-full text-center py-12">
                      <p className="text-slate-600 dark:text-slate-400">
                        {selectedClassFilter !== "all" 
                          ? "No flashcards found for this class." 
                          : "No flashcards yet. Use AI Studio to create flashcards."}
                      </p>
                      <div className="mt-4">
                        <button onClick={() => router.push('/teacher_page/ai-studio-resources?type=flashcards')} className="px-4 py-2 bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] text-white rounded-lg hover:bg-[#1B5E20] dark:hover:bg-[hsl(142.1,76.2%,30%)]">Create Flashcards</button>
                      </div>
                    </div>
                  ) : (
                    filteredFlashcards.map((fc) => {
                    const item = {
                      id: fc._id,
                      type: "flashcards",
                      title: fc.title,
                      subject: fc.subject,
                      updatedAt: fc.updatedAt || fc.createdAt,
                      isPublished: fc.accessType === 'public'
                    };
                    return (
                      <div 
                        key={item.id} 
                        className={`bg-white dark:bg-slate-800 border rounded-2xl p-4 hover:shadow-lg transition-shadow relative`}
                      >
                        {/* Ellipsis Menu Button */}
                        <div className="absolute top-4 right-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === item.id ? null : item.id);
                            }}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                          >
                            <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                            </svg>
                          </button>
                          
                          {/* Dropdown Menu */}
                          {openMenuId === item.id && (
                            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-10">
                              <button
                                onClick={() => handleRename(item.id, item.type, item.title)}
                                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                              >
                                Rename
                              </button>
                              <button
                                onClick={() => {
                                  handleTogglePublish(item.id, item.type, item.isPublished);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                              >
                                {item.isPublished ? 'Unpublish' : 'Publish'}
                              </button>
                              <button
                                onClick={() => handleArchive(item.id, item.type)}
                                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                              >
                                Archive
                              </button>
                              <button
                                onClick={() => handleDelete(item.id, item.type)}
                                className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>

                        <div 
                          className="cursor-pointer pr-8"
                          onClick={() => router.push(`/teacher_page/library/${item.id}`)}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-sm text-slate-500 dark:text-slate-400 capitalize">Flashcards</div>
                          </div>
                          {item.subject && (
                            <div className="text-sm text-slate-600 dark:text-slate-300 mb-2">{item.subject}</div>
                          )}
                          <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                          <div className="text-xs text-slate-400">Updated {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : 'recently'}</div>
                        </div>
                        
                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-1 rounded ${item.isPublished ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>
                              {item.isPublished ? '✓ Published' : 'Draft'}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTogglePublish(item.id, item.type, item.isPublished);
                            }}
                            className={`text-xs px-3 py-1.5 rounded transition-colors ${
                              item.isPublished 
                                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                                : 'bg-[#2E7D32] text-white hover:bg-[#1B5E20] dark:bg-[hsl(142.1,76.2%,36.3%)] dark:hover:bg-[hsl(142.1,76.2%,30%)]'
                            }`}
                          >
                            {item.isPublished ? 'Unpublish' : 'Publish'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                  );
                })()}
              </div>
            )}

            {activeTab === "summaries" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(() => {
                  let filteredSummaries = summaries;
                  if (selectedClassFilter !== "all") {
                    const selectedClass = classes.find(c => c._id === selectedClassFilter);
                    if (selectedClass) {
                      filteredSummaries = summaries.filter(sm => 
                        sm.subject && 
                        sm.subject.toLowerCase().trim() === selectedClass.subject.toLowerCase().trim()
                      );
                    }
                  }
                  return filteredSummaries.length === 0 ? (
                    <div className="col-span-full text-center py-12">
                      <p className="text-slate-600 dark:text-slate-400">
                        {selectedClassFilter !== "all" 
                          ? "No summaries found for this class." 
                          : "No summaries yet. Use AI Studio to create summaries."}
                      </p>
                      <div className="mt-4">
                        <button onClick={() => router.push('/teacher_page/ai-studio-resources?type=summary')} className="px-4 py-2 bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] text-white rounded-lg hover:bg-[#1B5E20] dark:hover:bg-[hsl(142.1,76.2%,30%)]">Create Summary</button>
                      </div>
                    </div>
                  ) : (
                    filteredSummaries.map((sm) => {
                    const item = {
                      id: sm._id,
                      type: "summary",
                      title: sm.title,
                      subject: sm.subject,
                      updatedAt: sm.updatedAt || sm.createdAt,
                      isPublished: sm.isPublic === true
                    };
                    return (
                      <div 
                        key={item.id} 
                        className={`bg-white dark:bg-slate-800 border rounded-2xl p-4 hover:shadow-lg transition-shadow relative`}
                      >
                        {/* Ellipsis Menu Button */}
                        <div className="absolute top-4 right-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === item.id ? null : item.id);
                            }}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                          >
                            <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                            </svg>
                          </button>
                          
                          {/* Dropdown Menu */}
                          {openMenuId === item.id && (
                            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-10">
                              <button
                                onClick={() => handleRename(item.id, item.type, item.title)}
                                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                              >
                                Rename
                              </button>
                              <button
                                onClick={() => {
                                  handleTogglePublish(item.id, item.type, item.isPublished);
                                  setOpenMenuId(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                              >
                                {item.isPublished ? 'Unpublish' : 'Publish'}
                              </button>
                              <button
                                onClick={() => handleCreateFlashcard(item.id)}
                                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                              >
                                Create Flashcard
                              </button>
                              <button
                                onClick={() => handleArchive(item.id, item.type)}
                                className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                              >
                                Archive
                              </button>
                              <button
                                onClick={() => handleDelete(item.id, item.type)}
                                className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>

                        <div 
                          className="cursor-pointer pr-8"
                          onClick={() => router.push(`/teacher_page/summaries/${item.id}`)}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="text-sm text-slate-500 dark:text-slate-400 capitalize">Summary</div>
                          </div>
                          {item.subject && (
                            <div className="text-sm text-slate-600 dark:text-slate-300 mb-2">{item.subject}</div>
                          )}
                          <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                          <div className="text-xs text-slate-400">Updated {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : 'recently'}</div>
                        </div>
                        
                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-1 rounded ${item.isPublished ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>
                              {item.isPublished ? '✓ Published' : 'Draft'}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTogglePublish(item.id, item.type, item.isPublished);
                            }}
                            className={`text-xs px-3 py-1.5 rounded transition-colors ${
                              item.isPublished 
                                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                                : 'bg-[#2E7D32] text-white hover:bg-[#1B5E20] dark:bg-[hsl(142.1,76.2%,36.3%)] dark:hover:bg-[hsl(142.1,76.2%,30%)]'
                            }`}
                          >
                            {item.isPublished ? 'Unpublish' : 'Publish'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rename Modal */}
      {renameModalOpen && (
        <div className="fixed inset-0 bg-black/30 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setRenameModalOpen(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 w-full max-w-md shadow-2xl border-2 border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 bg-[#2E7D32]/10 rounded-2xl flex items-center justify-center mb-6">
              <svg className="w-7 h-7 text-[#2E7D32]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Rename {renameItemType === 'flashcards' ? 'Flashcard' : 'Summary'}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">Enter a new title for this item.</p>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/50 focus:border-[#2E7D32] font-medium"
              placeholder="Enter new title"
              autoFocus
            />
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleRenameSubmit}
                className="flex-1 px-5 py-3 bg-[#2E7D32] text-white rounded-xl font-semibold hover:bg-[#1B5E20] shadow-md hover:shadow-lg transition-all"
              >
                Save Changes
              </button>
              <button
                onClick={() => setRenameModalOpen(false)}
                className="flex-1 px-5 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
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
    </div>
  );
}
