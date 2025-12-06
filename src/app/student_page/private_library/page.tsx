"use client";

import "../dashboard/styles.css";
import React, { useEffect, useMemo, useState, Suspense } from 'react';
import ConfirmModal from '@/components/molecules/ConfirmModal';
import Modal from '@/components/molecules/Modal';
import { useRouter, useSearchParams } from 'next/navigation';
import PrimaryActionButton from '@/components/molecules/buttons/buttons/PrimaryActionButton';
import { useToast } from '@/contexts/ToastContext';
import { Edit2, Eye, Trash2, FileText } from 'lucide-react';

type FlashcardItem = {
  _id: string;
  title: string;
  description?: string;
  cards?: Array<{ _id: string; question: string; answer: string }>;
  tags?: string[];
  subject?: string;
  image?: string;
  isFavorite?: boolean;
  favoritedAt?: string;
  isRead?: boolean;
  lastReadAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

type PracticeTestItem = {
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
  isFavorite?: boolean;
  favoritedAt?: string;
  isRead?: boolean;
  lastReadAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

type SummaryItem = {
  _id: string;
  title: string;
  content: string;
  subject: string;
  difficulty: string;
  summaryType: string;
  wordCount: number;
  readingTime: number;
  keyPoints: string[];
  mainTopics: string[];
  compressionRatio: number;
  confidence: number;
  tags: string[];
  isFavorite?: boolean;
  favoritedAt?: string;
  isRead?: boolean;
  isCompleted?: boolean;
  lastReadAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

function PrivateLibraryContent() {
  const [activeTab, setActiveTab] = useState('flashcards');
  const [filter, setFilter] = useState('recent');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'folders' | 'list'>('folders'); // New state for view mode
  const [expandedFolder, setExpandedFolder] = useState<string | null>(null); // Track which folder is open

  const [userId, setUserId] = useState<string | null>(null);
  const [flashcards, setFlashcards] = useState<FlashcardItem[]>([]);
  const [practiceTests, setPracticeTests] = useState<PracticeTestItem[]>([]);
  const [summaries, setSummaries] = useState<SummaryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [openSubMenu, setOpenSubMenu] = useState<'share' | 'organize' | null>(null);
  const [showShareModal, setShowShareModal] = useState<boolean>(false);
  const [shareItem, setShareItem] = useState<FlashcardItem | null>(null);
  // Generic confirm modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    confirmText?: string;
    isDangerous?: boolean;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  // Rename modal state (used for flashcards, practice tests, summaries and folders)
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{
    type: 'flashcard' | 'practice_test' | 'summary' | 'folder';
    id?: string;
    currentTitle: string;
    folderType?: 'flashcards' | 'practice_tests' | 'summaries';
    folderOldSubject?: string;
  } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null);
  const [openFolderMenu, setOpenFolderMenu] = useState<string | null>(null);
  const [showDeleteFolderModal, setShowDeleteFolderModal] = useState<boolean>(false);
  const [folderToDelete, setFolderToDelete] = useState<{ subject: string; type: 'flashcards' | 'practice_tests' | 'summaries' } | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  // Track items the user opened in this session to hide NEW without marking completed
  const [viewedFlashcardIds, setViewedFlashcardIds] = useState<Set<string>>(new Set());
  const [viewedPracticeTestIds, setViewedPracticeTestIds] = useState<Set<string>>(new Set());
  
  // Toast notification system
  const { showSuccess, showError, showWarning } = useToast();
  const [alert, setAlert] = useState<{ isVisible: boolean; type: 'success' | 'error' | 'warning' | 'info'; message: string }>({ isVisible: false, type: 'info', message: '' });
  const hideAlert = () => setAlert({ ...alert, isVisible: false });

  // Format date/time exactly as: MM/DD/YYYY - hh:mm AM/PM
  const formatDateTime = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    let h = d.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    const hh = String(h).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${mm}/${dd}/${yyyy} - ${hh}:${min} ${ampm}`;
  };

  const getDisplayDate = (item: { lastReadAt?: string; updatedAt?: string; createdAt?: string }) =>
    item.lastReadAt || item.updatedAt || item.createdAt;

  // Helper: mark a flashcard as viewed locally and broadcast for other views/tabs
  const markFlashcardViewed = (id: string) => {
    setViewedFlashcardIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    try {
      // Broadcast to other tabs/pages
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('notewise.library.updates');
        bc.postMessage({ type: 'flashcard', id, viewed: true });
        try { bc.close(); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
    try {
      // Persist one-shot event so navigating back can apply it immediately
      localStorage.setItem('notewise.library.lastUpdate', JSON.stringify({ type: 'flashcard', id, viewed: true }));
    } catch { /* ignore */ }
  };

  // Helper: mark a practice test as viewed locally and broadcast for other views/tabs
  const markPracticeTestViewed = (id: string) => {
    setViewedPracticeTestIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const bc = new BroadcastChannel('notewise.library.updates');
        bc.postMessage({ type: 'practice_test', id, viewed: true });
        try { bc.close(); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
    try {
      localStorage.setItem('notewise.library.lastUpdate', JSON.stringify({ type: 'practice_test', id, viewed: true }));
    } catch { /* ignore */ }
  };

  // Rehydrate viewed state from sessionStorage (same-tab back navigation)
  useEffect(() => {
    try {
      const vf = sessionStorage.getItem('notewise.viewed.flashcards');
      const vp = sessionStorage.getItem('notewise.viewed.practiceTests');
      if (vf) {
        const arr = JSON.parse(vf) as string[];
        setViewedFlashcardIds(new Set(arr));
      }
      if (vp) {
        const arr = JSON.parse(vp) as string[];
        setViewedPracticeTestIds(new Set(arr));
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  // Persist viewed sets to sessionStorage whenever they change
  useEffect(() => {
    try {
      sessionStorage.setItem('notewise.viewed.flashcards', JSON.stringify(Array.from(viewedFlashcardIds)));
    } catch { /* ignore */ }
  }, [viewedFlashcardIds]);

  useEffect(() => {
    try {
      sessionStorage.setItem('notewise.viewed.practiceTests', JSON.stringify(Array.from(viewedPracticeTestIds)));
    } catch { /* ignore */ }
  }, [viewedPracticeTestIds]);

  const handleFilterChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setFilter(event.target.value);
  };
  
  // Sort favorites by favoritedAt timestamp (most recent first)
  const sortFavoritesByTimestamps = <T extends { _id: string; isFavorite?: boolean; favoritedAt?: string }>(arr: T[]) => {
    return [...arr].sort((a, b) => {
      if (a.isFavorite && b.isFavorite) {
        const at = a.favoritedAt ? new Date(a.favoritedAt).getTime() : 0;
        const bt = b.favoritedAt ? new Date(b.favoritedAt).getTime() : 0;
        return bt - at; // most recently favorited first
      }
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return 0;
    });
  };

  // Track if we've processed initial URL params
  const initialUrlProcessed = React.useRef(false);

  // Check for URL parameters - only on initial load
  useEffect(() => {
    // Wait for loading to complete before processing URL params
    if (isLoading) return;
    
    // Only process URL params once on initial load
    if (initialUrlProcessed.current) return;
    
    // Check for tab parameter
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
    
    // Mark as processed after first successful run (when not loading)
    initialUrlProcessed.current = true;

    // Check for subject to auto-expand folder
    const autoExpandSubject = searchParams.get('subject');
    if (autoExpandSubject && viewMode === 'folders') {
      const decodedSubject = decodeURIComponent(autoExpandSubject);
      setExpandedFolder(decodedSubject);
      
      // Scroll to the folder after a short delay to ensure it's rendered
      setTimeout(() => {
        const folderElement = document.getElementById(`folder-${decodedSubject.replace(/[^a-zA-Z0-9]/g, '-')}`);
        if (folderElement) {
          folderElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 300);

      // Find and highlight the most recent flashcard in this subject
      if (flashcards.length > 0) {
        const subjectFlashcards = flashcards.filter(f => f.subject === decodedSubject);
        if (subjectFlashcards.length > 0) {
          // Get the most recently created flashcard
          const mostRecent = subjectFlashcards.reduce((latest, current) => {
            const latestDate = new Date(latest.createdAt || 0).getTime();
            const currentDate = new Date(current.createdAt || 0).getTime();
            return currentDate > latestDate ? current : latest;
          });
          setHighlightedCardId(mostRecent._id);
          
          // Remove highlight after 3 seconds
          setTimeout(() => {
            setHighlightedCardId(null);
          }, 3000);
        }
      }
    }
  }, [searchParams, viewMode, isLoading, flashcards]);

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
        
        // Debug: Log flashcard data to check subjects
        console.log('📚 Loaded flashcards:', data.flashcards);
        data.flashcards.forEach((fc, idx) => {
          console.log(`Flashcard ${idx + 1}: "${fc.title}" - Subject: "${fc.subject || 'MISSING'}"`, fc);
        });
        
        setFlashcards(Array.isArray(data?.flashcards) ? data.flashcards : []);

        // Fetch practice tests (private only)
        const practiceTestRes = await fetch(`/api/student_page/practice-test?userId=${uid}&isPublic=false`, {
          headers: {
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });
        
        if (practiceTestRes.ok) {
          const practiceTestData = (await practiceTestRes.json()) as { practiceTests: PracticeTestItem[] };
          if (isMounted) {
            console.log('📝 Loaded private practice tests:', practiceTestData.practiceTests);
            setPracticeTests(Array.isArray(practiceTestData?.practiceTests) ? practiceTestData.practiceTests : []);
          }
        } else {
          console.warn('Failed to load practice tests');
        }
        
        // Fetch summaries (private only)
        const summariesRes = await fetch(`/api/student_page/summary?userId=${uid}`, {
          headers: {
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });
        
        if (summariesRes.ok) {
          const summariesData = (await summariesRes.json()) as { summaries: SummaryItem[] };
          if (isMounted) {
            console.log('📄 Loaded summaries:', summariesData.summaries);
            setSummaries(Array.isArray(summariesData?.summaries) ? summariesData.summaries : []);
          }
        } else {
          console.warn('Failed to load summaries');
        }
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
  }, [searchParams]);

  // Listen for completion updates via BroadcastChannel
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let bc: BroadcastChannel | null = null;
    try {
      if ('BroadcastChannel' in window) {
        bc = new BroadcastChannel('notewise.library.updates');
        bc.onmessage = (ev) => {
          try {
            const data = ev.data as { type: string; id: string; isRead?: boolean; isCompleted?: boolean; viewed?: boolean } | null;
            if (!data || !data.id) return;

            // Update the appropriate state based on type
            if (data.type === 'flashcard') {
              if (data.isRead !== undefined) {
                setFlashcards(prev => prev.map(f => f._id === data.id ? { ...f, isRead: data.isRead, lastReadAt: data.isRead ? new Date().toISOString() : undefined } : f));
              }
              if (data.viewed) {
                setViewedFlashcardIds(prev => { const next = new Set(prev); next.add(data.id); return next; });
              }
            } else if (data.type === 'summary') {
              setSummaries(prev => prev.map(s => {
                if (s._id !== data.id) return s;
                const updates: Partial<SummaryItem> = {};
                if (data.isRead !== undefined) updates.isRead = data.isRead;
                if (data.isCompleted !== undefined) updates.isCompleted = data.isCompleted;
                if (data.isRead || data.isCompleted) updates.lastReadAt = new Date().toISOString();
                return { ...s, ...updates };
              }));
            } else if (data.type === 'practice_test') {
              if (data.isRead !== undefined) {
                setPracticeTests(prev => prev.map(t => t._id === data.id ? { ...t, isRead: data.isRead, lastReadAt: data.isRead ? new Date().toISOString() : undefined } : t));
              }
              if (data.viewed) {
                setViewedPracticeTestIds(prev => { const next = new Set(prev); next.add(data.id); return next; });
              }
            }
          } catch (e) {
            console.warn('Failed to handle library update:', e);
          }
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel not supported:', e);
    }

    // Apply the most recent update from localStorage on mount (same-tab navigation)
    try {
      const last = localStorage.getItem('notewise.library.lastUpdate');
      if (last) {
        const data = JSON.parse(last) as { type: string; id: string; isRead?: boolean; isCompleted?: boolean; viewed?: boolean };
        if (data && data.id) {
          if (data.type === 'flashcard') {
            if (data.isRead !== undefined) {
              setFlashcards(prev => prev.map(f => f._id === data.id ? { ...f, isRead: data.isRead, lastReadAt: data.isRead ? new Date().toISOString() : undefined } : f));
            }
            if (data.viewed) {
              setViewedFlashcardIds(prev => { const next = new Set(prev); next.add(data.id); return next; });
            }
          } else if (data.type === 'summary') {
            setSummaries(prev => prev.map(s => {
              if (s._id !== data.id) return s;
              const updates: Partial<SummaryItem> = {};
              if (data.isRead !== undefined) updates.isRead = data.isRead;
              if (data.isCompleted !== undefined) updates.isCompleted = data.isCompleted;
              if (data.isRead || data.isCompleted) updates.lastReadAt = new Date().toISOString();
              return { ...s, ...updates };
            }));
          } else if (data.type === 'practice_test') {
            if (data.isRead !== undefined) {
              setPracticeTests(prev => prev.map(t => t._id === data.id ? { ...t, isRead: data.isRead, lastReadAt: data.isRead ? new Date().toISOString() : undefined } : t));
            }
            if (data.viewed) {
              setViewedPracticeTestIds(prev => { const next = new Set(prev); next.add(data.id); return next; });
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to apply last library update from storage:', e);
    }

    const storageHandler = (e: StorageEvent) => {
      if (e.key === 'notewise.library.lastUpdate' && e.newValue) {
        try {
          const data = JSON.parse(e.newValue) as { type: string; id: string; isRead?: boolean; isCompleted?: boolean; viewed?: boolean };
          if (!data || !data.id) return;

          if (data.type === 'flashcard') {
            if (data.isRead !== undefined) {
              setFlashcards(prev => prev.map(f => f._id === data.id ? { ...f, isRead: data.isRead, lastReadAt: data.isRead ? new Date().toISOString() : undefined } : f));
            }
            if (data.viewed) {
              setViewedFlashcardIds(prev => { const next = new Set(prev); next.add(data.id); return next; });
            }
          } else if (data.type === 'summary') {
            setSummaries(prev => prev.map(s => {
              if (s._id !== data.id) return s;
              const updates: Partial<SummaryItem> = {};
              if (data.isRead !== undefined) updates.isRead = data.isRead;
              if (data.isCompleted !== undefined) updates.isCompleted = data.isCompleted;
              if (data.isRead || data.isCompleted) updates.lastReadAt = new Date().toISOString();
              return { ...s, ...updates };
            }));
          } else if (data.type === 'practice_test') {
            if (data.isRead !== undefined) {
              setPracticeTests(prev => prev.map(t => t._id === data.id ? { ...t, isRead: data.isRead, lastReadAt: data.isRead ? new Date().toISOString() : undefined } : t));
            }
            if (data.viewed) {
              setViewedPracticeTestIds(prev => { const next = new Set(prev); next.add(data.id); return next; });
            }
          }
        } catch (err) {
          console.warn('Failed to parse storage update:', err);
        }
      }
    };
    window.addEventListener('storage', storageHandler);

    return () => {
      window.removeEventListener('storage', storageHandler);
      try { bc && bc.close(); } catch (e) { /* ignore */ }
    };
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openMenuId) {
        setOpenMenuId(null);
      }
    };

    if (openMenuId) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [openMenuId]);

  const handleDelete = async (flashcardId: string) => {
    if (!userId) return;
    setConfirmConfig({
      title: 'Delete Flashcard',
      message: 'Delete this flashcard? This cannot be undone.',
      confirmText: 'Delete',
      isDangerous: true,
      onConfirm: async () => {
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
          showSuccess('Flashcard deleted successfully');
        } catch (e: unknown) {
          showError(e instanceof Error ? e.message : 'Failed to delete flashcard.');
        }
      }
    });
    setConfirmOpen(true);
  };

  const handleDeletePracticeTest = async (testId: string) => {
    if (!userId) return;
    setConfirmConfig({
      title: 'Delete Practice Test',
      message: 'Delete this practice test? This cannot be undone.',
      confirmText: 'Delete',
      isDangerous: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/student_page/practice-test/${testId}?userId=${userId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
          });
          if (!res.ok) {
            const maybeUnknown = await res.json().catch(() => ({} as unknown));
            const maybe = maybeUnknown as Partial<{ message?: string }>;
            throw new Error(maybe?.message || `Failed to delete (${res.status})`);
          }
          setPracticeTests(prev => prev.filter(t => t._id !== testId));
          setOpenMenuId(null);
          showSuccess('Practice test deleted successfully');
        } catch (e: unknown) {
          showError(e instanceof Error ? e.message : 'Failed to delete practice test.');
        }
      }
    });
    setConfirmOpen(true);
  };

  const handleDeleteSummary = async (summaryId: string) => {
    if (!userId) return;
    setConfirmConfig({
      title: 'Delete Summary',
      message: 'Delete this summary? This cannot be undone.',
      confirmText: 'Delete',
      isDangerous: true,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/student_page/summary?userId=${userId}&summaryId=${summaryId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
          });
          if (!res.ok) {
            const maybeUnknown = await res.json().catch(() => ({} as unknown));
            const maybe = maybeUnknown as Partial<{ message?: string }>;
            throw new Error(maybe?.message || `Failed to delete (${res.status})`);
          }
          setSummaries(prev => prev.filter(s => s._id !== summaryId));
          setOpenMenuId(null);
          showSuccess('Summary deleted successfully');
        } catch (e: unknown) {
          showError(e instanceof Error ? e.message : 'Failed to delete summary.');
        }
      }
    });
    setConfirmOpen(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => showSuccess('Link copied to clipboard!'))
      .catch(() => showError('Failed to copy link'));
  };

  const handleRename = async (item: FlashcardItem) => {
    if (!userId) return;
    setRenameTarget({ type: 'flashcard', id: item._id, currentTitle: item.title || '' });
    setRenameValue(item.title || '');
    setRenameModalOpen(true);
  };

  const handleRenamePracticeTest = async (test: PracticeTestItem) => {
    if (!userId) return;
    setRenameTarget({ type: 'practice_test', id: test._id, currentTitle: test.title || '' });
    setRenameValue(test.title || '');
    setRenameModalOpen(true);
  };

  const handleRenameSummary = async (summary: SummaryItem) => {
    if (!userId) return;
    setRenameTarget({ type: 'summary', id: summary._id, currentTitle: summary.title || '' });
    setRenameValue(summary.title || '');
    setRenameModalOpen(true);
  };

  // Toggle favorite for any item type
  const toggleFavorite = async (id: string, type: 'flashcard' | 'practice_test' | 'summary', currentFavorite: boolean) => {
    if (!userId) return;

    console.log(`🔄 Toggling favorite for ${type} ${id}: ${currentFavorite} -> ${!currentFavorite}`);

    try {
      let endpoint = '';
      const updateData = { isFavorite: !currentFavorite };

      if (type === 'flashcard') {
        endpoint = `/api/student_page/flashcard/${id}?userId=${userId}`;
      } else if (type === 'summary') {
        endpoint = `/api/student_page/summary?userId=${userId}&summaryId=${id}`;
      } else if (type === 'practice_test') {
        endpoint = `/api/student_page/practice-test/${id}?userId=${userId}`;
      }

      console.log(`📡 Making PATCH request to: ${endpoint}`, updateData);

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      console.log(`📡 Response status: ${response.status}`);

      // Read the response body safely. Some endpoints reply with no content (204)
      // or with plain text; avoid calling response.json() twice and handle empty bodies.
      const raw = await response.text().catch(() => '');
      let parsedBody: unknown = {};
      if (raw) {
        try {
          parsedBody = JSON.parse(raw);
        } catch {
          // Not JSON, keep raw text for debugging
          parsedBody = { text: raw };
        }
      }

      if (!response.ok) {
        console.error('❌ API Error:', parsedBody);
        const parsedAny = parsedBody as any;
        const msg = parsedAny?.message || parsedAny?.error || parsedAny?.text || `Failed to toggle favorite (${response.status})`;
        throw new Error(msg);
      }

      console.log('✅ API Success:', parsedBody);

      // Get the favoritedAt timestamp from the API response
      const favoritedAt = !currentFavorite ? new Date().toISOString() : undefined;

      // Update local state and ensure favorites are ordered by timestamp
      if (type === 'flashcard') {
        setFlashcards(prev => {
          const updated = prev.map(f => f._id === id ? { ...f, isFavorite: !currentFavorite, favoritedAt } : f);
          return sortFavoritesByTimestamps(updated) as FlashcardItem[];
        });
      } else if (type === 'summary') {
        setSummaries(prev => {
          const updated = prev.map(s => s._id === id ? { ...s, isFavorite: !currentFavorite, favoritedAt } : s);
          return sortFavoritesByTimestamps(updated) as SummaryItem[];
        });
      } else if (type === 'practice_test') {
        setPracticeTests(prev => {
          const updated = prev.map(t => t._id === id ? { ...t, isFavorite: !currentFavorite, favoritedAt } : t);
          return sortFavoritesByTimestamps(updated) as PracticeTestItem[];
        });
      }

      console.log(`✅ Local state updated for ${type} ${id}`);
      showSuccess(!currentFavorite ? 'Added to favorites' : 'Removed from favorites');
    } catch (error) {
      console.error('❌ Failed to toggle favorite:', error);
      showError(error instanceof Error ? error.message : 'Failed to toggle favorite');
    }
  };

  // Folder management functions
  const handleRenameFolder = async (oldSubject: string, type: 'flashcards' | 'practice_tests' | 'summaries') => {
    if (!userId) return;
    const newSubject = prompt(`Rename folder "${oldSubject}" to:`, oldSubject);
    if (!newSubject || newSubject.trim() === '' || newSubject === oldSubject) return;

    try {
      let items: Array<{ _id: string; subject?: string }> = [];
      
      if (type === 'flashcards') {
        items = flashcards.filter(f => (f.subject || 'Uncategorized') === oldSubject);
      } else if (type === 'practice_tests') {
        items = practiceTests.filter(t => (t.subject || 'Uncategorized') === oldSubject);
      } else if (type === 'summaries') {
        items = summaries.filter(s => (s.subject || 'Uncategorized') === oldSubject);
      }

      // Update all items in the folder
      const updatePromises = items.map(item => {
        let endpoint = '';
        if (type === 'flashcards') {
          endpoint = `/api/student_page/flashcard/${item._id}?userId=${userId}`;
        } else if (type === 'practice_tests') {
          endpoint = `/api/student_page/practice-test/${item._id}?userId=${userId}`;
        } else if (type === 'summaries') {
          endpoint = `/api/student_page/summary?userId=${userId}&summaryId=${item._id}`;
        }

        return fetch(endpoint, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject: newSubject.trim() }),
        });
      });

      await Promise.all(updatePromises);

      // Update local state
      if (type === 'flashcards') {
        setFlashcards(prev => prev.map(f => 
          (f.subject || 'Uncategorized') === oldSubject ? { ...f, subject: newSubject.trim() } : f
        ));
      } else if (type === 'practice_tests') {
        setPracticeTests(prev => prev.map(t => 
          (t.subject || 'Uncategorized') === oldSubject ? { ...t, subject: newSubject.trim() } : t
        ));
      } else if (type === 'summaries') {
        setSummaries(prev => prev.map(s => 
          (s.subject || 'Uncategorized') === oldSubject ? { ...s, subject: newSubject.trim() } : s
        ));
      }

      setOpenFolderMenu(null);
      setExpandedFolder(newSubject.trim());
      showSuccess(`Folder renamed to "${newSubject.trim()}"`);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to rename folder');
    }
  };

  const handleDeleteFolder = (subject: string, type: 'flashcards' | 'practice_tests' | 'summaries') => {
    setFolderToDelete({ subject, type });
    setShowDeleteFolderModal(true);
    setOpenFolderMenu(null);
  };

  const confirmDeleteFolder = async (deleteContents: boolean) => {
    if (!userId || !folderToDelete) return;

    const { subject, type } = folderToDelete;

    try {
      let items: Array<{ _id: string }> = [];
      
      if (type === 'flashcards') {
        items = flashcards.filter(f => (f.subject || 'Uncategorized') === subject);
      } else if (type === 'practice_tests') {
        items = practiceTests.filter(t => (t.subject || 'Uncategorized') === subject);
      } else if (type === 'summaries') {
        items = summaries.filter(s => (s.subject || 'Uncategorized') === subject);
      }

      if (deleteContents) {
        // Delete all items in the folder
        const deletePromises = items.map(item => {
          let endpoint = '';
          if (type === 'flashcards') {
            endpoint = `/api/student_page/flashcard/${item._id}?userId=${userId}`;
          } else if (type === 'practice_tests') {
            endpoint = `/api/student_page/practice-test/${item._id}?userId=${userId}`;
          } else if (type === 'summaries') {
            endpoint = `/api/student_page/summary?userId=${userId}&summaryId=${item._id}`;
          }

          return fetch(endpoint, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
          });
        });

        await Promise.all(deletePromises);

        // Update local state - remove items
        if (type === 'flashcards') {
          setFlashcards(prev => prev.filter(f => (f.subject || 'Uncategorized') !== subject));
        } else if (type === 'practice_tests') {
          setPracticeTests(prev => prev.filter(t => (t.subject || 'Uncategorized') !== subject));
        } else if (type === 'summaries') {
          setSummaries(prev => prev.filter(s => (s.subject || 'Uncategorized') !== subject));
        }

        showSuccess(`Folder "${subject}" and its contents deleted`);
      } else {
        // Just remove the subject (move to Uncategorized)
        const updatePromises = items.map(item => {
          let endpoint = '';
          if (type === 'flashcards') {
            endpoint = `/api/student_page/flashcard/${item._id}?userId=${userId}`;
          } else if (type === 'practice_tests') {
            endpoint = `/api/student_page/practice-test/${item._id}?userId=${userId}`;
          } else if (type === 'summaries') {
            endpoint = `/api/student_page/summary?userId=${userId}&summaryId=${item._id}`;
          }

          return fetch(endpoint, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject: '' }),
          });
        });

        await Promise.all(updatePromises);

        // Update local state - move items to Uncategorized
        if (type === 'flashcards') {
          setFlashcards(prev => prev.map(f => 
            (f.subject || 'Uncategorized') === subject ? { ...f, subject: '' } : f
          ));
        } else if (type === 'practice_tests') {
          setPracticeTests(prev => prev.map(t => 
            (t.subject || 'Uncategorized') === subject ? { ...t, subject: '' } : t
          ));
        } else if (type === 'summaries') {
          setSummaries(prev => prev.map(s => 
            (s.subject || 'Uncategorized') === subject ? { ...s, subject: '' } : s
          ));
        }

        showSuccess(`Folder "${subject}" deleted. Items moved to Uncategorized`);
      }

      setShowDeleteFolderModal(false);
      setFolderToDelete(null);
      setExpandedFolder(null);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to delete folder');
    }
  };

  // Perform rename for items or folders from rename modal
  const performRename = async () => {
    if (!userId || !renameTarget) return;
    const newTitle = renameValue?.trim();
    if (!newTitle || newTitle === renameTarget.currentTitle) {
      setRenameModalOpen(false);
      setRenameTarget(null);
      return;
    }

    try {
      if (renameTarget.type === 'flashcard' && renameTarget.id) {
        const res = await fetch(`/api/student_page/flashcard/${renameTarget.id}?userId=${userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle }),
        });
        if (!res.ok) throw new Error('Failed to rename flashcard');
        setFlashcards(prev => prev.map(f => f._id === renameTarget.id ? { ...f, title: newTitle } : f));
        showSuccess('Flashcard renamed successfully');
      } else if (renameTarget.type === 'practice_test' && renameTarget.id) {
        const res = await fetch(`/api/student_page/practice-test/${renameTarget.id}?userId=${userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle }),
        });
        if (!res.ok) throw new Error('Failed to rename practice test');
        setPracticeTests(prev => prev.map(t => t._id === renameTarget.id ? { ...t, title: newTitle } : t));
        showSuccess('Practice test renamed successfully');
      } else if (renameTarget.type === 'summary' && renameTarget.id) {
        const res = await fetch(`/api/student_page/summary?userId=${userId}&summaryId=${renameTarget.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: newTitle }),
        });
        if (!res.ok) throw new Error('Failed to rename summary');
        setSummaries(prev => prev.map(s => s._id === renameTarget.id ? { ...s, title: newTitle } : s));
        showSuccess('Summary renamed successfully');
      } else if (renameTarget.type === 'folder' && renameTarget.folderOldSubject && renameTarget.folderType) {
        // Rename folder: update subject for all items in folder
        const oldSubject = renameTarget.folderOldSubject;
        const type = renameTarget.folderType;
        let items: Array<{ _id: string; subject?: string }> = [];
        if (type === 'flashcards') items = flashcards.filter(f => (f.subject || 'Uncategorized') === oldSubject);
        if (type === 'practice_tests') items = practiceTests.filter(t => (t.subject || 'Uncategorized') === oldSubject);
        if (type === 'summaries') items = summaries.filter(s => (s.subject || 'Uncategorized') === oldSubject);

        const updatePromises = items.map(item => {
          let endpoint = '';
          if (type === 'flashcards') endpoint = `/api/student_page/flashcard/${item._id}?userId=${userId}`;
          if (type === 'practice_tests') endpoint = `/api/student_page/practice-test/${item._id}?userId=${userId}`;
          if (type === 'summaries') endpoint = `/api/student_page/summary?userId=${userId}&summaryId=${item._id}`;
          return fetch(endpoint, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subject: newTitle }),
          });
        });

        await Promise.all(updatePromises);

        if (type === 'flashcards') {
          setFlashcards(prev => prev.map(f => (f.subject || 'Uncategorized') === oldSubject ? { ...f, subject: newTitle } : f));
        } else if (type === 'practice_tests') {
          setPracticeTests(prev => prev.map(t => (t.subject || 'Uncategorized') === oldSubject ? { ...t, subject: newTitle } : t));
        } else if (type === 'summaries') {
          setSummaries(prev => prev.map(s => (s.subject || 'Uncategorized') === oldSubject ? { ...s, subject: newTitle } : s));
        }
        setOpenFolderMenu(null);
        setExpandedFolder(newTitle);
        showSuccess(`Folder renamed to "${newTitle}"`);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to rename');
    } finally {
      setRenameModalOpen(false);
      setRenameTarget(null);
      setRenameValue('');
      setOpenMenuId(null);
    }
  };

  // Get unique subjects from flashcards, practice tests, and summaries based on active tab
  const subjects = useMemo(() => {
    const subjectSet = new Set<string>();
    if (activeTab === 'flashcards') {
      flashcards.forEach(f => {
        if (f.subject) subjectSet.add(f.subject);
      });
    } else if (activeTab === 'practice_tests') {
      practiceTests.forEach(t => {
        if (t.subject) subjectSet.add(t.subject);
      });
    } else if (activeTab === 'summaries') {
      summaries.forEach(s => {
        if (s.subject) subjectSet.add(s.subject);
      });
    }
    return Array.from(subjectSet).sort();
  }, [flashcards, practiceTests, summaries, activeTab]);

  // Group flashcards by subject for folder view
  const flashcardsBySubject = useMemo(() => {
    const grouped = new Map<string, FlashcardItem[]>();

    // Build subject list in a stable alphabetical order so favoriting doesn't reorder folders
    const subjectOrder = Array.from(new Set(flashcards.map(f => f.subject || 'Uncategorized'))).sort();
    subjectOrder.forEach(subject => {
      const items = flashcards.filter(f => (f.subject || 'Uncategorized') === subject);

      // Sort items according to selected filter
      if (filter === 'recent') {
        items.sort((a, b) => {
          const ad = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const bd = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return bd - ad;
        });
      } else if (filter === 'popular') {
        items.sort((a, b) => (b.cards?.length || 0) - (a.cards?.length || 0));
      } else if (filter === 'alphabetical') {
        items.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      }

      // Put favorites first within the subject only
      grouped.set(subject, sortFavoritesByTimestamps(items));
    });

    return grouped;
  }, [flashcards, filter]);

  // Group practice tests by subject for folder view
  const practiceTestsBySubject = useMemo(() => {
    const grouped = new Map<string, PracticeTestItem[]>();

    const subjectOrder = Array.from(new Set(practiceTests.map(t => t.subject || 'Uncategorized'))).sort();
    subjectOrder.forEach(subject => {
      const items = practiceTests.filter(t => (t.subject || 'Uncategorized') === subject);

      if (filter === 'recent') {
        items.sort((a, b) => {
          const ad = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const bd = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return bd - ad;
        });
      } else if (filter === 'popular') {
        items.sort((a, b) => (b.attempts || 0) - (a.attempts || 0));
      } else if (filter === 'alphabetical') {
        items.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      }

      grouped.set(subject, sortFavoritesByTimestamps(items));
    });

    return grouped;
  }, [practiceTests, filter]);

  // Group summaries by subject for folder view
  const summariesBySubject = useMemo(() => {
    const grouped = new Map<string, SummaryItem[]>();

    const subjectOrder = Array.from(new Set(summaries.map(s => s.subject || 'Uncategorized'))).sort();
    subjectOrder.forEach(subject => {
      const items = summaries.filter(s => (s.subject || 'Uncategorized') === subject);

      if (filter === 'recent') {
        items.sort((a, b) => {
          const ad = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const bd = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return bd - ad;
        });
      } else if (filter === 'popular') {
        items.sort((a, b) => (b.wordCount || 0) - (a.wordCount || 0));
      } else if (filter === 'alphabetical') {
        items.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      }

      grouped.set(subject, sortFavoritesByTimestamps(items));
    });

    return grouped;
  }, [summaries, filter]);

  const filteredFlashcards = useMemo(() => {
    let list = [...flashcards];
    
    // Filter by subject
    if (selectedSubject !== 'all') {
      list = list.filter(f => f.subject === selectedSubject);
    }
    
    // Sort
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
    // Ensure favorites are ordered by timestamp (favorites first)
    return sortFavoritesByTimestamps(list);
  }, [flashcards, filter, selectedSubject]);

  const filteredPracticeTests = useMemo(() => {
    let list = [...practiceTests];
    
    // Filter by subject
    if (selectedSubject !== 'all') {
      list = list.filter(t => t.subject === selectedSubject);
    }
    
    // Sort
    if (filter === 'recent') {
      list.sort((a, b) => {
        const ad = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bd = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bd - ad;
      });
    } else if (filter === 'popular') {
      list.sort((a, b) => (b.attempts || 0) - (a.attempts || 0));
    } else if (filter === 'alphabetical') {
      list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }
    return sortFavoritesByTimestamps(list);
  }, [practiceTests, filter, selectedSubject]);

  const filteredSummaries = useMemo(() => {
    let list = [...summaries];
    
    // Filter by subject
    if (selectedSubject !== 'all') {
      list = list.filter(s => s.subject === selectedSubject);
    }
    
    // Sort
    if (filter === 'recent') {
      list.sort((a, b) => {
        const ad = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bd = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bd - ad;
      });
    } else if (filter === 'popular') {
      list.sort((a, b) => (b.wordCount || 0) - (a.wordCount || 0));
    } else if (filter === 'alphabetical') {
      list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }
    
    // Ensure favorites are ordered by timestamp (favorites first)
    return sortFavoritesByTimestamps(list);
  }, [summaries, filter, selectedSubject]);

  return (
    <div className="dashboard-root">
      <div className="dashboard-container">
        {/* Header Card - matching teacher class page style */}
        <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-8 mb-8 overflow-hidden">
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#2E7D32]/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-400/5 rounded-full blur-3xl" />
          
          <div className="relative">
            <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2">
              Private Library
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              Manage and organize your study materials
            </p>
          </div>
        </div>

      {/* Navigation Tabs - matching teacher class page style */}
      <div className="mb-8 border-b border-slate-200 dark:border-slate-700">
        <div className="flex gap-8">
    {['flashcards', 'summaries', 'practice_tests', 'bookmarked'].map((tab) => {
            let label = tab === 'summaries' ? 'Summaries' : tab === 'bookmarked' ? 'Bookmarked' : tab
              .split('_')
              .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
              .join(' ');
            
            // Add count to bookmarked tab
            if (tab === 'bookmarked') {
              const bookmarkedCount = flashcards.filter(f => f.isFavorite).length + 
                                      practiceTests.filter(t => t.isFavorite).length + 
                                      summaries.filter(s => s.isFavorite).length;
              label = `Bookmarked (${bookmarkedCount})`;
            }
            
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 text-sm font-medium transition-colors relative ${
                  activeTab === tab
                    ? 'text-[#2E7D32] dark:text-[#4CAF50]'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {label}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2E7D32] dark:bg-[#4CAF50] rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter and Actions */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          {/* View Mode Toggle - hidden for bookmarked tab */}
          {activeTab !== 'bookmarked' && (
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1">
              <button
                onClick={() => setViewMode('folders')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'folders'
                    ? 'bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
                title="View by folders"
              >
                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                Folders
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'list'
                    ? 'bg-[#1C2B1C] text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
                title="View as list"
              >
                <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                List
              </button>
            </div>
          )}

          {viewMode === 'list' && activeTab !== 'bookmarked' && (
            <>
              <select
                id="subject-filter"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#1C2B1C] focus:border-[#1C2B1C] shadow-sm"
              >
                <option value="all">All Subjects</option>
                {subjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
              
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
            </>
          )}
          {activeTab !== 'bookmarked' && (
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {activeTab === 'flashcards' && (
                viewMode === 'folders' 
                  ? `${flashcardsBySubject.size} ${flashcardsBySubject.size === 1 ? 'class' : 'classes'}, ${flashcards.length} ${flashcards.length === 1 ? 'set' : 'sets'}`
                  : `${filteredFlashcards.length} ${filteredFlashcards.length === 1 ? 'set' : 'sets'}`
              )}
              {/* Shared Confirm Modal (used for deletes) */}
              <ConfirmModal
                isOpen={confirmOpen}
                onClose={() => { setConfirmOpen(false); setConfirmConfig(null); }}
                onConfirm={() => { if (confirmConfig && confirmConfig.onConfirm) { void confirmConfig.onConfirm(); } }}
                title={confirmConfig?.title || ''}
                message={confirmConfig?.message || ''}
                confirmText={confirmConfig?.confirmText}
                isDangerous={confirmConfig?.isDangerous}
              />

              {/* Rename Modal */}
              <Modal
                isOpen={renameModalOpen}
                onClose={() => { setRenameModalOpen(false); setRenameTarget(null); setRenameValue(''); }}
                title={renameTarget?.type === 'folder' ? `Rename Folder` : `Rename ${renameTarget?.type === 'practice_test' ? 'Test' : renameTarget?.type === 'summary' ? 'Summary' : 'Set'}`}
                maxWidth="max-w-md"
                footer={(
                  <div className="flex gap-3">
                    <button onClick={() => { setRenameModalOpen(false); setRenameTarget(null); setRenameValue(''); }} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg">Cancel</button>
                    <button onClick={() => void performRename()} className="px-4 py-2 bg-[#2E7D32] hover:bg-[#256925] dark:bg-[hsl(142.1,76.2%,36.3%)] text-white rounded-lg">Save</button>
                  </div>
                )}
              >
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">New name</label>
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm"
                    placeholder="Enter new name"
                    autoFocus
                  />
                </div>
              </Modal>
              {activeTab === 'practice_tests' && (
                viewMode === 'folders'
                  ? `${practiceTestsBySubject.size} ${practiceTestsBySubject.size === 1 ? 'class' : 'classes'}, ${practiceTests.length} ${practiceTests.length === 1 ? 'test' : 'tests'}`
                  : `${filteredPracticeTests.length} ${filteredPracticeTests.length === 1 ? 'test' : 'tests'}`
              )}
              {activeTab === 'summaries' && (
                viewMode === 'folders'
                  ? `${summariesBySubject.size} ${summariesBySubject.size === 1 ? 'class' : 'classes'}, ${summaries.length} ${summaries.length === 1 ? 'summary' : 'summaries'}`
                  : `${filteredSummaries.length} ${filteredSummaries.length === 1 ? 'summary' : 'summaries'}`
              )}
            </span>
          )}
        </div>

        {activeTab === 'flashcards' && (
          <PrimaryActionButton as="link" href="/student_page/study_mode?create=flashcard" title="Create a new flashcard set">
            + Create Set
          </PrimaryActionButton>
        )}
        {activeTab === 'practice_tests' && (
          <PrimaryActionButton as="link" href="/student_page/practice_tests" title="Create a practice test">
            + Create Test
          </PrimaryActionButton>
        )}
        {activeTab === 'summaries' && (
          <PrimaryActionButton as="link" href="/student_page/study_mode?create=summary" title="Create a new summary">
            + Create Summary
          </PrimaryActionButton>
        )}
        {activeTab === 'bookmarked' && (
          <div className="text-sm text-slate-500 dark:text-slate-400 italic">
            Your favorited items from all categories
          </div>
        )}
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
              {!isLoading && !error && flashcards.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">No flashcard sets yet</h3>
                  <p className="text-gray-500 dark:text-slate-400 mb-4">Create your first set to get started</p>
                  <PrimaryActionButton as="link" href="/student_page/study_mode?create=flashcard" title="Create your first flashcard set">
                    Create Your First Set
                  </PrimaryActionButton>
                </div>
              )}

              {/* Folder View */}
              {!isLoading && !error && viewMode === 'folders' && flashcards.length > 0 && (
                <div className="space-y-4">
                  {Array.from(flashcardsBySubject.entries()).map(([subject, items]) => (
                    <div 
                      key={subject} 
                      id={`folder-${subject.replace(/[^a-zA-Z0-9]/g, '-')}`}
                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-visible"
                    >
                      {/* Folder Header */}
                      <div className="w-full flex items-center justify-between p-6 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <button
                          onClick={() => setExpandedFolder(expandedFolder === subject ? null : subject)}
                          className="flex items-center gap-4 flex-1"
                        >
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                            expandedFolder === subject 
                              ? 'bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] text-white' 
                              : 'bg-[#2E7D32]/10 dark:bg-[hsl(142.1,76.2%,36.3%)]/10 text-[#2E7D32] dark:text-[hsl(142.1,76.2%,36.3%)]'
                          }`}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                          </div>
                          <div className="text-left">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{subject}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              {items.length} {items.length === 1 ? 'set' : 'sets'}
                            </p>
                          </div>
                        </button>
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <button
                              onClick={(e) => { e.stopPropagation(); setOpenFolderMenu(openFolderMenu === subject ? null : subject); }}
                              className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-all"
                              aria-label="Folder options"
                            >
                              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                            </button>
                            {openFolderMenu === subject && (
                              <div className="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50" onClick={(e) => e.stopPropagation()}>
                                <button
                                  className="w-full text-left px-4 py-3 text-sm text-slate-700 dark:text-slate-100 hover:bg-[#E8F5E9] hover:text-[#2E7D32] dark:hover:bg-[#1C2B1C] dark:hover:text-[#04C40A] rounded-t-xl flex items-center gap-2"
                                  onClick={() => handleRenameFolder(subject, 'flashcards')}
                                >
                                  <Edit2 className="w-4 h-4" />
                                  Rename Folder
                                </button>
                                <div className="h-px bg-slate-100 dark:bg-slate-700 mx-2" />
                                <button
                                  className="w-full text-left px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-b-xl flex items-center gap-2"
                                  onClick={() => handleDeleteFolder(subject, 'flashcards')}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete Folder
                                </button>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => setExpandedFolder(expandedFolder === subject ? null : subject)}
                            className="p-1"
                          >
                            <svg 
                              className={`w-5 h-5 text-slate-400 transition-transform ${expandedFolder === subject ? 'rotate-180' : ''}`}
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Folder Contents */}
                      {expandedFolder === subject && (
                        <div className="border-t border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-900/30">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-visible">
                            {items.map((item) => (
                              <div
                                key={item._id}
                                onClick={() => {
                                  markFlashcardViewed(item._id);
                                  // Locally mark as read to hide NEW like summaries (not persisted)
                                  setFlashcards(prev => prev.map(f => f._id === item._id ? { ...f, isRead: true } : f));
                                  router.push(`/student_page/private_library/${item._id}`);
                                }}
                                className={`bg-white dark:bg-slate-800 border rounded-xl p-4 cursor-pointer hover:shadow-lg hover:border-[#1C2B1C]/20 dark:hover:border-[#1C2B1C]/40 transition-all duration-200 group relative ${
                                  highlightedCardId === item._id 
                                    ? 'border-[#1C2B1C] border-2 shadow-lg ring-2 ring-[#1C2B1C]/20 animate-pulse' 
                                    : 'border-slate-200 dark:border-slate-700'
                                } ${openMenuId === item._id ? 'z-[70]' : ''}`}
                              >
                                {/* Favorite + actions (inside folder) */}
                                <div className="absolute top-3 right-3 flex items-center gap-1 z-[5]">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); toggleFavorite(item._id, 'flashcard', item.isFavorite || false); }}
                                    className={`p-1 rounded-lg transition-colors ${item.isFavorite ? 'text-yellow-500 hover:text-yellow-600' : 'text-gray-400 hover:text-yellow-500'}`}
                                    title={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                                  >
                                    <svg className="w-4 h-4" fill={item.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                    </svg>
                                  </button>

                                  <button
                                    onClick={(e) => { e.stopPropagation(); setOpenMenuId(prev => prev === item._id ? null : item._id); }}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 dark:text-gray-500 hover:text-[#2E7D32] dark:hover:text-[hsl(142.1,76.2%,36.3%)] transition-all"
                                    aria-label="Open actions"
                                  >
                                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                  </button>
                                </div>
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-teal-500 dark:bg-teal-400 rounded-full"></div>
                                    <span className="text-sm font-medium text-teal-600 dark:text-teal-300">{item.cards?.length || 0} cards</span>
                                  </div>
                                </div>
                                {/* NEW / COMPLETED Badge */}
                                <div className="mb-3">
                                  {item.lastReadAt ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-[#2E7D32] text-white">
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                      COMPLETED
                                    </span>
                                  ) : (!item.isRead && !viewedFlashcardIds.has(item._id)) ? (
                                    <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-[#00BCD4] text-white">
                                      NEW
                                    </span>
                                  ) : null}
                                </div>

                                <div className="mb-3">
                                  <h4 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-1 line-clamp-2">{item.title}</h4>
                                  {item.description && (
                                    <p className="text-xs text-gray-600 dark:text-slate-400 line-clamp-2">{item.description}</p>
                                  )}
                                </div>

                                <div className="flex items-center justify-between text-xs text-gray-400 dark:text-slate-500">
                                  <span>{formatDateTime(getDisplayDate(item)) || ''}</span>
                                </div>

                                {/* Dropdown Menu */}
                                {openMenuId === item._id && (
                                  <div className="absolute right-3 top-full mt-2 w-48 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg z-[60] origin-top-right" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-white hover:bg-[#E8F5E9] hover:text-[#2E7D32] dark:hover:bg-[#1C2B1C] dark:hover:text-[#04C40A] rounded-t-xl flex items-center gap-2"
                                      onClick={() => handleRename(item)}
                                    >
                                       <Edit2 className="w-4 h-4" />
                                       Rename
                                     </button>
                                    <button
                                      className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-white hover:bg-[#E8F5E9] hover:text-[#2E7D32] dark:hover:bg-[#1C2B1C] dark:hover:text-[#04C40A] flex items-center gap-2"
                                      onClick={() => { 
                                        markFlashcardViewed(item._id);
                                        router.push(`/student_page/private_library/${item._id}/flashcard`); 
                                        setOpenMenuId(null); 
                                      }}
                                    >
                                      <Eye className="w-4 h-4" />
                                      Study
                                    </button>
                                    <div className="h-px bg-gray-100 dark:bg-slate-700 mx-2" />
                                    <button
                                      className="w-full text-left px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-b-xl flex items-center gap-2"
                                      onClick={() => handleDelete(item._id)}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* List View - Original Grid */}
              {!isLoading && !error && viewMode === 'list' && filteredFlashcards.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredFlashcards.map((item) => (
                  <div
                    key={item._id}
                    onClick={() => {
                      markFlashcardViewed(item._id);
                      setFlashcards(prev => prev.map(f => f._id === item._id ? { ...f, isRead: true } : f));
                      router.push(`/student_page/private_library/${item._id}`);
                    }}
                    className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-[var(--dark-border,#2E2E2E)] rounded-2xl p-6 cursor-pointer hover:shadow-lg hover:border-[#1C2B1C]/20 dark:hover:border-[#1C2B1C]/40 transition-all duration-200 group relative h-full flex flex-col ${openMenuId === item._id ? 'z-[70]' : ''}`}
                  >
                    {/* Favorite + actions */}
                    <div className="absolute top-3 right-3 flex items-center gap-1 z-[5]">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(item._id, 'flashcard', item.isFavorite || false); }}
                        className={`p-1 rounded-lg transition-colors ${item.isFavorite ? 'text-yellow-500 hover:text-yellow-600' : 'text-gray-400 hover:text-yellow-500'}`}
                        title={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <svg className="w-4 h-4" fill={item.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                        </svg>
                      </button>

                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(prev => prev === item._id ? null : item._id); }}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 dark:text-gray-500 hover:text-[#2E7D32] dark:hover:text-[hsl(142.1,76.2%,36.3%)] transition-all"
                        aria-label="Open actions"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-teal-500 dark:bg-teal-400 rounded-full"></div>
                        <span className="text-sm font-medium text-teal-600 dark:text-teal-300">{item.cards?.length || 0} cards</span>
                      </div>
                    </div>
                    {/* NEW / COMPLETED Badge */}
                    <div className="mb-3">
                      {item.lastReadAt ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-[#2E7D32] text-white">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          COMPLETED
                        </span>
                      ) : (!item.isRead && !viewedFlashcardIds.has(item._id)) ? (
                        <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-[#00BCD4] text-white">
                          NEW
                        </span>
                      ) : null}
                    </div>
                    <div className="mb-3">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-1 line-clamp-2">{item.title}</h3>
                      {item.description && (
                        <p className="text-sm text-gray-600 dark:text-slate-400 line-clamp-2">{item.description}</p>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                      {formatDateTime(getDisplayDate(item)) || ''}
                    </div>
                    {item.subject && (
                      <div className="flex items-center gap-2 flex-wrap mb-3">
                        <span className="inline-flex items-center px-2 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap rounded-full transition-colors bg-[#E8F5E9] text-[#2E7D32] dark:bg-[#1C2B1C] dark:text-[#04C40A]">
                          {item.subject}
                        </span>
                      </div>
                    )}

                    {/* Dropdown Menu */}
                    {openMenuId === item._id && (
                      <div className="absolute right-3 top-full mt-2 w-48 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg z-[60] origin-top-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-white hover:bg-[#E8F5E9] hover:text-[#2E7D32] dark:hover:bg-[#1C2B1C] dark:hover:text-[#04C40A] rounded-t-xl flex items-center gap-2"
                          onClick={() => handleRename(item)}
                        >
                          <Edit2 className="w-4 h-4" />
                          Rename
                        </button>
                        <button
                          className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-white hover:bg-[#E8F5E9] hover:text-[#2E7D32] dark:hover:bg-[#1C2B1C] dark:hover:text-[#04C40A] flex items-center gap-2"
                          onClick={() => { 
                            markFlashcardViewed(item._id);
                            router.push(`/student_page/private_library/${item._id}/flashcard`); 
                            setOpenMenuId(null); 
                          }}
                        >
                          <Eye className="w-4 h-4" />
                          Study
                        </button>
                        <div className="h-px bg-gray-100 dark:bg-slate-700 mx-2" />
                        <button
                          className="w-full text-left px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-b-xl flex items-center gap-2"
                          onClick={() => handleDelete(item._id)}
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              )}

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
                  <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">No Practice Tests Yet</h3>
                  <p className="text-gray-500 dark:text-slate-400 mb-4">Create practice tests from your flashcards</p>
                  <PrimaryActionButton as="link" href="/student_page/practice_tests" title="Create a practice test">
                    Create Practice Test
                  </PrimaryActionButton>
                </div>
              )}
              {!isLoading && practiceTests.length > 0 && viewMode === 'folders' && (
                <div className="space-y-4">
                  {Array.from(practiceTestsBySubject.entries()).map(([subject, tests]) => (
                    <div 
                      key={subject}
                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-visible"
                    >
                      {/* Folder Header */}
                      <div className="w-full flex items-center justify-between p-6 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <button
                          onClick={() => setExpandedFolder(expandedFolder === subject ? null : subject)}
                          className="flex items-center gap-4 flex-1"
                        >
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                            expandedFolder === subject 
                              ? 'bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] text-white' 
                              : 'bg-[#2E7D32]/10 dark:bg-[hsl(142.1,76.2%,36.3%)]/10 text-[#2E7D32] dark:text-[hsl(142.1,76.2%,36.3%)]'
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
                        </button>
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <button
                              onClick={(e) => { e.stopPropagation(); setOpenFolderMenu(openFolderMenu === subject ? null : subject); }}
                              className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-all"
                              aria-label="Folder options"
                            >
                              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                            </button>
                            {openFolderMenu === subject && (
                              <div className="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50" onClick={(e) => e.stopPropagation()}>
                                <button
                                  className="w-full text-left px-4 py-3 text-sm text-slate-700 dark:text-slate-100 hover:bg-[#E8F5E9] hover:text-[#2E7D32] dark:hover:bg-[#1C2B1C] dark:hover:text-[#04C40A] rounded-t-xl flex items-center gap-2"
                                  onClick={() => handleRenameFolder(subject, 'practice_tests')}
                                >
                                   <Edit2 className="w-4 h-4" />
                                   Rename Folder
                                 </button>
                                <div className="h-px bg-slate-100 dark:bg-slate-700 mx-2" />
                                <button
                                  className="w-full text-left px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-b-xl flex items-center gap-2"
                                  onClick={() => handleDeleteFolder(subject, 'practice_tests')}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete Folder
                                </button>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => setExpandedFolder(expandedFolder === subject ? null : subject)}
                            className="p-1"
                          >
                            <svg 
                              className={`w-5 h-5 text-slate-400 transition-transform ${expandedFolder === subject ? 'rotate-180' : ''}`}
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Folder Contents */}
                      {expandedFolder === subject && (
                        <div className="border-t border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-900/30">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {tests.map((test) => (
                              <div
                                key={test._id}
                                onClick={() => {
                                  markPracticeTestViewed(test._id);
                                  sessionStorage.setItem('breadcrumb_context', 'private_library');
                                  sessionStorage.setItem('breadcrumb_tab', activeTab);
                                  router.push(`/student_page/practice_tests/${test._id}`);
                                }}
                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 cursor-pointer hover:shadow-lg hover:border-[#1C2B1C]/20 dark:hover:border-[#1C2B1C]/40 transition-all duration-200 group relative"
                              >
                                {/* Favorite + actions (inside folder) */}
                                <div className="absolute top-3 right-3 flex items-center gap-1 z-[5]">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); toggleFavorite(test._id, 'practice_test', test.isFavorite || false); }}
                                    className={`p-1 rounded-lg transition-colors ${test.isFavorite ? 'text-yellow-500 hover:text-yellow-600' : 'text-gray-400 hover:text-yellow-500'}`}
                                    title={test.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                                  >
                                    <svg className="w-4 h-4" fill={test.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                    </svg>
                                  </button>

                                  <button
                                    onClick={(e) => { e.stopPropagation(); setOpenMenuId(prev => prev === test._id ? null : test._id); }}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 dark:text-gray-500 hover:text-[#2E7D32] dark:hover:text-[hsl(142.1,76.2%,36.3%)] transition-all"
                                    aria-label="Open actions"
                                  >
                                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                    </svg>
                                  </button>

                                  {openMenuId === test._id && (
                                    <div
                                      className="absolute right-3 top-full mt-2 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-[60] origin-top-right"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <button
                                        className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-white hover:bg-[#E8F5E9] hover:text-[#2E7D32] dark:hover:bg-[#1C2B1C] dark:hover:text-[#04C40A] rounded-t-xl flex items-center gap-2"
                                        onClick={(e) => { 
                                          e.stopPropagation(); 
                                          markPracticeTestViewed(test._id);
                                          sessionStorage.setItem('breadcrumb_context', 'private_library'); 
                                          sessionStorage.setItem('breadcrumb_tab', activeTab); 
                                          router.push(`/student_page/practice_tests/${test._id}`); 
                                          setOpenMenuId(null); 
                                        }}
                                      >
                                        <Eye className="w-4 h-4" />
                                        View
                                      </button>
                                      <button
                                        className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-white hover:bg-[#E8F5E9] hover:text-[#2E7D32] dark:hover:bg-[#1C2B1C] dark:hover:text-[#04C40A] flex items-center gap-2"
                                        onClick={(e) => { e.stopPropagation(); handleRenamePracticeTest(test); setOpenMenuId(null); }}
                                      >
                                        <Edit2 className="w-4 h-4" />
                                        Rename
                                      </button>
                                      <div className="h-px bg-gray-100 dark:bg-slate-700 mx-2" />
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeletePracticeTest(test._id);
                                        }}
                                        className="w-full px-4 py-3 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-b-xl transition-colors flex items-center gap-2"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                        Delete
                                      </button>
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <div className="w-2 h-2 bg-[#2E7D32] rounded-full"></div>
                                    <span className="text-sm font-medium text-[#2E7D32] dark:text-[#04C40A]">Practice Test • {test.totalPoints} pts</span>
                                  </div>
                                </div>
                                {/* NEW / COMPLETED Badge */}
                                <div className="mb-3">
                                  {(test.lastReadAt || test.attempts > 0) ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-[#2E7D32] text-white">
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                      COMPLETED
                                    </span>
                                  ) : (!test.isRead && !viewedPracticeTestIds.has(test._id)) ? (
                                    <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-[#00BCD4] text-white">
                                      NEW
                                    </span>
                                  ) : null}
                                </div>
                                <div className="mb-3">
                                  <h4 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-1 line-clamp-2 break-words">{test.title}</h4>
                                  {test.description && (
                                    <p className="text-xs text-gray-600 dark:text-slate-400 line-clamp-2">{test.description}</p>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                                  {formatDateTime(getDisplayDate(test)) || ''}
                                </div>

                                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mb-3">
                                  <span className="flex items-center gap-1">
                                    ⏱️ {test.timeLimit} min
                                  </span>
                                  <span className="flex items-center gap-1">
                                    🎯 {test.totalPoints} pts
                                  </span>
                                </div>

                                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-200 dark:border-slate-700">
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

              {/* List View for Practice Tests */}
              {!isLoading && practiceTests.length > 0 && viewMode === 'list' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredPracticeTests.map((test) => (
                    <div
                      key={test._id}
                      onClick={() => {
                        markPracticeTestViewed(test._id);
                        sessionStorage.setItem('breadcrumb_context', 'private_library');
                        sessionStorage.setItem('breadcrumb_tab', activeTab);
                        router.push(`/student_page/practice_tests/${test._id}`);
                      }}
                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 cursor-pointer hover:shadow-lg hover:border-[#1C2B1C]/20 dark:hover:border-[#1C2B1C]/40 transition-all duration-200 group relative"
                    >
                      {/* Favorite + actions */}
                      <div className="absolute top-3 right-3 flex items-center gap-1 z-[5]">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(test._id, 'practice_test', test.isFavorite || false); }}
                          className={`p-1 rounded-lg transition-colors ${test.isFavorite ? 'text-yellow-500 hover:text-yellow-600' : 'text-gray-400 hover:text-yellow-500'}`}
                          title={test.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <svg className="w-4 h-4" fill={test.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        </button>

                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenMenuId(prev => prev === test._id ? null : test._id); }}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 dark:text-gray-500 hover:text-[#2E7D32] dark:hover:text-[hsl(142.1,76.2%,36.3%)] transition-all"
                          aria-label="Open actions"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                          </svg>
                        </button>

                        {/* Dropdown Menu */}
                        {openMenuId === test._id && (
                          <div 
                            className="absolute right-3 top-full mt-2 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-[60] origin-top-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-white hover:bg-slate-700/50 rounded-t-xl flex items-center gap-2"
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                markPracticeTestViewed(test._id);
                                sessionStorage.setItem('breadcrumb_context', 'private_library'); 
                                sessionStorage.setItem('breadcrumb_tab', activeTab); 
                                router.push(`/student_page/practice_tests/${test._id}`); 
                                setOpenMenuId(null); 
                              }}
                            >
                              <Eye className="w-4 h-4" />
                              View
                            </button>
                            <button
                              className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-white hover:bg-slate-700/50 flex items-center gap-2"
                              onClick={(e) => { e.stopPropagation(); handleRenamePracticeTest(test); setOpenMenuId(null); }}
                            >
                              <Edit2 className="w-4 h-4" />
                              Rename
                            </button>
                            <div className="h-px bg-gray-100 dark:bg-slate-700 mx-2" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePracticeTest(test._id);
                              }}
                              className="w-full px-4 py-3 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-b-xl transition-colors flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>

                      {/* NEW / COMPLETED Badge */}
                      <div className="mb-3">
                        {(test.lastReadAt || test.attempts > 0) ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-[#2E7D32] text-white">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            COMPLETED
                          </span>
                        ) : (!test.isRead && !viewedPracticeTestIds.has(test._id)) ? (
                          <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-[#00BCD4] text-white">
                            NEW
                          </span>
                        ) : null}
                      </div>

                      {test.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2 line-clamp-2">
                          {test.description}
                        </p>
                      )}
                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                        {formatDateTime(getDisplayDate(test)) || ''}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap mb-3">
                        <span className="inline-flex items-center px-2 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap rounded-full transition-colors bg-[#E8F5E9] text-[#2E7D32] dark:bg-[#1C2B1C] dark:text-[#04C40A]">
                          {test.subject}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mb-3">
                        <span className="flex items-center gap-1">
                          ⏱️ {test.timeLimit} min
                        </span>
                        <span className="flex items-center gap-1">
                          🎯 {test.totalPoints} pts
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-200 dark:border-slate-700">
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
              )}
            </div>
          )}
          {activeTab === 'summaries' && (
            <div id="summaries">
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

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}

              {!isLoading && !error && summaries.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">No summaries yet</h3>
                  <p className="text-gray-500 dark:text-slate-400 mb-4">Create your first summary to get started</p>
                </div>
              )}

              {!isLoading && !error && summaries.length > 0 && viewMode === 'folders' && (
                <div className="space-y-4">
                  {Array.from(summariesBySubject.entries()).map(([subject, items]) => (
                    <div key={subject} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-visible">
                      {/* Subject Header */}
                      <div className="w-full flex items-center justify-between p-6 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <button
                          onClick={() => setExpandedFolder(expandedFolder === subject ? null : subject)}
                          className="flex items-center gap-4 flex-1"
                        >
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${expandedFolder === subject
                            ? 'bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] text-white'
                            : 'bg-[#2E7D32]/10 dark:bg-[hsl(142.1,76.2%,36.3%)]/10 text-[#2E7D32] dark:text-[hsl(142.1,76.2%,36.3%)]'
                            }`}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="text-left">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{subject}</h3>
                            <p className="text-sm text-gray-500 dark:text-slate-400">{items.length} {items.length === 1 ? 'summary' : 'summaries'}</p>
                          </div>
                        </button>
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <button
                              onClick={(e) => { e.stopPropagation(); setOpenFolderMenu(openFolderMenu === subject ? null : subject); }}
                              className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-all"
                              aria-label="Folder options"
                            >
                              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                            </button>
                            {openFolderMenu === subject && (
                              <div className="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50" onClick={(e) => e.stopPropagation()}>
                                <button
                                      className="w-full text-left px-4 py-3 text-sm text-slate-700 dark:text-slate-100 hover:bg-[#E8F5E9] hover:text-[#2E7D32] dark:hover:bg-[#1C2B1C] dark:hover:text-[#04C40A] rounded-t-xl flex items-center gap-2"
                                      onClick={() => handleRenameFolder(subject, 'summaries')}
                                    >
                                       <Edit2 className="w-4 h-4" />
                                       Rename Folder
                                     </button>
                                <div className="h-px bg-slate-100 dark:bg-slate-700 mx-2" />
                                <button
                                  className="w-full text-left px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-b-xl flex items-center gap-2"
                                  onClick={() => handleDeleteFolder(subject, 'summaries')}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete Folder
                                </button>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => setExpandedFolder(expandedFolder === subject ? null : subject)}
                            className="p-1"
                          >
                            <svg
                              className={`w-5 h-5 text-gray-400 dark:text-slate-500 transition-transform ${expandedFolder === subject ? 'rotate-180' : ''}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Folder Contents */}
                      {expandedFolder === subject && (
                        <div className="border-t border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-900/30">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {items.map((summary) => (
                              <div
                                key={summary._id}
                                onClick={() => {
                                  // Only update local state to hide NEW badge (not persisted to DB)
                                  if (!summary.isRead) {
                                    setSummaries(prev => prev.map(s => s._id === summary._id ? { ...s, isRead: true } : s));
                                  }
                                  sessionStorage.setItem('breadcrumb_context', 'private_library');
                                  sessionStorage.setItem('breadcrumb_tab', activeTab);
                                  router.push(`/student_page/summaries/${summary._id}`);
                                }}
                                className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 cursor-pointer hover:shadow-lg hover:border-purple-600/20 dark:hover:border-purple-600/40 transition-all duration-200 group relative ${highlightedCardId === summary._id ? 'ring-2 ring-purple-500 animate-pulse' : ''} ${openMenuId === summary._id ? 'z-[70]' : ''}`}
                              >
                                {/* Favorite + actions (inside folder) */}
                                <div className="absolute top-3 right-3 flex items-center gap-1 z-[5]">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); toggleFavorite(summary._id, 'summary', summary.isFavorite || false); }}
                                    className={`p-1 rounded-lg transition-colors ${summary.isFavorite ? 'text-yellow-500 hover:text-yellow-600' : 'text-gray-400 hover:text-yellow-500'}`}
                                    title={summary.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                                  >
                                    <svg className="w-4 h-4" fill={summary.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                    </svg>
                                  </button>

                                  <button
                                    onClick={(e) => { e.stopPropagation(); setOpenMenuId(prev => prev === summary._id ? null : summary._id); }}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 dark:text-gray-500 hover:text-[#2E7D32] dark:hover:text-[hsl(142.1,76.2%,36.3%)] transition-all"
                                    aria-label="Open actions"
                                  >
                                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                  </button>

                                  {openMenuId === summary._id && (
                                    <div className="absolute right-3 top-full mt-2 w-44 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg z-[60] origin-top-right" onClick={(e) => e.stopPropagation()}>
                                      <button
                                        className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-white hover:bg-[#E8F5E9] hover:text-[#2E7D32] dark:hover:bg-[#1C2B1C] dark:hover:text-[#04C40A] rounded-t-xl flex items-center gap-2"
                                        onClick={() => { sessionStorage.setItem('breadcrumb_context', 'private_library'); sessionStorage.setItem('breadcrumb_tab', activeTab); router.push(`/student_page/summaries/${summary._id}`); setOpenMenuId(null); }}
                                      >
                                        <Eye className="w-4 h-4" />
                                        View
                                      </button>
                                      <button
                                        className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-white hover:bg-[#E8F5E9] hover:text-[#2E7D32] dark:hover:bg-[#1C2B1C] dark:hover:text-[#04C40A] flex items-center gap-2"
                                        onClick={() => { handleRenameSummary(summary); setOpenMenuId(null); }}
                                      >
                                        <Edit2 className="w-4 h-4" />
                                        Rename
                                      </button>
                                      <button
                                        className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-white hover:bg-[#E8F5E9] hover:text-[#2E7D32] dark:hover:bg-[#1C2B1C] dark:hover:text-[#04C40A] flex items-center gap-2"
                                        onClick={async () => {
                                          if (!userId) return;
                                          setOpenMenuId(null);
                                          try {
                                            setIsGenerating(true);
                                            const response = await fetch(`/api/student_page/flashcard/generate-from-text?userId=${userId}`, {
                                              method: 'POST',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify({ content: summary.content, title: `${summary.title} - Flashcards`, subject: summary.subject, difficulty: summary.difficulty, maxCards: 15 })
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
                                      >
                                        <FileText className="w-4 h-4" />
                                        Create Flashcards
                                      </button>
                                      <div className="h-px bg-gray-100 dark:bg-slate-700 mx-2" />
                                      <button
                                        className="w-full text-left px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-b-xl flex items-center gap-2"
                                        onClick={() => { handleDeleteSummary(summary._id); setOpenMenuId(null); }}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                        Delete
                                      </button>
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                    <span className="text-sm font-medium text-purple-500">Summary • {summary.wordCount} words</span>
                                  </div>
                                </div>
                                {/* NEW / COMPLETED Badge */}
                                <div className="mb-3">
                                  {(summary.isCompleted || !!summary.lastReadAt) ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-[#2E7D32] text-white">
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                      COMPLETED
                                    </span>
                                  ) : !summary.isRead ? (
                                    <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-[#00BCD4] text-white">
                                      NEW
                                    </span>
                                  ) : null}
                                </div>
                                <div className="mb-3">
                                  <h4 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-1 line-clamp-2">{summary.title}</h4>
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  {formatDateTime(getDisplayDate(summary)) || ''}
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

              {!isLoading && !error && summaries.length > 0 && viewMode === 'list' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredSummaries.map((summary) => (
                    <div
                      key={summary._id}
                      onClick={() => {
                        // Only update local state to hide NEW badge (not persisted to DB)
                        if (!summary.isRead) {
                          setSummaries(prev => prev.map(s => s._id === summary._id ? { ...s, isRead: true } : s));
                        }
                        sessionStorage.setItem('breadcrumb_context', 'private_library');
                        sessionStorage.setItem('breadcrumb_tab', activeTab);
                        router.push(`/student_page/summaries/${summary._id}`);
                      }}
                      className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 cursor-pointer hover:shadow-lg hover:border-purple-600/20 dark:hover:border-purple-600/40 transition-all duration-200 group relative ${openMenuId === summary._id ? 'z-[70]' : ''}`}
                    >
                      {/* Favorite + actions */}
                      <div className="absolute top-3 right-3 flex items-center gap-1 z-[5]">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(summary._id, 'summary', summary.isFavorite || false); }}
                          className={`p-1 rounded-lg transition-colors ${summary.isFavorite ? 'text-yellow-500 hover:text-yellow-600' : 'text-gray-400 hover:text-yellow-500'}`}
                          title={summary.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <svg className="w-4 h-4" fill={summary.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        </button>

                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenMenuId(prev => prev === summary._id ? null : summary._id); }}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 dark:text-gray-500 hover:text-[#2E7D32] dark:hover:text-[hsl(142.1,76.2%,36.3%)] transition-all"
                          aria-label="Open actions"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </button>

                        {openMenuId === summary._id && (
                          <div className="absolute right-3 top-full mt-2 w-44 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-lg z-[60] origin-top-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-white hover:bg-slate-700/50 rounded-t-xl flex items-center gap-2"
                              onClick={() => { sessionStorage.setItem('breadcrumb_context', 'private_library'); sessionStorage.setItem('breadcrumb_tab', activeTab); router.push(`/student_page/summaries/${summary._id}`); setOpenMenuId(null); }}
                            >
                              <Eye className="w-4 h-4" />
                              View
                            </button>
                            <button
                              className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-white hover:bg-slate-700/50 flex items-center gap-2"
                              onClick={() => { handleRenameSummary(summary); setOpenMenuId(null); }}
                            >
                              <Edit2 className="w-4 h-4" />
                              Rename
                            </button>
                            <button
                              className="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-white hover:bg-slate-700/50 flex items-center gap-2"
                              onClick={async () => {
                                if (!userId) return;
                                setOpenMenuId(null);
                                try {
                                  setIsGenerating(true);
                                  const response = await fetch(`/api/student_page/flashcard/generate-from-text?userId=${userId}`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ content: summary.content, title: `${summary.title} - Flashcards`, subject: summary.subject, difficulty: summary.difficulty, maxCards: 15 })
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
                            >
                              <FileText className="w-4 h-4" />
                              Create Flashcards
                            </button>
                            <div className="h-px bg-gray-100 dark:bg-slate-700 mx-2" />
                            <button
                              className="w-full text-left px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-b-xl flex items-center gap-2"
                              onClick={() => { handleDeleteSummary(summary._id); setOpenMenuId(null); }}
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                          <span className="text-sm font-medium text-purple-500">Summary • {summary.wordCount} words</span>
                        </div>
                      </div>
                      {/* NEW / COMPLETED Badge */}
                      <div className="mb-3">
                        {(summary.isCompleted || !!summary.lastReadAt) ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-[#2E7D32] text-white">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            COMPLETED
                          </span>
                        ) : !summary.isRead ? (
                          <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-[#00BCD4] text-white">
                            NEW
                          </span>
                        ) : null}
                      </div>

                      <div className="mb-3">
                        <h4 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-1 line-clamp-2">{summary.title}</h4>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                        {formatDateTime(getDisplayDate(summary)) || ''}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap mb-3">
                        <span className="inline-flex items-center px-2 py-0.5 text-[0.6875rem] font-semibold rounded-full transition-colors bg-[#E8F5E9] text-[#2E7D32] dark:bg-[#1C2B1C] dark:text-[#04C40A] max-w-full truncate">
                          {summary.subject}
                        </span>
                      </div>

                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {summary.summaryType}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'bookmarked' && (
            <div id="bookmarked">
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

              {!isLoading && flashcards.filter(f => f.isFavorite).length === 0 && practiceTests.filter(t => t.isFavorite).length === 0 && summaries.filter(s => s.isFavorite).length === 0 && (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">⭐</div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-2">No bookmarked items yet</h3>
                  <p className="text-gray-600 dark:text-slate-400 mb-6">
                    Click the star icon on any flashcard, practice test, or summary to bookmark it
                  </p>
                </div>
              )}

              {!isLoading && (flashcards.filter(f => f.isFavorite).length > 0 || practiceTests.filter(t => t.isFavorite).length > 0 || summaries.filter(s => s.isFavorite).length > 0) && (
                <div className="space-y-8">
                  {/* Bookmarked Flashcards */}
                  {flashcards.filter(f => f.isFavorite).length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                        <span className="text-teal-600">📚</span> Flashcards ({flashcards.filter(f => f.isFavorite).length})
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {flashcards.filter(f => f.isFavorite).map((flashcard) => (
                          <div
                            key={flashcard._id}
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-lg transition-shadow cursor-pointer relative"
                            onClick={() => {
                              markFlashcardViewed(flashcard._id);
                              // Locally mark as read to hide NEW like summaries (not persisted)
                              setFlashcards(prev => prev.map(f => f._id === flashcard._id ? { ...f, isRead: true } : f));
                              router.push(`/student_page/private_library/${flashcard._id}`);
                            }}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(flashcard._id, 'flashcard', flashcard.isFavorite || false);
                              }}
                              className="absolute top-3 right-3 text-yellow-500 hover:scale-110 transition-transform z-[5]"
                              title="Remove from favorites"
                            >
                              ⭐
                            </button>

                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="w-2 h-2 bg-teal-500 rounded-full"></div>
                                <span className="text-sm font-medium text-teal-500">Flashcard • {flashcard.cards?.length || 0} cards</span>
                              </div>
                            </div>
                            {/* NEW / COMPLETED Badge */}
                            <div className="mb-3">
                              {flashcard.lastReadAt ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-[#2E7D32] text-white">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  COMPLETED
                                </span>
                              ) : (!flashcard.isRead && !viewedFlashcardIds.has(flashcard._id)) ? (
                                <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-[#00BCD4] text-white">
                                  NEW
                                </span>
                              ) : null}
                            </div>

                            <div className="mb-3">
                              <h4 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-1 line-clamp-2">{flashcard.title}</h4>
                              {flashcard.description && (
                                <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{flashcard.description}</p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              {flashcard.subject && (
                                <span className="inline-flex items-center px-2 py-0.5 text-[0.6875rem] font-semibold rounded-full transition-colors bg-[#E8F5E9] text-[#2E7D32] dark:bg-[#1C2B1C] dark:text-[#04C40A] max-w-full truncate">
                                  {flashcard.subject}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bookmarked Practice Tests */}
                  {practiceTests.filter(t => t.isFavorite).length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                        <span className="text-blue-600">📝</span> Practice Tests ({practiceTests.filter(t => t.isFavorite).length})
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {practiceTests.filter(t => t.isFavorite).map((test) => (
                          <div
                            key={test._id}
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-lg transition-shadow cursor-pointer relative"
                            onClick={() => {
                              markPracticeTestViewed(test._id);
                              sessionStorage.setItem('breadcrumb_context', 'private_library');
                              sessionStorage.setItem('breadcrumb_tab', activeTab);
                              router.push(`/student_page/practice_tests/${test._id}`);
                            }}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(test._id, 'practice_test', test.isFavorite || false);
                              }}
                              className="absolute top-3 right-3 text-yellow-500 hover:scale-110 transition-transform z-[5]"
                              title="Remove from favorites"
                            >
                              ⭐
                            </button>

                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="w-2 h-2 bg-[#2E7D32] rounded-full"></div>
                                <span className="text-sm font-medium text-[#2E7D32] dark:text-[#04C40A]">Practice Test • {test.timeLimit} min</span>
                              </div>
                            </div>
                            {/* NEW / COMPLETED Badge */}
                            <div className="mb-3">
                              {(test.lastReadAt || test.attempts > 0) ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-[#2E7D32] text-white">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  COMPLETED
                                </span>
                              ) : (!test.isRead && !viewedPracticeTestIds.has(test._id)) ? (
                                <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-[#00BCD4] text-white">
                                  NEW
                                </span>
                              ) : null}
                            </div>

                            <div className="mb-3">
                              <h4 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-1 line-clamp-2 break-words">{test.title}</h4>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="inline-flex items-center px-2 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap rounded-full transition-colors bg-[#E8F5E9] text-[#2E7D32] dark:bg-[#1C2B1C] dark:text-[#04C40A]">
                                  {test.difficulty}
                                </span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  {test.totalPoints} pts
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="inline-flex items-center px-2 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap rounded-full transition-colors bg-[#E8F5E9] text-[#2E7D32] dark:bg-[#1C2B1C] dark:text-[#04C40A]">
                                {test.subject}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bookmarked Summaries */}
                  {summaries.filter(s => s.isFavorite).length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                        <span className="text-purple-600">📄</span> Summaries ({summaries.filter(s => s.isFavorite).length})
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {summaries.filter(s => s.isFavorite).map((summary) => (
                          <div
                            key={summary._id}
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-lg transition-shadow cursor-pointer relative"
                            onClick={() => {
                              // Only update local state to hide NEW badge (not persisted to DB)
                              if (!summary.isRead) {
                                setSummaries(prev => prev.map(s => s._id === summary._id ? { ...s, isRead: true } : s));
                              }
                              sessionStorage.setItem('breadcrumb_context', 'private_library');
                              sessionStorage.setItem('breadcrumb_tab', activeTab);
                              router.push(`/student_page/summaries/${summary._id}`);
                            }}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(summary._id, 'summary', summary.isFavorite || false);
                              }}
                              className="absolute top-3 right-3 text-yellow-500 hover:scale-110 transition-transform z-[5]"
                              title="Remove from favorites"
                            >
                              ⭐
                            </button>

                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                <span className="text-sm font-medium text-purple-500">Summary • {summary.wordCount} words</span>
                              </div>
                            </div>
                            {/* NEW / COMPLETED Badge */}
                            <div className="mb-3">
                              {(summary.isCompleted || !!summary.lastReadAt) ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-[#2E7D32] text-white">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  COMPLETED
                                </span>
                              ) : !summary.isRead ? (
                                <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-[#00BCD4] text-white">
                                  NEW
                                </span>
                              ) : null}
                            </div>

                            <div className="mb-3">
                              <h4 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-1 line-clamp-2">{summary.title}</h4>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {formatDateTime(getDisplayDate(summary)) || ''}
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="inline-flex items-center px-2 py-0.5 text-[0.6875rem] font-semibold rounded-full transition-colors bg-[#E8F5E9] text-[#2E7D32] dark:bg-[#1C2B1C] dark:text-[#04C40A] max-w-full truncate">
                                {summary.subject}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete Folder Confirmation Modal */}
      {showDeleteFolderModal && folderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDeleteFolderModal(false)}></div>
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Delete Folder</h3>
              <button
                className="text-gray-400 dark:text-slate-500 hover:text-[#1C2B1C] p-1"
                onClick={() => setShowDeleteFolderModal(false)}
                aria-label="Close"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-6">
              What would you like to do with the folder &quot;{folderToDelete.subject}&quot;?
            </p>
            <div className="space-y-3">
              <button
                onClick={() => confirmDeleteFolder(false)}
                className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 rounded-xl font-medium transition-colors text-left"
              >
                <div className="font-semibold mb-1">Delete folder only</div>
                <div className="text-xs text-slate-600 dark:text-slate-400">Move items to &quot;Uncategorized&quot;</div>
              </button>
              <button
                onClick={() => confirmDeleteFolder(true)}
                className="w-full px-4 py-3 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl font-medium transition-colors text-left border border-red-200 dark:border-red-800"
              >
                <div className="font-semibold mb-1">Delete folder and contents</div>
                <div className="text-xs text-red-500 dark:text-red-400">This cannot be undone</div>
              </button>
              <button
                onClick={() => setShowDeleteFolderModal(false)}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium transition-colors border border-slate-200 dark:border-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Loading Modal for Flashcard Generation */}
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
  );
}

export default function PrivateLibraryPage() {
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
              <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-24 py-3"></div>
            </div>
          </div>
          
          {/* Cards Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
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
      <PrivateLibraryContent />
    </Suspense>
  );
}