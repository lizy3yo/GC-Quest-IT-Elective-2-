'use client';

import "../dashboard/styles.css";
import React, { Suspense, useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import { CategoryBadge } from '@/components/atoms';

interface PublicDeck {
  _id: string;
  title: string;
  description?: string;
  category?: string;
  cardCount: number;
  createdAt: string;
  coverImage?: string;
  author: {
    _id: string;
    username: string;
  };
  studyCount?: number;
  rating?: number;
  isFavorite?: boolean;
  favoritedAt?: string;
}

interface PracticeTestItem {
  _id: string;
  title: string;
  description?: string;
  subject: string;
  difficulty: string;
  timeLimit: number;
  totalPoints: number;
  topics: string[];
  attempts: number;
  averageScore?: number;
  isPublic: boolean;
  createdAt?: string;
  updatedAt?: string;
}

function PublicLibraryContent() {
  const [activeTab, setActiveTab] = useState('flashcards');
  const [filter, setFilter] = useState('popular');
  
  const [decks, setDecks] = useState<PublicDeck[]>([]);
  const [practiceTests, setPracticeTests] = useState<PracticeTestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [expandedFolder, setExpandedFolder] = useState<string | null>(null);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Toast notification system
  const { showSuccess, showError } = useToast();

  const getUserId = async () => {
    let uid: string | null = null;
    try {
      const token = localStorage.getItem('accessToken');
      if (token) {
        const currentRes = await fetch('/api/v1/users/current', {
          credentials: 'include',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        if (currentRes.ok) {
          const json = await currentRes.json().catch(() => ({} as unknown));
          uid = json?.user?._id;
        }
      }
    } catch {
      // ignore
    }
    if (!uid) uid = localStorage.getItem('userId');
    if (!uid) {
      uid = `temp-user-${Date.now()}`;
      localStorage.setItem('userId', uid);
    }
    setUserId(uid);
  };

  const fetchPublicDecks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category', selectedCategory);
      if (searchTerm) params.append('search', searchTerm);
      if (filter) params.append('sortBy', filter);
      if (userId) params.append('userId', userId);

      const res = await fetch(`/api/student_page/flashcard/public?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to fetch public decks');
      }
      const data = await res.json();
      setDecks(data as PublicDeck[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch public decks');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPublicPracticeTests = async () => {
    try {
      if (!userId) return;

      const res = await fetch(`/api/student_page/practice-test?userId=${userId}&isPublic=true`, {
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (res.ok) {
        const data = (await res.json()) as { practiceTests: PracticeTestItem[] };
        console.log('📝 Loaded public practice tests:', data.practiceTests);
        setPracticeTests(Array.isArray(data?.practiceTests) ? data.practiceTests : []);
      } else {
        console.warn('Failed to load public practice tests');
      }
    } catch (e: unknown) {
      console.error('Error fetching public practice tests:', e);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/student_page/flashcard/public');
      if (!res.ok) {
        throw new Error('Failed to fetch flashcards');
      }
      const data = await res.json();

      const uniqueCategories = Array.from(
        new Set(
          (data as PublicDeck[])
            .map(deck => deck.category)
            .filter((cat): cat is string => !!cat)
        )
      );
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const handleFilterChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setFilter(event.target.value);
  };

  // Toggle favorite for public flashcards
  const toggleFavorite = async (id: string, currentFavorite: boolean) => {
    if (!userId) {
      showError('Please log in to bookmark flashcards');
      return;
    }

    console.log(`🔄 Toggling favorite for public flashcard ${id}: ${currentFavorite} -> ${!currentFavorite}`);

    try {
      const endpoint = `/api/student_page/flashcard/${id}?userId=${userId}`;
      const updateData = { isFavorite: !currentFavorite };

      console.log(`📡 Making PATCH request to: ${endpoint}`, updateData);

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      console.log(`📡 Response status: ${response.status}`);

      const raw = await response.text().catch(() => '');
      let parsedBody: unknown = {};
      if (raw) {
        try {
          parsedBody = JSON.parse(raw);
        } catch {
          parsedBody = { text: raw };
        }
      }

      if (!response.ok) {
        console.error('❌ API Error:', parsedBody);
        const parsedAny = parsedBody as { message?: string; error?: string; text?: string };
        const msg = parsedAny?.message || parsedAny?.error || parsedAny?.text || `Failed to toggle favorite (${response.status})`;
        throw new Error(msg);
      }

      console.log('✅ API Success:', parsedBody);

      const favoritedAt = !currentFavorite ? new Date().toISOString() : undefined;

      // Update local state
      setDecks(prev => prev.map(d => d._id === id ? { ...d, isFavorite: !currentFavorite, favoritedAt } : d));

      console.log(`✅ Local state updated for flashcard ${id}`);
      showSuccess(!currentFavorite ? 'Added to favorites' : 'Removed from favorites');
    } catch (error) {
      console.error('❌ Failed to toggle favorite:', error);
      showError(error instanceof Error ? error.message : 'Failed to toggle favorite');
    }
  };

  useEffect(() => {
    fetchPublicDecks();
    if (userId) {
      fetchPublicPracticeTests();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, searchTerm, filter, userId, searchParams]);

  useEffect(() => {
    fetchCategories();
    getUserId();
    
    // Check for tab parameter
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);


  const filteredAndSortedDecks = useMemo(() => {
    let filtered = [...decks];
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(deck => 
        deck.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deck.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply category filter
    if (selectedCategory) {
      filtered = filtered.filter(deck => deck.category === selectedCategory);
    }
    
    // Apply sorting
    if (filter === 'recent') {
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (filter === 'popular') {
      filtered.sort((a, b) => (b.studyCount || 0) - (a.studyCount || 0));
    } else if (filter === 'alphabetical') {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    }
    
    return filtered;
  }, [decks, searchTerm, selectedCategory, filter]);

  // Group practice tests by subject
  const practiceTestsBySubject = useMemo(() => {
    const grouped = new Map<string, PracticeTestItem[]>();
    
    practiceTests.forEach((test) => {
      const subject = test.subject || 'Uncategorized';
      if (!grouped.has(subject)) {
        grouped.set(subject, []);
      }
      grouped.get(subject)!.push(test);
    });

    // Sort tests within each subject based on filter
    grouped.forEach((tests) => {
      if (filter === 'recent') {
        tests.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
      } else if (filter === 'popular') {
        tests.sort((a, b) => (b.attempts || 0) - (a.attempts || 0));
      } else if (filter === 'alphabetical') {
        tests.sort((a, b) => a.title.localeCompare(b.title));
      }
    });

    return grouped;
  }, [practiceTests, filter]);

  return (
    <div className="dashboard-root">
      <div className="dashboard-container">
        {/* Header Card - matching dashboard style */}
        <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-8 mb-8 overflow-hidden">
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#2E7D32]/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-400/5 rounded-full blur-3xl" />
          
          <div className="relative">
            <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2">
              Public Library
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              Discover study sets created by the community
            </p>
          </div>
        </div>

      {/* Navigation Tabs - matching Private Library style */}
      <div className="mb-8 bg-transparent">
        <div className="flex gap-6 border-b border-slate-200 dark:border-slate-700">
          {['flashcards', 'summaries', 'practice_tests'].map((tab) => {
            const labels: Record<string, string> = {
              flashcards: 'Flashcards',
              summaries: 'Summaries',
              practice_tests: 'Practice Tests'
            };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'text-[#2E7D32] dark:!text-[hsl(142.1,76.2%,36.3%)] border-b-2 border-[#2E7D32] dark:!border-[hsl(142.1,76.2%,36.3%)] -mb-[2px]'
                    : 'text-slate-600 dark:text-slate-400 hover:text-[#2E7D32] dark:hover:text-white'
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter and Actions */}
      <div className="flex items-center gap-3 mb-8">
        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search public sets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64 px-4 py-2 pl-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1C2B1C] focus:border-[#1C2B1C] shadow-sm"
          />
          <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Sort Filter */}
        <select
          id="filter"
          value={filter}
          onChange={handleFilterChange}
          className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1C2B1C] focus:border-[#1C2B1C] shadow-sm"
        >
          <option value="popular">Most Popular</option>
          <option value="recent">Recently Created</option>
          <option value="alphabetical">A-Z</option>
        </select>

        {/* Category Filter */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1C2B1C] focus:border-[#1C2B1C] shadow-sm"
        >
          <option value="">All Categories</option>
          {categories.map(category => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </div>

      {/* Content Section */}
      <div className="space-y-6">
        {activeTab === 'flashcards' && (
          <div id="flashcards">
            {isLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-6 animate-pulse">
                    <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-3"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-4"></div>
                    <div className="flex items-center justify-between">
                      <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-20"></div>
                      <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!isLoading && error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                <p className="text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
            {!isLoading && !error && filteredAndSortedDecks.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">No flashcards found</h3>
                <p className="text-gray-500 dark:text-slate-400 mb-4">
                  Try adjusting your search terms or filters
                </p>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedCategory('');
                  }}
                  className="px-6 py-2 bg-[#1C2B1C] text-white rounded-xl hover:brightness-110 transition-all font-medium"
                >
                  Clear Filters
                </button>
              </div>
            )}

            {/* Flashcard Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {!isLoading && !error && filteredAndSortedDecks.map((deck) => (
                <PublicDeckCard key={deck._id} deck={deck} router={router} onToggleFavorite={toggleFavorite} />
              ))}
            </div>
          </div>
        )}
        {activeTab === 'summaries' && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">Public Summaries</h3>
            <p className="text-gray-500 dark:text-slate-400">Coming soon - Browse public study summaries</p>
          </div>
        )}
        {activeTab === 'practice_tests' && (
          <div>
            {isLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-6 animate-pulse">
                    <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-3"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-4"></div>
                    <div className="flex items-center justify-between">
                      <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-20"></div>
                      <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!isLoading && practiceTests.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">No Public Practice Tests Yet</h3>
                <p className="text-gray-500 dark:text-slate-400">Be the first to create and share a practice test</p>
              </div>
            )}
            {!isLoading && practiceTests.length > 0 && (
              <div className="space-y-4">
                {Array.from(practiceTestsBySubject.entries()).map(([subject, tests]) => (
                  <div 
                    key={subject}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-visible"
                  >
                    {/* Folder Header */}
                    <button
                      onClick={() => setExpandedFolder(expandedFolder === subject ? null : subject)}
                      className="w-full flex items-center justify-between p-6 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                          expandedFolder === subject 
                            ? 'bg-[#1C2B1C] text-white' 
                            : 'bg-[#1C2B1C]/10 text-[#1C2B1C]'
                        }`}>
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        </div>
                        <div className="text-left">
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{subject}</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {tests.length} {tests.length === 1 ? 'test' : 'tests'}
                          </p>
                        </div>
                      </div>
                      <svg 
                        className={`w-5 h-5 text-slate-400 transition-transform ${expandedFolder === subject ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Folder Contents */}
                    {expandedFolder === subject && (
                      <div className="border-t border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-900/30">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {tests.map((test) => (
                            <div
                              key={test._id}
                              onClick={() => {
                                sessionStorage.setItem('breadcrumb_context', 'public_library');
                                sessionStorage.setItem('breadcrumb_tab', 'practice_tests');
                                router.push(`/student_page/practice_tests/${test._id}`);
                              }}
                              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 cursor-pointer hover:shadow-lg hover:border-[#1C2B1C]/20 dark:hover:border-[#1C2B1C]/40 transition-all duration-200 group relative"
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div className="w-2 h-2 bg-[#2E7D32] rounded-full"></div>
                                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                    {test.difficulty}
                                  </span>
                                </div>
                                <CategoryBadge variant="public">
                                  Public
                                </CategoryBadge>
                              </div>
                              
                              <div className="mb-3">
                                <h4 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-1 line-clamp-2 break-words">
                                  {test.title}
                                </h4>
                                {test.description && (
                                  <p className="text-xs text-gray-600 dark:text-slate-400 line-clamp-2">
                                    {test.description}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mb-3">
                                <span className="flex items-center gap-1">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  {test.timeLimit} min
                                </span>
                                <span className="flex items-center gap-1">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  {test.totalPoints} pts
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-xs text-gray-400 dark:text-slate-500 pt-3 border-t border-slate-200 dark:border-slate-700">
                                <span>
                                  {test.attempts} {test.attempts === 1 ? 'attempt' : 'attempts'}
                                </span>
                                {test.averageScore !== undefined && (
                                  <span className="font-medium text-[#2E7D32] dark:text-[#04C40A]">
                                    Avg: {test.averageScore.toFixed(1)}%
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        </div>
      </div>
    </div>
  );
}

export default function PublicLibrary() {
  return (
    <Suspense fallback={
      <div className="dashboard-root">
        <div className="dashboard-container">
          {/* Header Card Skeleton */}
          <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-8 mb-8 overflow-hidden">
            <div className="animate-pulse">
              <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-48 mb-3"></div>
              <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-80"></div>
            </div>
          </div>
          
          {/* Tabs Skeleton */}
          <div className="mb-8 border-b border-slate-200 dark:border-slate-700">
            <div className="flex gap-8 animate-pulse">
              <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-24 py-3"></div>
              <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-24 py-3"></div>
              <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-24 py-3"></div>
            </div>
          </div>
          
          {/* Cards Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 p-6 animate-pulse">
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-full mb-2"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-4"></div>
                <div className="flex items-center justify-between">
                  <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-20"></div>
                  <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    }>
      <PublicLibraryContent />
    </Suspense>
  );
}

function PublicDeckCard({ deck, router, onToggleFavorite }: { deck: PublicDeck; router: ReturnType<typeof useRouter>; onToggleFavorite: (id: string, currentFavorite: boolean) => void }) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const getInitials = (username: string) => {
    return username.charAt(0).toUpperCase();
  };

  return (
    <div
      onClick={() => router.push(`/student_page/public_library/${deck._id}/flashcard`)}
      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-[var(--dark-border,#2E2E2E)] rounded-2xl p-6 cursor-pointer hover:shadow-lg hover:border-[#1C2B1C]/20 dark:hover:border-[#1C2B1C]/40 transition-all duration-200 group relative h-full flex flex-col"
    >
      {/* Top row with card count, category badge, and bookmark button */}
      <div className="flex items-start justify-between mb-4 gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-2 h-2 bg-slate-500 dark:bg-slate-400 rounded-full flex-shrink-0"></div>
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{deck.cardCount} cards</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {deck.category && (
            <CategoryBadge variant="ai-generated">
              {deck.category}
            </CategoryBadge>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(deck._id, deck.isFavorite || false); }}
            className={`p-1 rounded-lg transition-colors flex-shrink-0 ${deck.isFavorite ? 'text-yellow-500 hover:text-yellow-600' : 'text-gray-400 hover:text-yellow-500'}`}
            title={deck.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <svg className="w-4 h-4" fill={deck.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mb-3 flex-1">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-1 line-clamp-2">
          {deck.title}
        </h3>
        {deck.description && (
          <p className="text-sm text-gray-600 dark:text-slate-400 line-clamp-2">
            {deck.description}
          </p>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#1C2B1C]/10 rounded-full flex items-center justify-center">
            <span className="text-xs font-medium text-[#1C2B1C]">
              {getInitials(deck.author.username)}
            </span>
          </div>
          <span className="text-xs text-gray-500 dark:text-slate-400">{deck.author.username}</span>
        </div>
        <span className="text-xs text-gray-400 dark:text-slate-500">
          {formatDate(deck.createdAt)}
        </span>
      </div>
      
      {deck.studyCount !== undefined && deck.studyCount > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span>{deck.studyCount} {deck.studyCount === 1 ? 'person' : 'people'} studied</span>
          </div>
        </div>
      )}
    </div>
  );
}