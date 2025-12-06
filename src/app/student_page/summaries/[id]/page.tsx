"use client";

import "../../dashboard/styles.css";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useToast } from '@/contexts/ToastContext';
import RichTextEditor from '@/components/molecules/RichTextEditor';
import { Edit2, Save, X } from 'lucide-react';

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
    isRead?: boolean;
    lastReadAt?: string;
}

export default function SummaryViewPage() {
    const [summary, setSummary] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const router = useRouter();
    const params = useParams();
    const summaryId = params.id as string;

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
            console.log('Fetching summary with userId:', uid, 'summaryId:', id);
            const response = await fetch(`/api/student_page/summary?userId=${uid}&summaryId=${id}`);
            console.log('Response status:', response.status);
            const data = await response.json();
            console.log('Response data:', data);

            if (data.success && data.summary) {
                setSummary(data.summary);
                // Check if summary is already marked as read from the isRead field
                if (data.summary.isRead) {
                    setHasRead(true);
                } else {
                    // Fallback: check recent activities to see if this summary was already marked read
                    try {
                        const histRes = await fetch(`/api/student_page/history?userId=${encodeURIComponent(uid)}&limit=200`);
                        if (histRes.ok) {
                            const histJson = await histRes.json().catch(() => null);
                            const acts = Array.isArray(histJson?.activities) ? histJson.activities : [];
                            const found = acts.find((a: any) => (a.type || '').toString().toLowerCase().includes('summary.read') && a.meta?.summaryId === id);
                            if (found) setHasRead(true);
                        }
                    } catch (e) {
                        // ignore history check errors — non-fatal
                    }
                }
            } else {
                setError(data.error || 'Summary not found');
            }
        } catch (err) {
            console.error('Error fetching summary:', err);
            setError('Failed to load summary');
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
                router.push('/student_page/private_library?tab=summaries');
            } else {
                showError(data.error || 'Failed to delete summary');
            }
        } catch (err) {
            console.error('Error deleting summary:', err);
            showError('Failed to delete summary');
        } finally {
            setDeleteLoading(false);
        }
    };

    // Delete confirmation modal state
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
    const [deleteLoading, setDeleteLoading] = useState<boolean>(false);

    const openDeleteConfirm = () => {
        if (!userId) {
            showError('User not found.');
            return;
        }
        setShowDeleteConfirm(true);
    };

    const [showResummarizeModal, setShowResummarizeModal] = useState<boolean>(false);
    const [resummarizeLoading, setResummarizeLoading] = useState<boolean>(false);
    // whether the current user has already marked this summary as read
    const [hasRead, setHasRead] = useState<boolean>(false);
    const [markReadLoading, setMarkReadLoading] = useState<boolean>(false);
    // flashcard generation modal
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    // Edit mode state
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [editedContent, setEditedContent] = useState<string>('');
    const [editedKeyPoints, setEditedKeyPoints] = useState<string[]>([]);
    const [editedMainTopics, setEditedMainTopics] = useState<string[]>([]);
    const [saveLoading, setSaveLoading] = useState<boolean>(false);
    // Confirmation modal for actions (re-used from library style)
    const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
    const [confirmModalConfig, setConfirmModalConfig] = useState<{
        title: string;
        message: string;
        onConfirm: () => void | Promise<void>;
        confirmText?: string;
        cancelText?: string;
        isDangerous?: boolean;
    }>({ title: '', message: '', onConfirm: () => {}, confirmText: 'Confirm', cancelText: 'Cancel', isDangerous: false });
    const { showSuccess, showError } = useToast();

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
            showSuccess('Summary rewritten successfully');
        } catch (err) {
            console.error('Rewrite failed:', err);
            showError(err instanceof Error ? err.message : 'Failed to rewrite');
        } finally {
            setResummarizeLoading(false);
        }
    };

    const handleEditClick = () => {
        if (summary) {
            // Load all editable fields
            setEditedContent(summary.content);
            setEditedKeyPoints(summary.keyPoints || []);
            setEditedMainTopics(summary.mainTopics || []);
            setIsEditing(true);
        }
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditedContent('');
        setEditedKeyPoints([]);
        setEditedMainTopics([]);
    };

    const handleSaveEdit = async () => {
        if (!userId || !summary) {
            showError('User not found.');
            return;
        }

        try {
            setSaveLoading(true);
            const response = await fetch(`/api/student_page/summary?userId=${userId}&summaryId=${summaryId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    content: editedContent,
                    keyPoints: editedKeyPoints.filter(p => p.trim() !== ''),
                    mainTopics: editedMainTopics.filter(t => t.trim() !== '')
                })
            });
            const data = await response.json();

            if (data.success && data.summary) {
                // Update the summary state with the new data
                setSummary(data.summary);
                setIsEditing(false);
                setEditedContent('');
                setEditedKeyPoints([]);
                setEditedMainTopics([]);
                showSuccess('Summary updated successfully');
                
                // Force a re-fetch to ensure we have the latest data
                await fetchSummary(userId, summaryId);
            } else {
                showError(data.error || 'Failed to update summary');
            }
        } catch (err) {
            console.error('Error updating summary:', err);
            showError('Failed to update summary');
        } finally {
            setSaveLoading(false);
        }
    };

    const addKeyPoint = () => {
        setEditedKeyPoints([...editedKeyPoints, '']);
    };

    const updateKeyPoint = (index: number, value: string) => {
        const updated = [...editedKeyPoints];
        updated[index] = value;
        setEditedKeyPoints(updated);
    };

    const removeKeyPoint = (index: number) => {
        setEditedKeyPoints(editedKeyPoints.filter((_, i) => i !== index));
    };

    const addMainTopic = () => {
        setEditedMainTopics([...editedMainTopics, '']);
    };

    const updateMainTopic = (index: number, value: string) => {
        const updated = [...editedMainTopics];
        updated[index] = value;
        setEditedMainTopics(updated);
    };

    const removeMainTopic = (index: number) => {
        setEditedMainTopics(editedMainTopics.filter((_, i) => i !== index));
    };

    if (loading) {
        return (
            <div className="dashboard-root">
                <div className="dashboard-container">
                    <div className="text-center py-12">
                        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-600 dark:text-gray-400">Loading summary...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !summary) {
        return (
            <div className="dashboard-root">
                <div className="dashboard-container">
                    <div className="text-center py-12">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <span className="text-2xl">⚠️</span>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Summary Not Found</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
                        <Link
                            href="/student_page/private_library?tab=summaries"
                            className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors no-underline font-medium"
                        >
                            Back to Library
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-root">
            <div className="dashboard-container">
                {/* Header matching dashboard greet-block */}
                <header className="greet-block" aria-label="Summary Details">
                    <Link
                        href="/student_page/private_library?tab=summaries"
                        className="inline-flex items-center gap-1 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors no-underline mb-2"
                    >
                        <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        <span className="text-sm text-gray-600 dark:text-gray-400">Back to Library</span>
                    </Link>
                    <h1 className="greet-title mb-2">{summary.title}</h1>
                    <div className="greet-sub flex items-center gap-2 flex-wrap">
                        <span>Subject: {summary.subject}</span>
                        <span className="text-gray-300 dark:text-gray-600">|</span>
                        <span>{summary.wordCount} words</span>
                        <span className="text-gray-300 dark:text-gray-600">|</span>
                        <span>{summary.readingTime} min read</span>
                        <span className="text-gray-300 dark:text-gray-600">|</span>
                        <span className="capitalize">{summary.difficulty}</span>
                        <span className="text-gray-300 dark:text-gray-600">|</span>
                        <span>{Math.round(summary.confidence * 100)}% confidence</span>
                        <span className="text-gray-300 dark:text-gray-600">|</span>
                        <span>{summary.compressionRatio.toFixed(1)}x compression</span>
                        <span className="text-gray-300 dark:text-gray-600">|</span>
                        <span>Created: {new Date(summary.createdAt).toLocaleDateString()}</span>
                    </div>
                </header>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 mb-6">
                        {isEditing ? (
                            <>
                                <button
                                    onClick={handleSaveEdit}
                                    disabled={saveLoading}
                                    className="inline-flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Save size={16} />
                                    {saveLoading ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                    onClick={handleCancelEdit}
                                    disabled={saveLoading}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium disabled:opacity-50"
                                >
                                    <X size={16} />
                                    Cancel
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={handleEditClick}
                                    className="inline-flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                                >
                                    <Edit2 size={16} />
                                    Edit
                                </button>
                                <button
                            onClick={async () => {
                                if (!userId || !summary) return;
                                setIsGenerating(true);
                                try {
                                    const response = await fetch(`/api/student_page/flashcard/generate-from-text?userId=${userId}`, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json'
                                        },
                                        body: JSON.stringify({
                                            content: summary.content,
                                            title: `${summary.title} - Flashcards`,
                                            subject: summary.subject,
                                            difficulty: summary.difficulty,
                                            maxCards: 15
                                        })
                                    });
                                    const data = await response.json();
                                    if (!response.ok || !data.success) throw new Error(data.error || 'Failed to generate flashcards');
                                    showSuccess('Flashcards generated successfully');
                                    router.push('/student_page/private_library?tab=flashcards');
                                } catch (error) {
                                    console.error('Flashcard generation failed:', error);
                                    showError(error instanceof Error ? error.message : 'Failed to generate flashcards');
                                } finally {
                                    setIsGenerating(false);
                                }
                            }}
                            className="bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flashcard-generate-btn disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Create Flashcards
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

                                setConfirmModalConfig({
                                    title: 'Mark Summary as Read',
                                    message: 'Mark this summary as read? You can only mark a summary as read once.',
                                    onConfirm: async () => {
                                        try {
                                            setMarkReadLoading(true);
                                            const res = await fetch('/api/student_page/summary/mark-read', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ userId, summaryId: summary._id, title: summary.title })
                                            });
                                            const data = await res.json().catch(() => null);
                                            if (!res.ok || !data?.success) {
                                                throw new Error(data?.error || 'Failed to mark read');
                                            }

                                            setHasRead(true);
                                            setSummary(prev => prev ? { ...prev, isRead: true, lastReadAt: new Date().toISOString() } : null);
                                            showSuccess('Marked summary as read');
                                            // notify other tabs/pages to refresh
                                            try {
                                                if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
                                                    const BC = (window as any).BroadcastChannel;
                                                    if (typeof BC === 'function') {
                                                        const bc = new BC('notewise.activities');
                                                        bc.postMessage({ type: 'summary.read', summaryId: summary._id });
                                                        bc.close();
                                                        // Also notify library page with isCompleted flag
                                                        const libBc = new BC('notewise.library.updates');
                                                        libBc.postMessage({ type: 'summary', id: summary._id, isRead: true, isCompleted: true });
                                                        libBc.close();
                                                    }
                                                }
                                                localStorage.setItem('notewise.library.lastUpdate', JSON.stringify({ type: 'summary', id: summary._id, isRead: true, isCompleted: true }));
                                            } catch (e) {}
                                        } catch (err: unknown) {
                                            console.error('Mark read failed', err);
                                            showError((err as any)?.message || 'Failed to mark read');
                                        } finally {
                                            setMarkReadLoading(false);
                                        }
                                    },
                                    confirmText: 'Mark as Read',
                                    cancelText: 'Cancel',
                                    isDangerous: false
                                });
                                setShowConfirmModal(true);
                            }}
                            className={`px-3 py-1.5 text-sm ${hasRead ? 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300' : 'bg-indigo-600 text-white hover:bg-indigo-700'} rounded-lg transition-colors font-medium`}
                            disabled={markReadLoading || hasRead}
                        >
                            {hasRead ? 'Read' : (markReadLoading ? 'Marking...' : 'Mark as Read')}
                        </button>
                        <button
                            onClick={() => setShowResummarizeModal(true)}
                            className="px-3 py-1.5 text-sm border border-green-300 text-green-700 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors font-medium"
                        >
                            Rewrite
                        </button>
                        <button
                            onClick={openDeleteConfirm}
                            className="px-3 py-1.5 text-sm border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium"
                        >
                            Delete
                        </button>
                            </>
                        )}
                </div>

                {/* Content */}
                <div className="panel panel-padded-lg space-y-8">
                    {isEditing ? (
                        <>
                            {/* Edit Summary Content */}
                            <div>
                                <h2 className="section-title mb-4 !border-0">Edit Summary</h2>
                                <div className="summary-editor-wrapper">
                                    <style jsx>{`
                                        .summary-editor-wrapper :global(.overflow-y-auto) {
                                            max-height: 600px !important;
                                        }
                                    `}</style>
                                    <RichTextEditor
                                        content={editedContent}
                                        onChange={setEditedContent}
                                        placeholder="Edit your summary content..."
                                    />
                                </div>
                            </div>

                            {/* Edit Key Points */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="section-title !border-0">Edit Key Points</h2>
                                    <button
                                        onClick={addKeyPoint}
                                        className="text-sm text-green-600 hover:text-green-700 dark:text-green-400 font-medium"
                                    >
                                        + Add Point
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {editedKeyPoints.map((point, index) => (
                                        <div key={index} className="flex gap-2">
                                            <input
                                                type="text"
                                                value={point}
                                                onChange={(e) => updateKeyPoint(index, e.target.value)}
                                                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                                placeholder="Enter key point..."
                                            />
                                            <button
                                                onClick={() => removeKeyPoint(index)}
                                                className="px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Edit Main Topics */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="section-title !border-0">Edit Main Topics</h2>
                                    <button
                                        onClick={addMainTopic}
                                        className="text-sm text-green-600 hover:text-green-700 dark:text-green-400 font-medium"
                                    >
                                        + Add Topic
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {editedMainTopics.map((topic, index) => (
                                        <div key={index} className="flex gap-2">
                                            <input
                                                type="text"
                                                value={topic}
                                                onChange={(e) => updateMainTopic(index, e.target.value)}
                                                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                                placeholder="Enter topic..."
                                            />
                                            <button
                                                onClick={() => removeMainTopic(index)}
                                                className="px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Summary Content */}
                            <div>
                                <h2 className="section-title mb-4 !border-0">Summary</h2>
                                <div className="prose dark:prose-invert max-w-none tiptap-editor">
                                    <div 
                                        className="text-gray-700 dark:text-gray-300 leading-relaxed"
                                        dangerouslySetInnerHTML={{ __html: summary.content || 'No content available' }}
                                    />
                                </div>
                            </div>

                            {/* Key Points */}
                            {summary.keyPoints && summary.keyPoints.length > 0 && (
                                <div>
                                    <h2 className="section-title mb-4 !border-0">Key Points</h2>
                                    <ul className="space-y-3">
                                        {summary.keyPoints.map((point, index) => (
                                            <li key={index} className="flex items-start gap-3">
                                                <span className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></span>
                                                <span className="text-gray-700 dark:text-gray-300 leading-relaxed">{point}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Main Topics */}
                            {summary.mainTopics && summary.mainTopics.length > 0 && (
                                <div>
                                    <h2 className="section-title mb-4 !border-0">Main Topics</h2>
                                    <div className="flex flex-wrap gap-2">
                                        {summary.mainTopics.map((topic, index) => (
                                            <span
                                                key={index}
                                                className="px-3 py-2 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full text-sm font-medium"
                                            >
                                                {topic}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}


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
                                    className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${resummarizeLoading ? 'opacity-60 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
                                    disabled={resummarizeLoading}
                                >
                                    {resummarizeLoading ? 'Rewriting...' : 'Rewrite'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Confirmation Modal (re-used style from Library) */}
                {showConfirmModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/50" onClick={() => setShowConfirmModal(false)}></div>
                        <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100">{confirmModalConfig.title}</h3>
                                <button
                                    className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 p-1"
                                    onClick={() => setShowConfirmModal(false)}
                                    aria-label="Close"
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <p className="text-sm text-gray-600 dark:text-slate-400 mb-6">
                                {confirmModalConfig.message}
                            </p>

                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setShowConfirmModal(false)}
                                    className="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors text-sm font-medium"
                                >
                                    {confirmModalConfig.cancelText}
                                </button>
                                <button
                                    onClick={async () => {
                                        try {
                                            await Promise.resolve(confirmModalConfig.onConfirm());
                                        } catch (e) {
                                            // onConfirm should handle its own errors
                                        }
                                        setShowConfirmModal(false);
                                    }}
                                    className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${confirmModalConfig.isDangerous ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-green-600 text-white hover:bg-green-700'}`}>
                                    {confirmModalConfig.confirmText}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {showDeleteConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/50" onClick={() => { if (!deleteLoading) setShowDeleteConfirm(false); }}></div>
                        <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Delete Summary</h3>
                                <button
                                    className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 p-1"
                                    onClick={() => { if (!deleteLoading) setShowDeleteConfirm(false); }}
                                    aria-label="Close"
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <p className="text-sm text-gray-600 dark:text-slate-400 mb-6">
                                Are you sure you want to delete this summary? This action cannot be undone.
                            </p>

                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors text-sm font-medium"
                                    disabled={deleteLoading}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={deleteSummary}
                                    className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${deleteLoading ? 'opacity-60 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700'}`}
                                    disabled={deleteLoading}
                                >
                                    {deleteLoading ? 'Deleting...' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Loading Modal (match Study Mode) */}
                {isGenerating && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 border border-slate-200 dark:border-slate-800">
                            <div className="flex flex-col items-center gap-6">
                                <div className="relative">
                                    <div className="w-16 h-16 border-4 border-[#E8F5E9] dark:border-slate-800 rounded-full"></div>
                                    <div className="absolute top-0 left-0 w-16 h-16 border-4 border-[#2E7D32] dark:border-[#04C40A] border-t-transparent rounded-full animate-spin"></div>
                                </div>
                                <div className="text-center">
                                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Generating Flashcards...</h3>
                                    <p className="text-sm text-slate-600 dark:text-slate-400">AI is processing your content. This may take a moment.</p>
                                </div>
                                <div className="flex gap-2">
                                    <div className="w-2 h-2 bg-[#2E7D32] dark:bg-[#04C40A] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-2 h-2 bg-[#2E7D32] dark:bg-[#04C40A] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                    <div className="w-2 h-2 bg-[#2E7D32] dark:bg-[#04C40A] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}