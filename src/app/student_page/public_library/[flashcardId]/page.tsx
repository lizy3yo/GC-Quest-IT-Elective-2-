"use client";

import React, { useEffect, useState } from "react";
import {
  useRouter,
  useParams,
  useSearchParams,
  usePathname,
} from "next/navigation";
import api from "@/lib/api";
import {
  Share2,
  FileStack,
  Lightbulb,
  ArrowLeftRight,
  NotebookPen,
  RotateCcw,
  Star,
  BookmarkPlus,
  Copy,
} from "lucide-react";
import LoadingTemplate2 from "@/components/molecules/loading_template_2/loading_template_2/loading2";
import PrimaryActionButton from "@/components/molecules/buttons/buttons/PrimaryActionButton";
import { Chip } from "@/components/atoms";

type FlashcardCard = {
  _id: string;
  question: string;
  answer: string;
  image?: string;
};

type SharedUser = {
  user?: string;
  email?: string;
  role: "viewer" | "editor";
  addedAt?: string;
  status?: "pending" | "accepted";
};

type Flashcard = {
  _id: string;
  title: string;
  description?: string;
  cards: FlashcardCard[];
  tags?: string[];
  image?: string;
  difficulty?: "easy" | "medium" | "hard";
  accessType: "private" | "public";
  sharingMode?: "restricted" | "anyone_with_link";
  password?: string;
  linkRole?: "viewer" | "editor";
  publicRole?: "viewer" | "editor";
  sharedUsers?: SharedUser[];
  shareableLink?: string;
  createdAt?: string;
  updatedAt?: string;
  user: {
    _id: string;
    username: string;
  };
};

