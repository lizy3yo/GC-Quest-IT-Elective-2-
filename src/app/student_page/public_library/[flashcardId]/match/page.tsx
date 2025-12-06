"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ChevronLeft, Trophy } from "lucide-react";
import LoadingTemplate2 from "@/components/molecules/loading_template_2/loading_template_2/loading2";

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
};

type MatchItem = {
  id: string;
  text: string;
  type: "question" | "answer";
  cardId: string;
  matched: boolean;
};

export default function PublicMatchModePage() {
  const [flashcard, setFlashcard] = useState<Flashcard | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [matchItems, setMatchItems] = useState<MatchItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<MatchItem | null>(null);
  const [matchedCount, setMatchedCount] = useState<number>(0);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [endTime, setEndTime] = useState<number | null>(null);
  const [isComplete, setIsComplete] = useState<boolean>(false);

  const router = useRouter();
  const params = useParams();
  const flashcardId = params.flashcardId as string;

  useEffect(() => {
    let isMounted = true;

    async function loadFlashcard() {
      setIsLoading(true);
      setError(null);
      try {
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
          throw new Error("Failed to load flashcard");
        }

        const data = (await res.json()) as { flashcard: Flashcard };
        if (!isMounted) return;

        setFlashcard(data.flashcard);
        initializeMatchGame(data.flashcard);
      } catch (e: unknown) {
        if (!isMounted) return;
        setError(
          e instanceof Error
            ? e.message
            : "Something went wrong loading the flashcard."
        );
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

  const initializeMatchGame = (flashcard: Flashcard) => {
    const items: MatchItem[] = [];
    
    // Take up to 6 cards for the match game
    const cardsToUse = flashcard.cards.slice(0, 6);
    
    cardsToUse.forEach((card) => {
      items.push({
        id: `q-${card._id}`,
        text: card.question,
        type: "question",
        cardId: card._id,
        matched: false,
      });
      items.push({
        id: `a-${card._id}`,
        text: card.answer,
        type: "answer",
        cardId: card._id,
        matched: false,
      });
    });

    // Shuffle items
    const shuffled = items.sort(() => Math.random() - 0.5);
    setMatchItems(shuffled);
    setStartTime(Date.now());
  };

  const handleItemClick = (item: MatchItem) => {
    if (item.matched) return;

    if (!selectedItem) {
      setSelectedItem(item);
    } else {
      // Check if match
      if (
        selectedItem.cardId === item.cardId &&
        selectedItem.type !== item.type
      ) {
        // Match found!
        setMatchItems((prev) =>
          prev.map((i) =>
            i.cardId === item.cardId ? { ...i, matched: true } : i
          )
        );
        setMatchedCount((prev) => prev + 1);
        
        // Check if game is complete
        const totalPairs = Math.min(flashcard?.cards.length || 0, 6);
        if (matchedCount + 1 >= totalPairs) {
          setEndTime(Date.now());
          setIsComplete(true);
        }
      }
      setSelectedItem(null);
    }
  };

  const resetGame = () => {
    if (flashcard) {
      initializeMatchGame(flashcard);
      setSelectedItem(null);
      setMatchedCount(0);
      setIsComplete(false);
      setEndTime(null);
    }
  };

  if (isLoading) {
    return (
      <LoadingTemplate2
        title="Loading match game"
        subtitle="Preparing your matching game…"
        compact={false}
      />
    );
  }

  if (error || !flashcard) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-red-600 dark:text-red-400">
            {error || "Flashcard not found"}
          </div>
          <button
            onClick={() =>
              router.push(`/student_page/public_library/${flashcardId}`)
            }
            className="mt-4 px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-md"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  const totalPairs = Math.min(flashcard.cards.length, 6);
  const elapsedTime = endTime
    ? Math.floor((endTime - startTime) / 1000)
    : Math.floor((Date.now() - startTime) / 1000);

  if (isComplete) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 flex items-center justify-center">
        <div className="max-w-2xl w-full mx-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-10 md:p-14 text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/30 dark:to-amber-800/30 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg shadow-amber-500/20">
              <Trophy size={48} className="text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Perfect Match!
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-6">
              You matched all pairs successfully
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <div className="inline-flex items-center gap-2 px-5 py-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {totalPairs}
                </span>
                <span className="text-slate-600 dark:text-slate-400">pairs matched</span>
              </div>
              <div className="inline-flex items-center gap-2 px-5 py-3 bg-sky-50 dark:bg-sky-900/20 rounded-xl">
                <span className="text-2xl font-bold text-sky-600 dark:text-sky-400">
                  {elapsedTime}s
                </span>
                <span className="text-slate-600 dark:text-slate-400">completion time</span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={resetGame}
                className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-xl font-semibold transition-all shadow-lg shadow-emerald-500/20"
              >
                Play Again
              </button>
              <button
                onClick={() =>
                  router.push(`/student_page/public_library/${flashcardId}`)
                }
                className="px-8 py-4 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
              >
                Back to Overview
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 transition-colors duration-300">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header - matching private library style */}
        <header className="flex items-center gap-4 mb-4">
          <button
            onClick={() => router.push(`/student_page/public_library/${flashcardId}`)}
            aria-label="Back"
            className="w-10 h-10 rounded-full bg-slate-700/60 hover:bg-slate-700/80 flex items-center justify-center text-slate-100 transition"
          >
            <ChevronLeft size={16} className="text-slate-100" />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-lg md:text-2xl font-semibold text-slate-900 dark:text-slate-100 truncate">
              Public Library - Match
            </h1>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Match · <span className="font-medium text-slate-900 dark:text-slate-100">{totalPairs} pairs</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{matchedCount}</span> / {totalPairs}
            </div>
            <div className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700/50 rounded-lg">
              <span className="text-sm font-mono text-slate-900 dark:text-slate-100">{elapsedTime}s</span>
            </div>
            <button
              onClick={resetGame}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-all font-medium text-sm"
            >
              Reset
            </button>
          </div>
        </header>

        {/* Instructions */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-8">
          <p className="text-blue-900 dark:text-blue-100 text-sm">
            <strong>How to play:</strong> Click on a question and then click on its matching answer. Match all pairs to complete the game!
          </p>
        </div>

        {/* Match Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {matchItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleItemClick(item)}
              disabled={item.matched}
              className={`p-6 rounded-xl text-left transition-all min-h-32 flex items-center justify-center ${
                item.matched
                  ? "bg-green-50 dark:bg-green-900/20 border-2 border-green-500 dark:border-green-600 opacity-50 cursor-not-allowed"
                  : selectedItem?.id === item.id
                  ? "bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500 dark:border-blue-600 scale-105 shadow-lg"
                  : item.type === "question"
                  ? "bg-violet-50 dark:bg-violet-900/20 border-2 border-violet-200 dark:border-violet-800 hover:border-violet-400 dark:hover:border-violet-600 hover:scale-105 hover:shadow-lg"
                  : "bg-cyan-50 dark:bg-cyan-900/20 border-2 border-cyan-200 dark:border-cyan-800 hover:border-cyan-400 dark:hover:border-cyan-600 hover:scale-105 hover:shadow-lg"
              }`}
            >
              <div className="text-center">
                <div className="text-xs font-semibold mb-2 uppercase tracking-wider opacity-60">
                  {item.type === "question" ? "Question" : "Answer"}
                </div>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {item.text}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
