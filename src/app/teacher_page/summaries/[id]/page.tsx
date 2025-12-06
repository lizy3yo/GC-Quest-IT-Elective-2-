"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import ConfirmModal from "@/components/molecules/ConfirmModal";
import Link from "next/link";
import { useToast } from '@/contexts/ToastContext';

interface Summary {
    _id: string;
    title: string;
    content: string;
    subject: string;
    createdAt: string;
    wordCount: number;
    status: string;
    difficulty: string;
    summaryType: string;
    keyPoints: string[];
    mainTopics: string[];
    compressionRatio: number;
    readingTime: number;
    tags: string[];
    confidence: number;
}

export default function SummaryViewPage() {
    const [summary, setSummary] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const summaryId = params.id as string;
    const { showSuccess, showError } = useToast();
    
    // Get tab from URL for back navigation
    const tabFromUrl = searchParams?.get('tab') || 'all';
    
    // Edit mode states
    const [isEditing, setIsEditing] = useState(false);
    const [editedTitle, setEditedTitle] = useState('');
    const [editedContent, setEditedContent] = useState('');
    const [editedKeyPoints, setEditedKeyPoints] = useState<string[]>([]);
    const [editedMainTopics, setEditedMainTopics] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    
    // Detect if viewing from class
    const [isFromClass, setIsFromClass] = useState(false);
    const [classId, setClassId] = useState<string | null>(null);
    
    // Menu state
    const [showMenu, setShowMenu] = useState(false);
    
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const searchParams = new URLSearchParams(window.location.search);
            setIsFromClass(searchParams.get('from') === 'class');
            setClassId(searchParams.get('classId'));
        }
    }, []);
    
    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => {
            if (showMenu) setShowMenu(false);
        };
        
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [showMenu]);

    // Get userId and fetch summary
    useEffect(() => {
        async function getUserIdAndFetchSummary() {
            let uid: string | null = null;
            try {
                const token = localStorage.getItem("accessToken");
                if (token) {
                    const currentRes = await fetch("/api/v1/users/current", {
                        credentials: "include",
                        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                    });
                    if (currentRes.ok) {
                        const json = await currentRes.json().catch(() => ({} as unknown));
                        uid = json?.user?._id;
                    }
                }
            } catch (e) {
                // ignore
            }
            if (!uid) uid = localStorage.getItem('userId');
            if (!uid) {
                uid = `temp-user-${Date.now()}`;
                localStorage.setItem('userId', uid);
            }
            setUserId(uid);

            // Fetch specific summary
            if (uid && summaryId) {
                await fetchSummary(uid, summaryId);
            }
        }
        getUserIdAndFetchSummary();
    }, [summaryId]);

    const fetchSummary = async (uid: string, id: string) => {
        try {
            setLoading(true);
            const response = await fetch(`/api/student_page/summary?userId=${uid}&summaryId=${id}`);
            const data = await response.json();

            if (data.success && data.summary) {
                setSummary(data.summary);
                // best-effort: check recent activities to see if this summary was already marked read
                try {
                    const histRes = await fetch(`/api/student_page/history?userId=${encodeURIComponent(uid)}&limit=200`);
                    if (histRes.ok) {
                        const histJson = await histRes.json().catch(() => null);
                        const acts = Array.isArray(histJson?.activities) ? histJson.activities : [];
                        const found = acts.find((a: any) => (a.type || '').toString().toLowerCase().includes('summary?.read') && a.meta?.summaryId === id);
                        if (found) setHasRead(true);
                    }
                } catch (e) {
                    // ignore history check errors — non-fatal
                }
            } else {
                showError(data.error || 'Summary not found', 'Load Error');
            }
        } catch (err) {
            showError('Failed to load summary', 'Load Error');
        } finally {
            setLoading(false);
        }
    };

    const deleteSummary = async () => {
        // This function performs the delete. Confirmation is handled by the in-app modal.
        if (!userId) {
            showError('User not found.');
            return;
        }

        try {
            setDeleteLoading(true);
            const response = await fetch(`/api/student_page/summary?userId=${userId}&summaryId=${summaryId}`, {
                method: 'DELETE'
            });
            const data = await response.json();

            if (data.success) {
                showSuccess('Summary deleted successfully');
                router.push('/teacher_page/library?tab=study_notes');
            } else {
                showError(data.error || 'Failed to delete summary');
            }
        } catch (err) {
            showError('Failed to delete summary', 'Delete Error');
        } finally {
            setDeleteLoading(false);
        }
    };

    // Delete confirmation loading state
    const [deleteLoading, setDeleteLoading] = useState<boolean>(false);

    const openDeleteConfirm = () => {
        if (!userId) {
            showError('User not found.');
            return;
        }

        setConfirmState({
            open: true,
            title: 'Delete Summary',
            message: 'Are you sure you want to delete this summary? This action cannot be undone.',
            isDangerous: true,
            confirmText: 'Delete',
            cancelText: 'Cancel',
            onConfirm: async () => {
                try {
                    setDeleteLoading(true);
                    await deleteSummary();
                } finally {
                    setDeleteLoading(false);
                    setConfirmState((prev) => ({ ...prev, open: false, onConfirm: null }));
                }
            }
        });
    };

    const [showResummarizeModal, setShowResummarizeModal] = useState<boolean>(false);
    const [resummarizeLoading, setResummarizeLoading] = useState<boolean>(false);
    // whether the current user has already marked this summary as read
    const [hasRead, setHasRead] = useState<boolean>(false);
    const [markReadLoading, setMarkReadLoading] = useState<boolean>(false);
    // Shared confirmation modal state
    const [confirmState, setConfirmState] = useState<{
        open: boolean;
        title: string;
        message: string;
        isDangerous?: boolean;
        confirmText?: string;
        cancelText?: string;
        onConfirm: (() => void | Promise<void>) | null;
    }>({ open: false, title: '', message: '', isDangerous: false, confirmText: 'Confirm', cancelText: 'Cancel', onConfirm: null });

    const resummarize = async () => {
        if (!userId) {
            showError('User not found.');
            return;
        }

        try {
            setResummarizeLoading(true);
            const response = await fetch(`/api/student_page/summary/resummarize?userId=${userId}&summaryId=${summaryId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to resummarize');
            }

            // Update the displayed summary
            setSummary(data.summary);
            setShowResummarizeModal(false);
            showSuccess('Summary rewritten successfully', 'Success');
        } catch (err) {
            showError(err instanceof Error ? err.message : 'Failed to rewrite', 'Rewrite Error');
        } finally {
            setResummarizeLoading(false);
        }
    };
    
    const startEditing = () => {
        if (!summary) return;
        setEditedTitle(summary?.title);
        setEditedContent(summary?.content);
        setEditedKeyPoints([...summary?.keyPoints]);
        setEditedMainTopics([...summary?.mainTopics]);
        setIsEditing(true);
    };
    
    const cancelEditing = () => {
        setIsEditing(false);
        setEditedTitle('');
        setEditedContent('');
        setEditedKeyPoints([]);
        setEditedMainTopics([]);
    };
    
    const saveEdits = async () => {
        if (!userId || !summary) {
            showError('Cannot save changes');
            return;
        }
        
        if (!editedTitle.trim()) {
            showError('Title cannot be empty');
            return;
        }
        
        try {
            setSaving(true);
            const response = await fetch(`/api/teacher_page/summary/${summaryId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                },
                body: JSON.stringify({
                    title: editedTitle.trim(),
                    content: editedContent,
                    keyPoints: editedKeyPoints.filter(kp => kp.trim()),
                    mainTopics: editedMainTopics.filter(mt => mt.trim())
                })
            });
            
            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to save changes');
            }
            
            // Update local state
            setSummary({
                ...summary,
                title: editedTitle.trim(),
                content: editedContent,
                keyPoints: editedKeyPoints.filter(kp => kp.trim()),
                mainTopics: editedMainTopics.filter(mt => mt.trim())
            });
            setIsEditing(false);
            showSuccess('Changes saved successfully', 'Success');
        } catch (err) {
            showError(err instanceof Error ? err.message : 'Failed to save changes', 'Save Error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900" style={{ padding: '1.5rem' }}>
                <div style={{ maxWidth: '72rem', marginLeft: 'auto', marginRight: 'auto' }}>
                    {/* Header Card Skeleton */}
                    <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-8 mb-8 overflow-hidden animate-pulse">
                        {/* Decorative Background Elements */}
                        <div className="absolute top-0 right-0 w-96 h-96 bg-[#2E7D32]/5 rounded-full blur-3xl" />
                        <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-400/5 rounded-full blur-3xl" />
                        
                        <div className="relative">
                            {/* Back Button Skeleton */}
                            <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-lg w-32 mb-4"></div>
                            
                            {/* Title Skeleton */}
                            <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-xl w-3/4 mb-3"></div>
                            
                            {/* Metadata Skeleton */}
                            <div className="flex flex-wrap items-center gap-3 mb-6">
                                <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-lg w-32"></div>
                                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1"></div>
                                <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-20"></div>
                                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1"></div>
                                <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
                                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1"></div>
                                <div className="h-7 bg-slate-200 dark:bg-slate-700 rounded-lg w-16"></div>
                                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1"></div>
                                <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-36"></div>
                            </div>
                            
                            {/* Action Buttons Skeleton */}
                            <div className="flex flex-wrap gap-3">
                                <div className="h-11 bg-slate-200 dark:bg-slate-700 rounded-xl w-52"></div>
                                <div className="h-11 bg-slate-200 dark:bg-slate-700 rounded-xl w-32"></div>
                                <div className="h-11 bg-slate-200 dark:bg-slate-700 rounded-xl w-24"></div>
                                <div className="h-11 bg-slate-200 dark:bg-slate-700 rounded-xl w-28"></div>
                            </div>
                        </div>
                    </div>

                    {/* Content Card Skeleton */}
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-8 space-y-8 relative overflow-hidden animate-pulse">
                        {/* Decorative Background Elements */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400/5 rounded-full blur-3xl" />
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#2E7D32]/5 rounded-full blur-3xl" />
                        
                        <div className="relative space-y-8">
                            {/* Summary Section Skeleton */}
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-6 h-6 bg-slate-200 dark:bg-slate-700 rounded"></div>
                                    <div className="h-7 bg-slate-200 dark:bg-slate-700 rounded w-28"></div>
                                </div>
                                <div className="space-y-3">
                                    <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                                    <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                                    <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                                    <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                                    <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-5/6"></div>
                                </div>
                            </div>

                            {/* Key Points Section Skeleton */}
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-6 h-6 bg-slate-200 dark:bg-slate-700 rounded"></div>
                                    <div className="h-7 bg-slate-200 dark:bg-slate-700 rounded w-32"></div>
                                </div>
                                <div className="space-y-3">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div key={i} className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200/50 dark:border-slate-600/50">
                                            <div className="w-2 h-2 bg-slate-300 dark:bg-slate-600 rounded-full mt-2 flex-shrink-0"></div>
                                            <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded flex-1"></div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Main Topics Section Skeleton */}
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-6 h-6 bg-slate-200 dark:bg-slate-700 rounded"></div>
                                    <div className="h-7 bg-slate-200 dark:bg-slate-700 rounded w-36"></div>
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <div key={i} className="h-10 bg-slate-200 dark:bg-slate-700 rounded-xl w-28"></div>
                                    ))}
                                </div>
                            </div>


                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!loading && !summary) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                    <div className="text-center py-12">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <span className="text-2xl">⚠️</span>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Summary Not Found</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">The summary you're looking for doesn't exist or has been deleted.</p>
                        <Link
                            href="/teacher_page/library?tab=study_notes"
                            className="inline-block bg-teal-600 text-white px-6 py-3 rounded-lg hover:bg-teal-700 transition-colors no-underline font-medium"
                        >
                            Back to Library
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300" style={{ padding: '1.5rem' }}>
            <div style={{ maxWidth: '72rem', marginLeft: 'auto', marginRight: 'auto' }}>
                {/* Header Card - matching library page style */}
                <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-8 mb-8 overflow-hidden">
                    {/* Decorative Background Elements */}
                    <div className="absolute top-0 right-0 w-96 h-96 bg-[#2E7D32]/5 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-400/5 rounded-full blur-3xl" />
                    
                    <div className="relative">
                        {/* Back Button */}
                        <Link
                            href={isFromClass && classId ? `/teacher_page/classes/${classId}` : `/teacher_page/library?tab=${tabFromUrl}`}
                            className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-[#2E7D32] dark:hover:text-[#4CAF50] mb-4 transition-colors no-underline"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            <span className="font-medium">Back to Library</span>
                        </Link>
                        
                        {/* Title */}
                        {isEditing ? (
                            <input
                                type="text"
                                value={editedTitle}
                                onChange={(e) => setEditedTitle(e.target.value)}
                                className="w-full text-3xl sm:text-4xl font-black px-4 py-2 border-2 border-[#2E7D32] rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/50 mb-3"
                                placeholder="Enter title..."
                            />
                        ) : (
                            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mb-3">
                                {summary?.title}
                            </h1>
                        )}
                        
                        {/* Metadata */}
                        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-400 mb-6">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg font-semibold">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                                {summary?.subject}
                            </span>
                            <span className="text-slate-400">•</span>
                            <span>{summary?.wordCount} words</span>
                            <span className="text-slate-400">•</span>
                            <span>Created: {summary?.createdAt ? new Date(summary.createdAt).toLocaleDateString() : 'N/A'}</span>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-3">
                            {isEditing ? (
                                <>
                                    <button
                                        onClick={saveEdits}
                                        disabled={saving}
                                        className="px-5 py-2.5 bg-[#2E7D32] text-white rounded-xl hover:bg-[#1B5E20] text-sm font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {saving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                    <button
                                        onClick={cancelEditing}
                                        disabled={saving}
                                        className="px-5 py-2.5 border-2 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-semibold transition-all disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                </>
                            ) : (
                                <>
                                    {!isFromClass && (
                                        <>
                                            <button
                                                onClick={async () => {
                                                    if (!userId || !summary) return;
                                                    try {
                                                        const button = document.querySelector('.flashcard-generate-btn') as HTMLButtonElement;
                                                        if (button) {
                                                            button.disabled = true;
                                                            button.textContent = 'Generating...';
                                                        }
                                                        const response = await fetch(`/api/student_page/flashcard/generate-from-text?userId=${userId}`, {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({
                                                                content: summary?.content,
                                                                title: `${summary?.title} - Flashcards`,
                                                                subject: summary?.subject,
                                                                difficulty: summary?.difficulty,
                                                                maxCards: 15
                                                            })
                                                        });
                                                        const data = await response.json();
                                                        if (!response.ok || !data.success) throw new Error(data.error || 'Failed to generate flashcards');
                                                        router.push('/teacher_page/library?tab=flashcards');
                                                    } catch (error) {
                                                        showError(error instanceof Error ? error.message : 'Failed to generate flashcards', 'Generation Error');
                                                        const button = document.querySelector('.flashcard-generate-btn') as HTMLButtonElement;
                                                        if (button) {
                                                            button.disabled = false;
                                                            button.textContent = 'Create Flashcards from This';
                                                        }
                                                    }
                                                }}
                                                className="flashcard-generate-btn px-5 py-2.5 bg-[#2E7D32] text-white rounded-xl hover:bg-[#1B5E20] text-sm font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                </svg>
                                                Create Flashcards from This
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (!userId || !summary) {
                                                        showError('User not found');
                                                        return;
                                                    }
                                                    if (hasRead) {
                                                        showSuccess('You already marked this summary as read');
                                                        return;
                                                    }
                                                    setConfirmState({
                                                        open: true,
                                                        title: 'Mark Summary as Read',
                                                        message: 'Mark this summary as read? You can only mark a summary as read once.',
                                                        isDangerous: false,
                                                        confirmText: 'Mark as Read',
                                                        cancelText: 'Cancel',
                                                        onConfirm: async () => {
                                                            try {
                                                                setMarkReadLoading(true);
                                                                const res = await fetch('/api/student_page/summary/mark-read', {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({ userId, summaryId: summary?._id, title: summary?.title })
                                                                });
                                                                const data = await res.json().catch(() => null);
                                                                if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to mark read');
                                                                setHasRead(true);
                                                                showSuccess('Marked summary as read');
                                                            } catch (err: any) {
                                                                showError(err?.message || 'Failed to mark read', 'Mark Read Error');
                                                            } finally {
                                                                setMarkReadLoading(false);
                                                            }
                                                        }
                                                    });
                                                }}
                                                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                                                    hasRead 
                                                        ? 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400 cursor-not-allowed' 
                                                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg'
                                                }`}
                                                disabled={markReadLoading || hasRead}
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                {hasRead ? 'Marked as Read' : (markReadLoading ? 'Marking...' : 'Mark as Read')}
                                            </button>
                                            <button
                                                onClick={() => setShowResummarizeModal(true)}
                                                className="px-5 py-2.5 border-2 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-semibold transition-all"
                                            >
                                                Rewrite
                                            </button>
                                            <button
                                                onClick={startEditing}
                                                className="px-5 py-2.5 border-2 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-semibold transition-all flex items-center gap-2"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                                Edit
                                            </button>
                                            <button
                                                onClick={openDeleteConfirm}
                                                className="px-5 py-2.5 border-2 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-semibold transition-all"
                                            >
                                                Delete Summary
                                            </button>
                                        </>
                                    )}
                                    {isFromClass && (
                                        <button
                                            onClick={startEditing}
                                            className="px-5 py-2.5 bg-[#2E7D32] text-white rounded-xl hover:bg-[#1B5E20] text-sm font-semibold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                            Edit Summary
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                        
                        {/* Ellipsis Menu - Only show when viewing from class and not editing */}
                        {isFromClass && !isEditing && (
                            <div className="absolute top-8 right-8">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowMenu(!showMenu);
                                    }}
                                    className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-[#2E7D32] transition-all"
                                >
                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                    </svg>
                                </button>
                                
                                {/* Dropdown Menu */}
                                {showMenu && (
                                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-20 overflow-hidden">
                                        <button
                                            onClick={() => {
                                                setShowResummarizeModal(true);
                                                setShowMenu(false);
                                            }}
                                            className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 dark:text-white hover:bg-emerald-50 hover:text-[#2E7D32] dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400 flex items-center gap-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                            Rewrite (AI)
                                        </button>
                                        <button
                                            onClick={() => {
                                                showError('Archive functionality coming soon');
                                                setShowMenu(false);
                                            }}
                                            className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 dark:text-white hover:bg-emerald-50 hover:text-[#2E7D32] dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400 flex items-center gap-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                                            Archive
                                        </button>
                                        <button
                                            onClick={() => {
                                                openDeleteConfirm();
                                                setShowMenu(false);
                                            }}
                                            className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                </div>

                {/* Content */}
                <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-6 sm:p-8 space-y-8 overflow-hidden">
                    {/* Decorative Background Elements */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400/5 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#2E7D32]/5 rounded-full blur-3xl" />
                    
                    {/* Summary Content */}
                    <div className="relative">
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-[#2E7D32]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Summary
                        </h2>
                        {isEditing ? (
                            <textarea
                                value={editedContent}
                                onChange={(e) => setEditedContent(e.target.value)}
                                className="w-full min-h-[200px] px-4 py-3 border-2 border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/50 focus:border-[#2E7D32]"
                                placeholder="Enter summary content..."
                            />
                        ) : (
                            <div className="prose dark:prose-invert max-w-none">
                                <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                    {summary?.content || 'No content available'}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Key Points */}
                    <div className="relative">
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-[#2E7D32]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                            Key Points
                        </h2>
                        {isEditing ? (
                            <div className="space-y-2">
                                {editedKeyPoints.map((point, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={point}
                                            onChange={(e) => {
                                                const newPoints = [...editedKeyPoints];
                                                newPoints[index] = e.target.value;
                                                setEditedKeyPoints(newPoints);
                                            }}
                                            className="flex-1 px-4 py-2 border-2 border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/50 focus:border-[#2E7D32]"
                                            placeholder="Enter key point..."
                                        />
                                        <button
                                            onClick={() => setEditedKeyPoints(editedKeyPoints.filter((_, i) => i !== index))}
                                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                                <button
                                    onClick={() => setEditedKeyPoints([...editedKeyPoints, ''])}
                                    className="text-sm text-[#2E7D32] hover:text-[#1B5E20] font-semibold"
                                >
                                    + Add Key Point
                                </button>
                            </div>
                        ) : (
                            summary?.keyPoints && summary?.keyPoints.length > 0 && (
                                <div className="space-y-3">
                                    {summary?.keyPoints.map((point, index) => (
                                        <div key={index} className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200/50 dark:border-slate-600/50">
                                            <span className="w-2 h-2 bg-[#2E7D32] rounded-full mt-2 flex-shrink-0"></span>
                                            <span className="text-slate-700 dark:text-slate-300 leading-relaxed">{point}</span>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}
                    </div>

                    {/* Main Topics */}
                    <div className="relative">
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-[#2E7D32]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            Main Topics
                        </h2>
                        {isEditing ? (
                            <div className="space-y-2">
                                {editedMainTopics.map((topic, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={topic}
                                            onChange={(e) => {
                                                const newTopics = [...editedMainTopics];
                                                newTopics[index] = e.target.value;
                                                setEditedMainTopics(newTopics);
                                            }}
                                            className="flex-1 px-4 py-2 border-2 border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/50 focus:border-[#2E7D32]"
                                            placeholder="Enter main topic..."
                                        />
                                        <button
                                            onClick={() => setEditedMainTopics(editedMainTopics.filter((_, i) => i !== index))}
                                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                                <button
                                    onClick={() => setEditedMainTopics([...editedMainTopics, ''])}
                                    className="text-sm text-[#2E7D32] hover:text-[#1B5E20] font-semibold"
                                >
                                    + Add Main Topic
                                </button>
                            </div>
                        ) : (
                            summary?.mainTopics && summary?.mainTopics.length > 0 && (
                                <div className="flex flex-wrap gap-3">
                                    {summary?.mainTopics.map((topic, index) => (
                                        <span
                                            key={index}
                                            className="px-4 py-2.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 rounded-xl text-sm font-semibold"
                                        >
                                            {topic}
                                        </span>
                                    ))}
                                </div>
                            )
                        )}
                    </div>


                </div>

                {/* Resummarize Confirmation Modal */}
                {showResummarizeModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/50" onClick={() => { if (!resummarizeLoading) setShowResummarizeModal(false); }}></div>
                        <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Rewrite Summary</h3>
                                <button
                                    className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 p-1"
                                    onClick={() => { if (!resummarizeLoading) setShowResummarizeModal(false); }}
                                    aria-label="Close"
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <p className="text-sm text-gray-600 dark:text-slate-400 mb-6">
                                This will regenerate and overwrite the existing summary content. Are you sure you want to continue?
                            </p>

                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setShowResummarizeModal(false)}
                                    className="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors text-sm font-medium"
                                    disabled={resummarizeLoading}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={resummarize}
                                    className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${resummarizeLoading ? 'opacity-60 cursor-not-allowed' : 'bg-teal-600 text-white hover:bg-teal-700'}`}
                                    disabled={resummarizeLoading}
                                >
                                    {resummarizeLoading ? 'Rewriting...' : 'Rewrite'}
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
                    confirmText={confirmState.confirmText}
                    cancelText={confirmState.cancelText}
                    onClose={() => setConfirmState((prev) => ({ ...prev, open: false, onConfirm: null }))}
                    onConfirm={async () => {
                        if (confirmState.onConfirm) {
                            await Promise.resolve(confirmState.onConfirm());
                        }
                    }}
                />
            </div>
        </div>
    );
}