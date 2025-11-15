"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";

import LoadingTemplate2 from "@/components/atoms/loading_template_2/loading2"; // added import
import { Settings } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { authManager } from "@/utils/auth";

type Card = { _id: string; question: string; answer: string; image?: string };
type Flashcard = { _id: string; title: string; cards: Card[] };

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Helper: simple ObjectId check (24 hex chars)
function isObjectId(id?: string | null) {
  return typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);
}

// Helper: decide uid (prefers authenticated user._id, falls back to localStorage)
function getUidForRequests(user?: any) {
  if (user && user._id) return String(user._id);
  const ls = typeof window !== "undefined" ? localStorage.getItem("userId") : null;
  return ls;
}

export default function TestPage() {
  const params = useParams() as { flashcardId?: string };
  const router = useRouter();
  const flashcardId = params.flashcardId || "";
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [flashcard, setFlashcard] = useState<Flashcard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [questions, setQuestions] = useState<
    { card: Card; choices: string[] }[]
  >([]);
  // per-question selection (index aligned with questions)
  const [selectedAnswers, setSelectedAnswers] = useState<(string | null)[]>(
    []
  );

  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [shuffleChoices, setShuffleChoices] = useState(true);

  // New test mode options
  const [testMode, setTestMode] = useState<'multiple-choice' | 'written' | 'mixed'>('multiple-choice');
  const [feedbackMode, setFeedbackMode] = useState<'immediate' | 'end'>('end');
  const [writtenAnswers, setWrittenAnswers] = useState<(string)[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [questionTypes, setQuestionTypes] = useState<('multiple-choice' | 'written')[]>([]);
  // Used to avoid rebuilding questions when we programmatically restore testMode from server
  const ignoreBuildOnTestModeChange = useRef(false);

  // track whether we've restored progress from server to avoid overwriting immediately
  const [restoredProgress, setRestoredProgress] = useState(false);

  // track user-driven changes to prevent server restoration from overriding them
  const userMadeChanges = useRef(false);

  // track if any answers have been provided to prevent randomization
  const [hasAnswers, setHasAnswers] = useState(false);

  // reviewMode unchanged hook position
  const reviewMode = useMemo(() => {
    if (!done || wrongIds.length === 0 || !flashcard) return null;
    const wrongCards = flashcard.cards.filter((c) => wrongIds.includes(c._id));
    return wrongCards;
  }, [done, wrongIds, flashcard]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      // Wait for auth to complete
      if (authLoading) return;

      setLoading(true);
      setError(null);
      try {
        let uid: string | null = null;

        // Method 1: Use authenticated user if available
        if (isAuthenticated && user?._id) {
          uid = user._id;
          console.log("✅ Test: Authenticated user ID:", uid);
        }

        // Method 2: Fallback to localStorage userId
        if (!uid) {
          uid = localStorage.getItem('userId');
          if (uid) {
            console.log("✅ Test: Using localStorage userId:", uid);
          }
        }

        // Method 3: Generate a temporary user ID for demo purposes
        if (!uid) {
          uid = `temp-user-${Date.now()}`;
          localStorage.setItem('userId', uid);
          console.log("⚠️ Test: Generated temporary user ID:", uid);
        }

        if (!mounted) return;

        // Use authenticated request for better error handling
        const response = await authManager.makeAuthenticatedRequest(
          `/api/student_page/flashcard/${flashcardId}?userId=${uid}`,
          {
            method: 'GET',
            cache: "no-store" as RequestCache
          }
        );

        if (!response.ok) {
          const maybe = await response.json().catch(() => ({} as any));
          throw new Error(maybe?.message || `Failed to load (${response.status})`);
        }

        const data = (await response.json()) as { flashcard: Flashcard };
        if (!mounted) return;
        setFlashcard(data.flashcard);

        // --- NEW: Immediately load and apply saved test settings so testMode
        // is applied before/between question builds and survives a reload.
        try {
          if (isObjectId(uid)) {
            const progRes = await authManager.makeAuthenticatedRequest(
              `/api/student_page/flashcard/${flashcardId}/progress?userId=${uid}`,
              { method: "GET", cache: "no-store" as RequestCache }
            );
            if (progRes.ok) {
              const progData = await progRes.json().catch(() => null);
              const progTest = progData?.progress?.test;
              if (progTest) {
                if (!mounted) return;
                if (typeof progTest.shuffleChoices === "boolean") {
                  setShuffleChoices(progTest.shuffleChoices);
                }
                if (progTest.feedbackMode) {
                  setFeedbackMode(progTest.feedbackMode);
                }
                if (progTest.testMode && typeof progTest.testMode === "string") {
                  // Apply server-saved global testMode so the build-effect will create matching question types
                  setTestMode(progTest.testMode as 'multiple-choice' | 'written' | 'mixed');
                }
                if (typeof progTest.score === "number") {
                  setScore(progTest.score);
                }
                if (typeof progTest.done === "boolean") {
                  setDone(progTest.done);
                }
              }
            }
          }
        } catch (err) {
          console.warn("Failed to pre-load test progress:", err);
        }
        // --- END NEW
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load test.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (flashcardId && !authLoading) {
      load();
    }

    return () => {
      mounted = false;
    };
  }, [flashcardId, authLoading, isAuthenticated, user]);

  // build questions once flashcard loads
  useEffect(() => {
    // If we are skipping a rebuild caused by a programmatic testMode restore, skip once.
    if (ignoreBuildOnTestModeChange.current) {
      ignoreBuildOnTestModeChange.current = false;
      return;
    }
    if (!flashcard) return;

    // Don't rebuild questions if user has already provided answers
    if (hasAnswers) return;

    const allAnswers = flashcard.cards.map((c) => c.answer);

    if (testMode === 'multiple-choice') {
      // build multiple-choice questions; 4 choices when possible
      const q = flashcard.cards.map((card) => {
        const wrongPool = allAnswers.filter((a) => a !== card.answer);
        const picks = shuffle(wrongPool).slice(0, Math.min(3, wrongPool.length));
        const choices = shuffleChoices
          ? shuffle([card.answer, ...picks])
          : [card.answer, ...picks];
        return { card, choices };
      });
      const shuffled = shuffle(q);
      setQuestions(shuffled);
      setSelectedAnswers(Array(shuffled.length).fill(null));
      setQuestionTypes(Array(shuffled.length).fill('multiple-choice'));
    } else if (testMode === 'written') {
      // written mode - no choices needed
      const q = flashcard.cards.map((card) => ({ card, choices: [] }));
      const shuffled = shuffle(q);
      setQuestions(shuffled);
      setWrittenAnswers(Array(shuffled.length).fill(''));
      setQuestionTypes(Array(shuffled.length).fill('written'));
    } else if (testMode === 'mixed') {
      // mixed mode - randomly assign question types (fixed)
      // Attach type to each entry, then shuffle entries so type stays paired with its card/choices
      const entries: { card: Card; choices: string[]; type: 'multiple-choice' | 'written' }[] =
        flashcard.cards.map((card) => {
          const isMultipleChoice = Math.random() > 0.5;
          if (isMultipleChoice) {
            const wrongPool = allAnswers.filter((a) => a !== card.answer);
            const picks = shuffle(wrongPool).slice(0, Math.min(3, wrongPool.length));
            const choices = shuffleChoices
              ? shuffle([card.answer, ...picks])
              : [card.answer, ...picks];
            return { card, choices, type: 'multiple-choice' };
          } else {
            return { card, choices: [], type: 'written' };
          }
        });

      const shuffledEntries = shuffle(entries);
      setQuestions(shuffledEntries.map((e) => ({ card: e.card, choices: e.choices })));
      setQuestionTypes(shuffledEntries.map((e) => e.type));
      setSelectedAnswers(Array(shuffledEntries.length).fill(null));
      setWrittenAnswers(Array(shuffledEntries.length).fill(''));
    }

    setScore(0);
    setDone(false);
    setWrongIds([]);
    // mark that we haven't restored progress for this new set yet
    setRestoredProgress(false);
  }, [flashcard, shuffleChoices, testMode]);

  // Restore saved progress from server (if available & userId looks like an ObjectId)
  useEffect(() => {
    if (!flashcard || questions.length === 0) return;
    if (restoredProgress || userMadeChanges.current) return;

    // capture non-null references for use inside async closure
    const fc = flashcard;
    const qs = questions;

    const uid = getUidForRequests(user);
    if (!isObjectId(uid)) {
      // server requires valid ObjectId for progress endpoints; skip restore for temporary users
      return;
    }

    let mounted = true;
    async function restore() {
      try {
        const res = await authManager.makeAuthenticatedRequest(
          `/api/student_page/flashcard/${flashcardId}/progress?userId=${uid}`,
          { method: "GET", cache: "no-store" as RequestCache }
        );
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        const prog = data?.progress?.test;
        if (!prog) {
          setRestoredProgress(true);
          return;
        }

        // If the server saved a questionsOrder (indices into flashcard.cards), reorder questions to match
        const qo = prog?.questionsOrder;
        let questionsToUse = qs;
        if (Array.isArray(qo) && qo.length === qs.length) {
          const newQuestions = qo.map((origIndex: number) => {
            const origCard = fc.cards[origIndex];
            // find the question with that card id (guard origCard)
            const found = origCard ? qs.find((q) => q.card._id === origCard._id) : undefined;
            // fallback to index if necessary (and safe-mod in case of out-of-range)
            return found ?? qs[origIndex] ?? qs[origIndex % qs.length];
          });
          if (mounted) setQuestions(newQuestions);
          questionsToUse = newQuestions;
        }

        // If the server saved questionChoices, restore them to preserve the exact choices that were shown
        if (Array.isArray(prog.questionChoices) && prog.questionChoices.length === questionsToUse.length) {
          console.log("Restoring saved choices:", prog.questionChoices);
          const questionsWithRestoredChoices = questionsToUse.map((q, i) => ({
            ...q,
            choices: Array.isArray(prog.questionChoices[i]) ? prog.questionChoices[i] : q.choices
          }));
          if (mounted) setQuestions(questionsWithRestoredChoices);
          questionsToUse = questionsWithRestoredChoices;
        }

        // Ensure per-question types reflect actual availability of choices.
        // Always treat any entry that has choices as 'multiple-choice' and any entry without choices as 'written'.
        let finalTypes: ('multiple-choice' | 'written')[] = questionsToUse.map((q) =>
          q?.choices && q.choices.length > 0 ? 'multiple-choice' : 'written'
        );

        // If server provided questionTypes, prefer them but enforce consistency with available choices
        if (Array.isArray(prog.questionTypes) && prog.questionTypes.length === questionsToUse.length) {
          finalTypes = prog.questionTypes.map((t: any, i: number) =>
            (questionsToUse[i]?.choices && questionsToUse[i].choices.length > 0) ? 'multiple-choice' : 'written'
          );
        }

        if (mounted) setQuestionTypes(finalTypes);

        // Apply saved answers but align them with finalTypes (MC answers only for MC; written answers only for written)
        if (Array.isArray(prog.selectedAnswers) && prog.selectedAnswers.length === questionsToUse.length) {
          const sel = finalTypes.map((t, i) => (t === 'multiple-choice' ? prog.selectedAnswers[i] ?? null : null));
          if (mounted) setSelectedAnswers(sel);
          // Check if any answers were restored
          if (sel.some(answer => answer !== null)) {
            setHasAnswers(true);
          }
        }
        if (Array.isArray(prog.writtenAnswers) && prog.writtenAnswers.length === questionsToUse.length) {
          const wr = finalTypes.map((t, i) => (t === 'written' ? prog.writtenAnswers[i] ?? '' : ''));
          if (mounted) setWrittenAnswers(wr);
          // Check if any written answers were restored
          if (wr.some(answer => answer.trim() !== '')) {
            setHasAnswers(true);
          }
        }
        if (typeof prog.shuffleChoices === "boolean") {
          if (mounted) setShuffleChoices(prog.shuffleChoices);
        }
        if (prog.feedbackMode) {
          if (mounted) setFeedbackMode(prog.feedbackMode);
        }
        // Restore global testMode (if saved). Avoid triggering the build-effect that would overwrite restored questions/answers.
        if (prog.testMode && typeof prog.testMode === "string") {
          if (mounted) {
            ignoreBuildOnTestModeChange.current = true;
            setTestMode(prog.testMode as 'multiple-choice' | 'written' | 'mixed');
          }
        }
        if (typeof prog.score === "number") {
          if (mounted) setScore(prog.score);
        }
        if (typeof prog.done === "boolean") {
          if (mounted) setDone(prog.done);
        }

        // compute wrongIds from restored answers (best-effort)
        if (mounted) {
          const restoredWrong: string[] = [];
          questionsToUse.forEach((q, i) => {
            const t = finalTypes[i] ?? testMode;
            if (t === "multiple-choice") {
              const sel = prog.selectedAnswers?.[i];
              if (sel !== q.card.answer) restoredWrong.push(q.card._id);
            } else {
              const wa = (prog.writtenAnswers?.[i] || "").toLowerCase().trim();
              if (wa !== q.card.answer.toLowerCase().trim()) restoredWrong.push(q.card._id);
            }
          });
          setWrongIds(restoredWrong);
        }

      } catch (err) {
        // ignore restore failures silently
        console.warn("Failed to restore progress", err);
      } finally {
        if (mounted) setRestoredProgress(true);
      }
    }

    restore();
    return () => { mounted = false; };
  }, [flashcard, questions, flashcardId, user, restoredProgress, testMode]);

  // Persist progress to server (debounced)
  useEffect(() => {
    if (!flashcard) return;
    const uid = getUidForRequests(user);
    if (!isObjectId(uid)) {
      // server requires valid ObjectId; skip saving for temp users
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        // flashcard is guaranteed non-null here due to the early guard at the top of this effect
        const cards = flashcard.cards;
        const questionsOrder = questions.map((q) =>
          flashcard.cards.findIndex((c) => c._id === q.card._id)
        );

        const questionChoices = questions.map(q => q.choices);
        console.log("Saving choices:", questionChoices);

        const payload: any = {
          test: {
            selectedAnswers,
            writtenAnswers,
            questionTypes,
            shuffleChoices,
            feedbackMode,
            // persist global mode so options/settings survive reloads/logins
            testMode,
            score,
            done,
            questionsOrder,
            // Save the choices for each question to preserve them on reload
            questionChoices
          }
        };

        await authManager.makeAuthenticatedRequest(
          `/api/student_page/flashcard/${flashcardId}/progress?userId=${uid}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal
          }
        );
        // no need to handle response in UI, log for debugging
        // console.log("Progress saved");
      } catch (err) {
        // ignore save errors
        console.warn("Failed to save progress", err);
      }
    }, 800);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [selectedAnswers, writtenAnswers, questionTypes, shuffleChoices, feedbackMode, testMode, score, done, questions, flashcard, flashcardId, user]);

  // build current score (derived state)
  const currentScore = useMemo(() => {
    if (questions.length === 0) return 0;

    return questions.reduce((acc, question, idx) => {
      // prefer per-question type if available; otherwise fall back to global testMode
      const currentType = questionTypes?.[idx] ?? testMode;

      if (currentType === 'multiple-choice') {
        const sel = selectedAnswers[idx];
        if (!sel) return acc;
        const correct = question.card.answer;
        return acc + (sel === correct ? 1 : 0);
      } else {
        const answer = writtenAnswers[idx];
        if (!answer?.trim()) return acc;
        const correct = question.card.answer.toLowerCase().trim();
        const userAnswer = answer.toLowerCase().trim();
        return acc + (userAnswer === correct ? 1 : 0);
      }
    }, 0);
  }, [selectedAnswers, writtenAnswers, questions, testMode, questionTypes]);

  const choose = (qIndex: number, choice: string) => {
    if (done) return;
    setSelectedAnswers((prev) => {
      const next = (prev && prev.length === questions.length) ? [...prev] : Array(questions.length).fill(null);
      next[qIndex] = choice;
      return next;
    });
    // Mark that user made changes to prevent server restore from overwriting
    userMadeChanges.current = true;
    // Mark that answers have been provided to stop randomization
    setHasAnswers(true);
  };

  const handleWrittenAnswer = (qIndex: number, answer: string) => {
    if (done) return;
    setWrittenAnswers((prev) => {
      const next = (prev && prev.length === questions.length) ? [...prev] : Array(questions.length).fill('');
      next[qIndex] = answer;
      return next;
    });
    // Mark that user made changes to prevent server restore from overwriting
    userMadeChanges.current = true;
    // Mark that answers have been provided to stop randomization (only if answer is not empty)
    if (answer.trim()) {
      setHasAnswers(true);
    }
  };

  // User-driven setters — mark restoredProgress so server-restore won't overwrite user changes
  const setTestModeUser = (mode: 'multiple-choice' | 'written' | 'mixed') => {
    // Don't allow changing test mode if answers have been provided
    if (hasAnswers) return;

    // prevent the restore effect from later overwriting this manual choice
    setRestoredProgress(true);
    userMadeChanges.current = true;
    // ensure rebuild effect runs for this change (clear any ignore flag)
    ignoreBuildOnTestModeChange.current = false;
    setTestMode(mode);
  };

  const setFeedbackModeUser = (mode: 'immediate' | 'end') => {
    setRestoredProgress(true);
    userMadeChanges.current = true;
    setFeedbackMode(mode);
  };

  const setShuffleChoicesUser = (val: boolean) => {
    // Don't allow changing shuffle choices if answers have been provided
    if (hasAnswers) return;

    setRestoredProgress(true);
    userMadeChanges.current = true;
    setShuffleChoices(val);
  };

  const finishTest = () => {
    // compute score and wrong ids
    const wrong: string[] = [];

    questions.forEach((q, i) => {
      // prefer per-question type when present
      const currentType = questionTypes?.[i] ?? testMode;

      if (currentType === 'multiple-choice') {
        const sel = selectedAnswers[i];
        if (sel !== q.card.answer) wrong.push(q.card._id);
      } else {
        const userAnswer = writtenAnswers[i]?.toLowerCase().trim() || '';
        const correctAnswer = q.card.answer.toLowerCase().trim();
        if (userAnswer !== correctAnswer) wrong.push(q.card._id);
      }
    });

    setWrongIds(wrong);
    setScore(currentScore);
    setDone(true);
  };

  const restart = () => {
    if (!flashcard) return;

    // Rebuild questions depending on mode so choices are always present when needed
    const allAnswers = flashcard.cards.map((c) => c.answer);

    if (testMode === 'multiple-choice') {
      const q = flashcard.cards.map((card) => {
        const wrongPool = allAnswers.filter((a) => a !== card.answer);
        const picks = shuffle(wrongPool).slice(0, Math.min(3, wrongPool.length));
        const choices = shuffleChoices ? shuffle([card.answer, ...picks]) : [card.answer, ...picks];
        return { card, choices };
      });
      const shuffled = shuffle(q);
      setQuestions(shuffled);
      setQuestionTypes(Array(shuffled.length).fill('multiple-choice'));
      setSelectedAnswers(Array(shuffled.length).fill(null));
      setWrittenAnswers(Array(shuffled.length).fill(''));
    } else if (testMode === 'written') {
      const q = flashcard.cards.map((card) => ({ card, choices: [] }));
      const shuffled = shuffle(q);
      setQuestions(shuffled);
      setQuestionTypes(Array(shuffled.length).fill('written'));
      setSelectedAnswers(Array(shuffled.length).fill(null));
      setWrittenAnswers(Array(shuffled.length).fill(''));
    } else {
      // mixed: assign types randomly and build choices for MC types
      const entries = flashcard.cards.map((card) => {
        const isMC = Math.random() > 0.5;
        if (isMC) {
          const wrongPool = allAnswers.filter((a) => a !== card.answer);
          const picks = shuffle(wrongPool).slice(0, Math.min(3, wrongPool.length));
          const choices = shuffleChoices ? shuffle([card.answer, ...picks]) : [card.answer, ...picks];
          return { card, choices, type: 'multiple-choice' as const };
        } else {
          return { card, choices: [], type: 'written' as const };
        }
      });
      const shuffledEntries = shuffle(entries);
      setQuestions(shuffledEntries.map((e) => ({ card: e.card, choices: e.choices })));
      setQuestionTypes(shuffledEntries.map((e) => e.type));
      setSelectedAnswers(Array(shuffledEntries.length).fill(null));
      setWrittenAnswers(Array(shuffledEntries.length).fill(''));
    }

    setScore(0);
    setDone(false);
    setWrongIds([]);
    // Reset the answers flag to allow randomization again
    setHasAnswers(false);
    // prevent automatic restore from server after a manual restart/retake
    setRestoredProgress(true);
    userMadeChanges.current = true;
  };

  const randomizeQuestionTypes = () => {
    if (testMode !== 'mixed' || !flashcard) return;

    // Don't randomize if user has already provided answers
    if (hasAnswers) return;

    // produce new types and ensure questions have choices for MC entries
    const newTypes = questions.map(() => (Math.random() > 0.5 ? 'multiple-choice' : 'written'));
    const allAnswers = flashcard.cards.map((c) => c.answer);

    const newQuestions = questions.map((q, idx) => {
      const type = newTypes[idx];
      if (type === 'multiple-choice') {
        // if choices already exist and non-empty keep them, otherwise build new choices
        if (q.choices && q.choices.length > 0) return q;
        const wrongPool = allAnswers.filter((a) => a !== q.card.answer);
        const picks = shuffle(wrongPool).slice(0, Math.min(3, wrongPool.length));
        const choices = shuffleChoices ? shuffle([q.card.answer, ...picks]) : [q.card.answer, ...picks];
        return { card: q.card, choices };
      } else {
        return { card: q.card, choices: [] };
      }
    });

    setQuestionTypes(newTypes);
    setQuestions(newQuestions);
    // Clear existing answers when randomizing
    setSelectedAnswers(Array(newQuestions.length).fill(null));
    setWrittenAnswers(Array(newQuestions.length).fill(''));
    // Mark that user made changes
    userMadeChanges.current = true;
  };

  if (loading) {
    return <LoadingTemplate2 title="Loading test" subtitle="Preparing questions…" compact={false} />;
  }
  if (error) {
    return (
      <div className="p-6">
        <div className="text-red-600">{error}</div>
        <button
          onClick={() => router.back()}
          className="mt-3 px-3 py-1 bg-slate-200 rounded"
        >
          Back
        </button>
      </div>
    );
  }
  if (!flashcard || questions.length === 0) {
    return (
      <div className="p-6">
        <div>No cards available for test.</div>
        <button
          onClick={() =>
            router.push(`/student_page/private_library/${flashcardId}`)
          }
          className="mt-3 px-3 py-1 bg-slate-200 rounded"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 transition-colors duration-300">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 transition-colors duration-300">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            {/* Left section - Title and info */}
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <div className="flex-shrink-0">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#1C2B1C] to-teal-600 flex items-center justify-center shadow-lg">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white">
                    <path d="M9 11H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z" stroke="currentColor" strokeWidth="2" />
                    <path d="M17 7h-2a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100 truncate">
                    {flashcard.title}
                  </h1>
                  <div className="flex-shrink-0 px-2 py-1 bg-[#1C2B1C]/10 dark:bg-[#1C2B1C]/20 text-[#1C2B1C] text-xs font-medium rounded-full">
                    Test
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>{questions.length} questions</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-[#1C2B1C] rounded-full"></div>
                    <span>{done ? score : (feedbackMode === 'immediate' ? currentScore : 0)} correct</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                    <span>{Math.round(((done ? score : (feedbackMode === 'immediate' ? currentScore : 0)) / questions.length) * 100)}% score</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right section - Actions and settings */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-shrink-0">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  aria-label="Settings"
                  className="px-3 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-[#1C2B1C]/20 hover:text-[#1C2B1C] rounded-xl transition-all duration-200 hover:scale-105 flex items-center"
                >
                  <Settings size={18} />
                </button>
                <button
                  onClick={() => router.push(`/student_page/private_library/${flashcardId}`)}
                  className="px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl font-medium transition-all duration-200 hover:scale-105"
                >
                  Back
                </button>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Progress</span>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {done ? score : (feedbackMode === 'immediate' ? currentScore : 0)} / {questions.length}
              </span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#1C2B1C] to-teal-600 transition-all duration-500 ease-out"
                style={{ width: `${((done ? score : (feedbackMode === 'immediate' ? currentScore : 0)) / questions.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Settings Panel (REPLACED - modal like flashcard page) */}
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowSettings(false)} />

            <div className="relative w-full max-w-5xl max-h-[90vh] bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl shadow-2xl overflow-auto grid grid-cols-1 md:grid-cols-[1fr_320px]">
              {/* Left: settings */}
              <div className="p-6 space-y-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">Test Settings</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Choose test type, feedback and options for this run</p>
                  </div>
                  <button onClick={() => setShowSettings(false)} className="ml-4 text-slate-400 hover:text-[#1C2B1C]">✕</button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Test Mode</div>
                    <div className="grid gap-3">
                      <label className={`flex items-center justify-between p-4 rounded-xl border transition-all ${hasAnswers
                          ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                          : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 cursor-pointer'
                        }`}>
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="testMode"
                            value="multiple-choice"
                            checked={testMode === 'multiple-choice'}
                            onChange={() => setTestModeUser('multiple-choice')}
                            disabled={hasAnswers}
                            className="w-4 h-4"
                          />
                          <div>
                            <div className="font-medium text-slate-900 dark:text-slate-100">Multiple Choice</div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">Choose from options</div>
                          </div>
                        </div>
                        <div className="text-2xl">📝</div>
                      </label>

                      <label className={`flex items-center justify-between p-4 rounded-xl border transition-all ${hasAnswers
                          ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                          : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 cursor-pointer'
                        }`}>
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="testMode"
                            value="written"
                            checked={testMode === 'written'}
                            onChange={() => setTestModeUser('written')}
                            disabled={hasAnswers}
                            className="w-4 h-4"
                          />
                          <div>
                            <div className="font-medium text-slate-900 dark:text-slate-100">Written</div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">Type your answer</div>
                          </div>
                        </div>
                        <div className="text-2xl">✍️</div>
                      </label>

                      <label className={`flex items-center justify-between p-4 rounded-xl border transition-all ${hasAnswers
                          ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                          : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 cursor-pointer'
                        }`}>
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="testMode"
                            value="mixed"
                            checked={testMode === 'mixed'}
                            onChange={() => setTestModeUser('mixed')}
                            disabled={hasAnswers}
                            className="w-4 h-4"
                          />
                          <div>
                            <div className="font-medium text-slate-900 dark:text-slate-100">Mixed</div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">Random mix of both</div>
                          </div>
                        </div>
                        <div className="text-2xl">🎲</div>
                      </label>
                    </div>
                  </div>

                  <div>
                    <div className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Feedback Timing</div>
                    <div className="grid gap-3">
                      <label className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="feedbackMode"
                            value="immediate"
                            checked={feedbackMode === 'immediate'}
                            onChange={() => setFeedbackModeUser('immediate')}
                            className="w-4 h-4"
                          />
                          <div>
                            <div className="font-medium">Immediate</div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">Show results as you answer</div>
                          </div>
                        </div>
                        <div className="text-2xl">⚡</div>
                      </label>

                      <label className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="feedbackMode"
                            value="end"
                            checked={feedbackMode === 'end'}
                            onChange={() => setFeedbackModeUser('end')}
                            className="w-4 h-4"
                          />
                          <div>
                            <div className="font-medium">At End</div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">Show results when finished</div>
                          </div>
                        </div>
                        <div className="text-2xl">🏁</div>
                      </label>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Additional Options</div>
                  <div className="space-y-3">
                    {(testMode === 'multiple-choice' || testMode === 'mixed') && (
                      <label className={`flex items-center justify-between p-4 rounded-xl border transition-all ${hasAnswers
                          ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                          : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 cursor-pointer'
                        }`}>
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={shuffleChoices}
                            onChange={(e) => setShuffleChoicesUser(e.target.checked)}
                            disabled={hasAnswers}
                            className="w-4 h-4"
                          />
                          <div>
                            <div className="font-medium">Shuffle Answer Choices</div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                              {hasAnswers ? 'Cannot change after answering' : 'Randomize option order'}
                            </div>
                          </div>
                        </div>
                        <div className="text-2xl">🔀</div>
                      </label>
                    )}

                    {testMode === 'mixed' && (
                      <button
                        onClick={randomizeQuestionTypes}
                        disabled={hasAnswers}
                        className={`flex items-center justify-between w-full p-4 rounded-xl border transition-all ${hasAnswers
                            ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                            : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-500'
                          }`}
                      >
                        <div>
                          <div className="font-medium">Randomize Question Types</div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            {hasAnswers ? 'Cannot randomize after answering' : 'Re-shuffle MC vs Written'}
                          </div>
                        </div>
                        <div className="text-2xl">🎯</div>
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700 flex gap-3">
                  <button
                    onClick={() => setShowSettings(false)}
                    className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium"
                  >
                    Apply Settings
                  </button>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="px-6 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {/* Right: preview / summary (flashcard-style) */}
              <div className="p-6 border-l border-slate-100 dark:border-slate-700 bg-gradient-to-b from-slate-50 to-white dark:from-slate-800 dark:to-slate-800">
                <div className="text-sm font-medium mb-2">Session preview</div>

                <div className="rounded-lg p-4 mb-4 bg-white dark:bg-slate-900 shadow-inner">
                  <div className="text-xs text-slate-500 mb-2">Progress</div>
                  <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-3">
                    <div
                      className="h-full bg-[#1C2B1C]"
                      style={{ width: `${Math.round((currentScore / Math.max(questions.length, 1)) * 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-500 flex justify-between">
                    <span>{currentScore} correct</span>
                    <span>{questions.length} total</span>
                  </div>
                </div>

                <div className="rounded-lg p-4 bg-slate-50 dark:bg-slate-800">
                  <div className="text-xs text-slate-500 mb-2">Current preview</div>
                  <div className="h-28 flex items-center justify-center rounded-md bg-white dark:bg-slate-900 text-center px-3">
                    <div className="text-sm">{questions[0]?.card?.question ?? "No question"}</div>
                  </div>

                  <div className="mt-3 text-xs text-slate-500">
                    Tip: Use Immediate feedback to see correctness as you answer. Mixed mode will randomly present MC or written.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Questions */}
        <div className="space-y-6">
          {questions.map((q, qi) => {
            // prefer per-question type when available; otherwise use global testMode
            const currentType = questionTypes?.[qi] ?? testMode;

            const isAnswered = currentType === 'multiple-choice'
              ? selectedAnswers[qi] !== null
              : writtenAnswers[qi]?.trim() !== '';

            const isCorrect = currentType === 'multiple-choice'
              ? selectedAnswers[qi] === q.card.answer
              : writtenAnswers[qi]?.toLowerCase().trim() === q.card.answer.toLowerCase().trim();

            const showFeedback = (feedbackMode === 'immediate' && isAnswered) || done;

            return (
              <div
                key={q.card._id}
                className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 transition-all duration-300 hover:shadow-md"
              >
                {/* Question header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {qi + 1}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        Question {qi + 1} of {questions.length}
                      </span>
                      {/* show per-question badge when in mixed mode or when a per-question type differs from global */}
                      {(testMode === 'mixed' || testMode !== currentType) && (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${currentType === 'multiple-choice'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                          }`}>
                          {currentType === 'multiple-choice' ? '📝 MC' : '✍️ Written'}
                        </span>
                      )}
                    </div>
                  </div>

                  {showFeedback && isAnswered && (
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${isCorrect
                      ? 'bg-[#1C2B1C]/10 dark:bg-[#1C2B1C]/20 text-[#1C2B1C]'
                      : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                      }`}>
                      {isCorrect ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      {isCorrect ? 'Correct' : 'Incorrect'}
                    </div>
                  )}
                </div>

                {/* Question content */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3 leading-relaxed">
                    {q.card.question}
                  </h3>
                  {q.card.image && (
                    <div className="mb-4">
                      <img
                        src={q.card.image}
                        alt="Question illustration"
                        className="max-h-48 w-auto object-contain rounded-xl border border-slate-200 dark:border-slate-600"
                        onError={(e) => (e.currentTarget.style.display = "none")}
                      />
                    </div>
                  )}
                </div>

                {/* Answer section */}
                {currentType === 'multiple-choice' ? (
                  <div className="grid grid-cols-1 gap-3">
                    {q.choices.map((choice, choiceIndex) => {
                      const isSelected = selectedAnswers[qi] === choice;
                      const isCorrectChoice = choice === q.card.answer;
                      const showResult = showFeedback;

                      let buttonClass = "w-full px-4 py-4 text-left rounded-xl border-2 transition-all duration-200 font-medium";

                      // Only Immediate uses green accents; "At End" will keep the original blue accents
                      const immediateActive = feedbackMode === 'immediate';
                      if (showResult) {
                        if (isSelected && isCorrectChoice) {
                          // Selected and correct
                          buttonClass += " bg-[#1C2B1C]/10 dark:bg-[#1C2B1C]/20 border-[#1C2B1C]/40 dark:border-[#1C2B1C]/60 text-[#1C2B1C]";
                        } else if (isSelected && !isCorrectChoice) {
                          // Selected but wrong
                          buttonClass += " bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-600 text-red-800 dark:text-red-200";
                        } else if (!isSelected && isCorrectChoice && done) {
                          // Not selected but correct (show correct answer only when done)
                          buttonClass += " bg-[#1C2B1C]/10 dark:bg-[#1C2B1C]/20 border-[#1C2B1C]/30 dark:border-[#1C2B1C]/60 text-[#1C2B1C]";
                        } else {
                          // Not selected and not correct
                          buttonClass += " bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400";
                        }
                      } else {
                        // Default state (not showing correctness yet)
                        // Use green accents when feedbackMode === 'immediate'
                        if (isSelected) {
                          if (immediateActive) {
                            // immediate selected -> green
                            buttonClass += " bg-[#1C2B1C] dark:bg-[#1C2B1C] border-[#1C2B1C]/50 dark:border-[#1C2B1C]/50 text-white";
                          } else {
                            // at-end selected -> original blue/dark selection
                            buttonClass += " bg-slate-700 dark:bg-slate-700/80 border-blue-300 dark:border-blue-500 text-white";
                          }
                        } else {
                          if (immediateActive) {
                            // hover/interactive -> subtle green hover when immediate feedback is on
                            buttonClass += " bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 hover:bg-[#1C2B1C]/10 dark:hover:bg-[#1C2B1C]/20 hover:border-[#1C2B1C]/40 dark:hover:border-[#1C2B1C]/60 hover:scale-[1.02]";
                          } else {
                            buttonClass += " bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-600 hover:border-blue-300 dark:hover:border-blue-500 hover:scale-[1.02]";
                          }
                        }
                      }

                      return (
                        <button
                          key={choice}
                          onClick={() => choose(qi, choice)}
                          disabled={done}
                          className={buttonClass}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-600 flex items-center justify-center text-xs font-semibold text-slate-600 dark:text-slate-300">
                              {String.fromCharCode(65 + choiceIndex)}
                            </div>
                            <span className="flex-1">{choice}</span>
                            {showResult && isSelected && (
                              <div className="flex-shrink-0">
                                {isCorrectChoice ? (
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-[#1C2B1C]">
                                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                ) : (
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-red-600">
                                    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Your Answer:
                      </label>
                      <input
                        type="text"
                        value={writtenAnswers[qi] || ''}
                        onChange={(e) => handleWrittenAnswer(qi, e.target.value)}
                        disabled={done}
                        placeholder="Type your answer here..."
                        className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>

                    {showFeedback && isAnswered && (
                      <div className={`p-4 rounded-xl border-2 ${isCorrect
                        ? 'bg-[#1C2B1C]/10 dark:bg-[#1C2B1C]/20 border-[#1C2B1C]/40 dark:border-[#1C2B1C]/60'
                        : 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-600'
                        }`}>
                        <div className="flex items-center gap-2 mb-2">
                          {isCorrect ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-[#1C2B1C]">
                              <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-red-600">
                              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                          <span className={`font-semibold ${isCorrect ? 'text-[#1C2B1C]' : 'text-red-700 dark:text-red-300'}`}>
                            {isCorrect ? 'Correct!' : 'Incorrect'}
                          </span>
                        </div>
                        {/* Only show the correct answer text for end-of-test feedback (or when finished) */}
                        {!isCorrect && (feedbackMode === 'end' || done) && (
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            <span className="font-medium">Correct answer:</span> {q.card.answer}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Action buttons */}
          <div className="flex justify-center gap-4">
            {!done ? (
              <>
                <button
                  onClick={finishTest}
                  className="px-6 py-3 bg-[#1C2B1C] hover:brightness-110 text-white rounded-xl font-semibold shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl"
                >
                  Finish Test
                </button>
                <button
                  onClick={restart}
                  className="px-6 py-3 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl font-semibold transition-all duration-200 hover:scale-105"
                >
                  Restart
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => restart()}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-semibold shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl"
                >
                  Retake Test
                </button>
                <button
                  onClick={() => router.push(`/student_page/private_library/${flashcardId}`)}
                  className="px-6 py-3 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl font-semibold transition-all duration-200 hover:scale-105"
                >
                  Back to Set
                </button>
              </>
            )}
          </div>

          {/* Results summary */}
          {done && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#1C2B1C] to-teal-600 flex items-center justify-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" className="text-white">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Test Complete!</h3>
                <p className="text-lg text-slate-600 dark:text-slate-400">
                  You scored <span className="font-semibold text-[#1C2B1C]">{score}</span> out of <span className="font-semibold">{questions.length}</span>
                </p>
                <div className="mt-3 text-3xl font-bold text-[#1C2B1C]">
                  {Math.round((score / questions.length) * 100)}%
                </div>
              </div>

              {wrongIds.length > 0 && (
                <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                  <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-red-500">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                      <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Review Incorrect Answers ({wrongIds.length})
                  </h4>
                  <div className="space-y-4">
                    {reviewMode?.map((card) => (
                      <div
                        key={card._id}
                        className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl"
                      >
                        <div className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
                          {card.question}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-slate-600 dark:text-slate-400">Correct answer:</span>
                          <span className="font-semibold text-[#1C2B1C] px-2 py-1 bg-[#1C2B1C]/10 rounded-lg">
                            {card.answer}
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
      </div>
    </div>
  );

  // Added helper components (optional - lightweight presentational)
  function SettingRow({ title, desc, checked, onToggle, accent = "green" }: any) {
  const accentClass = accent === "amber" ? "from-amber-400 to-amber-500" : "from-[#1C2B1C] to-[#1C2B1C]";
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

  function ToggleRow({ label, desc, checked, onChange }: any) {
    return (
      <div className="flex items-center justify-between p-2">
        <div>
          <div className="font-medium">{label}</div>
          <div className="text-xs text-slate-400">{desc}</div>
        </div>
        <label className="inline-flex items-center cursor-pointer">
          <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
          <span className={`w-12 h-6 rounded-full transition ${checked ? "bg-[#1C2B1C]" : "bg-slate-600"}`} />
        </label>
      </div>
    );
  }
}