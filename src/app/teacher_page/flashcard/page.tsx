"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";

type FlashcardItem = {
  _id: string;
  title: string;
  description?: string;
  subject?: string;
  cards?: Array<{ _id: string; question: string; answer: string }>;
  createdAt?: string;
  updatedAt?: string;
};

type SummaryItem = {
  _id: string;
  title: string;
  content?: string;
  subject?: string;
  createdAt?: string;
  updatedAt?: string;
};

export default function TeacherFlashcardPage() {
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  const [flashcards, setFlashcards] = useState<FlashcardItem[]>([]);
  const [summaries, setSummaries] = useState<SummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "drafts" | "uploads">("all");

  useEffect(() => {
    let isMounted = true;
    // Read query params once on mount (client-side) so we can show success toasts
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
          const sJson = await sRes.json().catch(() => ({} as any));
          setSummaries(Array.isArray(sJson?.summaries) ? sJson.summaries : []);
        } else {
          setSummaries([]);
        }

        // If we were navigated here with a createdId, show a success toast
        if (createdId && createdType) {
          showSuccess(`New ${createdType} created — added to Library`, "Success");
        }
      } catch (err) {
        if (isMounted) showError("Failed to load library items", "Load Error");
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
    // Merge flashcards and summaries into a single list for 'all'
    const f = flashcards.map((fc) => ({
      id: fc._id,
      type: "flashcards",
      title: fc.title,
      subject: fc.subject,
      updatedAt: fc.updatedAt || fc.createdAt
    }));
    const s = summaries.map((su) => ({
      id: su._id,
      type: "summary",
      title: su.title,
      subject: su.subject,
      updatedAt: su.updatedAt || su.createdAt
    }));
    return [...f, ...s].sort((a, b) => (new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()));
  }, [flashcards, summaries]);

  return (
    <div className="min-h-screen" style={{ padding: '1.5rem' }}>
      <div style={{ maxWidth: '80rem', marginLeft: 'auto', marginRight: 'auto' }}>
        <div className="mb-6">
          <h1 style={{ margin: '0 0 0.25rem 0', fontSize: '1.875rem', lineHeight: '2.25rem', fontWeight: 800, color: '#0f172a' }} className="dark:text-[var(--dark-text-primary)]">Library</h1>
        <p style={{ margin: 0, fontSize: '0.9375rem', color: '#64748b' }} className="dark:text-[var(--dark-text-secondary)]">Manage flashcards and summaries created or uploaded by you.</p>
      </div>

      <div className="mb-4">
        <div className="flex gap-4 border-b border-slate-200 pb-2">
          {[
            { key: "all", label: "All Items" },
            { key: "drafts", label: "Drafts" },
            { key: "uploads", label: "Uploads" }
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`py-2 text-sm font-medium ${activeTab === t.key ? "text-slate-900 border-b-2 border-slate-900 -mb-[2px]" : "text-slate-500"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 animate-pulse">
                <div className="flex items-center justify-between mb-3">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-20"></div>
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
                </div>
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {activeTab === "all" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {combined.length === 0 && (
                  <div className="col-span-full text-center py-12">
                    <p className="text-slate-600">No library items yet. Use AI Studio or Upload to create flashcards and summaries.</p>
                    <div className="mt-4">
                      <button onClick={() => router.push('/teacher_page/ai-studio')} className="px-4 py-2 bg-green-500 text-white rounded-lg">Open AI Studio</button>
                    </div>
                  </div>
                )}

                {combined.map((item) => (
                  <div key={`${item.type}-${item.id}`} className={`bg-white dark:bg-slate-800 border rounded-2xl p-4 hover:shadow-lg cursor-pointer`} onClick={() => router.push(`/teacher_page/library/view/${item.id}`)}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm text-slate-500">{item.type === 'flashcards' ? 'Flashcards' : 'Summary'}</div>
                      <div className="text-xs text-slate-400">{item.subject || ''}</div>
                    </div>
                    <h3 className="font-semibold text-lg mb-1">{item.title}</h3>
                    <div className="text-xs text-slate-400">Updated {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : 'recently'}</div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "drafts" && (
              <div>
                <p className="text-sm text-slate-600 mb-4">Drafts will appear here (saved but not published).</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* We don't have a dedicated drafts API for flashcards; show placeholder and links to create */}
                  <div className="bg-white dark:bg-slate-800 border rounded-2xl p-6 text-center">
                    <p className="text-slate-600">No drafts available.</p>
                    <div className="mt-3">
                      <button onClick={() => router.push('/teacher_page/ai-studio')} className="px-4 py-2 bg-green-500 text-white rounded-lg">Open AI Studio</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "uploads" && (
              <div>
                <p className="text-sm text-slate-600 mb-4">Uploaded files and generated items from uploads.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* List uploaded flashcards — we don't yet have a teacher-specific uploads API; link to classroom resources as a fallback */}
                  <div className="bg-white dark:bg-slate-800 border rounded-2xl p-6 text-center">
                    <p className="text-slate-600">No uploads found.</p>
                    <div className="mt-3">
                      <button onClick={() => router.push('/teacher_page/ai-studio')} className="px-4 py-2 bg-green-500 text-white rounded-lg">Open AI Studio</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
