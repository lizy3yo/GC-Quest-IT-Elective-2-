"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Settings } from "lucide-react";
import LoadingTemplate2 from "@/components/molecules/loading_template_2/loading_template_2/loading2"; // added import
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/contexts/ToastContext";
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
  const { showSuccess, showError } = useToast();
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
  // trackProgress setting removed (UI and function removed)
  const [studyStarredOnly, setStudyStarredOnly] = useState(false);
  // sidePreference (Term/Definition) removed per request
  const [showBothSides, setShowBothSides] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [uid, setUid] = useState<string | null>(null); // <-- added: current user id for progress API
  const [progressLoaded, setProgressLoaded] = useState(false); // prevent init overwrite of loaded server state
  const progressLoadAttempted = React.useRef(false); // track if we've tried to load progress (set synchronously)
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
          try { maybe = await response.json(); } catch { }
          const msg = (maybe && typeof (maybe as { message?: unknown }).message === "string")
            ? (maybe as { message?: string }).message!
            : `Failed to load flashcard (${response.status})`;
          throw new Error(msg);
        }
        const data = (await response.json()) as { flashcard: Flashcard };
        if (!mounted) return;
        setFlashcard(data.flashcard);
        // Apply persisted starred cards ordering after flashcard is loaded
        try {
          await applyPersistedCardFavorites(data.flashcard, finalUid);
        } catch (e) {
          // ignore
        }
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

  // Read persisted favorite card timestamps and server progress, then apply starredIds and reorder cards
  async function applyPersistedCardFavorites(loadedFlashcard: Flashcard, uidStr?: string) {
    try {
      const uidToUse = uidStr || uid;

      // Try server progress first
      if (uidToUse) {
        try {
          const pr = await fetch(`/api/student_page/flashcard/${loadedFlashcard._id}/progress?userId=${uidToUse}`, { cache: 'no-store' });
          if (pr.ok) {
            const prog = await pr.json().catch(() => ({}));
            const progressData = prog?.progress || prog;
            const starredIdsArray = progressData?.flashcards?.starredIds || progressData?.starredIds;
            if (starredIdsArray && Array.isArray(starredIdsArray)) {
              const sv = new Set<string>(starredIdsArray);
              setStarredIds(sv);
              
              // Try to get timestamps from localStorage for proper ordering (newest first)
              let starredOrder = starredIdsArray;
              try {
                const key = `notewise.flashcard.cardFavoriteTimestamps.${loadedFlashcard._id}.${uidToUse}`;
                const raw = localStorage.getItem(key);
                if (raw) {
                  const map = JSON.parse(raw) as Record<string, number>;
                  const entries = Object.entries(map)
                    .filter(([id]) => sv.has(id))
                    .sort((a, b) => b[1] - a[1]); // newest first
                  const orderedIds = entries.map(e => e[0]);
                  // Include any starred IDs that don't have timestamps at the end
                  const remainingIds = starredIdsArray.filter((id: string) => !orderedIds.includes(id));
                  starredOrder = [...orderedIds, ...remainingIds];
                }
              } catch (e) {
                // ignore, use server order as fallback
              }
              
              // reorder cards so starred ones come first in timestamp order
              const remaining = loadedFlashcard.cards.filter(c => !sv.has(c._id));
              const starredCards = starredOrder.map((id: string) => loadedFlashcard.cards.find(c => c._id === id)).filter(Boolean) as FlashcardCard[];
              const newCards = [...starredCards, ...remaining];
              setFlashcard(prev => prev ? { ...prev, cards: newCards } : prev);
              return;
            }
          }
        } catch (e) {
          // fall through to localStorage
        }
      }

      // Fallback to localStorage timestamps
      try {
        const key = `notewise.flashcard.cardFavoriteTimestamps.${loadedFlashcard._id}.${uidToUse}`;
        const raw = localStorage.getItem(key);
        if (raw) {
          const map = JSON.parse(raw) as Record<string, number>;
          const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
          const favIds = entries.map(e => e[0]);
          setStarredIds(new Set(favIds));
          const favSet = new Set(favIds);
          const favCards = favIds.map(id => loadedFlashcard.cards.find(c => c._id === id)).filter(Boolean) as FlashcardCard[];
          const remaining = loadedFlashcard.cards.filter(c => !favSet.has(c._id));
          const newCards = [...favCards, ...remaining];
          setFlashcard(prev => prev ? { ...prev, cards: newCards } : prev);
        }
      } catch (e) {
        // ignore
      }
    } catch (e) {
      // ignore
    }
  }

  // initialize session queue when flashcard loads or when starred/study options change
  useEffect(() => {
    if (!flashcard) return;
    // if progress load was attempted, wait for it to finish
    if (progressLoadAttempted.current && !progressLoaded) return;
    // if progress was loaded from server, do not overwrite the persisted sessionQueue  
    if (progressLoaded) return;
    const total = flashcard.cards.length;
    setInitialTotal(total);

    let indices = Array.from({ length: total }, (_, i) => i);

    // When "study starred only" is enabled, limit the indices to starred card indices
    if (studyStarredOnly) {
      indices = indices.filter(i => starredIds.has(flashcard.cards[i]._id));
    }

  // NOTE: toggling shuffle via the header control applies it immediately.
    setSessionQueue(indices);
    setViewerPos(0);
    setIsShowingAnswer(false);
    // keep starredIds as-is (separate feature)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashcard, studyStarredOnly, shuffle, starredIdsKey]);

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
      // persist immediately to server
      if (uid) saveProgress({ flashcards: { starredIds: Array.from(next) } });

      // also persist per-card favorite timestamps to localStorage so the detail page can read ordering
      try {
        const key = `notewise.flashcard.cardFavoriteTimestamps.${flashcardId}.${uid}`;
        const raw = localStorage.getItem(key);
        const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
        const now = Date.now();
        // if the id is present in next set, ensure timestamp exists, otherwise remove it
        if (next.has(id)) map[id] = now;
        else delete map[id];
        localStorage.setItem(key, JSON.stringify(map));
        // broadcast to other listeners (detail page, other tabs)
        try {
          if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
            const bc = new BroadcastChannel(`notewise.flashcard.${flashcardId}.starred`);
            bc.postMessage({ starredIds: Array.from(next) });
            bc.close();
          }
        } catch (e) {
          // ignore
        }
      } catch (e) {
        // ignore localstorage errors
      }

      // Reorder cards so that all starred cards are at the front, ordered by timestamp (most recent first)
      setFlashcard((prev) => {
        if (!prev) return prev;
        // read timestamps (best-effort)
        const key = `notewise.flashcard.cardFavoriteTimestamps.${flashcardId}.${uid}`;
        let tsMap: Record<string, number> = {};
        try {
          const raw = localStorage.getItem(key);
          tsMap = raw ? (JSON.parse(raw) as Record<string, number>) : {};
        } catch (e) {
          tsMap = {};
        }

        // collect starred ids present in nextSet and sort by timestamp desc
        const starredEntries = Object.entries(tsMap).filter(([k]) => next.has(k));
        starredEntries.sort((a, b) => (b[1] - a[1]));
        const starredIdsOrdered = starredEntries.map((e) => e[0]);

        // In case timestamps are missing for some ids (edge cases), include any remaining starred ids
        const remainingStarred = Array.from(next).filter((s) => !starredIdsOrdered.includes(s));
        const finalStarredOrder = [...starredIdsOrdered, ...remainingStarred];

        const starredCards = finalStarredOrder
          .map((sid) => prev.cards.find((c) => c._id === sid))
          .filter(Boolean) as FlashcardCard[];

        const remaining = prev.cards.filter((c) => !next.has(c._id));
        const newCards = [...starredCards, ...remaining];

        return { ...prev, cards: newCards };
      });

      // If user is studying "starred only", immediately update the session to reflect the new starred set.
      if (studyStarredOnly && flashcard) {
        const indices = flashcard.cards.map((_, i) => i).filter(i => next.has(flashcard.cards[i]._id));
        // do NOT auto-shuffle here; indices will be shuffled only if the shuffle pref is enabled (header control applies it immediately)
        setSessionQueue(indices);
        setViewerPos(0);
        setIsShowingAnswer(false);
      }
      return next;
    });
  };

  // Listen for starred changes from other pages/tabs via BroadcastChannel and storage events
  useEffect(() => {
    if (typeof window === 'undefined' || !flashcard || !uid) return;
    const channelName = `notewise.flashcard.${flashcardId}.starred`;

    let bc: BroadcastChannel | null = null;
    try {
      if ('BroadcastChannel' in window) {
        bc = new BroadcastChannel(channelName);
        bc.onmessage = (ev) => {
          try {
            const data = ev.data as { starredIds?: string[] } | null;
            if (data && Array.isArray(data.starredIds)) {
              const nextSet = new Set(data.starredIds);
              setStarredIds(nextSet);

              // Reorder cards to reflect the new starred set
              setFlashcard((prev) => {
                if (!prev) return prev;

                // Read timestamps to maintain proper ordering
                const key = `notewise.flashcard.cardFavoriteTimestamps.${flashcardId}.${uid}`;
                let tsMap: Record<string, number> = {};
                try {
                  const raw = localStorage.getItem(key);
                  tsMap = raw ? (JSON.parse(raw) as Record<string, number>) : {};
                } catch (e) {
                  tsMap = {};
                }

                // Collect starred ids and sort by timestamp desc
                const starredEntries = Object.entries(tsMap).filter(([k]) => nextSet.has(k));
                starredEntries.sort((a, b) => (b[1] - a[1]));
                const starredIdsOrdered = starredEntries.map((e) => e[0]);

                // Include any remaining starred ids without timestamps
                const remainingStarred = Array.from(nextSet).filter((s) => !starredIdsOrdered.includes(s));
                const finalStarredOrder = [...starredIdsOrdered, ...remainingStarred];

                const starredCards = finalStarredOrder
                  .map((sid) => prev.cards.find((c) => c._id === sid))
                  .filter(Boolean) as FlashcardCard[];

                const remaining = prev.cards.filter((c) => !nextSet.has(c._id));
                const newCards = [...starredCards, ...remaining];

                return { ...prev, cards: newCards };
              });
            }
          } catch (e) {
            // ignore
          }
        };
      }
    } catch (e) {
      bc = null;
    }

    const storageHandler = (e: StorageEvent) => {
      const key = `notewise.flashcard.cardFavoriteTimestamps.${flashcardId}.${uid}`;
      if (e.key !== key) return;
      try {
        if (!e.newValue) {
          setStarredIds(new Set());
          setFlashcard((prev) => prev ? { ...prev, cards: prev.cards } : prev);
          return;
        }
        const map = JSON.parse(e.newValue) as Record<string, number>;
        const nextSet = new Set(Object.keys(map));
        setStarredIds(nextSet);

        // Reorder cards based on localStorage update
        setFlashcard((prev) => {
          if (!prev) return prev;

          const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
          const favIds = entries.map(e => e[0]);
          const favSet = new Set(favIds);
          const favCards = favIds.map(id => prev.cards.find(c => c._id === id)).filter(Boolean) as FlashcardCard[];
          const remaining = prev.cards.filter(c => !favSet.has(c._id));
          const newCards = [...favCards, ...remaining];

          return { ...prev, cards: newCards };
        });
      } catch (err) {
        // ignore
      }
    };
    window.addEventListener('storage', storageHandler);

    return () => {
      window.removeEventListener('storage', storageHandler);
      try { bc && bc.close(); } catch (e) { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flashcardId, uid, flashcard]);

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
  const [completionPersisted, setCompletionPersisted] = useState(false); // track if we loaded completion from server

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

    // track rating stats (counts and per-card sets). We compute a snapshot synchronously
    // so we can persist the exact values immediately (avoids stale state issues).
    const cardId = currentCard?._id;
    const newRatingCounts = {
      again: ratingCounts.again + (rating === "again" ? 1 : 0),
      hard: ratingCounts.hard + (rating === "hard" ? 1 : 0),
      good: ratingCounts.good + (rating === "good" ? 1 : 0),
      easy: ratingCounts.easy + (rating === "easy" ? 1 : 0),
      total: (ratingCounts.total || 0) + 1,
    };
    setRatingCounts(newRatingCounts);

    // Build deterministic arrays for persisted sets (snapshot current + new)
    const newAgainIdsArr = Array.from(againIds);
    const newHardIdsArr = Array.from(hardIds);
    const newEasyIdsArr = Array.from(easyIds);
    if (cardId) {
      if (rating === "again" && !newAgainIdsArr.includes(cardId)) newAgainIdsArr.push(cardId);
      if (rating === "hard" && !newHardIdsArr.includes(cardId)) newHardIdsArr.push(cardId);
      if (rating === "easy" && !newEasyIdsArr.includes(cardId)) newEasyIdsArr.push(cardId);

      // Also update local Sets for UI continuity
      setAgainIds(s => { const n = new Set(s); if (rating === "again") n.add(cardId); return n; });
      setHardIds(s => { const n = new Set(s); if (rating === "hard") n.add(cardId); return n; });
      setEasyIds(s => { const n = new Set(s); if (rating === "easy") n.add(cardId); return n; });
    }

      // compute new queue immediately (avoid closure-stale bugs) and persist immediately
      // NOTE: side-effects must not run inside the setState updater because React
      // may call updater multiple times (Strict Mode/dev). Compute the next queue
      // synchronously, call setSessionQueue, then run side-effects once.
      const prev = sessionQueue;
      if (prev && prev.length) {
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
        setSessionQueue(next);
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

        // if no more cards, show completion (run side-effects once)
        if (next.length === 0) {
          setShowCompletion(true);

          (async () => {
            try {
              if (uid && flashcard) {
                const cardsStudied = initialTotal || flashcard.cards.length;
                const studiedFavorites = studyStarredOnly;

                // Persist completion state to server so it survives page reload
                const completionData = {
                  showCompletion: true,
                  initialTotal: initialTotal || flashcard.cards.length, // Save the initial total
                  ratingCounts: newRatingCounts,
                  againIds: newAgainIdsArr,
                  hardIds: newHardIdsArr,
                  easyIds: newEasyIdsArr,
                  completedAt: new Date().toISOString(),
                };

                // Persist to localStorage immediately as a fast-fail fallback so the UI
                // can restore completion even if the server save is delayed or fails.
                try {
                  const key = `notewise.flashcard.completion.${flashcardId}.${uid}`;
                  if (typeof window !== 'undefined') localStorage.setItem(key, JSON.stringify(completionData));
                } catch (e) {
                  // ignore localStorage write errors
                }

                // Save completion state
                await saveProgress({
                  sessionQueue: next,
                  viewerPos: newPos,
                  completion: completionData
                });

                // Log to history via API
                await authManager.makeAuthenticatedRequest('/api/student_page/log-activity', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    userId: uid,
                    type: 'flashcard.study_complete',
                    action: studiedFavorites ? 'Studied favorites' : 'Studied flashcard set',
                    meta: {
                      flashcardId: flashcard._id,
                      flashcardTitle: flashcard.title,
                      cardsStudied,
                      studiedFavorites,
                      ratingCounts: completionData.ratingCounts
                    },
                    progress: 100
                  })
                });

                // Trigger immediate achievement check with slight delay to ensure activity is persisted
                if (typeof window !== 'undefined') {
                  // Small delay to ensure database write completes
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('checkAchievements'));
                    
                    // Also broadcast to other tabs
                    try {
                      if ('BroadcastChannel' in window) {
                        const bc = new BroadcastChannel('notewise.activities');
                        bc.postMessage({ type: 'flashcard.study_complete', flashcardId: flashcard._id });
                        bc.close();
                      }
                    } catch (e) {
                      console.warn('BroadcastChannel not available:', e);
                    }
                  }, 500);
                }

                // Show success popup: keep title, replace subtitle with concise praise
                showSuccess('Good Job', '🎉 Session Complete');
              }
            } catch (e) {
              console.warn('Failed to log study completion:', e);
            }
          })();
        }
      }

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
    console.log("💾 SAVING PROGRESS:", JSON.stringify(payload, null, 2));
    try {
      const response = await fetch(`/api/student_page/flashcard/${flashcardId}/progress?userId=${uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      console.log("✅ SAVE RESPONSE:", result);
    } catch (err) {
      // silent fail; server logging handles it
      console.error("❌ Failed to save progress", err);
    }
  }

  // load persisted progress when flashcard and uid are available
  useEffect(() => {
    let mounted = true;
    async function loadProgress() {
      if (!uid || !flashcard) return;
      
      console.log("🔄 LOADING PROGRESS for flashcard:", flashcardId, "user:", uid);
      
      // CRITICAL: Set BOTH ref and state IMMEDIATELY to block init effect from running
      progressLoadAttempted.current = true;
      setProgressLoaded(true);
      
      // Fast-path: if we have a locally persisted completion (saved as a fallback
      // when the user finished the session), restore it immediately so the UI
      // stays on the completion screen even if the server save hasn't completed.
      try {
        const key = `notewise.flashcard.completion.${flashcardId}.${uid}`;
        if (typeof window !== 'undefined') {
          const raw = localStorage.getItem(key);
          if (raw) {
            const localComp = JSON.parse(raw);
            console.log('📁 Restoring completion from localStorage', localComp);
            if (localComp) {
              setShowCompletion(true);
              setCompletionPersisted(true);
              if (typeof localComp.initialTotal === 'number') setInitialTotal(localComp.initialTotal);
              if (localComp.ratingCounts) setRatingCounts(localComp.ratingCounts);
              if (Array.isArray(localComp.againIds)) setAgainIds(new Set(localComp.againIds));
              if (Array.isArray(localComp.hardIds)) setHardIds(new Set(localComp.hardIds));
              if (Array.isArray(localComp.easyIds)) setEasyIds(new Set(localComp.easyIds));
              // Restore sessionQueue to the saved value (may be empty)
              if (Array.isArray(localComp.sessionQueue)) setSessionQueue(localComp.sessionQueue);
              if (typeof localComp.viewerPos === 'number') setViewerPos(localComp.viewerPos);
            }
          }
        }
      } catch (e) {
        // ignore errors reading localStorage
      }

      try {
        const res = await fetch(`/api/student_page/flashcard/${flashcardId}/progress?userId=${uid}`, { cache: "no-store" });
        if (!res.ok) {
          console.log("⚠️ Load failed:", res.status);
          return;
        }
        const json = await res.json().catch(() => null);
        const progress = json?.progress;
        console.log("📥 LOADED PROGRESS:", JSON.stringify(progress, null, 2));
        if (!mounted || !progress) return;
        
        // Check if there's a saved completion state
        if (progress.completion && progress.completion.showCompletion) {
          console.log("🎉 RESTORING COMPLETION STATE");
          setShowCompletion(true);
          setCompletionPersisted(true);
          
          // Restore the initial total so progress bar shows correctly
          if (typeof progress.completion.initialTotal === "number") {
            console.log("📊 Restoring initialTotal:", progress.completion.initialTotal);
            setInitialTotal(progress.completion.initialTotal);
          }
          
          // Restore rating counts and card sets
          if (progress.completion.ratingCounts) {
            console.log("📊 Restoring rating counts:", progress.completion.ratingCounts);
            setRatingCounts(progress.completion.ratingCounts);
          }
          if (Array.isArray(progress.completion.againIds)) {
            setAgainIds(new Set(progress.completion.againIds));
          }
          if (Array.isArray(progress.completion.hardIds)) {
            setHardIds(new Set(progress.completion.hardIds));
          }
          if (Array.isArray(progress.completion.easyIds)) {
            setEasyIds(new Set(progress.completion.easyIds));
          }
        }
        
        // apply persisted prefs / starred / session state
        if (progress.flashcards && Array.isArray(progress.flashcards.starredIds)) setStarredIds(new Set(progress.flashcards.starredIds));
        if (progress.flashcards && progress.flashcards.prefs) {
          // 'sidePreference' and 'trackProgress' preferences removed; only keep remaining prefs
          setShuffle(!!progress.flashcards.prefs.shuffle);
          setStudyStarredOnly(!!progress.flashcards.prefs.studyStarredOnly);
          setShowBothSides(!!progress.flashcards.prefs.showBothSides);
        }
        // Restore sessionQueue: if completion is set, restore even if empty; otherwise only if non-empty
        if (Array.isArray(progress.sessionQueue)) {
          if (progress.completion?.showCompletion || progress.sessionQueue.length > 0) {
            console.log("🔢 Restoring sessionQueue:", progress.sessionQueue);
            setSessionQueue(progress.sessionQueue);
          }
        }
        if (typeof progress.viewerPos === "number") setViewerPos(progress.viewerPos);
        // progressLoaded was already set at the start of this function
      } catch (err) {
        // ignore load errors
        console.error("❌ Failed to load progress", err);
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
      // Persist prefs; 'sidePreference' removed
      saveProgress({ flashcards: { prefs: { shuffle, studyStarredOnly, showBothSides } } });
      saveTimer.current = null;
    }, 700);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shuffle, studyStarredOnly, showBothSides, uid]);

  // Removed debounced persistence for sessionQueue/viewerPos as they are saved immediately in rateCard and other functions
  // --- end Progress API integration --------------------------------------------

  if (isLoading) return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 flex items-center justify-center p-6">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" aria-hidden="true" />
        <p className="text-gray-500 dark:text-slate-400">Loading your flashcards...</p>
      </div>
    </div>
  );
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
          rating === "good" ? "bg-teal-600" :
            "bg-teal-600";
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
    setCompletionPersisted(false);
    
    // Clear completion state from server so it doesn't show on reload
    if (uid) await saveProgress({ 
      sessionQueue: indices, 
      viewerPos: 0,
      completion: null // Clear completion state
    });
    try {
      const key = `notewise.flashcard.completion.${flashcardId}.${uid}`;
      if (typeof window !== 'undefined') localStorage.removeItem(key);
    } catch (e) {
      // ignore
    }
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
    setCompletionPersisted(false);
    
    // Clear completion state from server when starting a new review
    if (uid) await saveProgress({ 
      sessionQueue: indices, 
      viewerPos: 0,
      completion: indices.length === 0 ? undefined : null // Only clear if we have cards to review
    });
    try {
      const key = `notewise.flashcard.completion.${flashcardId}.${uid}`;
      if (typeof window !== 'undefined') localStorage.removeItem(key);
    } catch (e) {
      // ignore
    }
  };

  const gotoNextDeck = () => {
    // Navigate back to library where user can pick next deck
    router.push("/student_page/library");
  };

  const exploreRelated = () => {
    // Navigate to explore/flashcards page
    router.push("/student_page/flashcards");
  };

  const uniqueMastered = easyIds.size; // topics mastered approximated by cards marked Easy
  const uniqueStillLearning = Math.max(0, (flashcard.cards?.length || 0) - uniqueMastered);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-3 sm:p-4 lg:p-6 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-2 sm:px-4">
        <header className="grid grid-cols-1 xl:grid-cols-[auto_1fr_auto] items-start xl:items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => router.back()}
              aria-label="Back"
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-700/60 hover:bg-slate-700/80 flex items-center justify-center text-slate-100 transition flex-shrink-0"
            >
              <ChevronLeft size={14} className="sm:w-4 sm:h-4 text-slate-100" />
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-lg lg:text-2xl font-semibold text-slate-900 dark:text-slate-100 truncate leading-tight">{flashcard.title}</h1>
              <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">Flashcards · <span className="font-medium text-slate-900 dark:text-slate-100">{flashcard.cards.length}</span></div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 xl:justify-self-end">
            <button
              onClick={() => setShowOptions(true)}
              aria-label="Options"
              className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:shadow inline-flex items-center text-sm sm:text-base"
            >
              <Settings size={16} className="sm:w-[18px] sm:h-[18px]" />
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
              <div className="mb-3 sm:mb-4 flex items-center justify-between text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                <div>Card <span className="font-medium text-slate-700 dark:text-slate-100">{Math.min(viewerPos + 1, Math.max(remaining, 1))}</span> / <span className="font-medium">{Math.max(remaining, 1)}</span></div>
              </div>

              {/* Progress bar moved above card */}
              <div className="mb-4 max-w-5xl mx-auto">
                <div className="w-full h-1.5 sm:h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-teal-600 to-teal-600 transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  <div className="flex items-center">
                    <span>Progress</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 ml-1 sm:ml-2">{progress}%</span>
                  </div>
                </div>
              </div>

              <div className="relative max-w-5xl mx-auto">
                {/* make the card much larger using viewport height.
                    When "Show both sides" is enabled render two stacked cards.
                */}
                <div className="h-[32vh] sm:h-[35vh] md:h-[38vh] lg:h-[40vh] xl:h-[42vh]">
                  {showBothSides ? (
                    <div className="h-full flex flex-col gap-3 sm:gap-4 lg:gap-6">
                      {/* Front / top */}
                      <div className={`w-full flex-1 rounded-xl sm:rounded-2xl flex items-center justify-center p-4 sm:p-6 text-center select-none shadow-lg border border-slate-100 dark:border-transparent ${getBgClass(true, null)}`}>
                        {/* Front label removed */}
                        <div className="max-w-[85%] text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl leading-snug break-words overflow-hidden">{currentCard?.question ?? "No question"}</div>
                      </div>

                      {/* Back / bottom (rating overlay will attach here) */}
                      <div className={`relative w-full flex-1 rounded-xl sm:rounded-2xl flex items-center justify-center p-4 sm:p-6 text-center select-none shadow-lg border border-slate-100 dark:border-transparent ${getBgClass(false, null)}`}>
                        <div className="absolute top-2 sm:top-3 right-2 sm:right-3 bg-slate-200 dark:bg-slate-700 text-xs px-2 py-1 rounded">Back</div>
                        <div className="max-w-[85%] text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl leading-snug break-words overflow-hidden">{currentCard?.answer ?? "No answer"}</div>
                        {/* Rating overlay attaches to the back card in "both sides" mode */}
                        {selectedRating && (
                          <div
                            className={`absolute inset-0 rounded-xl sm:rounded-2xl flex items-center justify-center text-lg sm:text-xl lg:text-2xl font-bold z-10 ${selectedRating === "again"
                                ? "bg-red-700/100 text-white"
                                : selectedRating === "hard"
                                  ? "bg-amber-500/100 text-white"
                                  : selectedRating === "good"
                                    ? "bg-teal-600 text-white"
                                    : "bg-teal-600 text-white"
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
                        className="relative w-full h-full rounded-xl sm:rounded-2xl focus:outline-none [transform-style:preserve-3d] shadow-lg hover:shadow-2xl border border-slate-100 dark:border-transparent"
                        style={{
                          transform: isShowingAnswer ? "rotateY(180deg)" : "rotateY(0deg)",
                          transition: disableFlipTransition ? "none" : "transform 700ms",
                        }}
                      >
                        {/* Front (question) */}
                        <div className={`absolute inset-0 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center p-4 sm:p-6 text-center select-none [backface-visibility:hidden] ${getBgClass(true, null)}`}>
                          {/* Front label removed */}
                          <div className="w-full flex flex-col items-center">
                            <div className="max-w-[85%] text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl leading-snug break-words overflow-hidden">{currentCard?.question ?? "No question"}</div>
                            <div className="mt-3 sm:mt-4 text-xs sm:text-sm text-slate-500 dark:text-slate-400">Press <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs">Space</span> or click to flip</div>
                          </div>
                        </div>

                        {/* Back (answer) */}
                        <div className={`absolute inset-0 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center p-4 sm:p-6 text-center select-none [backface-visibility:hidden] [transform:rotateY(180deg)] ${getBgClass(false, null)}`}>
                          <div className="absolute top-2 right-2 bg-slate-200 dark:bg-slate-700 text-xs px-2 py-1 rounded">Back</div>
                          <div className="w-full flex flex-col items-center">
                            <div className="max-w-[85%] text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl leading-snug break-words overflow-hidden">{currentCard?.answer ?? "No answer"}</div>
                            <div className="mt-3 sm:mt-4 text-xs sm:text-sm text-slate-500 dark:text-slate-400">Flip back with Space or click</div>
                          </div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                {/* Hint / image small overlay */}
                {currentCard?.image && (
                  <div className="absolute top-3 sm:top-4 right-4 sm:right-6 bg-white/80 dark:bg-black/40 rounded-md p-1 shadow">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={currentCard.image} alt="card image" className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 object-cover rounded" />
                  </div>
                )}
              </div>

              {/* Rating buttons: Disable during animation */}
              <div className="mt-3 sm:mt-4 flex items-center justify-center gap-2 sm:gap-3 flex-wrap max-w-5xl mx-auto">
                <button
                  onClick={() => rateCard("again")}
                  disabled={isRatingInProgress}
                  className={`min-w-[60px] sm:min-w-[72px] px-2 sm:px-3 py-1.5 sm:py-2 rounded-full bg-red-100 text-red-700 text-sm sm:text-base font-medium hover:bg-red-200 transition-colors ${isRatingInProgress ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  Again
                </button>
                <button
                  onClick={() => rateCard("hard")}
                  disabled={isRatingInProgress}
                  className={`min-w-[60px] sm:min-w-[72px] px-2 sm:px-3 py-1.5 sm:py-2 rounded-full bg-amber-100 text-amber-800 text-sm sm:text-base font-medium hover:bg-amber-200 transition-colors ${isRatingInProgress ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  Hard
                </button>
                <button
                  onClick={() => rateCard("good")}
                  disabled={isRatingInProgress}
                  className={`min-w-[60px] sm:min-w-[72px] px-2 sm:px-3 py-1.5 sm:py-2 rounded-full bg-teal-600/10 text-teal-600 text-sm sm:text-base font-medium hover:bg-teal-600/20 transition-colors ${isRatingInProgress ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  Good
                </button>
                <button
                  onClick={() => rateCard("easy")}
                  disabled={isRatingInProgress}
                  className={`min-w-[60px] sm:min-w-[72px] px-2 sm:px-3 py-1.5 sm:py-2 rounded-full bg-teal-600 text-white text-sm sm:text-base font-medium hover:bg-teal-700 transition-colors ${isRatingInProgress ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  Easy
                </button>
              </div>

              <div className="mt-4 sm:mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <button
                    onClick={() => toggleStar(currentCard?._id)}
                    className={`inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full font-medium transition text-sm sm:text-base ${starredIds.has(currentCard?._id || "") ? "bg-yellow-500 text-white shadow-md" : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      }`}
                  >
                    <svg width="14" height="14" className="sm:w-4 sm:h-4 inline-block" viewBox="0 0 24 24" fill={starredIds.has(currentCard?._id || "") ? "white" : "none"} stroke={starredIds.has(currentCard?._id || "") ? "none" : "currentColor"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 17.3 7.4 20l1-5.3L4 11.5l5.4-.5L12 6l2.6 5 5.4.5-4.4 3.2 1 5.3z" />
                    </svg>
                    <span className="hidden sm:inline">{starredIds.has(currentCard?._id || "") ? "Starred" : "Star"}</span>
                  </button>

                  {/* Track progress pill removed per request */}
                </div>

                <div className="flex items-center gap-2 sm:gap-3 justify-center flex-wrap sm:ml-12 md:ml-16 lg:ml-20">
                  <div className="inline-flex items-center gap-1 sm:gap-2 px-2 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/20 text-xs sm:text-sm">
                    <span className="font-semibold">Still learning</span>
                    <span className="inline-block w-5 sm:w-6 text-center bg-white dark:bg-slate-800 rounded-full px-1 text-xs">{remaining}</span>
                  </div>
                  <div className="inline-flex items-center gap-1 sm:gap-2 px-2 py-1 rounded-full bg-teal-600/10 text-teal-600 dark:bg-teal-600/20 text-xs sm:text-sm">
                    <span className="font-semibold">Know</span>
                    <span className="inline-block w-5 sm:w-6 text-center bg-white dark:bg-slate-800 rounded-full px-1 text-xs">{learnedCount}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 justify-center sm:justify-end">
                  <button
                    onClick={goPrev}
                    aria-label="Previous"
                    disabled={viewerPos === 0}
                    className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:scale-105 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={16} className="sm:w-[18px] sm:h-[18px]" />
                  </button>
                  <button
                    onClick={goNext}
                    aria-label="Next"
                    disabled={viewerPos >= sessionQueue.length - 1}
                    className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full bg-gradient-to-br from-teal-600 to-teal-600 text-white shadow-sm hover:brightness-105 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={16} className="sm:w-[18px] sm:h-[18px]" />
                  </button>
                  <button
                    onClick={goRandom}
                    className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full bg-sky-500 text-white hover:scale-105 transition"
                    title="Shuffle to random card"
                  >
                    <svg width="14" height="14" className="sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M3 4l17 17" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </main>

        {/* Options / Settings modal (UI only) */}
        {showOptions && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 lg:p-6">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowOptions(false)} />

            {/* center modal, allow scrolling when viewport is small */}
            <div className="relative w-full max-w-4xl max-h-[95vh] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl shadow-2xl overflow-auto grid grid-cols-1 xl:grid-cols-[1fr_220px] items-start">
              {/* Left: settings */}
              <div className="p-4 sm:p-6 h-full flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg sm:text-xl font-semibold">Options</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Session settings and UI preferences</p>
                  </div>
                  <button onClick={() => setShowOptions(false)} className="ml-3 sm:ml-4 text-slate-400 hover:text-teal-600 p-1 flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="grid gap-2">
                  {/* "Track progress" setting removed */}

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
                        if (uid) saveProgress({ flashcards: { prefs: { shuffle, studyStarredOnly: next, showBothSides } } });
                        return next;
                      });
                    }}
                    accent="amber"
                  />
                </div>

                <div className="grid gap-2">
                  <div className="flex flex-col gap-3">
                    <ToggleRow label="Show both sides" desc="Reveal question and answer together" checked={showBothSides} onChange={() => setShowBothSides(v => !v)} />
                    {/* Shuffle control moved to the header for quicker access; removed from modal. */}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-auto">
                  <button
                    onClick={async () => {
                      const total = flashcard?.cards.length || 0;
                      let indices = Array.from({ length: total }, (_, i) => i);
                      // Respect "study starred only" when restarting
                      if (studyStarredOnly && flashcard) {
                        indices = indices.filter(i => starredIds.has(flashcard.cards[i]._id));
                      }
                      // do NOT auto-shuffle on restart; shuffle will only be applied when the shuffle pref is enabled (header control applies immediately)
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
                    className="px-3 py-1.5 rounded-md bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                  >
                    Restart Flashcards
                  </button>

                  <div className="ml-auto text-xs text-slate-400">Changes apply immediately</div>
                </div>

              </div>

              {/* Right: preview / summary */}
              <div className="p-2 sm:p-3 border-l border-slate-100 dark:border-slate-700 bg-gradient-to-b from-slate-50 to-white dark:from-slate-800 dark:to-slate-800">
                <div className="text-sm font-medium mb-2">Session preview</div>

                <div className="rounded-lg p-2 mb-3 bg-white dark:bg-slate-900 shadow-inner">
                  <div className="text-xs text-slate-500 mb-2">Progress</div>
                  <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-3">
                    <div className="h-full bg-gradient-to-r from-green-400 to-emerald-500" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="text-xs text-slate-500 flex justify-between">
                    <span>{learnedCount} know</span>
                    <span>{remaining} learning</span>
                  </div>
                </div>

                <div className="rounded-lg p-2 bg-slate-50 dark:bg-slate-800">
                  <div className="text-xs text-slate-500 mb-2">Current card</div>
                  <div className="h-24 flex items-center justify-center rounded-md bg-white dark:bg-slate-900 text-center px-3">
                    <div className="text-sm">{currentCard?.question ?? "No question"}</div>
                  </div>

                  <div className="mt-3 text-xs text-slate-500">
                    Tip: use Space to flip, ← / → to navigate. Toggle &apos;Show both sides&apos; to reveal both sides at once.
                  </div>
                </div>

                
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
  // Persist only the session state (do not mark a persistent "shuffle enabled" pref)
  if (uid) saveProgress({ sessionQueue: indices, viewerPos: 0 });
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

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 mt-4 sm:mt-6">
          <SummaryTile label="Total reviewed" value={totalReviewed} className="bg-slate-50 dark:bg-slate-800" />
          <SummaryTile label="Easy" value={counts.easy} className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20" />
          <SummaryTile label="Good" value={counts.good} className="bg-sky-50 text-sky-700 dark:bg-sky-900/20" />
          <SummaryTile label="Hard" value={counts.hard} className="bg-amber-50 text-amber-700 dark:bg-amber-900/20" />
          <SummaryTile label="Again" value={counts.again} className="bg-rose-50 text-rose-700 dark:bg-rose-900/20" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          <SummaryTile label="Topics mastered" value={mastered} className="bg-teal-600/10 text-teal-600 dark:bg-teal-600/20" />
          <SummaryTile label="Still learning" value={stillLearning} className="bg-amber-50 text-amber-700 dark:bg-amber-900/20" />
        </div>

        <div className="mt-8">
          <button onClick={onRestart} className="w-full px-4 py-3 rounded-md bg-teal-600 text-white hover:brightness-110">Restart deck</button>
        </div>
      </div>
    </section>
  );
}

function SummaryTile({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className={`rounded-lg sm:rounded-xl p-3 sm:p-4 border border-slate-100 dark:border-slate-700 ${className || ''}`}>
      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">{label}</div>
      <div className="text-lg sm:text-xl lg:text-2xl font-semibold mt-1 text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  );
}