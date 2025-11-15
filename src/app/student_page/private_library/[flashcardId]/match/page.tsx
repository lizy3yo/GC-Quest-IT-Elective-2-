"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import api from '@/lib/api';
import LoadingTemplate2 from '@/components/atoms/loading_template_2/loading2';

type FlashcardCard = {
  _id: string;
  question: string;
  answer: string;
};

export default function MatchPage() {
  const router = useRouter();
  const params = useParams();
  const flashcardId = params.flashcardId as string;
  // localStorage key helper for persisting feedback mode per-flashcard
  const getModeLSKey = () => `gcq:matchMode:${flashcardId}`;
  const readModeFromLS = (): 'immediate' | 'end' | null => {
    try {
      const v = localStorage.getItem(getModeLSKey());
      if (v === 'immediate' || v === 'end') return v;
    } catch (e) { /* ignore */ }
    return null;
  };
  const writeModeToLS = (mode: 'immediate' | 'end') => {
    try { localStorage.setItem(getModeLSKey(), mode); } catch (e) { /* ignore */ }
  };

  const [flashcardTitle, setFlashcardTitle] = useState<string>('');
  const [cards, setCards] = useState<FlashcardCard[]>([]);
  const [shuffledAnswers, setShuffledAnswers] = useState<{ id: string; text: string }[]>([]);
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<boolean>(false);

  // New: feedback mode can be "immediate" (instant correctness) or "end" (evaluate after Finish)
  const [feedbackMode, setFeedbackMode] = useState<'immediate' | 'end'>('immediate');
  // New: verifiedMatches records correctness after evaluation in "end" mode (or immediate mode confirmations)
  const [verifiedMatches, setVerifiedMatches] = useState<Record<string, 'correct' | 'wrong'>>({});
  // New: finished flag for "end" mode once user clicks Finish
  const [finished, setFinished] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const questionRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const answerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [activeLine, setActiveLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  // changed matchedLines to include qid/aid so we can color by verification status
  const [matchedLines, setMatchedLines] = useState<{ qid: string; aid: string; x1: number; y1: number; x2: number; y2: number }[]>([]);

  // keep userId for progress calls
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
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
              const currentJson = await currentRes.json().catch(() => ({} as any));
              uid = currentJson?.user?._id;
              console.log("✅ Match: Authenticated via JWT token, user ID:", uid);
            }
          }
        } catch (err) {
          console.warn("Match: JWT authentication failed:", err);
        }

        // Method 2: Fallback to localStorage userId
        if (!uid) {
          uid = localStorage.getItem('userId');
          if (uid) {
            console.log("✅ Match: Using localStorage userId:", uid);
          }
        }

        // Method 3: Generate a temporary user ID for demo purposes
        if (!uid) {
          uid = `temp-user-${Date.now()}`;
          localStorage.setItem('userId', uid);
          console.log("⚠️ Match: Generated temporary user ID:", uid);
        }

        // store userId for later progress API calls
        userIdRef.current = uid;

        const url = uid
          ? `/api/student_page/flashcard/${flashcardId}?userId=${uid}`
          : `/api/student_page/flashcard/${flashcardId}`;

        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
          const maybe = await res.json().catch(() => ({} as any));
          throw new Error(maybe?.message || `Failed to load flashcard (${res.status})`);
        }
        const data = await res.json();
        if (!mounted) return;
        const loadedCards: FlashcardCard[] = data.flashcard?.cards || [];
        setFlashcardTitle(data.flashcard?.title || '');
        setCards(loadedCards);

        // prepare shuffled answers
        const answers = loadedCards.map(c => ({ id: c._id, text: c.answer }));
        shuffleArray(answers);
        setShuffledAnswers(answers);
        setMatches({});
        setSelectedQuestion(null);
        setSelectedAnswer(null);
        setCompleted(false);
        setVerifiedMatches({});
        setFinished(false);

        // Attempt to load saved progress (shuffledAnswers + matches) for this user/flashcard
        if (userIdRef.current) {
          await loadProgress(userIdRef.current, loadedCards);
        }
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Failed to load match data.');
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    if (flashcardId) load();
    return () => { mounted = false; };
  }, [flashcardId]);

  // load progress helper
  const loadProgress = async (uid: string, loadedCards: FlashcardCard[]) => {
    try {
      const res = await fetch(`/api/student_page/flashcard/${flashcardId}/progress?userId=${uid}`, { cache: 'no-store' });
      if (!res.ok) {
        console.warn("No saved progress or failed to fetch progress:", res.status);
        // fallback: try localStorage mode if server had no progress
        const lsMode = readModeFromLS();
        if (lsMode) setFeedbackMode(lsMode);
        return;
      }
      const json = await res.json().catch(() => ({} as any));
      const progress = json?.progress || {};
      const match = progress?.match || {};
      // Only restore shuffledAnswers if it matches the current card set length
      if (Array.isArray(match?.shuffledAnswers) && match.shuffledAnswers.length === loadedCards.length) {
        setShuffledAnswers(match.shuffledAnswers);
      }
      // restore matches map/object if present
      if (match?.matches && typeof match.matches === 'object') {
        setMatches(match.matches);
      }
      // restore saved feedback mode if available
      if (match?.mode && (match.mode === 'immediate' || match.mode === 'end')) {
        setFeedbackMode(match.mode);
      } else {
        // fallback to localStorage-stored mode if server didn't include it
        const lsMode = readModeFromLS();
        if (lsMode) setFeedbackMode(lsMode);
      }
    } catch (err) {
      console.warn("Failed to load saved match progress:", err);
      // fallback to localStorage if server fetch fails
      const lsMode = readModeFromLS();
      if (lsMode) setFeedbackMode(lsMode);
    }
  };
  
  // save progress helper (sends match namespace)
  const saveProgress = async (payload: { shuffledAnswers?: any; matches?: any } = {}, modeOverride?: 'immediate' | 'end') => {
    const uid = userIdRef.current;
    const modeToSave = modeOverride ?? feedbackMode;
    // Always persist chosen mode to localStorage (fallback when server save doesn't happen)
    try { writeModeToLS(modeToSave); } catch (e) { /* ignore */ }
    if (!uid) return;
    try {
      await fetch(`/api/student_page/flashcard/${flashcardId}/progress?userId=${uid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match: { ...payload, mode: modeToSave } })
      });
    } catch (err) {
      console.warn("Failed to save match progress:", err);
    }
  };

  useEffect(() => {
    if (cards.length > 0 && Object.keys(matches).length === cards.length) {
      setCompleted(true);
    }
  }, [matches, cards.length]);

  function shuffleArray<T>(arr: T[]) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  // compute coords helper
  const computeCoords = (qid: string, aid: string) => {
    const container = containerRef.current;
    const qEl = questionRefs.current[qid];
    const aEl = answerRefs.current[aid];
    if (!container || !qEl || !aEl) return null;
    const cRect = container.getBoundingClientRect();
    const qRect = qEl.getBoundingClientRect();
    const aRect = aEl.getBoundingClientRect();
    const x1 = qRect.right - cRect.left;
    const y1 = qRect.top + qRect.height / 2 - cRect.top;
    const x2 = aRect.left - cRect.left;
    const y2 = aRect.top + aRect.height / 2 - cRect.top;
    return { x1, y1, x2, y2 };
  };

  // update active line when selection changes
  useLayoutEffect(() => {
    const update = () => {
      if (selectedQuestion && selectedAnswer) {
        const coords = computeCoords(selectedQuestion, selectedAnswer);
        setActiveLine(coords);
      } else {
        setActiveLine(null);
      }
      // also update matched lines (store qid/aid + coords)
      const newMatched: { qid: string; aid: string; x1: number; y1: number; x2: number; y2: number }[] = [];
      for (const qid of Object.keys(matches)) {
        const aid = matches[qid];
        const c = computeCoords(qid, aid);
        if (c) newMatched.push({ qid, aid, x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2 });
      }
      setMatchedLines(newMatched);
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [selectedQuestion, selectedAnswer, matches, cards, shuffledAnswers]);

  const handleQuestionClick = (id: string) => {
    // if finished (end-eval) block further changes
    if (finished) return;
    // don't allow changing a question already matched in immediate mode (already handled),
    // but in end mode user should be able to change matches until Finish, so we check finished flag only.
    setSelectedQuestion(prev => prev === id ? null : id);
    setSelectedAnswer(null);
  };

  const handleAnswerClick = (id: string) => {
    if (!selectedQuestion) {
      // select question first
      return;
    }
    if (finished) return; // no changes after finish
    if (Object.values(matches).includes(id)) return; // answer already used

    // set selection for line drawing
    setSelectedAnswer(id);

    const question = cards.find(c => c._id === selectedQuestion);
    if (!question) return;

    if (feedbackMode === 'immediate') {
      // keep existing immediate feedback behavior
      // find answer text for id
      const answerObj = shuffledAnswers.find(a => a.id === id);
      if (!answerObj) return;

      if (answerObj.text === question.answer) {
        // correct: keep the active line briefly and then commit the match
        setTimeout(() => {
          setMatches(prev => {
            const next = { ...prev, [selectedQuestion as string]: id };
            // mark verified as correct
            setVerifiedMatches(vm => ({ ...vm, [selectedQuestion as string]: 'correct' }));
            saveProgress({ shuffledAnswers, matches: next });
            return next;
          });
          setSelectedQuestion(null);
          setSelectedAnswer(null);
        }, 250);
      } else {
        // incorrect: brief feedback by blinking selectedAnswer and line
        setTimeout(() => {
          setSelectedAnswer(null);
          setSelectedQuestion(null);
        }, 800);
      }
    } else {
      // "end" feedback: accept the user's choice now but don't indicate correctness until Finish
      // commit the match immediately (so user can continue matching)
      setMatches(prev => {
        const next = { ...prev, [selectedQuestion as string]: id };
        saveProgress({ shuffledAnswers, matches: next });
        return next;
      });
      // clear selection so user can continue
      setSelectedQuestion(null);
      setSelectedAnswer(null);
    }
  };

  // New: evaluate all matches (used in "end" mode)
  const finishAndEvaluate = () => {
    if (finished) return;
    const result: Record<string, 'correct' | 'wrong'> = {};
    for (const q of cards) {
      const aid = matches[q._id];
      if (!aid) {
        // unanswered => wrong
        result[q._id] = 'wrong';
        continue;
      }
      const aObj = shuffledAnswers.find(s => s.id === aid);
      if (!aObj) {
        result[q._id] = 'wrong';
        continue;
      }
      result[q._id] = aObj.text === q.answer ? 'correct' : 'wrong';
    }
    setVerifiedMatches(result);
    setFinished(true);
    // save verification state and current mode explicitly
    saveProgress({ shuffledAnswers, matches }, feedbackMode);
  };

  const reset = () => {
    const answers = cards.map(c => ({ id: c._id, text: c.answer }));
    shuffleArray(answers);
    setShuffledAnswers(answers);
    setMatches({});
    setSelectedQuestion(null);
    setSelectedAnswer(null);
    setCompleted(false);
    setVerifiedMatches({});
    setFinished(false);

    // persist reset state and current mode
    saveProgress({ shuffledAnswers: answers, matches: {} }, feedbackMode);
  };

  if (isLoading) {
    return <LoadingTemplate2 title="Loading match game" subtitle="Preparing match board…" compact={false} />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 transition-colors duration-300">
        <div className="max-w-4xl mx-auto text-red-600 dark:text-red-400">{error}</div>
        <div className="mt-4">
          <button onClick={() => router.back()} className="px-4 py-2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 hover:scale-105 transition">Back</button>
        </div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 transition-colors duration-300">
        <div className="max-w-4xl mx-auto text-slate-500 dark:text-slate-400">No cards to match.</div>
        <div className="mt-4">
          <button onClick={() => router.back()} className="px-4 py-2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 hover:scale-105 transition">Back</button>
        </div>
      </div>
    );
  }

  const score = Object.keys(matches).length;
  const progress = Math.round((score / cards.length) * 100);

  // expand svg viewBox padding so lines don't get clipped at the edges
  const containerWidth = containerRef.current?.clientWidth ?? 800;
  const containerHeight = containerRef.current?.clientHeight ?? 600;
  const svgPad = 36;
  const svgViewBox = `${-svgPad} ${-svgPad} ${containerWidth + svgPad * 2} ${containerHeight + svgPad * 2}`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 transition-colors duration-300">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 transition-colors duration-300">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            {/* Left section - Title and info */}
            <div className="flex items-start gap-4 min-w-0 flex-1">
              <div className="flex-shrink-0">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white">
                    <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100 truncate">
                    {flashcardTitle}
                  </h1>
                  <div className="flex-shrink-0 px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 text-xs font-medium rounded-full">
                    Match
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>{cards.length} cards</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-[#1C2B1C] rounded-full"></div>
                    <span>{score} matched</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                    <span>{progress}% complete</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right section - Actions */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {/* Feedback mode toggle - moved before Back */}
              <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-1 rounded-full">
                <button
                  onClick={() => { 
                    setFeedbackMode('immediate'); 
                    setVerifiedMatches({}); 
                    setFinished(false);
                    // save immediately using explicit mode so we don't rely on async state update
                    saveProgress({ shuffledAnswers, matches }, 'immediate');
                  }}
                  className={`px-3 py-1 rounded-full text-sm ${feedbackMode === 'immediate' ? 'bg-blue-600 text-white' : 'text-slate-700 dark:text-slate-300'}`}
                >
                  Immediate
                </button>
                <button
                  onClick={() => { 
                    setFeedbackMode('end'); 
                    setVerifiedMatches({}); 
                    setFinished(false);
                    saveProgress({ shuffledAnswers, matches }, 'end');
                  }}
                  className={`px-3 py-1 rounded-full text-sm ${feedbackMode === 'end' ? 'bg-blue-600 text-white' : 'text-slate-700 dark:text-slate-300'}`}
                >
                  At end
                </button>
              </div>

              <button
                onClick={() => router.back()}
                className="px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl font-medium transition-all duration-200 hover:scale-105"
              >
                Back
              </button>

              <button
                onClick={reset}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-medium shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-xl"
              >
                Reset Game
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Progress</span>
              <span className="text-sm text-slate-600 dark:text-slate-400">{score} / {cards.length}</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

  <div ref={containerRef} className="p-6 rounded-2xl relative bg-white dark:bg-slate-800 transition-colors duration-300 overflow-visible match-container">
          <div className="mb-4 text-sm text-slate-500 dark:text-slate-400">Click a question (left), then click the matching answer (right).</div>

          {/* If feedbackMode is 'end', show Finish button */}
          {feedbackMode === 'end' && (
            <div className="mb-4">
              <div className="text-sm text-slate-500 dark:text-slate-400">
                When ready, click "Finish & Evaluate" in the bottom-right to reveal results.
              </div>
            </div>
          )}

          {/* SVG overlay for lines */}
          <div className="absolute inset-0 pointer-events-none z-0">
            <svg width="100%" height="100%" viewBox={svgViewBox} preserveAspectRatio="none">
              {/* matched lines (colored by verification when finished or immediate) */}
              {matchedLines.map((l, idx) => {
                const status = verifiedMatches[l.qid]; // undefined if not verified
                // determine stroke color:
                // - immediate mode: matches are only stored when correct so color green
                // - end mode before Finish: neutral color (blue-ish/gray)
                // - end mode after Finish: green for correct, red for wrong
                let stroke = '#1C2B1C'; // brand
                let opacity = 0.95;
                if (feedbackMode === 'end' && !finished) {
                  stroke = '#94a3b8'; // neutral slate
                } else if (feedbackMode === 'end' && finished) {
                  stroke = status === 'correct' ? '#1C2B1C' : '#dc2626'; // brand or red
                } else {
                  // immediate mode
                  stroke = '#1C2B1C';
                }

                return (
                  <g key={idx}>
                    <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={stroke} strokeWidth={4} strokeLinecap="round" strokeOpacity={opacity} />
                    <circle cx={l.x1} cy={l.y1} r={4} fill={stroke} />
                    <circle cx={l.x2} cy={l.y2} r={4} fill={stroke} />
                  </g>
                );
              })}
              {/* active selection line (blue) */}
              {activeLine && (
                <g>
                  <line x1={activeLine.x1} y1={activeLine.y1} x2={activeLine.x2} y2={activeLine.y2} stroke="#2563eb" strokeWidth={3} strokeLinecap="round" strokeDasharray="8 6" strokeOpacity="0.98" />
                  <circle cx={activeLine.x1} cy={activeLine.y1} r={4} fill="#2563eb" />
                  <circle cx={activeLine.x2} cy={activeLine.y2} r={4} fill="#2563eb" />
                </g>
              )}
            </svg>
          </div>

          <div className="grid grid-cols-2 gap-50 relative z-10">
            <div>
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Questions</h3>
              <div className="space-y-3">
                {cards.map((q, i) => {
                  const matched = !!matches[q._id];
                  const isSelected = selectedQuestion === q._id;
                  const verified = verifiedMatches[q._id];
                  // if finished and verified is wrong, show different styling
                  const finishedWrong = finished && verified === 'wrong';
                  const finishedCorrect = finished && verified === 'correct';
                  return (
                    <button
                      key={q._id}
                      ref={(el) => { questionRefs.current[q._id] = el; }}
                      onClick={() => handleQuestionClick(q._id)}
                      disabled={finished || (feedbackMode === 'immediate' && matched)}
                      className={`w-full flex items-center justify-between gap-4 p-4 rounded-lg border transition-shadow transform
                        ${finishedCorrect
                          ? 'bg-gradient-to-r from-[#1C2B1C]/10 to-[#1C2B1C]/20 border-[#1C2B1C]/30 shadow-sm text-[#1C2B1C] dark:from-[#1C2B1C]/30 dark:to-[#1C2B1C]/20 dark:bg-[#1C2B1C]/30 dark:border-[#1C2B1C]/50 dark:text-[#1C2B1C]'
                          : finishedWrong
                            ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900 dark:border-red-700 dark:text-red-200'
                            : matched
                              ? 'bg-gradient-to-r from-[#1C2B1C]/10 to-[#1C2B1C]/20 border-[#1C2B1C]/30 shadow-sm text-[#1C2B1C] dark:from-[#1C2B1C]/30 dark:to-[#1C2B1C]/20 dark:bg-[#1C2B1C]/30 dark:border-[#1C2B1C]/50 dark:text-[#1C2B1C]'
                              : isSelected
                                ? 'bg-blue-100 border-blue-200 shadow text-slate-900 dark:bg-blue-900 dark:border-blue-800 dark:text-slate-100'
                                : 'bg-white border-slate-100 hover:shadow-sm hover:-translate-y-0.5 text-slate-900 dark:bg-slate-700 dark:border-slate-700 dark:text-slate-100'
                        }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 flex items-center justify-center rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-100 font-medium">{i + 1}</div>
                        <div className="text-sm text-slate-900 dark:text-slate-100">{q.question}</div>
                      </div>
                      {finishedCorrect ? (
                        <div className="flex items-center gap-2 text-[#1C2B1C]">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#1C2B1C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          <div className="text-xs">Correct</div>
                        </div>
                      ) : finishedWrong ? (
                        <div className="text-xs text-red-600 dark:text-red-400">Incorrect</div>
                      ) : matched ? (
                        <div className="flex items-center gap-2 text-[#1C2B1C]">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#1C2B1C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          <div className="text-xs">Matched</div>
                        </div>
                      ) : isSelected ? (
                        <div className="text-xs text-blue-600 dark:text-blue-300">Selected</div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Answers</h3>
              <div className="space-y-3">
                {shuffledAnswers.map((a, i) => {
                  const used = Object.values(matches).includes(a.id);
                  // determine "wrong" state by comparing the selected answer text with the selected question's correct answer.
                  // Only show immediate wrong feedback in 'immediate' mode.
                  const isWrongSelect = feedbackMode === 'immediate' && !!selectedQuestion && selectedAnswer === a.id && (() => {
                    const q = cards.find(c => c._id === selectedQuestion);
                    const aObj = shuffledAnswers.find(s => s.id === a.id);
                    if (!q || !aObj) return false;
                    return aObj.text !== q.answer;
                  })();
                  // If finished in 'end' mode, mark used answers that were wrong/correct for their question
                  let finishedTag: React.ReactNode = null;
                  if (finished) {
                    // find the question matched to this answer (if any)
                    const qid = Object.keys(matches).find(k => matches[k] === a.id);
                    if (qid) {
                      const status = verifiedMatches[qid];
                      if (status === 'correct') finishedTag = <div className="text-xs text-emerald-800 dark:text-slate-400">Correct</div>;
                      if (status === 'wrong') finishedTag = <div className="text-xs text-red-600 dark:text-red-400">Wrong</div>;
                    }
                  }
                  return (
                    <button
                      key={a.id}
                      ref={(el) => { answerRefs.current[a.id] = el; }}
                      onClick={() => handleAnswerClick(a.id)}
                      disabled={finished || used}
                      className={`w-full flex items-center justify-between gap-4 p-4 rounded-lg border transition-transform
                        ${used
                          ? 'bg-emerald-100 border-emerald-200 text-emerald-800 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400'
                          : isWrongSelect
                            ? 'bg-red-50 border-red-200 shadow-sm dark:bg-red-900 dark:border-red-700 dark:text-red-200'
                            : 'bg-white border-slate-100 hover:shadow-sm hover:-translate-y-0.5 text-slate-900 dark:bg-slate-700 dark:border-slate-700 dark:text-slate-100'
                        }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 flex items-center justify-center rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-100 font-medium">{String.fromCharCode(65 + i)}</div>
                        <div className="text-sm text-slate-900 dark:text-slate-100">{a.text}</div>
                      </div>
                      {finishedTag}
                      {!finishedTag && used && <div className="text-xs text-emerald-800 dark:text-slate-400">Used</div>}
                      {!finishedTag && isWrongSelect && <div className="text-xs text-red-600 dark:text-red-400">Try again</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-slate-700 dark:text-slate-300">Matches: {score} / {cards.length}</div>

            {/* Bottom-right: Finish / Results for 'end' mode, otherwise show completed badge */}
            <div className="flex items-center gap-3">
              {feedbackMode === 'end' ? (
                finished ? (
                  // show evaluated score after clicking Finish
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-emerald-600 text-white rounded-full shadow">
                      Score: {Object.values(verifiedMatches).filter(v => v === 'correct').length}/{cards.length}
                    </span>
                    <button
                      onClick={reset}
                      className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-full text-sm shadow hover:scale-105 transition"
                    >
                      Play again
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={finishAndEvaluate}
                    disabled={finished}
                    className="px-3 py-1 bg-emerald-600 text-white rounded-full text-sm shadow hover:scale-105 transition"
                  >
                    Finish & Evaluate
                  </button>
                )
              ) : (
                completed && (
                  <div className="text-sm">
                    <span className="px-3 py-1 bg-emerald-600 text-white rounded-full shadow">Completed — Score: {score}/{cards.length}</span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}