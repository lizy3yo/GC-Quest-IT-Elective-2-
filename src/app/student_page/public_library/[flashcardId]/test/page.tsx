"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ChevronLeft, Check, X, Award } from "lucide-react";
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

type TestQuestion = {
  card: FlashcardCard;
  options: string[];
  userAnswer: string | null;
  isCorrect: boolean | null;
};

export default function PublicTestModePage() {
  const [flashcard, setFlashcard] = useState<Flashcard | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [testQuestions, setTestQuestions] = useState<TestQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [isTestComplete, setIsTestComplete] = useState<boolean>(false);
  const [showResults, setShowResults] = useState<boolean>(false);

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
        generateTest(data.flashcard);
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

  const generateTest = (flashcard: Flashcard) => {
    const questions: TestQuestion[] = flashcard.cards.map((card) => {
      // Generate wrong answers from other cards
      const wrongAnswers = flashcard.cards
        .filter((c) => c._id !== card._id)
        .map((c) => c.answer)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);

      const options = [card.answer, ...wrongAnswers].sort(
        () => Math.random() - 0.5
      );

      return {
        card,
        options,
        userAnswer: null,
        isCorrect: null,
      };
    });

    setTestQuestions(questions);
  };

  const handleAnswerSelect = (answer: string) => {
    const updatedQuestions = [...testQuestions];
    const currentQuestion = updatedQuestions[currentQuestionIndex];
    currentQuestion.userAnswer = answer;
    currentQuestion.isCorrect = answer === currentQuestion.card.answer;
    setTestQuestions(updatedQuestions);
  };

  const handleNext = () => {
    if (currentQuestionIndex < testQuestions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      setIsTestComplete(true);
      setShowResults(true);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const retakeTest = () => {
    if (flashcard) {
      generateTest(flashcard);
      setCurrentQuestionIndex(0);
      setIsTestComplete(false);
      setShowResults(false);
    }
  };

  if (isLoading) {
    return (
      <LoadingTemplate2
        title="Loading test"
        subtitle="Preparing your test…"
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

  const currentQuestion = testQuestions[currentQuestionIndex];
  const answeredCount = testQuestions.filter((q) => q.userAnswer !== null).length;
  const correctCount = testQuestions.filter((q) => q.isCorrect === true).length;
  const score = testQuestions.length > 0
    ? Math.round((correctCount / testQuestions.length) * 100)
    : 0;

  if (showResults) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 md:p-12">
            <div className="text-center mb-10">
              <div className="w-24 h-24 bg-gradient-to-br from-cyan-100 to-cyan-200 dark:from-cyan-900/30 dark:to-cyan-800/30 rounded-full flex items-center justify-center mx-auto mb-8 shadow-lg shadow-cyan-500/20">
                <Award size={48} className="text-cyan-600 dark:text-cyan-400" />
              </div>
              <h2 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-6">
                Test Complete!
              </h2>
              <div className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-900/20 dark:to-sky-900/20 rounded-2xl mb-4 shadow-inner">
                <span className="text-6xl font-bold bg-gradient-to-r from-cyan-600 to-sky-600 bg-clip-text text-transparent">
                  {score}%
                </span>
              </div>
              <p className="text-lg text-slate-600 dark:text-slate-400">
                You scored <span className="font-semibold text-cyan-600 dark:text-cyan-400">{correctCount}</span> out of <span className="font-semibold">{testQuestions.length}</span> questions
              </p>
            </div>

            {/* Results breakdown */}
            <div className="space-y-4 mb-8">
              {testQuestions.map((question, index) => (
                <div
                  key={question.card._id}
                  className={`p-4 rounded-xl border-2 ${
                    question.isCorrect
                      ? "bg-green-50 dark:bg-green-900/20 border-green-500 dark:border-green-600"
                      : "bg-red-50 dark:bg-red-900/20 border-red-500 dark:border-red-600"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {question.isCorrect ? (
                        <Check className="text-green-600 dark:text-green-400" size={20} />
                      ) : (
                        <X className="text-red-600 dark:text-red-400" size={20} />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-slate-900 dark:text-slate-100 mb-2">
                        {index + 1}. {question.card.question}
                      </div>
                      <div className="text-sm space-y-1">
                        <div className="text-slate-700 dark:text-slate-300">
                          <strong>Correct answer:</strong> {question.card.answer}
                        </div>
                        {!question.isCorrect && question.userAnswer && (
                          <div className="text-red-700 dark:text-red-300">
                            <strong>Your answer:</strong> {question.userAnswer}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={retakeTest}
                className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800 text-white rounded-xl font-semibold transition-all shadow-lg shadow-cyan-500/20"
              >
                Retake Test
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

  if (!currentQuestion) {
    return null;
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
              Public Library - Test
            </h1>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Test · Question {currentQuestionIndex + 1} of {testQuestions.length}
            </div>
          </div>
        </header>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Answered: {answeredCount} / {testQuestions.length}
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
            <div
              className="bg-[#1C2B1C] h-2 rounded-full transition-all duration-300"
              style={{
                width: `${(answeredCount / testQuestions.length) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 mb-6 border border-slate-200 dark:border-slate-700">
          <div className="text-2xl font-medium text-slate-900 dark:text-slate-100 mb-8">
            {currentQuestion.card.question}
          </div>

          <div className="space-y-3">
            {currentQuestion.options.map((option, index) => (
              <button
                key={index}
                onClick={() => handleAnswerSelect(option)}
                className={`w-full p-4 rounded-xl text-left transition-all border-2 ${
                  currentQuestion.userAnswer === option
                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-600"
                    : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      currentQuestion.userAnswer === option
                        ? "border-blue-500 bg-blue-500"
                        : "border-slate-300 dark:border-slate-600"
                    }`}
                  >
                    {currentQuestion.userAnswer === option && (
                      <Check size={16} className="text-white" />
                    )}
                  </div>
                  <span className="text-slate-900 dark:text-slate-100">
                    {option}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0}
            className="px-6 py-3 bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            onClick={handleNext}
            disabled={!currentQuestion.userAnswer}
            className="px-6 py-3 bg-[#1C2B1C] text-white rounded-xl hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {currentQuestionIndex === testQuestions.length - 1
              ? "Finish Test"
              : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
