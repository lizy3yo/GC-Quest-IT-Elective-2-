"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";

type FlashcardItem = {
  _id: string;
  title: string;
  description?: string;
  cards?: Array<{ _id: string; question: string; answer: string }>;
  updatedAt?: string;
  createdAt?: string;
};

export default function PracticeTestsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"sets" | "upload" | "paste" | "drive">("sets");
  const [flashcards, setFlashcards] = useState<FlashcardItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // files + refs
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // paste state + ref
  const [pasteText, setPasteText] = useState<string>("");
  const pasteRef = useRef<HTMLTextAreaElement | null>(null);

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

        const res = await fetch(`/api/student_page/flashcard?userId=${uid}`, { cache: "no-store" });
        if (!res.ok) {
          const maybe = await res.json().catch(() => ({} as unknown));
          throw new Error(maybe?.message || `Failed to load (${res.status})`);
        }
        const data = (await res.json()) as { flashcards?: FlashcardItem[] };
        if (!mounted) return;
        setFlashcards(Array.isArray(data?.flashcards) ? data.flashcards : []);
      } catch (e: unknown) {
        if (!mounted) return;
        setError((e as any)?.message || "Failed to load flashcards.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const toggleSelect = (id: string) =>
    setSelectedIds((p) => ({ ...p, [id]: !p[id] }));

  const selectedCount = Object.values(selectedIds).filter(Boolean).length;

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

  // file handlers
  const handleFilesAdd = (newFiles: FileList | null) => {
    if (!newFiles) return;
    setFiles((prev) => [...prev, ...Array.from(newFiles)]);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const allowGenerate = selectedCount > 0 || files.length > 0 || pasteText.trim().length > 0;

  const handleGenerate = () => {
    if (!allowGenerate) return;
    if (tab === "upload") {
      sessionStorage.setItem("practice_test_upload_files", JSON.stringify(files.map((f) => f.name)));
      router.push(`/student_page/practice_tests/generate?source=upload`);
      return;
    }
    if (tab === "paste") {
      sessionStorage.setItem("practice_test_paste_text", pasteText);
      router.push(`/student_page/practice_tests/generate?source=paste`);
      return;
    }
    const ids = Object.keys(selectedIds).filter((k) => selectedIds[k]);
    router.push(`/student_page/practice_tests/generate?sets=${encodeURIComponent(ids.join(","))}`);
  };

  return (
    <>
      <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">Generate a practice test</h1>
        <p className="text-slate-600 dark:text-slate-400">Choose sets or upload materials to create tailored practice questions.</p>
      </div>

      <div className="mb-8 bg-transparent">
        <div className="flex gap-6 border-b border-slate-200 dark:border-slate-700">
          {['sets','upload','paste'].map((t) => {
            const label = t === 'sets' ? 'Flashcard sets' : t === 'upload' ? 'Upload files' : 'Paste text';
            return (
              <button
                key={t}
                onClick={() => setTab(t as any)}
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
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1C2B1C]"
                  />
                </div>

                <button
                  onClick={selectAllVisible}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  aria-pressed={visibleFlashcards.length > 0 && visibleFlashcards.every(f => !!selectedIds[f._id])}
                >
                  <CheckCircle 
                    size={16} 
                    className={visibleFlashcards.length > 0 && visibleFlashcards.every(f => !!selectedIds[f._id]) ? 'fill-current' : ''}
                  />
                  <span>{visibleFlashcards.length > 0 && visibleFlashcards.every(f => !!selectedIds[f._id]) ? 'Deselect all' : 'Select all'}</span>
                </button>

                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {visibleFlashcards.length} {visibleFlashcards.length === 1 ? 'set' : 'sets'}
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={!allowGenerate}
                  className={`ml-auto px-6 py-2 rounded-xl font-semibold text-sm transition-all ${!allowGenerate ? "bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed" : "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md hover:shadow-lg hover:scale-[1.02]"}`}
                >
                  Generate
                </button>
              </div>

              {loading && (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="w-8 h-8 border-2 border-[#1C2B1C] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-500 dark:text-slate-400">Loading your flashcard sets...</p>
                  </div>
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

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {!loading && !error && visibleFlashcards.map((item) => {
                  const selected = !!selectedIds[item._id];
                  return (
                    <div
                      key={item._id}
                      className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-[var(--dark-border,#2E2E2E)] rounded-2xl p-6 cursor-pointer hover:shadow-lg hover:border-[#1C2B1C]/20 dark:hover:border-[#1C2B1C]/40 transition-all relative`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-[#1C2B1C] rounded-full"></div>
                          <span className="text-sm font-medium text-[#1C2B1C]">{item.cards?.length || 0} cards</span>
                        </div>

                        <button
                          onClick={(e) => { e.stopPropagation(); toggleSelect(item._id); }}
                          className={`px-3 py-1 rounded-lg text-sm font-medium ${selected ? 'bg-[#1C2B1C] text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600'}`}
                          aria-pressed={selected}
                        >
                          {selected ? 'Selected' : 'Select'}
                        </button>
                      </div>

                      <div className="mb-3">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-1 line-clamp-2">{item.title}</h3>
                        {item.description && <p className="text-sm text-gray-600 dark:text-slate-400 line-clamp-2">{item.description}</p>}
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-[#1C2B1C]/10 rounded-full flex items-center justify-center">
                            <span className="text-xs font-medium text-[#1C2B1C]">Y</span>
                          </div>
                          <span className="text-xs text-gray-500 dark:text-slate-400">You</span>
                        </div>
                        <span className="text-xs text-gray-400 dark:text-slate-500">{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : 'Recently'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {tab === "upload" && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {files.length} {files.length === 1 ? 'file' : 'files'}
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={!allowGenerate}
                  className={`px-6 py-2 rounded-xl font-semibold text-sm transition-all ${!allowGenerate ? "bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed" : "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md hover:shadow-lg hover:scale-[1.02]"}`}
                >
                  Generate
                </button>
              </div>

              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl py-12 flex flex-col items-center justify-center gap-4 text-center bg-slate-50 dark:bg-slate-900 min-h-160"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-sky-400 to-indigo-500 rounded-md flex items-center justify-center text-white">DOC</div>
                  <div className="w-10 h-10 bg-gradient-to-r from-pink-400 to-rose-500 rounded-md flex items-center justify-center text-white">PDF</div>
                  <div className="w-10 h-10 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-md flex items-center justify-center text-white">PPT</div>
                </div>
                <div className="text-slate-700 dark:text-slate-300 font-medium">Drag notes, slides, or readings here</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Supported: .docx, .pdf, .pptx</div>
                <div className="mt-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-full shadow-sm text-sm font-medium"
                  >
                    Browse files
                  </button>
                  <input ref={fileInputRef} onChange={handleFileInput} type="file" className="hidden" multiple />
                </div>
              </div>

              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl border bg-white dark:bg-slate-800">
                      <div className="text-sm truncate">{f.name}</div>
                      <div className="flex items-center gap-3">
                        <div className="text-xs text-slate-400">{(f.size / 1024).toFixed(0)} KB</div>
                        <button onClick={() => removeFileAt(i)} className="text-sm text-red-500">Remove</button>
                      </div>
                    </div>
                  ))}
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
                <button
                  onClick={handleGenerate}
                  disabled={!allowGenerate}
                  className={`px-6 py-2 rounded-xl font-semibold text-sm transition-all ${!allowGenerate ? "bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed" : "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md hover:shadow-lg hover:scale-[1.02]"}`}
                >
                  Generate
                </button>
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
    </>
  );
}