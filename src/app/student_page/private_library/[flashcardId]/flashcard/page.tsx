"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Settings } from "lucide-react";
import LoadingTemplate2 from "@/components/ui/loading_template_2/loading2"; // added import
import { useAuth } from "@/hooks/useAuth";
import { authManager } from "@/utils/auth";

type FlashcardCard = {
  _id: string;
  question: string;
  answer: string;
  image?: string;
};

type Flashcard = {
  _id: string;
  title: string;
  cards: FlashcardCard[];
  shareableLink?: string;
};

export default function FlashcardOnlyPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [flashcard, setFlashcard] = useState<Flashcard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // session queue & pointer:
  const [sessionQueue, setSessionQueue] = useState<number[]>([]);
  const [viewerPos, setViewerPos] = useState(0);
  const [initialTotal, setInitialTotal] = useState(0);
  const [isShowingAnswer, setIsShowingAnswer] = useState(false);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  // stable key for starredIds so useEffect dependency array length is constant
  const starredIdsKey = React.useMemo(() => {
    if (!starredIds || starredIds.size === 0) return "";
    return Array.from(starredIds).sort().join("|");
  }, [starredIds]);
  // Options modal / settings (UI only)
  const [showOptions, setShowOptions] = useState(false);
  const [trackProgress, setTrackProgress] = useState(true);
  const [studyStarredOnly, setStudyStarredOnly] = useState(false);
  const [sidePreference, setSidePreference] = useState<"term" | "definition">("term");
  const [showBothSides, setShowBothSides] = useState(false);
  const [keyboardShortcutsOpen, setKeyboardShortcutsOpen] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [uid, setUid] = useState<string | null>(null); // <-- added: current user id for progress API
  const [progressLoaded, setProgressLoaded] = useState(false); // prevent init overwrite of loaded server state
  const router = useRouter();
  const params = useParams();
  const flashcardId = params.flashcardId as string;

  useEffect(() => {
    let mounted = true;
    async function load() {
      // wait for auth completion so we can prefer authenticated user id
      if (authLoading) return;
      setIsLoading(true);
      setError(null);
      try {
        // Determine uid: prefer authenticated user, then localStorage, otherwise generate a temp id
        let finalUid: string | null = null;
        if (isAuthenticated && user?._id) {
          finalUid = String(user._id);
        }
        if (!finalUid && typeof window !== "undefined") {
          finalUid = localStorage.getItem("userId");
        }
        if (!finalUid && typeof window !== "undefined") {
          finalUid = `temp-user-${Date.now()}`;
          localStorage.setItem("userId", finalUid);
        }
        if (!finalUid) throw new Error("Unable to determine current user.");
        setUid(finalUid);

        // Use authManager for authenticated requests (adds credentials/cookies), works safely for non-auth too
        const response = await authManager.makeAuthenticatedRequest(
          `/api/student_page/flashcard/${flashcardId}?userId=${finalUid}`,
          { method: "GET", cache: "no-store" as RequestCache }
        );
        if (!response.ok) {
          let maybe: unknown = null;
          try { maybe = await response.json(); } catch {}
          const msg = (maybe && typeof (maybe as { message?: unknown }).message === "string")
            ? (maybe as { message?: string }).message!
            : `Failed to load flashcard (${response.status})`;
          throw new Error(msg);
        }
        const data = (await response.json()) as { flashcard: Flashcard };
        if (!mounted) return;
        setFlashcard(data.flashcard);
      } catch (e: unknown) {
        if (!mounted) return;
        const msg = e instanceof Error ? e.message : "Failed to load flashcard.";
        setError(msg);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    if (flashcardId) load();
    return () => { mounted = false; };
  }, [flashcardId, authLoading, isAuthenticated, user]);

  // initialize session queue when flashcard loads or when starred/study options change
  useEffect(() => {
    if (!flashcard) return;
    // if progress was loaded from server, do not overwrite the persisted sessionQueue
    if (progressLoaded) return;
    const total = flashcard.cards.length;
    setInitialTotal(total);

    let indices = Array.from({ length: total }, (_, i) => i);

    // When "study starred only" is enabled, limit the indices to starred card indices
    if (studyStarredOnly) {
      indices = indices.filter(i => starredIds.has(flashcard.cards[i]._id));
    }

    // NOTE: do not auto-shuffle when the toggle changes. user must press "Shuffle now".
    setSessionQueue(indices);
    setViewerPos(0);
    setIsShowingAnswer(false);
    // keep starredIds as-is (separate feature)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashcard, studyStarredOnly, shuffle, starredIdsKey, progressLoaded]);

  const currentCard = flashcard?.cards?.[sessionQueue[viewerPos]];

  const goPrev = useCallback(() => {
    setViewerPos(p => Math.max(p - 1, 0));
    setIsShowingAnswer(false);
  }, []);

  const goNext = useCallback(() => {
    setViewerPos(p => Math.min(p + 1, Math.max((sessionQueue.length || 1) - 1, 0)));
    setIsShowingAnswer(false);
  }, [sessionQueue.length]);

  // jump to a random card in the current session (clickable repeatedly)
  const goRandom = useCallback(() => {
    const len = sessionQueue.length;
    if (len === 0) return;
    const randomPos = Math.floor(Math.random() * len);
    setViewerPos(randomPos);
    setIsShowingAnswer(false);
  }, [sessionQueue.length]);
  
  const toggleStar = (id?: string) => {
    if (!id) return;
    setStarredIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      // persist immediately
      if (uid) saveProgress({ flashcards: { starredIds: Array.from(next) } });
      // If user is studying "starred only", immediately update the session to reflect the new starred set.
      if (studyStarredOnly && flashcard) {
        const indices = flashcard.cards.map((_, i) => i).filter(i => next.has(flashcard.cards[i]._id));
        // do NOT auto-shuffle here; user must press "Shuffle now"
        setSessionQueue(indices);
        setViewerPos(0);
        setIsShowingAnswer(false);
      }
      return next;
    });
  };

  // Add new state for rating feedback
  const [selectedRating, setSelectedRating] = useState<"again" | "hard" | "good" | "easy" | null>(null);
  const [isRatingInProgress, setIsRatingInProgress] = useState(false); // To disable buttons during animation
  const [disableFlipTransition, setDisableFlipTransition] = useState(false); // To disable flip animation during rating transition
  // overlay pop animation state (no card movement)
  const [overlayPop, setOverlayPop] = useState(false);
  // rating summary & completion
  const [ratingCounts, setRatingCounts] = useState({ again: 0, hard: 0, good: 0, easy: 0, total: 0 });
  const [againIds, setAgainIds] = useState<Set<string>>(new Set());
  const [hardIds, setHardIds] = useState<Set<string>>(new Set());
  const [easyIds, setEasyIds] = useState<Set<string>>(new Set());
  const [showCompletion, setShowCompletion] = useState(false);
  
  // Updated rateCard function to include visual feedback and instant progression
  const rateCard = (rating: "again" | "hard" | "good" | "easy") => {
    if (isRatingInProgress) return;

    // mark that rating flow is happening (disables buttons)
    setIsRatingInProgress(true);

    // show overlay immediately
    setSelectedRating(rating);
    setOverlayPop(false);
    setTimeout(() => setOverlayPop(true), 8);

    // disable flip transition while we adjust the queue and viewer
    setDisableFlipTransition(true);

    // track rating stats (counts and per-card sets). We count total reviews, not unique.
    const cardId = currentCard?._id;
    setRatingCounts(prev => ({
      again: prev.again + (rating === "again" ? 1 : 0),
      hard: prev.hard + (rating === "hard" ? 1 : 0),
      good: prev.good + (rating === "good" ? 1 : 0),
      easy: prev.easy + (rating === "easy" ? 1 : 0),
      total: prev.total + 1,
    }));
    if (cardId) {
      setAgainIds(s => { const n = new Set(s); if (rating === "again") n.add(cardId); return n; });
      setHardIds(s => { const n = new Set(s); if (rating === "hard") n.add(cardId); return n; });
      setEasyIds(s => { const n = new Set(s); if (rating === "easy") n.add(cardId); return n; });
    }

    // compute new queue immediately (avoid closure-stale bugs) and persist immediately
    setSessionQueue(prev => {
      if (!prev.length) return prev;
      const currPos = viewerPos;
      const idx = prev[currPos];
      const next = prev.slice();
      next.splice(currPos, 1);

      if (rating === "again") {
        const insertPos = Math.min(currPos + 1, next.length);
        next.splice(insertPos, 0, idx);
      } else if (rating === "hard") {
        const insertPos = Math.min(currPos + 3, next.length);
        next.splice(insertPos, 0, idx);
      } else if (rating === "good") {
        next.push(idx);
      }

      const newPos = Math.min(currPos, Math.max(next.length - 1, 0));
      // update viewer and UI immediately
      setViewerPos(newPos);
      setIsShowingAnswer(false);

      // persist immediately to server (best-effort)
      if (uid) {
        try {
          saveProgress({ sessionQueue: next, viewerPos: newPos });
        } catch (e) {
          // ignore but keep console for diagnostics
          console.warn(e);
        }
      }

      // if no more cards, show completion
      if (next.length === 0) {
        setShowCompletion(true);
      }

      return next;
    });

    // keep the overlay visible for the duration, then hide it and re-enable transitions/buttons
    setTimeout(() => {
      // animate pop-out
      setOverlayPop(false);

      // after pop-out transition, clear overlay and restore transitions/buttons
      setTimeout(() => {
        setSelectedRating(null);
        setDisableFlipTransition(false);
        setIsRatingInProgress(false);
      }, 220); // match pop-out transition
    }, 1000);
  };

  // Keyboard shortcuts: Space to flip, ArrowLeft/ArrowRight to navigate
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        // prevent page scroll when flipping
        e.preventDefault();
        setIsShowingAnswer(s => !s);
      } else if (e.key === "ArrowLeft") {
        goPrev();
      } else if (e.key === "ArrowRight") {
        goNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext]);

  // --- Progress API integration ------------------------------------------------
  // debounce helpers for saving
  const saveTimer = React.useRef<number | null>(null);
  async function saveProgress(payload: Record<string, unknown>) {
    if (!uid || !flashcardId) return;
    try {
      await fetch(`/api/student_page/flashcard/${flashcardId}/progress?userId=${uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      // silent fail; server logging handles it
      console.warn("Failed to save progress", err);
    }
  }

  // load persisted progress when flashcard and uid are available
  useEffect(() => {
    let mounted = true;
    async function loadProgress() {
      if (!uid || !flashcard) return;
      try {
        const res = await fetch(`/api/student_page/flashcard/${flashcardId}/progress?userId=${uid}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json().catch(() => null);
        const progress = json?.progress;
        if (!mounted || !progress) return;
        // apply persisted prefs / starred / session state
        if (progress.flashcards && Array.isArray(progress.flashcards.starredIds)) setStarredIds(new Set(progress.flashcards.starredIds));
        if (progress.flashcards && progress.flashcards.prefs) {
          setTrackProgress(!!progress.flashcards.prefs.trackProgress);
          setShuffle(!!progress.flashcards.prefs.shuffle);
          setStudyStarredOnly(!!progress.flashcards.prefs.studyStarredOnly);
          if (progress.flashcards.prefs.sidePreference === "term" || progress.flashcards.prefs.sidePreference === "definition") {
            setSidePreference(progress.flashcards.prefs.sidePreference);
          }
          setShowBothSides(!!progress.flashcards.prefs.showBothSides);
        }
        if (Array.isArray(progress.sessionQueue) && progress.sessionQueue.length) {
          setSessionQueue(progress.sessionQueue);
        }
        if (typeof progress.viewerPos === "number") setViewerPos(progress.viewerPos);
        // mark that server progress was applied so the init effect does not stomp it
        setProgressLoaded(true);
      } catch (err) {
        // ignore load errors
        console.warn("Failed to load progress", err);
      }
    }
    loadProgress();
    return () => { mounted = false; };
  }, [uid, flashcard, flashcardId]);

  // persist prefs when they change (debounced)
  useEffect(() => {
    if (!uid) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveProgress({ flashcards: { prefs: { trackProgress, shuffle, studyStarredOnly, sidePreference, showBothSides } } });
      saveTimer.current = null;
    }, 700);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackProgress, shuffle, studyStarredOnly, sidePreference, showBothSides, uid]);

  // Removed debounced persistence for sessionQueue/viewerPos as they are saved immediately in rateCard and other functions
  // --- end Progress API integration --------------------------------------------

  if (isLoading) return <LoadingTemplate2 title="Loading flashcards" subtitle="Preparing your session..." compact={false} />;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!flashcard) return <div className="p-6">Flashcard not found</div>;

  const total = initialTotal || flashcard.cards.length;
  const remaining = sessionQueue.length;
  const learnedCount = Math.max(0, total - remaining);
  const progress = Math.round((learnedCount / Math.max(total, 1)) * 100);

  // Helper function for background and text classes based on rating
  const getBgClass = (isFront: boolean, rating?: string | null) => {
    if (!rating) {
      // Light-mode: subtle off-white gradient, thin border and soft shadow for better contrast
      // Dark-mode: keep existing rich gradient
      return "bg-gradient-to-br from-slate-50 to-white border border-slate-100 shadow-sm text-slate-900 dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900 dark:text-slate-100 dark:border-transparent";
    }
    const color =
      rating === "again" ? "bg-red-500" :
      rating === "hard" ? "bg-amber-500" :
      rating === "good" ? "bg-[#1C2B1C]" :
      "bg-[#1C2B1C]";
    return `${color} text-white`;
  };

  // Actions on completion screen
  const resetRatingStats = () => {
    setRatingCounts({ again: 0, hard: 0, good: 0, easy: 0, total: 0 });
    setAgainIds(new Set());
    setHardIds(new Set());
    setEasyIds(new Set());
  };

  const restartDeck = async () => {
    if (!flashcard) return;
    const total = flashcard.cards.length;
  const indices = Array.from({ length: total }, (_, i) => i);
    setSessionQueue(indices);
    setViewerPos(0);
    setIsShowingAnswer(false);
    resetRatingStats();
    setShowCompletion(false);
    if (uid) await saveProgress({ sessionQueue: indices, viewerPos: 0 });
  };

  const reviewOnlyHardAgain = async () => {
    if (!flashcard) return;
    const targetIds = new Set<string>([...againIds, ...hardIds]);
    const indices = flashcard.cards
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => targetIds.has(c._id))
      .map(({ i }) => i);
    setSessionQueue(indices);
    setViewerPos(0);
    setIsShowingAnswer(false);
    // keep rating stats for continuity, but hide completion if there is something to review
    setShowCompletion(indices.length === 0);
    if (uid) await saveProgress({ sessionQueue: indices, viewerPos: 0 });
  };

  const gotoNextDeck = () => {
    // Navigate back to library where user can pick next deck
    router.push("/student_page/private_library");
  };

  const exploreRelated = () => {
    // Navigate to explore/flashcards page
    router.push("/student_page/flashcards");
  };

  const uniqueMastered = easyIds.size; // topics mastered approximated by cards marked Easy
  const uniqueStillLearning = Math.max(0, (flashcard.cards?.length || 0) - uniqueMastered);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 transition-colors duration-300">
      <div className="max-w-6xl mx-auto px-4">
        <header className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] items-center gap-4 mb-2">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              aria-label="Back"
              className="w-10 h-10 rounded-full bg-slate-700/60 hover:bg-slate-700/80 flex items-center justify-center text-slate-100 transition"
            >
              <ChevronLeft size={16} className="text-slate-100" />
            </button>

            <div className="min-w-0">
              <h1 className="text-lg md:text-2xl font-semibold text-slate-900 dark:text-slate-100 truncate">{flashcard.title}</h1>
              <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Flashcards · <span className="font-medium text-slate-900 dark:text-slate-100">{flashcard.cards.length}</span></div>
            </div>
          </div>

          <div className="justify-self-center w-11/12 md:w-96">
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#1C2B1C] to-[#1C2B1C] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <div>Progress <span className="font-semibold text-slate-900 dark:text-slate-100 ml-2">{progress}%</span></div>

              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/20">
                  <span className="font-semibold">Still learning</span>
                  <span className="ml-1 inline-block w-6 text-center bg-white dark:bg-slate-800 rounded-full px-1 text-xs">{remaining}</span>
                </div>
                <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-[#1C2B1C]/10 text-[#1C2B1C] dark:bg-[#1C2B1C]/20">
                  <span className="font-semibold">Know</span>
                  <span className="ml-1 inline-block w-6 text-center bg-white dark:bg-slate-800 rounded-full px-1 text-xs">{learnedCount}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowOptions(true)}
              aria-label="Options"
              className="px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:shadow inline-flex items-center"
            >
              <Settings size={18} />
            </button>
          </div>
        </header>

        <main>
          {showCompletion || remaining === 0 ? (
            <CompletionSummary
              totalReviewed={ratingCounts.total}
              counts={ratingCounts}
              mastered={uniqueMastered}
              stillLearning={uniqueStillLearning}
              onRestart={restartDeck}
              onReviewHardAgain={reviewOnlyHardAgain}
              onNextDeck={gotoNextDeck}
              onExplore={exploreRelated}
            />
          ) : (
            <>
              {/* replaced compact "Card X / Y" line with a neat status row matching the progress bar */}
              <div className="mb-4 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
                <div>Card <span className="font-medium text-slate-700 dark:text-slate-100">{Math.min(viewerPos + 1, Math.max(remaining, 1))}</span> / <span className="font-medium">{Math.max(remaining, 1)}</span></div>
              </div>

              <div className="relative">
                {/* make the card much larger using viewport height.
                    When "Show both sides" is enabled render two stacked cards.
                */}
                <div className="h-[60vh] md:h-[55vh] lg:h-[62vh]">
                  {showBothSides ? (
                    <div className="h-full flex flex-col gap-6">
                      {/* Front / top */}
                      <div className={`w-full flex-1 rounded-2xl flex items-center justify-center p-6 text-center select-none shadow-lg border border-slate-100 dark:border-transparent ${getBgClass(true, null)}`}>
                        <div className="absolute top-3 right-3 bg-slate-200 dark:bg-slate-700 text-xs px-2 py-1 rounded">Front</div>
                        <div className="max-w-[95%] text-3xl md:text-4xl leading-snug">{currentCard?.question ?? "No question"}</div>
                      </div>

                      {/* Back / bottom (rating overlay will attach here) */}
                      <div className={`relative w-full flex-1 rounded-2xl flex items-center justify-center p-6 text-center select-none shadow-lg border border-slate-100 dark:border-transparent ${getBgClass(false, null)}`}>
                        <div className="absolute top-3 right-3 bg-slate-200 dark:bg-slate-700 text-xs px-2 py-1 rounded">Back</div>
                        <div className="max-w-[95%] text-3xl md:text-4xl leading-snug">{currentCard?.answer ?? "No answer"}</div>
                        {/* Rating overlay attaches to the back card in "both sides" mode */}
                        {selectedRating && (
                          <div
                            className={`absolute inset-0 rounded-2xl flex items-center justify-center text-2xl font-bold z-10 ${
                              selectedRating === "again"
                                ? "bg-red-700/100 text-white"
                                : selectedRating === "hard"
                                ? "bg-amber-500/100 text-white"
                                : selectedRating === "good"
                                ? "bg-[#1C2B1C] text-white"
                                : "bg-[#1C2B1C] text-white"
                            }`}
                            style={{
                              transformOrigin: "center bottom",
                              transform: overlayPop ? "scale(1)" : "scale(0.85)",
                              transition: "transform 220ms cubic-bezier(.2,.9,.2,1)",
                              opacity: 1,
                            }}
                          >
                            {selectedRating.charAt(0).toUpperCase() + selectedRating.slice(1)}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    // original flip card
                    <div className="[perspective:1000px] h-full">
                      <button
                        type="button"
                        onClick={() => setIsShowingAnswer(s => !s)}
                        aria-label={isShowingAnswer ? "Show question" : "Show answer"}
                        className="relative w-full h-full rounded-2xl focus:outline-none [transform-style:preserve-3d] shadow-lg hover:shadow-2xl border border-slate-100 dark:border-transparent"
                        style={{
                          transform: isShowingAnswer ? "rotateY(180deg)" : "rotateY(0deg)",
                          transition: disableFlipTransition ? "none" : "transform 700ms",
                        }}
                      >
                        {/* Front (question) */}
                        <div className={`absolute inset-0 rounded-2xl flex flex-col items-center justify-center p-6 text-center select-none [backface-visibility:hidden] ${getBgClass(true, null)}`}>
                          <div className="absolute top-2 right-2 bg-slate-200 dark:bg-slate-700 text-xs px-2 py-1 rounded">Front</div>
                          <div className="w-full flex flex-col items-center">
                            <div className="max-w-[95%] text-4xl md:text-5xl leading-snug">{currentCard?.question ?? "No question"}</div>
                            <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">Press <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs">Space</span> or click to flip</div>
                          </div>
                        </div>

                        {/* Back (answer) */}
                         <div className={`absolute inset-0 rounded-2xl flex flex-col items-center justify-center p-6 text-center select-none [backface-visibility:hidden] [transform:rotateY(180deg)] ${getBgClass(false, null)}`}>
                          <div className="absolute top-2 right-2 bg-slate-200 dark:bg-slate-700 text-xs px-2 py-1 rounded">Back</div>
                          <div className="w-full flex flex-col items-center">
                            <div className="max-w-[95%] text-4xl md:text-5xl leading-snug">{currentCard?.answer ?? "No answer"}</div>
                            <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">Flip back with Space or click</div>
                          </div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
 
                {/* Hint / image small overlay */}
                {currentCard?.image && (
                  <div className="absolute top-4 right-6 bg-white/80 dark:bg-black/40 rounded-md p-1 shadow">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={currentCard.image} alt="card image" className="w-24 h-24 object-cover rounded" />
                  </div>
                )}
              </div>

              {/* Rating buttons: Disable during animation */}
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  onClick={() => rateCard("again")}
                  disabled={isRatingInProgress}
                  className={`px-3 py-2 rounded-full bg-red-100 text-red-700 ${isRatingInProgress ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  Again
                </button>
                <button
                  onClick={() => rateCard("hard")}
                  disabled={isRatingInProgress}
                  className={`px-3 py-2 rounded-full bg-amber-100 text-amber-800 ${isRatingInProgress ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  Hard
                </button>
                <button
                  onClick={() => rateCard("good")}
                  disabled={isRatingInProgress}
                  className={`px-3 py-2 rounded-full bg-[#1C2B1C]/10 text-[#1C2B1C] ${isRatingInProgress ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  Good
                </button>
                <button
                  onClick={() => rateCard("easy")}
                  disabled={isRatingInProgress}
                  className={`px-3 py-2 rounded-full bg-[#1C2B1C] text-white ${isRatingInProgress ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  Easy
                </button>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleStar(currentCard?._id)}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-full font-medium transition ${
                      starredIds.has(currentCard?._id || "") ? "bg-yellow-500 text-white shadow-md" : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    }`}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={starredIds.has(currentCard?._id || "") ? "white" : "none"} stroke={starredIds.has(currentCard?._id || "") ? "none" : "currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="inline-block">
                      <path d="M12 17.3 7.4 20l1-5.3L4 11.5l5.4-.5L12 6l2.6 5 5.4.5-4.4 3.2 1 5.3z" />
                    </svg>
                    {starredIds.has(currentCard?._id || "") ? "Starred" : "Star"}
                  </button>

                  {/* Only render the header "Track progress" pill when the option is enabled in Options */}
                  {trackProgress && (
                    <div className="hidden sm:flex items-center gap-2 text-sm">
                      <span className="px-2 py-1 rounded font-medium transition bg-gradient-to-br from-[#1C2B1C] to-[#1C2B1C] text-white shadow-sm">
                        Track progress
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={goPrev} aria-label="Previous" className="px-3 py-2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:scale-105 transition">
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    onClick={goNext}
                    aria-label="Next"
                    className="px-3 py-2 rounded-full bg-gradient-to-br from-[#1C2B1C] to-[#1C2B1C] text-white shadow-sm hover:brightness-105 transition"
                  >
                    <ChevronRight size={18} />
                  </button>
                  {shuffle && (
                    <button onClick={goRandom} className="px-3 py-2 rounded-full bg-sky-500 text-white hover:scale-105 transition" title="Shuffle to random card">
                      <svg width="16" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M3 4l17 17" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </main>

        {/* Options / Settings modal (UI only) */}
        {showOptions && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowOptions(false)} />

            {/* center modal, allow scrolling when viewport is small */}
            <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl shadow-2xl overflow-auto grid grid-cols-1 md:grid-cols-[1fr_320px]">
               {/* Left: settings */}
               <div className="p-6 space-y-6">
                 <div className="flex items-start justify-between">
                   <div>
                     <h2 className="text-xl font-semibold">Options</h2>
                     <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Session settings and UI preferences</p>
                   </div>
                   <button onClick={() => setShowOptions(false)} className="ml-4 text-slate-400 hover:text-[#1C2B1C]">✕</button>
                 </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <SettingRow
                    title="Track progress"
                    desc="Sort cards to track what you know"
                    checked={trackProgress}
                    onToggle={() => setTrackProgress(v => !v)}
                    accent="green"
                  />

                  <SettingRow
                    title="Study starred only"
                    desc="Limit session to your starred cards"
                    checked={studyStarredOnly}
                    onToggle={() => {
                      // toggle and rebuild session queue immediately according to new value
                      setStudyStarredOnly(prev => {
                        const next = !prev;
                        if (flashcard) {
                          const total = flashcard.cards.length;
                          let indices = Array.from({ length: total }, (_, i) => i);
                          if (next) indices = indices.filter(i => starredIds.has(flashcard.cards[i]._id));
                          if (shuffle) indices = shuffleArray(indices);
                          setSessionQueue(indices);
                          setViewerPos(0);
                          setIsShowingAnswer(false);
                        }
                        // Save immediately to ensure persistence, including all current prefs
                        if (uid) saveProgress({ flashcards: { prefs: { trackProgress, shuffle, studyStarredOnly: next, sidePreference, showBothSides } } });
                        return next;
                      });
                    }}
                     accent="amber"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="font-medium">Front</div>
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => setSidePreference("term")} className={`px-3 py-1 rounded ${sidePreference === "term" ? "bg-emerald-600 text-white" : "bg-slate-200 dark:bg-slate-700"}`}>Term</button>
                      <button onClick={() => setSidePreference("definition")} className={`px-3 py-1 rounded ${sidePreference === "definition" ? "bg-emerald-600 text-white" : "bg-slate-200 dark:bg-slate-700"}`}>Definition</button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <ToggleRow label="Show both sides" desc="Reveal question and answer together" checked={showBothSides} onChange={() => setShowBothSides(v => !v)} />
                    <div>
                      <ToggleRow label="Shuffle cards" desc="Enable shuffle (press 'Shuffle now' to apply)" checked={shuffle} onChange={() => setShuffle(v => !v)} />
                      <div className="mt-2">
                        <button
                          onClick={shuffleNow}
                          disabled={!shuffle || !flashcard}
                          className={`px-3 py-1 rounded ${!shuffle ? "bg-slate-200 text-slate-500 cursor-not-allowed" : "bg-sky-500 text-white hover:brightness-110"}`}
                        >
                          Shuffle now
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={async () => {
                      const total = flashcard?.cards.length || 0;
                      let indices = Array.from({ length: total }, (_, i) => i);
                      // Respect "study starred only" when restarting
                      if (studyStarredOnly && flashcard) {
                        indices = indices.filter(i => starredIds.has(flashcard.cards[i]._id));
                      }
                      // do NOT auto-shuffle on restart; user must press Shuffle now
                      setSessionQueue(indices);
                      setViewerPos(0);
                      setIsShowingAnswer(false);
                      setStarredIds(new Set());
                      setShowOptions(false);

                      // persist reset immediately so server and client stay in sync
                      if (uid) {
                        try {
                          await saveProgress({ flashcards: { starredIds: [] }, sessionQueue: indices, viewerPos: 0 });
                          // mark as loaded so the initial session builder won't overwrite this reset
                          setProgressLoaded(true);
                        } catch {
                          // ignore - saveProgress logs internally
                        }
                      } else {
                        // still mark loaded to avoid init overwrite if uid isn't available yet
                        setProgressLoaded(true);
                      }
                    }}
                     className="px-4 py-2 rounded-md bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                  >
                    Restart Flashcards
                  </button>

                  <button onClick={() => setKeyboardShortcutsOpen(s => !s)} className="px-4 py-2 rounded-md bg-slate-100 dark:bg-slate-700">
                    {keyboardShortcutsOpen ? "Hide keyboard shortcuts" : "Keyboard shortcuts"}
                  </button>

                  <div className="ml-auto text-xs text-slate-400">Changes apply immediately</div>
                </div>

              </div>

              {/* Right: preview / summary */}
              <div className="p-6 border-l border-slate-100 dark:border-slate-700 bg-gradient-to-b from-slate-50 to-white dark:from-slate-800 dark:to-slate-800">
                <div className="text-sm font-medium mb-2">Session preview</div>

                <div className="rounded-lg p-4 mb-4 bg-white dark:bg-slate-900 shadow-inner">
                  <div className="text-xs text-slate-500 mb-2">Progress</div>
                  <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-3">
                    <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="text-xs text-slate-500 flex justify-between">
                    <span>{learnedCount} know</span>
                    <span>{remaining} learning</span>
                  </div>
                </div>

                <div className="rounded-lg p-4 bg-slate-50 dark:bg-slate-800">
                  <div className="text-xs text-slate-500 mb-2">Current card</div>
                  <div className="h-28 flex items-center justify-center rounded-md bg-white dark:bg-slate-900 text-center px-3">
                    <div className="text-sm">{currentCard?.question ?? "No question"}</div>
                  </div>

                  <div className="mt-3 text-xs text-slate-500">
                    Tip: use Space to flip, ← / → to navigate. Toggle &apos;Show both sides&apos; to reveal both sides at once.
                  </div>
                </div>

                {keyboardShortcutsOpen && (
                  <div className="mt-4 text-xs text-slate-400 bg-slate-100 dark:bg-slate-900 p-3 rounded">
                    <div><strong>Space</strong> — Flip</div>
                    <div><strong>← / →</strong> — Prev / Next</div>
                    <div className="mt-2">You can also restart the session from the left panel.</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
    );

  // small helper to produce a shuffled copy of indices
  function shuffleArray<T>(arr: T[]) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  // explicit shuffle action (callable from options)
  function shuffleNow() {
    if (!flashcard) return;
    const total = flashcard.cards.length;
    let indices = Array.from({ length: total }, (_, i) => i);
    if (studyStarredOnly) {
      indices = indices.filter(i => starredIds.has(flashcard.cards[i]._id));
    }
    indices = shuffleArray(indices);
    setSessionQueue(indices);
    setViewerPos(0);
    setIsShowingAnswer(false);
    if (uid) saveProgress({ flashcards: { prefs: { shuffle: true } }, sessionQueue: indices, viewerPos: 0 });
  }
}

// Helper presentational components used above (in-file, lightweight)
type SettingRowProps = { title: string; desc: string; checked: boolean; onToggle: () => void; accent?: "green" | "amber" };
function SettingRow({ title, desc, checked, onToggle, accent = "green" }: SettingRowProps) {
  const accentClass = accent === "amber" ? "from-amber-400 to-amber-500" : "from-green-400 to-emerald-500";
  return (
    <div className="flex items-start gap-3 p-3 rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700">
      <div className="flex-1">
        <div className="font-medium">{title}</div>
        <div className="text-xs text-slate-400 mt-1">{desc}</div>
      </div>
      <button onClick={onToggle} className={`w-12 h-6 rounded-full p-0.5 transition ${checked ? `bg-gradient-to-br ${accentClass}` : 'bg-slate-300 dark:bg-slate-700'}`}>
        <div className={`h-5 w-5 rounded-full bg-white shadow transform transition ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

type ToggleRowProps = { label: string; desc: string; checked: boolean; onChange: () => void };
function ToggleRow({ label, desc, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between p-2">
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-xs text-slate-400">{desc}</div>
      </div>
      <label className="inline-flex items-center cursor-pointer">
        <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
        <span className={`w-12 h-6 rounded-full transition ${checked ? "bg-emerald-500" : "bg-slate-600"}`} />
      </label>
    </div>
  );
}

// Completion Summary UI shown when session finishes
type CompletionSummaryProps = {
  totalReviewed: number;
  counts: { again: number; hard: number; good: number; easy: number; total: number };
  mastered: number;
  stillLearning: number;
  onRestart: () => void;
  onReviewHardAgain: () => void;
  onNextDeck: () => void;
  onExplore: () => void;
};

function CompletionSummary({ totalReviewed, counts, mastered, stillLearning, onRestart, onReviewHardAgain, onNextDeck, onExplore }: CompletionSummaryProps) {
  return (
    <section className="mt-8">
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 shadow p-6">
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Session complete 🎉</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Here’s your review summary.</p>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-6">
          <SummaryTile label="Total reviewed" value={totalReviewed} className="bg-slate-50 dark:bg-slate-800" />
          <SummaryTile label="Easy" value={counts.easy} className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20" />
          <SummaryTile label="Good" value={counts.good} className="bg-sky-50 text-sky-700 dark:bg-sky-900/20" />
          <SummaryTile label="Hard" value={counts.hard} className="bg-amber-50 text-amber-700 dark:bg-amber-900/20" />
          <SummaryTile label="Again" value={counts.again} className="bg-rose-50 text-rose-700 dark:bg-rose-900/20" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          <SummaryTile label="Topics mastered" value={mastered} className="bg-[#1C2B1C]/10 text-[#1C2B1C] dark:bg-[#1C2B1C]/20" />
          <SummaryTile label="Still learning" value={stillLearning} className="bg-amber-50 text-amber-700 dark:bg-amber-900/20" />
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3">
          <button onClick={onRestart} className="w-full px-4 py-3 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:brightness-105">Restart deck</button>
          <button onClick={onReviewHardAgain} className="w-full px-4 py-3 rounded-md bg-amber-500 text-white hover:brightness-110">Review only Hard/Again</button>
          <button onClick={onNextDeck} className="w-full px-4 py-3 rounded-md bg-[#1C2B1C] text-white hover:brightness-110">Go to next deck</button>
          <button onClick={onExplore} className="w-full px-4 py-3 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 hover:brightness-110">Explore related topics</button>
        </div>
      </div>
    </section>
  );
}

function SummaryTile({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className={`rounded-xl p-4 border border-slate-100 dark:border-slate-700 ${className || ''}`}>
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-2xl font-semibold mt-1 text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  );
}