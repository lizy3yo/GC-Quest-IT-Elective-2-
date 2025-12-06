"use client";

import "../dashboard/styles.css";
import React, { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";

type FlashcardItem = {
  _id: string;
  title: string;
  description?: string;
  subject?: string;
  cards?: Array<{ _id: string; question: string; answer: string }>;
  lastReadAt?: string;
  updatedAt?: string;
  createdAt?: string;
};

export default function PracticeTestsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"sets" | "summary" | "upload" | "paste" | "drive">("sets");
  const [flashcards, setFlashcards] = useState<FlashcardItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [selectedSummaryIds, setSelectedSummaryIds] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [expandedFolder, setExpandedFolder] = useState<string | null>(null);
  const [expandedSummaryFolder, setExpandedSummaryFolder] = useState<string | null>(null);

  // Summary state
  type SummaryItem = {
    _id: string;
    title: string;
    content?: string;
    subject?: string;
    summaryType?: string;
    lastReadAt?: string;
    createdAt?: string;
    updatedAt?: string;
  };
  const [summaries, setSummaries] = useState<SummaryItem[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // files + refs
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // paste state + ref
  const [pasteText, setPasteText] = useState<string>("");
  const pasteRef = useRef<HTMLTextAreaElement | null>(null);

  // Format date/time exactly as: MM/DD/YYYY - hh:mm AM/PM (same as private library)
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

  // new: search & select all
  const [query, setQuery] = useState("");
  const visibleFlashcards = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return flashcards;
    return flashcards.filter((f) => {
      const title = (f.title || "").toLowerCase();
      const desc = (f.description || "").toLowerCase();
      return title.includes(q) || desc.includes(q);
    });
  }, [flashcards, query]);

  // Group flashcards by subject
  const flashcardsBySubject = useMemo(() => {
    const grouped = new Map<string, FlashcardItem[]>();
    
    visibleFlashcards.forEach((flashcard) => {
      const subject = flashcard.subject || 'Uncategorized';
      if (!grouped.has(subject)) {
        grouped.set(subject, []);
      }
      grouped.get(subject)!.push(flashcard);
    });

    // Sort alphabetically within each subject
    grouped.forEach((cards) => {
      cards.sort((a, b) => a.title.localeCompare(b.title));
    });

    return grouped;
  }, [visibleFlashcards]);

  // Summary search query
  const [summaryQuery, setSummaryQuery] = useState("");
  const visibleSummaries = useMemo(() => {
    const q = summaryQuery.trim().toLowerCase();
    if (!q) return summaries;
    return summaries.filter((s) => {
      const title = (s.title || "").toLowerCase();
      const content = (s.content || "").toLowerCase();
      return title.includes(q) || content.includes(q);
    });
  }, [summaries, summaryQuery]);

  // Group summaries by subject
  const summariesBySubject = useMemo(() => {
    const grouped = new Map<string, SummaryItem[]>();
    
    visibleSummaries.forEach((summary) => {
      const subject = summary.subject || 'Uncategorized';
      if (!grouped.has(subject)) {
        grouped.set(subject, []);
      }
      grouped.get(subject)!.push(summary);
    });

    // Sort alphabetically within each subject
    grouped.forEach((items) => {
      items.sort((a, b) => a.title.localeCompare(b.title));
    });

    return grouped;
  }, [visibleSummaries]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
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
        if (!uid) uid = localStorage.getItem("userId");
        if (!uid) {
          uid = `temp-user-${Date.now()}`;
          localStorage.setItem("userId", uid);
        }
        if (!mounted) return;
        setUserId(uid);

        // Fetch flashcards
        const res = await fetch(`/api/student_page/flashcard?userId=${uid}`, { cache: "no-store" });
        if (!res.ok) {
          const maybe = await res.json().catch(() => ({} as unknown));
          throw new Error(maybe?.message || `Failed to load (${res.status})`);
        }
        const data = (await res.json()) as { flashcards?: FlashcardItem[] };
        if (!mounted) return;
        setFlashcards(Array.isArray(data?.flashcards) ? data.flashcards : []);

        // Fetch summaries in parallel
        const token = localStorage.getItem("accessToken");
        const summaryRes = await fetch(`/api/student_page/summary?userId=${uid}`, {
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          if (!mounted) return;
          setSummaries(Array.isArray(summaryData?.summaries) ? summaryData.summaries : []);
        }
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load flashcards.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  // Fetch summaries when summary tab is selected (fallback if not loaded initially)
  useEffect(() => {
    if (tab !== "summary" || summaries.length > 0) return;
    
    let mounted = true;
    async function loadSummaries() {
      setSummaryLoading(true);
      setSummaryError(null);
      try {
        // Get userId from state or localStorage
        let uid = userId;
        if (!uid) {
          uid = localStorage.getItem("userId");
        }
        if (!uid) {
          // Try to get from current user API
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
        }
        
        if (!uid) {
          throw new Error("User ID not found. Please log in again.");
        }
        
        const token = localStorage.getItem("accessToken");
        const res = await fetch(`/api/student_page/summary?userId=${uid}`, {
          cache: "no-store",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          const maybe = await res.json().catch(() => ({} as unknown));
          throw new Error(maybe?.error || maybe?.message || `Failed to load summaries (${res.status})`);
        }
        const data = await res.json();
        if (!mounted) return;
        setSummaries(Array.isArray(data?.summaries) ? data.summaries : []);
      } catch (e: any) {
        if (!mounted) return;
        setSummaryError(e?.message || "Failed to load summaries.");
      } finally {
        if (mounted) setSummaryLoading(false);
      }
    }
    loadSummaries();
    return () => { mounted = false; };
  }, [tab, summaries.length, userId]);

  const toggleSelect = (id: string) =>
    setSelectedIds((p) => ({ ...p, [id]: !p[id] }));

  const toggleSummarySelect = (id: string) =>
    setSelectedSummaryIds((p) => ({ ...p, [id]: !p[id] }));

  const selectedCount = Object.values(selectedIds).filter(Boolean).length;
  const selectedSummaryCount = Object.values(selectedSummaryIds).filter(Boolean).length;

  const selectAllVisible = () => {
    const visibleIds = visibleFlashcards.map((f) => f._id);
    const allSelected = visibleIds.every((id) => !!selectedIds[id]);
    if (allSelected) {
      // deselect visible
      setSelectedIds((prev) => {
        const copy = { ...prev };
        visibleIds.forEach((id) => delete copy[id]);
        return copy;
      });
    } else {
      // select visible
      setSelectedIds((prev) => {
        const copy = { ...prev };
        visibleIds.forEach((id) => { copy[id] = true; });
        return copy;
      });
    }
  };

  const selectAllVisibleSummaries = () => {
    const visibleIds = visibleSummaries.map((s) => s._id);
    const allSelected = visibleIds.every((id) => !!selectedSummaryIds[id]);
    if (allSelected) {
      setSelectedSummaryIds((prev) => {
        const copy = { ...prev };
        visibleIds.forEach((id) => delete copy[id]);
        return copy;
      });
    } else {
      setSelectedSummaryIds((prev) => {
        const copy = { ...prev };
        visibleIds.forEach((id) => { copy[id] = true; });
        return copy;
      });
    }
  };

  // file handlers
  const handleFilesAdd = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const newFilesArray = Array.from(newFiles);
    console.log('Adding files:', newFilesArray.map(f => f.name));
    setFiles((prev) => [...prev, ...newFilesArray]);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File input changed, files:', e.target.files?.length || 0);
    handleFilesAdd(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleFilesAdd(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const removeFileAt = (index: number) =>
    setFiles((p) => p.filter((_, i) => i !== index));

  // paste handlers
  const handlePasteInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPasteText(e.target.value);
  };

  const handlePasteDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const list = e.dataTransfer.files;
    if (list && list.length > 0) {
      const file = list[0];
      const textTypes = ["text/", "application/json", "application/xml", "application/xhtml+xml", "application/javascript"];
      if (textTypes.some((t) => file.type.startsWith(t)) || file.name.match(/\.(txt|md|csv|json|xml|html?|js)$/i)) {
        const reader = new FileReader();
        reader.onload = () => {
          const txt = String(reader.result || "");
          setPasteText((prev) => (prev ? prev + "\n\n" + txt : txt));
        };
        reader.readAsText(file);
      }
    } else {
      const dtText = e.dataTransfer.getData("text");
      if (dtText) setPasteText((prev) => (prev ? prev + "\n\n" + dtText : dtText));
    }
  };

  const handlePasteDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
  };

  const allowGenerate = selectedCount > 0 || selectedSummaryCount > 0 || files.length > 0 || pasteText.trim().length > 0;

  const handleGenerate = async () => {
    if (!allowGenerate) return;
    
    // Get selected IDs from both flashcards and summaries
    const flashcardIds = Object.keys(selectedIds).filter((k) => selectedIds[k]);
    const summaryIds = Object.keys(selectedSummaryIds).filter((k) => selectedSummaryIds[k]);
    const hasFiles = files.length > 0;
    const hasPaste = tab === "paste" && pasteText.trim().length > 0;
    
    // Clear breadcrumb context
    sessionStorage.removeItem('breadcrumb_context');
    
    // Store files in sessionStorage if any
    if (hasFiles) {
      try {
        const filePromises = files.map(file => {
          return new Promise<{ name: string; type: string; data: string }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                name: file.name,
                type: file.type,
                data: reader.result as string
              });
            };
            reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
            reader.readAsDataURL(file);
          });
        });
        const fileData = await Promise.all(filePromises);
        sessionStorage.setItem("practice_test_upload_files", JSON.stringify(fileData));
      } catch (error) {
        console.error('Error processing files:', error);
        alert('Failed to process files. Please try again.');
        return;
      }
    }
    
    // Build URL params based on what's selected
    const params = new URLSearchParams();
    
    if (flashcardIds.length > 0) {
      params.set('sets', flashcardIds.join(','));
    }
    if (summaryIds.length > 0) {
      params.set('summaries', summaryIds.join(','));
    }
    if (hasFiles) {
      params.set('hasFiles', 'true');
    }
    if (hasPaste) {
      sessionStorage.setItem("practice_test_paste_text", pasteText);
      params.set('source', 'paste');
    }
    
    // If only paste text (no other selections)
    if (hasPaste && flashcardIds.length === 0 && summaryIds.length === 0 && !hasFiles) {
      router.push(`/student_page/practice_tests/generate?source=paste`);
      return;
    }
    
    // If only files (no other selections)
    if (hasFiles && flashcardIds.length === 0 && summaryIds.length === 0) {
      router.push(`/student_page/practice_tests/generate?source=upload`);
      return;
    }
    
    router.push(`/student_page/practice_tests/generate?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900" style={{ padding: '1.5rem' }}>
      <div style={{ maxWidth: '80rem', marginLeft: 'auto', marginRight: 'auto' }}>
        {/* Header Card - matching ai-studio style */}
        <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-8 mb-8 overflow-hidden">
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#2E7D32]/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-400/5 rounded-full blur-3xl" />
          
          <div className="relative">
            <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2">
              Practice Tests
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              Choose sets or upload materials to create tailored practice questions
            </p>
          </div>
        </div>

      <div className="mb-8 bg-transparent">
        <div className="flex gap-6 border-b border-slate-200 dark:border-slate-700">
          {(['sets','summary','upload','paste'] as const).map((t) => {
            const label = t === 'sets' ? 'Flashcard' : t === 'summary' ? 'Summary' : t === 'upload' ? 'Upload files' : 'Paste text';
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`py-3 text-sm font-medium transition-colors ${
                  tab === t
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

      {/* Selection Summary Bar - shows when items are selected */}
      {(selectedCount > 0 || selectedSummaryCount > 0 || files.length > 0 || pasteText.trim().length > 0) && (
        <div className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Selected: {selectedCount > 0 && <span>{selectedCount} flashcard{selectedCount !== 1 ? 's' : ''}</span>}
                {selectedCount > 0 && (selectedSummaryCount > 0 || files.length > 0 || pasteText.trim().length > 0) && <span>, </span>}
                {selectedSummaryCount > 0 && <span>{selectedSummaryCount} summar{selectedSummaryCount !== 1 ? 'ies' : 'y'}</span>}
                {selectedSummaryCount > 0 && (files.length > 0 || pasteText.trim().length > 0) && <span>, </span>}
                {files.length > 0 && <span>{files.length} file{files.length !== 1 ? 's' : ''}</span>}
                {files.length > 0 && pasteText.trim().length > 0 && <span>, </span>}
                {pasteText.trim().length > 0 && <span>pasted text</span>}
              </div>
              {(selectedCount > 0 || selectedSummaryCount > 0 || files.length > 0 || pasteText.trim().length > 0) && (
                <button
                  onClick={() => {
                    setSelectedIds({});
                    setSelectedSummaryIds({});
                    setFiles([]);
                    setPasteText('');
                  }}
                  className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline"
                >
                  Clear all
                </button>
              )}
            </div>
            <button
              onClick={handleGenerate}
              disabled={!allowGenerate}
              className={`px-6 py-2 rounded-xl font-semibold text-sm transition-all ${!allowGenerate ? "bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed" : "bg-emerald-500 text-white shadow-md hover:shadow-lg hover:scale-[1.02]"}`}
            >
              Generate
            </button>
          </div>
        </div>
      )}

      <div className="space-y-6">
          {tab === "sets" && (
            <>
              {/* search + select all + generate in one row */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 max-w-md">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search sets by title or description"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-[#BCBCBC] focus:outline-none focus:ring-2 focus:ring-[#1C2B1C]"
                  />
                </div>

                <button
                  onClick={selectAllVisible}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-[#E8F5E9] dark:bg-[#1C2B1C] text-[#2E7D32] dark:text-[#04C40A] hover:bg-[#E8F5E9]/80 dark:hover:bg-[#1C2B1C]/80 transition-colors"
                  aria-pressed={visibleFlashcards.length > 0 && visibleFlashcards.every(f => !!selectedIds[f._id])}
                >
                  <div className="relative w-4 h-4 flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full border-2 border-[#2E7D32] dark:border-[#04C40A]"></div>
                    {visibleFlashcards.length > 0 && visibleFlashcards.every(f => !!selectedIds[f._id]) && (
                      <div className="absolute w-2.5 h-2.5 rounded-full bg-[#2E7D32] dark:bg-[#04C40A]"></div>
                    )}
                  </div>
                  <span>{visibleFlashcards.length > 0 && visibleFlashcards.every(f => !!selectedIds[f._id]) ? 'Deselect all' : 'Select all'}</span>
                </button>

                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {visibleFlashcards.length} {visibleFlashcards.length === 1 ? 'set' : 'sets'}
                </div>
              </div>

              {loading && (
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

              {!loading && error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-4">
                  <p className="text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              {!loading && !error && visibleFlashcards.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">No sets match your search</h3>
                  <p className="text-gray-500 dark:text-slate-400 mb-4">Try a different search or create a new set.</p>
                  <button onClick={() => router.push('/student_page/flashcards/create')} className="px-4 py-2 bg-[#1C2B1C] text-white rounded-xl">Create a set</button>
                </div>
              )}

              <div className="space-y-4">
                {!loading && !error && Array.from(flashcardsBySubject.entries()).map(([subject, items]) => (
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

                    {/* Folder Contents */}
                    {expandedFolder === subject && (
                      <div className="border-t border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-900/30">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {items.map((item) => {
                            const selected = !!selectedIds[item._id];
                            return (
                              <div
                                key={item._id}
                                onClick={() => toggleSelect(item._id)}
                                className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 cursor-pointer hover:shadow-lg hover:border-[#1C2B1C]/20 dark:hover:border-[#1C2B1C]/40 transition-all relative`}
                              >
                                {/* Radio button in top right corner */}
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleSelect(item._id); }}
                                  className="absolute top-4 right-4 w-5 h-5 flex items-center justify-center"
                                  aria-pressed={selected}
                                >
                                  <div className="relative w-5 h-5 flex items-center justify-center">
                                    <div className={`w-5 h-5 rounded-full border-2 transition-colors ${selected ? 'border-[#2E7D32] dark:border-[#04C40A]' : 'border-slate-300 dark:border-slate-600'}`}></div>
                                    {selected && (
                                      <div className="absolute w-3 h-3 rounded-full bg-[#2E7D32] dark:bg-[#04C40A]"></div>
                                    )}
                                  </div>
                                </button>

                                <div className="flex items-start justify-between mb-4 pr-8">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-[#1C2B1C] rounded-full"></div>
                                    <span className="text-sm font-medium text-[#1C2B1C]">{item.cards?.length || 0} cards</span>
                                  </div>
                                </div>

                                <div className="mb-3">
                                  <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-1 line-clamp-2">{item.title}</h3>
                                  {item.description && <p className="text-sm text-gray-600 dark:text-slate-400 line-clamp-2">{item.description}</p>}
                                </div>

                                <div className="flex items-center justify-end">
                                  <span className="text-xs text-gray-400 dark:text-slate-500">{formatDateTime(getDisplayDate(item)) || ''}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === "summary" && (
            <>
              {/* search + select all + generate in one row */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 max-w-md">
                  <input
                    value={summaryQuery}
                    onChange={(e) => setSummaryQuery(e.target.value)}
                    placeholder="Search summaries by title or content"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-[#BCBCBC] focus:outline-none focus:ring-2 focus:ring-[#1C2B1C]"
                  />
                </div>

                <button
                  onClick={selectAllVisibleSummaries}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold bg-[#E8F5E9] dark:bg-[#1C2B1C] text-[#2E7D32] dark:text-[#04C40A] hover:bg-[#E8F5E9]/80 dark:hover:bg-[#1C2B1C]/80 transition-colors"
                  aria-pressed={visibleSummaries.length > 0 && visibleSummaries.every(s => !!selectedSummaryIds[s._id])}
                >
                  <div className="relative w-4 h-4 flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full border-2 border-[#2E7D32] dark:border-[#04C40A]"></div>
                    {visibleSummaries.length > 0 && visibleSummaries.every(s => !!selectedSummaryIds[s._id]) && (
                      <div className="absolute w-2.5 h-2.5 rounded-full bg-[#2E7D32] dark:bg-[#04C40A]"></div>
                    )}
                  </div>
                  <span>{visibleSummaries.length > 0 && visibleSummaries.every(s => !!selectedSummaryIds[s._id]) ? 'Deselect all' : 'Select all'}</span>
                </button>

                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {visibleSummaries.length} {visibleSummaries.length === 1 ? 'summary' : 'summaries'}
                </div>
              </div>

              {summaryLoading && (
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

              {!summaryLoading && summaryError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-4">
                  <p className="text-red-600 dark:text-red-400">{summaryError}</p>
                </div>
              )}

              {!summaryLoading && !summaryError && visibleSummaries.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">No summaries found</h3>
                  <p className="text-gray-500 dark:text-slate-400 mb-4">Create summaries from your study materials to generate practice tests.</p>
                </div>
              )}

              <div className="space-y-4">
                {!summaryLoading && !summaryError && Array.from(summariesBySubject.entries()).map(([subject, items]) => (
                  <div 
                    key={subject}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-visible"
                  >
                    {/* Folder Header */}
                    <div className="w-full flex items-center justify-between p-6 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <button
                        onClick={() => setExpandedSummaryFolder(expandedSummaryFolder === subject ? null : subject)}
                        className="flex items-center gap-4 flex-1"
                      >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                          expandedSummaryFolder === subject 
                            ? 'bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] text-white' 
                            : 'bg-[#2E7D32]/10 dark:bg-[hsl(142.1,76.2%,36.3%)]/10 text-[#2E7D32] dark:text-[hsl(142.1,76.2%,36.3%)]'
                        }`}>
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="text-left">
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{subject}</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {items.length} {items.length === 1 ? 'summary' : 'summaries'}
                          </p>
                        </div>
                      </button>
                      <button
                        onClick={() => setExpandedSummaryFolder(expandedSummaryFolder === subject ? null : subject)}
                        className="p-1"
                      >
                        <svg 
                          className={`w-5 h-5 text-slate-400 transition-transform ${expandedSummaryFolder === subject ? 'rotate-180' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    {/* Folder Contents */}
                    {expandedSummaryFolder === subject && (
                      <div className="border-t border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-900/30">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {items.map((item) => {
                            const selected = !!selectedSummaryIds[item._id];
                            return (
                              <div
                                key={item._id}
                                onClick={() => toggleSummarySelect(item._id)}
                                className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 cursor-pointer hover:shadow-lg hover:border-[#1C2B1C]/20 dark:hover:border-[#1C2B1C]/40 transition-all relative`}
                              >
                                {/* Radio button in top right corner */}
                                <button
                                  onClick={(e) => { e.stopPropagation(); toggleSummarySelect(item._id); }}
                                  className="absolute top-4 right-4 w-5 h-5 flex items-center justify-center"
                                  aria-pressed={selected}
                                >
                                  <div className="relative w-5 h-5 flex items-center justify-center">
                                    <div className={`w-5 h-5 rounded-full border-2 transition-colors ${selected ? 'border-[#2E7D32] dark:border-[#04C40A]' : 'border-slate-300 dark:border-slate-600'}`}></div>
                                    {selected && (
                                      <div className="absolute w-3 h-3 rounded-full bg-[#2E7D32] dark:bg-[#04C40A]"></div>
                                    )}
                                  </div>
                                </button>

                                <div className="flex items-start justify-between mb-4 pr-8">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-[#1C2B1C] rounded-full"></div>
                                    <span className="text-sm font-medium text-[#1C2B1C]">{item.summaryType || 'Summary'}</span>
                                  </div>
                                </div>

                                <div className="mb-3">
                                  <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-1 line-clamp-2">{item.title}</h3>
                                  {item.content && <p className="text-sm text-gray-600 dark:text-slate-400 line-clamp-2">{item.content.substring(0, 100)}...</p>}
                                </div>

                                <div className="flex items-center justify-end">
                                  <span className="text-xs text-gray-400 dark:text-slate-500">{formatDateTime(getDisplayDate(item)) || ''}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === "upload" && (
            <div>
              {/* Hidden file input - always rendered */}
              <input 
                ref={fileInputRef} 
                onChange={handleFileInput} 
                type="file" 
                accept=".pdf,.docx,.doc,.txt"
                className="hidden" 
                multiple 
              />
              
              <div className="flex items-center justify-between mb-6">
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {files.length} {files.length === 1 ? 'file' : 'files'}
                </div>
              </div>

              {files.length === 0 ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl py-8 flex flex-col items-center justify-center gap-3 text-center bg-slate-50 dark:bg-slate-900"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-sky-400 to-indigo-500 rounded-md flex items-center justify-center text-white text-xs font-bold">DOC</div>
                    <div className="w-8 h-8 bg-gradient-to-r from-pink-400 to-rose-500 rounded-md flex items-center justify-center text-white text-xs font-bold">PDF</div>
                    <div className="w-8 h-8 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-md flex items-center justify-center text-white text-xs font-bold">TXT</div>
                  </div>
                  <div className="text-slate-700 dark:text-slate-300 font-medium">Drag notes, documents, or readings here</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Supported: .pdf, .docx, .doc, .txt</div>
                  <div className="mt-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-full shadow-sm text-sm font-medium text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                    >
                      Browse files
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{f.name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{(f.size / 1024).toFixed(1)} KB</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => removeFileAt(i)} 
                        className="ml-3 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                  >
                    + Add more files
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === "paste" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {pasteText.trim().length > 0 ? `${pasteText.trim().length} characters` : 'No text'}
                </div>
              </div>

              <textarea
                ref={pasteRef}
                value={pasteText}
                onChange={handlePasteInput}
                onDrop={handlePasteDrop}
                onDragOver={handlePasteDragOver}
                placeholder="Paste text here or drop a file"
                className="w-full min-h-[200px] rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent p-4 text-slate-900 dark:text-slate-100 resize-vertical"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Tip: drop a .txt/.md/.json file to append its contents</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}