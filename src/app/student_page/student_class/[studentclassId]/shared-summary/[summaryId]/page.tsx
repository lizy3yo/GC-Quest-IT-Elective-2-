"use client";

import "../../../../dashboard/styles.css";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/contexts/ToastContext";

type Summary = {
  _id: string;
  title: string;
  content: string;
  subject: string;
  createdAt: string;
  wordCount: number;
  difficulty: string;
  summaryType: string;
  keyPoints?: string[];
  mainTopics?: string[];
  compressionRatio?: number;
  readingTime?: number;
  confidence?: number;
};

export default function SharedSummaryPage() {
  const params = useParams();
  const router = useRouter();
  const { showError, showSuccess } = useToast();

  const studentclassId = params.studentclassId as string;
  const summaryId = params.summaryId as string;

  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [hasRead, setHasRead] = useState<boolean>(false);
  const [markReadLoading, setMarkReadLoading] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  useEffect(() => {
    async function init() {
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
            uid = (json as any)?.user?._id ?? null;
          }
        }
      } catch {}

      if (!uid) uid = localStorage.getItem("userId");
      if (!uid) {
        uid = `temp-user-${Date.now()}`;
        localStorage.setItem("userId", uid);
      }
      setUserId(uid);

      if (uid && summaryId) {
        await fetchSummary(uid, summaryId);
      }
    }
    init();
  }, [summaryId]);

  const fetchSummary = async (uid: string, id: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/student_page/shared-summary/${id}?userId=${uid}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.message || json?.error || "Summary not found");
        setSummary(null);
        return;
      }
      setSummary(json.summary);

      try {
        const histRes = await fetch(`/api/student_page/history?userId=${encodeURIComponent(uid)}&limit=200`);
        if (histRes.ok) {
          const histJson = await histRes.json().catch(() => null);
          const acts = Array.isArray(histJson?.activities) ? histJson.activities : [];
          const found = acts.find((a: any) => (a.type || '').toString().toLowerCase().includes('summary.read') && a.meta?.summaryId === id);
          if (found) setHasRead(true);
        }
      } catch {}
    } catch (e) {
      setError('Failed to load summary');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async () => {
    if (!userId || !summary) {
      showError('User not found');
      return;
    }
    if (hasRead) {
      showSuccess('You already marked this summary as read');
      return;
    }
    try {
      setMarkReadLoading(true);
      const res = await fetch('/api/student_page/summary/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, summaryId: summary._id, title: summary.title })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to mark read');
      setHasRead(true);
      showSuccess('Marked summary as read');
    } catch (e: any) {
      showError(e?.message || 'Failed to mark read');
    } finally {
      setMarkReadLoading(false);
    }
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
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">⚠️</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Summary Not Found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{error || 'This shared summary is unavailable.'}</p>
            <Link
              href={`/student_page/student_class/${studentclassId}?tab=resources`}
              className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors no-underline font-medium"
            >
              Back to Class
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-root">
      <div className="dashboard-container">
        {/* Header - match library styling */}
        <header className="greet-block" aria-label="Shared Summary Details">
          <Link
            href={`/student_page/student_class/${studentclassId}?tab=resources`}
            className="inline-flex items-center gap-1 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors no-underline mb-2"
          >
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm text-gray-600 dark:text-gray-400">Back to Class</span>
          </Link>
          <h1 className="greet-title mb-2">{summary.title}</h1>
          <div className="greet-sub flex items-center gap-2 flex-wrap">
            {summary.subject && <span>Subject: {summary.subject}</span>}
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span>{summary.wordCount ?? 0} words</span>
            {summary.readingTime !== undefined && <>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span>{summary.readingTime} min read</span>
            </>}
            {summary.difficulty && <>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span className="capitalize">{summary.difficulty}</span>
            </>}
          </div>
        </header>

        {/* Actions - green palette */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={async () => {
              if (!userId || !summary) return;
              setIsGenerating(true);
              try {
                const response = await fetch(`/api/student_page/flashcard/generate-from-text?userId=${userId}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
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
              } catch (e: any) {
                showError(e?.message || 'Failed to generate flashcards');
              } finally {
                setIsGenerating(false);
              }
            }}
            className="bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flashcard-generate-btn"
          >
            Create Flashcards
          </button>
          <button
            onClick={markAsRead}
            disabled={markReadLoading || hasRead}
            className={`px-3 py-1.5 text-sm ${hasRead ? 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300' : 'bg-indigo-600 text-white hover:bg-indigo-700'} rounded-lg transition-colors font-medium`}
          >
            {hasRead ? 'Read' : (markReadLoading ? 'Marking...' : 'Mark as Read')}
          </button>
        </div>

        {/* Content panel */}
        <div className="panel panel-padded-lg space-y-8">
          {/* Summary */}
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
                {summary.keyPoints.map((p, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></span>
                    <span className="text-gray-700 dark:text-gray-300 leading-relaxed">{p}</span>
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
                {summary.mainTopics.map((t, i) => (
                  <span key={i} className="px-3 py-2 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 rounded-full text-sm font-medium">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Loading Modal */}
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