export default function PublicFlashcardDetailPage() {
  const [flashcard, setFlashcard] = useState<Flashcard | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [showCopyModal, setShowCopyModal] = useState<boolean>(false);
  const [isCopying, setIsCopying] = useState<boolean>(false);
  const [viewerIndex, setViewerIndex] = useState<number>(0);
  const [isShowingAnswer, setIsShowingAnswer] = useState<boolean>(false);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());

  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const flashcardId = params.flashcardId as string;

  // Color-coded icon classes for each tab
  const tabIconColor = (label: string, isActive: boolean) => {
    const dim = isActive ? "" : " opacity-80";
    switch (label) {
      case "Flashcards":
        return `text-sky-600 dark:text-sky-400${dim}`;
      case "Learn":
        return `text-violet-600 dark:text-violet-400${dim}`;
      case "Match":
        return `text-emerald-600 dark:text-emerald-400${dim}`;
      case "Test":
        return `text-cyan-600 dark:text-cyan-400${dim}`;
      default:
        return dim.trim();
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function loadFlashcard() {
      setIsLoading(true);
      setError(null);
      try {
        // Get current user (optional for public view)
        try {
          const current = await api.get(`/users/current`);
          const uid = (current as { user?: { _id?: string } } | null)?.user?._id;
          if (uid && isMounted) {
            setUserId(uid);
          }
        } catch (e) {
          // User not logged in, continue as guest
          console.log("Viewing as guest");
        }

        // Fetch the public flashcard - this should be a different endpoint
        const res = await fetch(
          `/api/student_page/flashcard/public/${flashcardId}`,
          {
            headers: {
              "Content-Type": "application/json",
            },
            cache: "no-store",
          }
        );

        if (!res.ok) {
          const maybe: unknown = await res.json().catch(() => null);
          const message =
            maybe &&
            typeof maybe === "object" &&
            "message" in maybe &&
            typeof (maybe as { message?: unknown }).message === "string"
              ? String((maybe as { message?: unknown }).message)
              : `Failed to load flashcard (${res.status})`;
          throw new Error(message);
        }

        const data = (await res.json()) as { flashcard: Flashcard };
        if (!isMounted) return;

        setFlashcard(data.flashcard);
      } catch (e: unknown) {
        if (!isMounted) return;
        const msg =
          e instanceof Error
            ? e.message
            : "Something went wrong loading the flashcard.";
        setError(msg);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    if (flashcardId) {
      loadFlashcard();
    }

    return () => {
      isMounted = false;
    };
  }, [flashcardId]);

  const currentCard =
    flashcard?.cards?.[
      Math.min(viewerIndex, Math.max((flashcard?.cards?.length || 1) - 1, 0))
    ];
  
  const goPrev = () => {
    setViewerIndex((i) => Math.max(i - 1, 0));
    setIsShowingAnswer(false);
  };
  
  const goNext = () => {
    setViewerIndex((i) =>
      Math.min(i + 1, Math.max((flashcard?.cards?.length || 1) - 1, 0))
    );
    setIsShowingAnswer(false);
  };
  
  const toggleStar = (id?: string) => {
    if (!id) return;
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopyToLibrary = async () => {
    if (!flashcard || !userId) {
      alert("Please log in to copy this flashcard set to your library");
      return;
    }

    setIsCopying(true);
    try {
      const res = await fetch(`/api/student_page/flashcard?userId=${userId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: `${flashcard.title} (Copy)`,
          description: flashcard.description,
          cards: flashcard.cards.map(card => ({
            question: card.question,
            answer: card.answer,
            image: card.image
          })),
          tags: flashcard.tags,
          difficulty: flashcard.difficulty,
          accessType: "private", // Copies are private by default
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to copy flashcard set");
      }

      alert("Flashcard set copied to your private library!");
      setShowCopyModal(false);
      router.push("/student_page/private_library");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to copy flashcard set.");
    } finally {
      setIsCopying(false);
    }
  };

  const copyShareLink = () => {
    const link = `${window.location.origin}/student_page/public_library/${flashcardId}`;
    navigator.clipboard
      .writeText(link)
      .then(() => {
        alert("Link copied to clipboard!");
      })
      .catch(() => {
        alert("Failed to copy link");
      });
  };

  if (isLoading) {
    return (
      <LoadingTemplate2
        title="Loading flashcard"
        subtitle="Fetching flashcard data…"
        compact={false}
      />
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 transition-colors duration-300">
        <div className="max-w-4xl mx-auto">
          <div className="text-red-600 dark:text-red-400">{error}</div>
          <button
            onClick={() => router.push("/student_page/public_library")}
            className="mt-4 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            Back to Public Library
          </button>
        </div>
      </div>
    );
  }

  if (!flashcard) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 transition-colors duration-300">
        <div className="max-w-4xl mx-auto">
          <div className="text-slate-500 dark:text-slate-400">
            Flashcard not found
          </div>
          <button
            onClick={() => router.push("/student_page/public_library")}
            className="mt-4 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-md hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            Back to Public Library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header - matching private library style */}
        <header className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] items-center gap-4 mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/student_page/public_library")}
              aria-label="Back to Public Library"
              className="w-10 h-10 rounded-full bg-slate-700/60 hover:bg-slate-700/80 flex items-center justify-center text-slate-100 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-lg md:text-2xl font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {flashcard.title}
                </h1>
                <Chip variant="badge" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs">
                  Public
                </Chip>
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                <span className="font-medium text-slate-900 dark:text-slate-100">{flashcard.cards.length}</span> cards
                {flashcard.description && <span className="hidden sm:inline"> • {flashcard.description}</span>}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                By <span className="font-medium">{flashcard.user.username}</span>
              </p>
            </div>
          </div>

          <div className="justify-self-center hidden md:block" />

          <div className="flex items-center gap-2">
            <button
              onClick={copyShareLink}
              aria-label="Share"
              className="px-3 py-2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:shadow inline-flex items-center gap-2 transition"
            >
              <Copy size={16} />
              <span className="text-sm hidden sm:inline">Share</span>
            </button>
            {userId && (
              <button
                onClick={() => setShowCopyModal(true)}
                aria-label="Copy to Library"
                className="px-3 py-2 rounded-full bg-gradient-to-br from-[#1C2B1C] to-[#1C2B1C] text-white shadow-sm hover:brightness-105 inline-flex items-center gap-2 transition"
              >
                <BookmarkPlus size={16} />
                <span className="text-sm hidden sm:inline">Copy</span>
              </button>
            )}
          </div>
        </header>

        {/* Study Mode Tabs - matching private library style */}
        <nav className="mb-6">
          <div className="flex items-end justify-between">
            <div className="flex gap-4 overflow-x-auto">
              {(() => {
                const base = `/student_page/public_library/${flashcardId}`;
                const tabs = [
                  {
                    label: "Flashcards",
                    href: `${base}/flashcard`,
                    Icon: FileStack,
                  },
                  { label: "Learn", href: `${base}/learn`, Icon: Lightbulb },
                  {
                    label: "Match",
                    href: `${base}/match`,
                    Icon: ArrowLeftRight,
                  },
                  { label: "Test", href: `${base}/test`, Icon: NotebookPen },
                ];
                return tabs.map(({ label, href, Icon }) => {
                  const isActive = pathname?.startsWith(href);
                  return (
                    <button
                      key={label}
                      onClick={() => router.push(href)}
                      className={`relative pb-2 text-sm whitespace-nowrap inline-flex items-center gap-2 transition-colors ${
                        isActive
                          ? "text-slate-900 dark:text-slate-100 font-semibold"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                      }`}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <Icon
                        className={`w-4 h-4 ${tabIconColor(label, !!isActive)}`}
                      />
                      <span>{label}</span>
                      {label === "Flashcards" && (
                        <span
                          className={`ml-1 rounded-full px-2 py-0.5 text-[10px] leading-none ${
                            isActive
                              ? "bg-violet-600 text-white"
                              : "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                          }`}
                        >
                          {flashcard.cards.length}
                        </span>
                      )}
                      {isActive && (
                        <span className="absolute left-0 right-0 -bottom-[1px] h-[2px] bg-gradient-to-r from-violet-500 to-violet-600 rounded-full" />
                      )}
                    </button>
                  );
                });
              })()}
            </div>
          </div>
          <div className="mt-1 h-px w-full bg-slate-200 dark:bg-slate-700" />
        </nav>

        {/* Main Content Grid */}
        <div className="max-w-4xl mx-auto">
          {/* Set Preview Section */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  Set Preview
                </h2>
                {flashcard.difficulty && (
                  <Chip variant="badge" className="capitalize">
                    {flashcard.difficulty}
                  </Chip>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {Math.min(viewerIndex + 1, flashcard.cards.length)} /{" "}
                  {flashcard.cards.length}
                </span>
                <button
                  onClick={() => {
                    setViewerIndex(0);
                    setIsShowingAnswer(false);
                  }}
                  className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:border-[#1C2B1C]/30 dark:hover:border-[#8B9D8B]/30 hover:text-[#1C2B1C] dark:hover:text-[#8B9D8B] transition-all"
                  aria-label="Reset Viewer"
                >
                  <RotateCcw size={16} />
                </button>
              </div>
            </div>

            {/* Preview Card */}
            <div className="relative mb-6">
              <button
                type="button"
                onClick={() => setIsShowingAnswer((s) => !s)}
                aria-label={isShowingAnswer ? "Show question" : "Show answer"}
                className="w-full h-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#1C2B1C] dark:focus:ring-[#8B9D8B] focus:ring-offset-2 dark:focus:ring-offset-slate-900"
              >
                <div className="relative h-full overflow-hidden rounded-2xl">
                  {/* Star control */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStar(currentCard?._id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleStar(currentCard?._id);
                      }
                    }}
                    className={`absolute top-4 right-4 z-10 p-2 rounded-lg transition-all cursor-pointer ${
                      starredIds.has(currentCard?._id || "")
                        ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400"
                        : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-yellow-500 dark:hover:text-yellow-400"
                    }`}
                    aria-pressed={starredIds.has(currentCard?._id || "")}
                    aria-label={
                      starredIds.has(currentCard?._id || "")
                        ? "Unfavorite"
                        : "Favorite"
                    }
                  >
                    <Star size={20} />
                  </div>

                  <div
                    className={`absolute inset-0 flex items-center justify-center p-8 transition-opacity duration-300 ${
                      isShowingAnswer ? "opacity-0" : "opacity-100"
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-3xl font-medium text-slate-900 dark:text-slate-100 mb-4 leading-relaxed">
                        {currentCard?.question || "No question"}
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        Click to reveal answer
                      </div>
                    </div>
                  </div>
                  <div
                    className={`absolute inset-0 flex items-center justify-center p-8 transition-opacity duration-300 ${
                      isShowingAnswer ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-3xl font-medium text-slate-900 dark:text-slate-100 mb-4 leading-relaxed">
                        {currentCard?.answer || "No answer"}
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        Click to show question
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            </div>

            {/* Navigation Controls */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={goPrev}
                disabled={viewerIndex === 0}
                className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:border-[#1C2B1C]/30 dark:hover:border-[#8B9D8B]/30 hover:bg-[#1C2B1C]/5 dark:hover:bg-[#8B9D8B]/10 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg
                  className="w-5 h-5 text-slate-600 dark:text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <PrimaryActionButton
                onClick={() => setIsShowingAnswer((s) => !s)}
              >
                {isShowingAnswer ? "Show Question" : "Show Answer"}
              </PrimaryActionButton>
              <button
                onClick={goNext}
                disabled={viewerIndex >= (flashcard?.cards?.length || 1) - 1}
                className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:border-[#1C2B1C]/30 dark:hover:border-[#8B9D8B]/30 hover:bg-[#1C2B1C]/5 dark:hover:bg-[#8B9D8B]/10 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg
                  className="w-5 h-5 text-slate-600 dark:text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Cards Section */}
        <div className="mt-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              All Cards ({flashcard.cards.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {flashcard.cards.map((card, index) => (
              <div
                key={card._id}
                className="relative group bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 hover:border-[#1C2B1C]/30 dark:hover:border-[#04C40A]/30 hover:shadow-lg transition-all"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex items-center justify-center">
                    <Chip
                      variant="badge"
                      className="w-8 h-8 flex items-center justify-center flex-shrink-0"
                    >
                      {index + 1}
                    </Chip>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-900 dark:text-slate-100 font-medium mb-2 line-clamp-2">
                      {card.question}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-slate-400 line-clamp-2">
                      {card.answer}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Copy to Library Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowCopyModal(false)}
          />
          <div className="relative z-50 max-w-md w-full mx-4 bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Copy to Your Library
                </h2>
                <button
                  onClick={() => setShowCopyModal(false)}
                  className="text-slate-500 hover:text-slate-800 dark:hover:text-white"
                >
                  ✕
                </button>
              </div>

              <p className="text-slate-600 dark:text-slate-400 mb-6">
                This will create a private copy of &quot;{flashcard.title}&quot; in your library that you can edit and customize.
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowCopyModal(false)}
                  className="px-4 py-2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCopyToLibrary}
                  disabled={isCopying}
                  className="px-4 py-2 rounded-md bg-[#1C2B1C] text-white disabled:opacity-50"
                >
                  {isCopying ? "Copying..." : "Copy to Library"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
