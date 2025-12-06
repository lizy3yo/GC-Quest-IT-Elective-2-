"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Check, X, ChevronLeft } from "lucide-react";
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

export default function PublicLearnModePage() {
  const [flashcard, setFlashcard] = useState<Flashcard | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [userAnswer, setUserAnswer] = useState<string>("");
  const [showFeedback, setShowFeedback] = useState<boolean>(false);
  const [isCorrect, setIsCorrect] = useState<boolean>(false);
  const [masteredCards, setMasteredCards] = useState<Set<string>>(new Set());

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

  const currentCard = flashcard?.cards?.[currentIndex];

  const checkAnswer = () => {
    if (!currentCard) return;
    
    const correct = userAnswer.trim().toLowerCase() === currentCard.answer.trim().toLowerCase();
    setIsCorrect(correct);
    setShowFeedback(true);
    
    if (correct) {
      setMasteredCards((prev) => new Set(prev).add(currentCard._id));
    }
  };

  const handleNext = () => {
    setUserAnswer("");
    setShowFeedback(false);
    setCurrentIndex((prev) =>
      Math.min((flashcard?.cards?.length || 1) - 1, prev + 1)
    );
  };

  const handleSkip = () => {
    setUserAnswer("");
    setShowFeedback(false);
    setCurrentIndex((prev) =>
      Math.min((flashcard?.cards?.length || 1) - 1, prev + 1)
    );
  };

  if (isLoading) {
    return (
      <LoadingTemplate2
        title="Loading learn mode"
        subtitle="Preparing your learning session…"
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

  const progress = (masteredCards.size / flashcard.cards.length) * 100;
  const isComplete = currentIndex >= flashcard.cards.length - 1 && showFeedback;

  if (isComplete) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 flex items-center justify-center">
        <div className="max-w-2xl w-full mx-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-10 md:p-14 text-center">
            <div className="w-24 h-24 bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900/30 dark:to-emerald-800/30 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg shadow-emerald-500/20">
              <Check size={48} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Excellent Work!
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-3">
              You've completed this learning session
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg mb-8">
              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {masteredCards.size}/{flashcard.cards.length}
              </span>
              <span className="text-slate-600 dark:text-slate-400">cards mastered</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => {
                  setCurrentIndex(0);
                  setUserAnswer("");
                  setShowFeedback(false);
                  setMasteredCards(new Set());
                }}
                className="px-8 py-4 bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 text-white rounded-xl font-semibold transition-all shadow-lg shadow-violet-500/20"
              >
                Study Again
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

          <div className="min-w-0">
            <h1 className="text-lg md:text-2xl font-semibold text-slate-900 dark:text-slate-100 truncate">
              Public Library - Learn
            </h1>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Learn · <span className="font-medium text-slate-900 dark:text-slate-100">{flashcard.cards.length}</span>
            </div>
          </div>
        </header>

        {/* Progress - matching private library style */}
        <div className="mb-6 max-w-4xl mx-auto">
          <div className="bg-slate-200 dark:bg-slate-700/30 h-3 rounded-full overflow-hidden">
            <div
              className="h-3 bg-gradient-to-r from-sky-500 to-indigo-600 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            {masteredCards.size} of {flashcard.cards.length} mastered ({Math.round(progress)}%)
          </p>
        </div>

        {/* Question Card - matching private library style */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 md:p-10">
            <div className="text-center mb-10">
              <div className="flex items-center justify-center gap-2 mb-6">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  Question {currentIndex + 1} of {flashcard.cards.length}
                </span>
              </div>
              <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 dark:text-slate-100 mb-4">
                {currentCard?.question}
              </h2>
              <p className="text-slate-600 dark:text-slate-400">Type your answer below</p>
            </div>

            {!showFeedback ? (
              <div>
                <input
                  type="text"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && userAnswer.trim()) {
                      checkAnswer();
                    }
                  }}
                  placeholder="Type your answer..."
                  className="w-full px-5 py-4 text-lg border-2 border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 dark:bg-slate-700/50 dark:text-slate-100 transition mb-6"
                  autoFocus
                />
                <div className="flex gap-3">
                  <button
                    onClick={checkAnswer}
                    disabled={!userAnswer.trim()}
                    className="flex-1 bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 text-white py-4 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-500/20"
                  >
                    Submit Answer
                  </button>
                  <button
                    onClick={handleSkip}
                    className="px-8 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 py-4 rounded-xl font-semibold transition-colors"
                  >
                    Skip
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div
                  className={`p-5 rounded-xl mb-6 ${
                    isCorrect
                      ? "bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-200 dark:border-emerald-700"
                      : "bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-700"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    {isCorrect ? (
                      <Check className="text-emerald-600 dark:text-emerald-400" size={28} />
                    ) : (
                      <X className="text-red-600 dark:text-red-400" size={28} />
                    )}
                    <span
                      className={`font-semibold text-lg ${
                        isCorrect
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-red-700 dark:text-red-300"
                      }`}
                    >
                      {isCorrect ? "✓ Correct!" : "✗ Not quite"}
                    </span>
                  </div>
                  <div className="text-slate-700 dark:text-slate-300">
                    <strong>Correct answer:</strong> <span className="font-semibold">{currentCard?.answer}</span>
                  </div>
                </div>
                <button
                  onClick={handleNext}
                  className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white py-4 rounded-xl font-semibold transition-all shadow-lg shadow-emerald-500/20"
                >
                  {currentIndex >= flashcard.cards.length - 1 ? "Finish" : "Continue"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
