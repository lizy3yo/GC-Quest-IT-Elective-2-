"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PrimaryActionButton from '@/components/atoms/buttons/PrimaryActionButton';

type FlashcardItem = {
  _id: string;
  title: string;
  description?: string;
  cards?: Array<{ _id: string; question: string; answer: string }>;
  tags?: string[];
  image?: string;
  createdAt?: string;
  updatedAt?: string;
};

export default function PrivateLibraryPage() {
  const [activeTab, setActiveTab] = useState('flashcards');
  const [filter, setFilter] = useState('recent');

  const [userId, setUserId] = useState<string | null>(null);
  const [flashcards, setFlashcards] = useState<FlashcardItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [openSubMenu, setOpenSubMenu] = useState<'share' | 'organize' | null>(null);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [shareItem, setShareItem] = useState<FlashcardItem | null>(null);
  const router = useRouter();

  const handleFilterChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setFilter(event.target.value);
  };

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        // Try multiple authentication methods
        let uid: string | null = null;

        // Method 1: Try authenticated API call with token
        try {
          const token = localStorage.getItem('accessToken');
          if (token) {
            const currentRes = await fetch('/api/v1/users/current', {
              credentials: 'include',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
            if (currentRes.ok) {
              const currentJsonUnknown = await currentRes.json().catch(() => ({} as unknown));
              const currentJson = currentJsonUnknown as Partial<{ user?: { _id?: string } }>;
              uid = currentJson?.user?._id ?? null;
              console.log("✅ Private Library: Authenticated via JWT token, user ID:", uid);
            }
          }
        } catch (err) {
          console.warn("Private Library: JWT authentication failed:", err);
        }

        // Method 2: Fallback to localStorage userId
        if (!uid) {
          uid = localStorage.getItem('userId');
          if (uid) {
            console.log("✅ Private Library: Using localStorage userId:", uid);
          }
        }

        // Method 3: Generate a temporary user ID for demo purposes
        if (!uid) {
          uid = `temp-user-${Date.now()}`;
          localStorage.setItem('userId', uid);
          console.log("⚠️ Private Library: Generated temporary user ID:", uid);
        }

        if (!isMounted) return;
        setUserId(uid);

        // Fetch flashcards owned by the current user from the student_page API
        const res = await fetch(`/api/student_page/flashcard?userId=${uid}`, {
          headers: {
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });
        if (!res.ok) {
          const maybeUnknown = await res.json().catch(() => ({} as unknown));
          const maybe = maybeUnknown as Partial<{ message?: string }>;
          throw new Error(maybe?.message || `Failed to load flashcards (${res.status})`);
        }
        const data = (await res.json()) as { flashcards: FlashcardItem[] };
        if (!isMounted) return;
        setFlashcards(Array.isArray(data?.flashcards) ? data.flashcards : []);
      } catch (e: unknown) {
        if (!isMounted) return;
        setError(e instanceof Error ? e.message : 'Something went wrong loading your library.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleDelete = async (flashcardId: string) => {
    if (!userId) return;
    if (!confirm('Delete this flashcard? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/student_page/flashcard/${flashcardId}?userId=${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const maybeUnknown = await res.json().catch(() => ({} as unknown));
        const maybe = maybeUnknown as Partial<{ message?: string }>;
        throw new Error(maybe?.message || `Failed to delete (${res.status})`);
      }
      setFlashcards(prev => prev.filter(f => f._id !== flashcardId));
      setOpenMenuId(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete flashcard.');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => alert('Link copied to clipboard!'))
      .catch(() => alert('Failed to copy link'));
  };

  const handleRename = async (item: FlashcardItem) => {
    if (!userId) return;
    const newTitle = prompt('Rename set to:', item.title || '');
    if (!newTitle || newTitle.trim() === '' || newTitle === item.title) return;
    try {
      const res = await fetch(`/api/student_page/flashcard/${item._id}?userId=${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      if (!res.ok) {
        const maybeUnknown = await res.json().catch(() => ({} as unknown));
        const maybe = maybeUnknown as Partial<{ message?: string }>;
        throw new Error(maybe?.message || `Failed to rename (${res.status})`);
      }
      setFlashcards(prev => prev.map(f => f._id === item._id ? { ...f, title: newTitle.trim() } : f));
      setOpenMenuId(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to rename.');
    }
  };

  const filteredFlashcards = useMemo(() => {
    const list = [...flashcards];
    if (filter === 'recent') {
      list.sort((a, b) => {
        const ad = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bd = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bd - ad;
      });
    } else if (filter === 'popular') {
      list.sort((a, b) => (b.cards?.length || 0) - (a.cards?.length || 0));
    } else if (filter === 'alphabetical') {
      list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }
    return list;
  }, [flashcards, filter]);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">Private Library</h1>
        <p className="text-slate-600 dark:text-slate-400">Manage and organize your study materials</p>
      </div>

      {/* Navigation Tabs - matching Student Class page style */}
      <div className="mb-8 bg-transparent">
        <div className="flex gap-6 border-b border-slate-200 dark:border-slate-700">
          {['flashcards', 'practice_tests', 'study_guides', 'folders'].map((tab) => {
            const label = tab
              .split('_')
              .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
              .join(' ');
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'text-slate-900 dark:text-white border-b-2 border-slate-900 dark:border-white -mb-[2px]'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter and Actions */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <select
            id="filter"
            value={filter}
            onChange={handleFilterChange}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1C2B1C] focus:border-[#1C2B1C] shadow-sm"
          >
            <option value="recent">Recent</option>
            <option value="popular">Most Cards</option>
            <option value="alphabetical">A-Z</option>
          </select>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {filteredFlashcards.length} {filteredFlashcards.length === 1 ? 'set' : 'sets'}
          </span>
        </div>

        <PrimaryActionButton as="link" href="/student_page/flashcards/create" title="Create a new set">
          + Create Set
        </PrimaryActionButton>
      </div>

      {/* Content Section */}
      <div className="space-y-6">
          {activeTab === 'flashcards' && (
            <div id="flashcards">
              {isLoading && (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="w-8 h-8 border-2 border-[#1C2B1C] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-500 dark:text-slate-400">Loading your flashcards...</p>
                  </div>
                </div>
              )}
              {!isLoading && error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                  <p className="text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}
              {!isLoading && !error && filteredFlashcards.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">No flashcard sets yet</h3>
                  <p className="text-gray-500 dark:text-slate-400 mb-4">Create your first set to get started</p>
                  <PrimaryActionButton as="link" href="/student_page/flashcards/create" title="Create your first set">
                    Create Your First Set
                  </PrimaryActionButton>
                </div>
              )}

              {/* Flashcard Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {!isLoading && !error && filteredFlashcards.map((item) => (
                  <div
                    key={item._id}
                    onClick={() => router.push(`/student_page/private_library/${item._id}`)}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-[var(--dark-border,#2E2E2E)] rounded-2xl p-6 cursor-pointer hover:shadow-lg hover:border-[#1C2B1C]/20 dark:hover:border-[#1C2B1C]/40 transition-all duration-200 group relative h-full flex flex-col"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-[#1C2B1C] rounded-full"></div>
                        <span className="text-sm font-medium text-[#1C2B1C]">{item.cards?.length || 0} cards</span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(prev => prev === item._id ? null : item._id); }}
                        className="p-1.5 rounded-lg hover:bg-[#1C2B1C]/10 text-gray-400 dark:text-slate-500 hover:text-[#1C2B1C] opacity-0 group-hover:opacity-100 transition-all"
                        aria-label="Open actions"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </button>
                    </div>

                    <div className="mb-3">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-1 line-clamp-2">{item.title}</h3>
                      {item.description && (
                        <p className="text-sm text-gray-600 dark:text-slate-400 line-clamp-2">{item.description}</p>
                      )}
                    </div>

                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-[#1C2B1C]/10 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-[#1C2B1C]">Y</span>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-slate-400">You</span>
                      </div>
                      <span className="text-xs text-gray-400 dark:text-slate-500">
                        {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : 'Recently'}
                      </span>
                    </div>

                    {/* Dropdown Menu */}
                    {openMenuId === item._id && (
                      <div className="absolute top-12 right-4 w-48 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg z-20" onClick={(e) => e.stopPropagation()}>
                        <button
                          className={`w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-[#1C2B1C]/10 hover:text-[#1C2B1C] rounded-t-xl ${openSubMenu === 'share' ? 'bg-[#1C2B1C]/10' : ''}`}
                          onMouseEnter={() => setOpenSubMenu('share')}
                          onFocus={() => setOpenSubMenu('share')}
                        >
                          <span className="text-gray-700 dark:text-slate-300">Share</span>
                          <svg className="w-4 h-4 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        <button
                          className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-slate-300 hover:bg-[#1C2B1C]/10 hover:text-[#1C2B1C]"
                          onClick={() => handleRename(item)}
                        >
                          Rename
                        </button>
                        <button
                          className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-slate-300 hover:bg-[#1C2B1C]/10 hover:text-[#1C2B1C]"
                          onClick={() => { router.push(`/student_page/private_library/${item._id}`); setOpenMenuId(null); }}
                        >
                          Edit
                        </button>
                        <div className="h-px bg-gray-100 dark:bg-slate-700 mx-2" />
                        <button
                          className="w-full text-left px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-b-xl"
                          onClick={() => handleDelete(item._id)}
                        >
                          Delete
                        </button>

                        {openSubMenu === 'share' && (
                          <div className="absolute top-0 right-full mr-2 w-44 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg">
                            <button
                              className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-slate-300 hover:bg-[#1C2B1C]/10 hover:text-[#1C2B1C] rounded-t-xl"
                              onClick={() => { setShareItem(item); setShowShareModal(true); setOpenMenuId(null); setOpenSubMenu(null); }}
                            >
                              Share link
                            </button>
                            <button
                              className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-slate-300 hover:bg-[#1C2B1C]/10 hover:text-[#1C2B1C] rounded-b-xl"
                              onClick={() => { copyToClipboard(`${window.location.origin}/student_page/private_library/${item._id}`); setOpenMenuId(null); setOpenSubMenu(null); }}
                            >
                              Copy link
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Share Modal */}
              {showShareModal && shareItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-black/50" onClick={() => setShowShareModal(false)}></div>
                  <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Share &quot;{shareItem.title}&quot;</h3>
                      <button
                        className="text-gray-400 dark:text-slate-500 hover:text-[#1C2B1C] p-1"
                        onClick={() => setShowShareModal(false)}
                        aria-label="Close"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">Anyone with this link can view your flashcard set.</p>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={`${window.location.origin}/student_page/private_library/${shareItem._id}`}
                        className="flex-1 px-3 py-2 border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-slate-300 rounded-xl text-sm"
                      />
                      <PrimaryActionButton onClick={() => copyToClipboard(`${window.location.origin}/student_page/private_library/${shareItem._id}`)}>
                        Copy
                      </PrimaryActionButton>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {activeTab === 'practice_tests' && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">Practice Tests</h3>
              <p className="text-gray-500 dark:text-slate-400">Coming soon - Create practice tests from your flashcards</p>
            </div>
          )}
          {activeTab === 'study_guides' && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">Study Guides</h3>
              <p className="text-gray-500 dark:text-slate-400">Coming soon - Generate comprehensive study guides</p>
            </div>
          )}
          {activeTab === 'folders' && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">Folders</h3>
              <p className="text-gray-500 dark:text-slate-400">Coming soon - Organize your sets into folders</p>
            </div>
          )}
      </div>
    </div>
  );
}