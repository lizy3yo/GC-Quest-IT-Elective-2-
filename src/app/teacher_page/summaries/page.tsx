"use client";

import { useState, useEffect } from "react";
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

export default function SummariesPage() {
    const [summaries, setSummaries] = useState<Summary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [selectedSummary, setSelectedSummary] = useState<Summary | null>(null);
    const { showSuccess, showError } = useToast();

    // Get userId and fetch summaries
    useEffect(() => {
        async function getUserIdAndFetchSummaries() {
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

            // Fetch summaries
            if (uid) {
                await fetchSummaries(uid);
            }
        }
        getUserIdAndFetchSummaries();
    }, []);

    const fetchSummaries = async (uid: string) => {
        try {
            setLoading(true);
            const response = await fetch(`/api/student_page/summary?userId=${uid}`);
            const data = await response.json();

            if (data.success) {
                setSummaries(data.summaries || []);
            } else {
                showError(data.error || 'Failed to fetch summaries', 'Load Error');
            }
        } catch (err) {
            showError('Failed to load summaries', 'Load Error');
        } finally {
            setLoading(false);
        }
    };

    // Delete modal state and actions
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [deleteLoading, setDeleteLoading] = useState<boolean>(false);

    const confirmDeleteSummary = (summaryId: string) => {
        if (!userId) {
            showError('User not found.');
            return;
        }
        setDeleteTargetId(summaryId);
        setShowDeleteConfirm(true);
    };

    const deleteSummary = async (summaryId?: string) => {
        const id = summaryId || deleteTargetId;
        if (!userId || !id) {
            showError('User not found.');
            setShowDeleteConfirm(false);
            setDeleteTargetId(null);
            return;
        }

        try {
            setDeleteLoading(true);
            const response = await fetch(`/api/student_page/summary?userId=${userId}&summaryId=${id}`, {
                method: 'DELETE'
            });
            const data = await response.json();

            if (data.success) {
                setSummaries(prev => prev.filter(s => s._id !== id));
                showSuccess('Summary deleted successfully');
            } else {
                showError(data.error || 'Failed to delete summary');
            }
        } catch (err) {
            showError('Failed to delete summary', 'Delete Error');
        } finally {
            setDeleteLoading(false);
            setShowDeleteConfirm(false);
            setDeleteTargetId(null);
        }
    };

    // Resummarize modal state
    const [showResummarizeModal, setShowResummarizeModal] = useState<boolean>(false);
    const [resummarizeTargetId, setResummarizeTargetId] = useState<string | null>(null);
    const [resummarizeLoading, setResummarizeLoading] = useState<boolean>(false);

    const resummarizeSummary = async (summaryId: string) => {
        if (!userId) {
            showError('User not found.');
            return;
        }

        try {
            setResummarizeLoading(true);
            const res = await fetch(`/api/student_page/summary/resummarize?userId=${userId}&summaryId=${summaryId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Failed to resummarize');
            }

            // Update summaries list if present
            setSummaries(prev => prev.map(s => s._id === summaryId ? data.summary : s));
            // If modal open with this summary, update it
            if (selectedSummary && selectedSummary._id === summaryId) {
                setSelectedSummary(data.summary);
            }

            setShowResummarizeModal(false);
            setResummarizeTargetId(null);
            showSuccess('Summary rewritten successfully', 'Success');
        } catch (err) {
            showError(err instanceof Error ? err.message : 'Failed to rewrite', 'Rewrite Error');
        } finally {
            setResummarizeLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                {/* Header */}
                <div className="mb-6 sm:mb-8">
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white mb-2">
                        AI Summaries
                    </h1>
                    <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                        AI-generated summaries of your uploaded notes and study materials.
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="mb-6 flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <Link
                        href="/teacher_page/study_mode"
                        className="w-full sm:w-auto bg-teal-600 text-white px-4 py-3 rounded-lg hover:bg-teal-700 transition-colors font-medium text-center no-underline"
                    >
                        Generate New Summary
                    </Link>
                    <button
                        onClick={() => userId && fetchSummaries(userId)}
                        disabled={loading}
                        className="w-full sm:w-auto bg-gray-600 text-white px-4 py-3 rounded-lg hover:bg-gray-700 transition-colors font-medium disabled:opacity-50"
                    >
                        {loading ? 'Loading...' : 'Refresh'}
                    </button>
                </div>

                {/* Loading State */}
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6 animate-pulse">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                                    <div className="flex flex-col gap-1">
                                        <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-full w-20"></div>
                                        <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded-full w-16"></div>
                                    </div>
                                </div>
                                <div className="space-y-2 mb-4">
                                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32"></div>
                                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-40"></div>
                                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-28"></div>
                                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-36"></div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-lg w-full"></div>
                                    <div className="flex gap-2">
                                        <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-lg flex-1"></div>
                                        <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-lg w-16"></div>
                                        <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-lg w-16"></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : error ? (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <span className="text-2xl">⚠️</span>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Error Loading Summaries</h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
                        <button
                            onClick={() => userId && fetchSummaries(userId)}
                            className="bg-teal-600 text-white px-6 py-3 rounded-lg hover:bg-teal-700 transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                ) : summaries.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                        {summaries.map((summary) => (
                            <div
                                key={summary._id}
                                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6 hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white line-clamp-2 flex-1 mr-2">
                                        {summary.title}
                                    </h3>
                                    <div className="flex flex-col gap-1">
                                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full flex-shrink-0">
                                            completed
                                        </span>
                                        <span className={`px-2 py-1 text-xs rounded-full flex-shrink-0 ${summary.difficulty === 'easy' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                                summary.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                            }`}>
                                            {summary.difficulty}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-2 mb-4">
                                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                                        Subject: {summary.subject}
                                    </p>
                                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                                        Words: {summary.wordCount} • {summary.readingTime} min read
                                    </p>
                                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                                        Type: {summary.summaryType.replace('-', ' ')}
                                    </p>
                                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                                        Created: {new Date(summary.createdAt).toLocaleDateString()}
                                    </p>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={() => setSelectedSummary(summary)}
                                        className="w-full bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-teal-100 dark:hover:bg-teal-900/30 transition-colors"
                                    >
                                        View Summary
                                    </button>
                                    <div className="flex gap-2">
                                        <Link
                                            href="/teacher_page/study_mode"
                                            className="flex-1 bg-gray-50 text-gray-700 dark:bg-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-center no-underline"
                                        >
                                            Create Flashcards
                                        </Link>
                                        <button
                                            onClick={() => { setResummarizeTargetId(summary._id); setShowResummarizeModal(true); }}
                                            className="px-3 py-2 text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                                        >
                                            Rewrite
                                        </button>
                                        <button
                                            onClick={() => confirmDeleteSummary(summary._id)}
                                            className="px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 sm:py-16">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <h3 className="text-lg sm:text-xl font-medium text-gray-900 dark:text-white mb-2">
                            No summaries yet
                        </h3>
                        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                            Upload some notes to get started with AI-generated summaries.
                        </p>
                        <Link
                            href="/teacher_page/study_mode"
                            className="inline-block bg-teal-600 text-white px-6 py-3 rounded-lg hover:bg-teal-700 transition-colors no-underline font-medium"
                        >
                            Create Your First Summary
                        </Link>
                    </div>
                )}

                {/* Resummarize Confirmation Modal */}
                {showResummarizeModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/50" onClick={() => { if (!resummarizeLoading) { setShowResummarizeModal(false); setResummarizeTargetId(null); } }}></div>
                        <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Rewrite Summary</h3>
                                <button
                                    className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 p-1"
                                    onClick={() => { if (!resummarizeLoading) { setShowResummarizeModal(false); setResummarizeTargetId(null); } }}
                                    aria-label="Close"
                                >
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <p className="text-sm text-gray-600 dark:text-slate-400 mb-6">
                                This will regenerate and overwrite the existing summary content. Are you sure you want to continue?
                            </p>

                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => { setShowResummarizeModal(false); setResummarizeTargetId(null); }}
                                    className="px-4 py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors text-sm font-medium"
                                    disabled={resummarizeLoading}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => { if (resummarizeTargetId) resummarizeSummary(resummarizeTargetId); }}
                                    className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${resummarizeLoading ? 'opacity-60 cursor-not-allowed' : 'bg-teal-600 text-white hover:bg-teal-700'}`}
                                    disabled={resummarizeLoading}
                                >
                                    {resummarizeLoading ? 'Rewriting...' : 'Rewrite'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Summary View Modal */}
                {selectedSummary && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                                            {selectedSummary.title}
                                        </h2>
                                        <div className="flex flex-wrap gap-2 text-sm text-gray-600 dark:text-gray-400">
                                            <span>Subject: {selectedSummary.subject}</span>
                                            <span>•</span>
                                            <span>{selectedSummary.wordCount} words</span>
                                            <span>•</span>
                                            <span>{selectedSummary.readingTime} min read</span>
                                            <span>•</span>
                                            <span className="capitalize">{selectedSummary.difficulty}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSelectedSummary(null)}
                                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                    >
                                        <span className="text-xl">×</span>
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Summary Content */}
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Summary</h3>
                                    <div className="prose dark:prose-invert max-w-none">
                                        <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                                            {selectedSummary.content || 'No content available'}
                                        </p>
                                    </div>
                                </div>

                                {/* Key Points */}
                                {selectedSummary.keyPoints && selectedSummary.keyPoints.length > 0 && (
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Key Points</h3>
                                        <ul className="space-y-2">
                                            {selectedSummary.keyPoints.map((point, index) => (
                                                <li key={index} className="flex items-start gap-2">
                                                    <span className="w-2 h-2 bg-teal-500 rounded-full mt-2 flex-shrink-0"></span>
                                                    <span className="text-gray-700 dark:text-gray-300">{point}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Main Topics */}
                                {selectedSummary.mainTopics && selectedSummary.mainTopics.length > 0 && (
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Main Topics</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedSummary.mainTopics.map((topic, index) => (
                                                <span
                                                    key={index}
                                                    className="px-3 py-1 bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300 rounded-full text-sm"
                                                >
                                                    {topic}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                                    <Link
                                        href="/teacher_page/study_mode"
                                        className="flex-1 bg-teal-600 text-white px-4 py-2 rounded-lg hover:bg-teal-700 transition-colors text-center no-underline font-medium"
                                    >
                                        Create Flashcards from This
                                    </Link>
                                    <button
                                        onClick={() => { if (selectedSummary) { setResummarizeTargetId(selectedSummary._id); setShowResummarizeModal(true); } }}
                                        className="px-4 py-2 border border-teal-300 text-teal-700 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors font-medium"
                                    >
                                        Resummarize
                                    </button>
                                    <button
                                        onClick={() => setSelectedSummary(null)}
                                        className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}