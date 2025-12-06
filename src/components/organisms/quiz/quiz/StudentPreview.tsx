"use client";

import React, { useState, useEffect } from "react";
import { Question } from "./KahootQuestionEditor";

interface StudentPreviewProps {
  questions: Question[];
  quizTitle: string;
  onClose: () => void;
  settings?: {
    showProgress?: boolean;
    shuffleQuestions?: boolean;
    shuffleOptions?: boolean;
    allowReview?: boolean;
    lockdown?: boolean;
    trackTabSwitching?: boolean;
    hideCorrectAnswers?: boolean;
  };
}

export default function StudentPreview({ questions, quizTitle, onClose, settings }: StudentPreviewProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1); // -1 = waiting screen
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [typedAnswer, setTypedAnswer] = useState<string>(''); // For identification questions
  const [timeLeft, setTimeLeft] = useState(0);
  const [score, setScore] = useState(0);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [tabSwitchDurations, setTabSwitchDurations] = useState<number[]>([]);
  const [lastVisibilityChange, setLastVisibilityChange] = useState<number | null>(null);
  const [quizStarted, setQuizStarted] = useState(false);

  // Shuffle questions if enabled
  const [displayQuestions, setDisplayQuestions] = useState<Question[]>([]);
  // Store shuffled options per question (only shuffle once per question)
  const [shuffledOptions, setShuffledOptions] = useState<any[]>([]);
  
  useEffect(() => {
    let questionsToDisplay = [...questions];
    if (settings?.shuffleQuestions) {
      questionsToDisplay = [...questions].sort(() => Math.random() - 0.5);
    }
    setDisplayQuestions(questionsToDisplay);
  }, [questions, settings?.shuffleQuestions]);

  // Shuffle options once per question when question changes
  useEffect(() => {
    if (currentQuestion && settings?.shuffleOptions) {
      const shuffled = [...(currentQuestion.options || [])].sort(() => Math.random() - 0.5);
      setShuffledOptions(shuffled);
    } else if (currentQuestion) {
      setShuffledOptions(currentQuestion.options || []);
    }
  }, [currentQuestionIndex, settings?.shuffleOptions]);

  const currentQuestion = displayQuestions[currentQuestionIndex];
  const isWaitingScreen = currentQuestionIndex === -1;
  const isFinished = currentQuestionIndex >= displayQuestions.length;

  // Hide body scrollbar when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Tab switching detection - MUST be before any early returns
  useEffect(() => {
    if (!quizStarted || !settings?.trackTabSwitching) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setLastVisibilityChange(Date.now());
        setTabSwitches(prev => prev + 1);
      } else {
        if (lastVisibilityChange) {
          const duration = Date.now() - lastVisibilityChange;
          setTabSwitchDurations(prev => [...prev, duration]);
          setLastVisibilityChange(null);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [quizStarted, lastVisibilityChange, settings?.trackTabSwitching]);

  // Prevent leaving if lockdown mode is enabled - MUST be before any early returns
  useEffect(() => {
    if (!quizStarted || !settings?.lockdown) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      return (e.returnValue = 'You cannot leave this quiz once started. Your progress will be lost.');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [quizStarted, settings?.lockdown]);

  // Timer effect - MUST be before any early returns
  useEffect(() => {
    if (currentQuestion && !answerSubmitted) {
      const tl = currentQuestion.timeLimit ?? 0;
      if (tl > 0) {
        setTimeLeft(tl);
        const timer = setInterval(() => {
          setTimeLeft((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              handleTimeout();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        return () => clearInterval(timer);
      } else {
        setTimeLeft(0);
      }
    }
  }, [currentQuestionIndex, answerSubmitted]);

  const handleTimeout = () => {
    setAnswerSubmitted(true);
    setTimeout(() => {
      nextQuestion();
    }, 3000);
  };

  const handleAnswer = (optionId: string) => {
    if (answerSubmitted) return;
    setSelectedAnswer(optionId);
    
    const option = currentQuestion?.options?.find(opt => opt.id === optionId);
    if (option?.isCorrect) {
      const tl = currentQuestion?.timeLimit ?? 0;
      const timeBonus = tl > 0 ? Math.floor((timeLeft / tl) * 500) : 0;
      setScore(score + (currentQuestion?.points || 1000) + timeBonus);
    }
    
    setAnswerSubmitted(true);
    setTimeout(() => {
      nextQuestion();
    }, 3000);
  };

  const nextQuestion = () => {
    setCurrentQuestionIndex(currentQuestionIndex + 1);
    setSelectedAnswer(null);
    setTypedAnswer('');
    setAnswerSubmitted(false);
  };

  const handleSubmitTypedAnswer = () => {
    if (answerSubmitted || !typedAnswer.trim()) return;
    
    const correctAnswer = (currentQuestion?.correctAnswer || currentQuestion?.answer) as string;
    const isCorrect = typedAnswer.trim().toLowerCase() === correctAnswer?.toLowerCase();
    
    if (isCorrect) {
      const tl = currentQuestion?.timeLimit ?? 0;
      const timeBonus = tl > 0 ? Math.floor((timeLeft / tl) * 500) : 0;
      setScore(score + (currentQuestion?.points || 1000) + timeBonus);
    }
    
    setAnswerSubmitted(true);
    setTimeout(() => {
      nextQuestion();
    }, 3000);
  };

  const startQuiz = () => {
    setCurrentQuestionIndex(0);
    setQuizStarted(true);
  };

  // Results Screen
  if (isFinished) {
    const maxScore = displayQuestions.reduce((sum, q) => sum + (q.points || 1000), 0);
    const percentage = Math.round((score / maxScore) * 100);
    const totalTabSwitchTime = tabSwitchDurations.reduce((sum, duration) => sum + duration, 0);
    
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-slate-900 dark:via-slate-800 dark:to-emerald-950 z-50 flex items-center justify-center p-6 overflow-auto">
        <div className="max-w-5xl w-full">
          {/* Results Hero Card */}
          <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 p-12 mb-6 overflow-hidden">
            {/* Decorative Background */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#2E7D32]/10 to-transparent rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-emerald-400/10 to-transparent rounded-full blur-2xl" />
            
            <div className="relative text-center">
              {/* Trophy/Emoji */}
              <div className="text-8xl mb-6 animate-bounce">
                {percentage >= 80 ? '🏆' : percentage >= 60 ? '🎉' : percentage >= 40 ? '👍' : '💪'}
              </div>
              
              {/* Title */}
              <h1 className="text-5xl md:text-6xl font-black text-slate-900 dark:text-white mb-6 leading-tight">
                {percentage >= 80 ? 'Outstanding!' : percentage >= 60 ? 'Great Job!' : percentage >= 40 ? 'Good Effort!' : 'Keep Practicing!'}
              </h1>
              
              {/* Score Display */}
              <div className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-amber-400 to-yellow-400 dark:from-amber-600 dark:to-yellow-600 rounded-2xl shadow-lg mb-6">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-4xl font-black text-white">{score.toLocaleString()}</span>
                <span className="text-xl font-semibold text-white/90">points</span>
              </div>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto mb-6">
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl p-4 border border-emerald-200 dark:border-emerald-800">
                  <div className="text-3xl font-black text-[#2E7D32] dark:text-emerald-400 mb-1">{percentage}%</div>
                  <div className="text-sm font-semibold text-slate-600 dark:text-slate-400">Accuracy</div>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-2xl p-4 border border-blue-200 dark:border-blue-800">
                  <div className="text-3xl font-black text-blue-600 dark:text-blue-400">{displayQuestions.length}</div>
                  <div className="text-sm font-semibold text-slate-600 dark:text-slate-400">Questions</div>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Switching Warning */}
          {settings?.trackTabSwitching && tabSwitches > 0 && (
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-2xl p-6 mb-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-amber-100 dark:bg-amber-900/40 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-amber-900 dark:text-amber-300 text-lg mb-2">Tab Switching Detected</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-3">
                      <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{tabSwitches}</div>
                      <div className="text-amber-700 dark:text-amber-500 font-medium">Times Left Tab</div>
                    </div>
                    <div className="bg-white/50 dark:bg-slate-800/50 rounded-lg p-3">
                      <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{Math.round(totalTabSwitchTime / 1000)}s</div>
                      <div className="text-amber-700 dark:text-amber-500 font-medium">Time Away</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => {
                setCurrentQuestionIndex(-1);
                setScore(0);
                setTabSwitches(0);
                setTabSwitchDurations([]);
                setQuizStarted(false);
              }}
              className="px-8 py-5 bg-gradient-to-r from-[#2E7D32] to-[#1B5E20] hover:from-[#1B5E20] hover:to-[#0D4A14] text-white rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Try Again</span>
            </button>
            <button
              onClick={onClose}
              className="px-8 py-5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-bold text-lg border-2 border-slate-200 dark:border-slate-700 transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span>Exit Preview</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Waiting Screen
  if (isWaitingScreen) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-slate-900 dark:via-slate-800 dark:to-emerald-950 z-50 overflow-y-auto">
        <div className="min-h-full flex items-center justify-center p-6">
        {/* Animated Background Decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-br from-[#2E7D32]/20 to-emerald-300/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-gradient-to-tr from-teal-300/20 to-cyan-300/20 rounded-full blur-3xl animate-pulse delay-1000" />
          <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-gradient-to-br from-green-300/10 to-emerald-400/10 rounded-full blur-2xl animate-pulse delay-500" />
          
          {/* Floating Icons */}
          <div className="absolute top-32 right-1/4 animate-float">
            <div className="w-16 h-16 bg-gradient-to-br from-[#2E7D32]/10 to-emerald-400/10 rounded-2xl rotate-12 backdrop-blur-sm" />
          </div>
          <div className="absolute bottom-40 left-1/3 animate-float-delayed">
            <div className="w-20 h-20 bg-gradient-to-br from-teal-400/10 to-cyan-400/10 rounded-full backdrop-blur-sm" />
          </div>
          <div className="absolute top-1/3 right-1/3 animate-float-slow">
            <div className="w-12 h-12 bg-gradient-to-br from-green-400/10 to-emerald-500/10 rounded-xl -rotate-6 backdrop-blur-sm" />
          </div>
        </div>

        <div className="max-w-6xl w-full relative z-10">
          {/* Preview Mode Badge - At the very top */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-100 via-cyan-100 to-blue-100 dark:from-blue-900/40 dark:via-cyan-900/40 dark:to-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full text-sm font-bold border-2 border-blue-200 dark:border-blue-800 shadow-lg animate-pulse-slow">
              <svg className="w-5 h-5 animate-spin-slow" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
              <span className="bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent">Preview Mode</span>
            </div>
          </div>

          {/* Hero Card with Enhanced Design */}
          <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-16 mb-8 overflow-hidden">
            {/* Decorative Background Elements */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#2E7D32]/10 to-transparent rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-gradient-to-tr from-emerald-400/10 to-transparent rounded-full blur-3xl" />
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full h-full">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#2E7D32]/5 to-transparent animate-shimmer" />
            </div>
            
            <div className="relative text-center">
              {/* Large Animated Icon */}
              <div className="inline-flex items-center justify-center w-32 h-32 bg-gradient-to-br from-[#2E7D32] via-[#388E3C] to-[#1B5E20] rounded-3xl mb-8 shadow-2xl relative group">
                <div className="absolute inset-0 bg-[#2E7D32] rounded-3xl animate-ping opacity-20" />
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-3xl" />
                <svg className="w-16 h-16 text-white relative z-10 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              
              {/* Title with Gradient */}
              <h1 className="text-5xl md:text-6xl font-black bg-gradient-to-r from-slate-900 via-[#2E7D32] to-slate-900 dark:from-white dark:via-emerald-400 dark:to-white bg-clip-text text-transparent mb-6 leading-tight">
                {quizTitle}
              </h1>
              
              {/* Enhanced Stats Grid */}
              <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mt-8">
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl p-5 border-2 border-emerald-200 dark:border-emerald-800 shadow-sm hover:shadow-md transition-shadow">
                  <svg className="w-8 h-8 text-[#2E7D32] dark:text-emerald-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="text-3xl font-black text-[#2E7D32] dark:text-emerald-400 mb-1">{displayQuestions.length}</div>
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">Questions</div>
                </div>
                
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-2xl p-5 border-2 border-blue-200 dark:border-blue-800 shadow-sm hover:shadow-md transition-shadow">
                  <svg className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-3xl font-black text-blue-600 dark:text-blue-400 mb-1">
                    {displayQuestions.reduce((sum, q) => sum + (q.timeLimit || 0), 0)}s
                  </div>
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">Total Time</div>
                </div>
                
                <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-2xl p-5 border-2 border-amber-200 dark:border-amber-800 shadow-sm hover:shadow-md transition-shadow">
                  <svg className="w-8 h-8 text-amber-600 dark:text-amber-400 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <div className="text-3xl font-black text-amber-600 dark:text-amber-400 mb-1">
                    {displayQuestions.reduce((sum, q) => sum + (q.points || 1000), 0).toLocaleString()}
                  </div>
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">Max Points</div>
                </div>
              </div>
            </div>
          </div>

          {/* Warning Cards */}
          <div className="space-y-4 mb-6">
            {settings?.lockdown && (
              <div className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border-2 border-red-200 dark:border-red-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-red-100 dark:bg-red-900/40 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-red-900 dark:text-red-300 text-lg mb-1">Lockdown Mode Enabled</h3>
                    <p className="text-sm text-red-700 dark:text-red-400">Students cannot leave this assessment once started. Attempting to exit will trigger a warning.</p>
                  </div>
                </div>
              </div>
            )}
            
            {settings?.trackTabSwitching && (
              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-2xl p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-amber-100 dark:bg-amber-900/40 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-amber-900 dark:text-amber-300 text-lg mb-1">Tab Switching Monitored</h3>
                    <p className="text-sm text-amber-700 dark:text-amber-400">All tab switches and time spent away from the assessment will be tracked and reported.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={startQuiz}
              className="group w-full px-12 py-5 bg-gradient-to-r from-[#2E7D32] to-[#1B5E20] hover:from-[#1B5E20] hover:to-[#0D4A14] text-white rounded-2xl font-bold text-xl shadow-xl hover:shadow-2xl transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3"
            >
              <svg className="w-7 h-7 group-hover:animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Start Preview</span>
            </button>

            <button
              onClick={onClose}
              className="w-full px-6 py-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-semibold text-lg border-2 border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Exit Preview</span>
            </button>
          </div>
        </div>
        </div>
      </div>
    );
  }

  // Question Screen
  const OPTION_COLORS = [
    { bg: 'bg-gradient-to-br from-red-500 to-red-600', hover: 'hover:from-red-600 hover:to-red-700', ring: 'ring-red-400', icon: '▲', light: 'from-red-400 to-red-500' },
    { bg: 'bg-gradient-to-br from-blue-500 to-blue-600', hover: 'hover:from-blue-600 hover:to-blue-700', ring: 'ring-blue-400', icon: '◆', light: 'from-blue-400 to-blue-500' },
    { bg: 'bg-gradient-to-br from-amber-500 to-yellow-500', hover: 'hover:from-amber-600 hover:to-yellow-600', ring: 'ring-amber-400', icon: '●', light: 'from-amber-400 to-yellow-400' },
    { bg: 'bg-gradient-to-br from-emerald-500 to-green-600', hover: 'hover:from-emerald-600 hover:to-green-700', ring: 'ring-emerald-400', icon: '■', light: 'from-emerald-400 to-green-500' },
  ];

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:from-slate-900 dark:via-slate-800 dark:to-emerald-950 z-50 overflow-auto">
      {/* Header */}
      <div className="bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border-b-2 border-slate-200 dark:border-slate-700 p-5 flex items-center justify-between shadow-lg sticky top-0 z-10">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#2E7D32] to-[#1B5E20] rounded-xl shadow-md">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-white font-bold text-lg">
              {currentQuestionIndex + 1} / {displayQuestions.length}
            </span>
          </div>
          {(settings?.showProgress ?? true) && (
            <div className="w-64 h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-[#2E7D32] via-[#4CAF50] to-[#66BB6A] transition-all duration-500 ease-out shadow-sm"
                style={{ width: `${((currentQuestionIndex + 1) / displayQuestions.length) * 100}%` }}
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-400 to-yellow-400 dark:from-amber-600 dark:to-yellow-600 rounded-xl text-white font-black text-lg shadow-lg">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            {score.toLocaleString()}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-semibold transition-all shadow-sm hover:shadow-md flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Exit
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8">
        {/* Timer */}
        {((currentQuestion?.timeLimit ?? 0) > 0) && (
          <div className="flex justify-center mb-10">
            <div className={`relative w-32 h-32 ${timeLeft <= 5 ? 'animate-pulse' : ''}`}>
              <svg className="transform -rotate-90 w-32 h-32">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  className="text-slate-200 dark:text-slate-700"
                  strokeWidth="10"
                  fill="none"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke={timeLeft <= 5 ? '#ef4444' : '#2E7D32'}
                  strokeWidth="10"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 56}`}
                  strokeDashoffset={`${2 * Math.PI * 56 * (1 - (timeLeft / (currentQuestion.timeLimit ?? 20)))}`}
                  strokeLinecap="round"
                  className="transition-all duration-1000 drop-shadow-lg"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className={`text-4xl font-black ${timeLeft <= 5 ? 'text-red-600 dark:text-red-400' : 'text-[#2E7D32] dark:text-[#4CAF50]'}`}>
                    {timeLeft}
                  </div>
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">seconds</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Question Card */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-10 mb-10 shadow-2xl border-2 border-slate-200 dark:border-slate-700 relative overflow-hidden">
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-[#2E7D32]/10 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-emerald-400/10 to-transparent rounded-full blur-2xl" />
          
          <div className="relative">
            {currentQuestion.image && (
              <img
                src={currentQuestion.image}
                alt="Question"
                className="w-full max-h-80 object-cover rounded-2xl mb-8 shadow-lg"
              />
            )}
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white text-center leading-tight">
              {currentQuestion.title}
            </h2>
          </div>
        </div>

        {/* Answer Options */}
        {currentQuestion.type === 'identification' ? (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-xl border-2 border-slate-200 dark:border-slate-700">
              <input
                type="text"
                value={typedAnswer}
                onChange={(e) => setTypedAnswer(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmitTypedAnswer()}
                disabled={answerSubmitted}
                placeholder="Type your answer here..."
                className="w-full px-6 py-6 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white text-2xl font-semibold placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-4 focus:ring-[#2E7D32] dark:focus:ring-[#4CAF50] rounded-2xl border-2 border-slate-200 dark:border-slate-600 text-center disabled:opacity-50 shadow-sm transition-all"
                autoFocus
              />
              <button
                onClick={handleSubmitTypedAnswer}
                disabled={answerSubmitted || !typedAnswer.trim()}
                className="w-full mt-6 px-8 py-5 bg-gradient-to-r from-[#2E7D32] to-[#1B5E20] hover:from-[#1B5E20] hover:to-[#0D4A14] text-white rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {answerSubmitted ? '✓ Submitted' : 'Submit Answer'}
              </button>
            </div>
            {/* Feedback for identification */}
            {answerSubmitted && (
              <div className="mt-8 text-center animate-fade-in">
                {(() => {
                  const correctAnswer = (currentQuestion.correctAnswer || currentQuestion.answer) as string;
                  const isCorrect = typedAnswer.trim().toLowerCase() === correctAnswer?.toLowerCase();
                  if (settings?.hideCorrectAnswers) {
                    return (
                      <div className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold text-xl shadow-lg">
                        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Answer Submitted
                      </div>
                    );
                  }
                  return (
                    <div className={`inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-white font-bold text-xl shadow-lg ${
                      isCorrect ? 'bg-gradient-to-r from-emerald-500 to-green-600' : 'bg-gradient-to-r from-red-500 to-rose-600'
                    }`}>
                      <span className="text-2xl">{isCorrect ? '🎉' : '❌'}</span>
                      {isCorrect ? 'Correct!' : `Incorrect - Answer: ${correctAnswer}`}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        ) : currentQuestion.type === 'paragraph' ? (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-xl border-2 border-slate-200 dark:border-slate-700">
              <textarea
                value={typedAnswer}
                onChange={(e) => setTypedAnswer(e.target.value)}
                disabled={answerSubmitted}
                placeholder="Type your essay answer here..."
                className="w-full px-6 py-6 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white text-lg font-medium placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-4 focus:ring-[#2E7D32] dark:focus:ring-[#4CAF50] rounded-2xl border-2 border-slate-200 dark:border-slate-600 disabled:opacity-50 min-h-[200px] shadow-sm transition-all resize-none"
                rows={8}
                autoFocus
              />
              <button
                onClick={handleSubmitTypedAnswer}
                disabled={answerSubmitted || !typedAnswer.trim()}
                className="w-full mt-6 px-8 py-5 bg-gradient-to-r from-[#2E7D32] to-[#1B5E20] hover:from-[#1B5E20] hover:to-[#0D4A14] text-white rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {answerSubmitted ? '✓ Submitted' : 'Submit Essay'}
              </button>
            </div>
            {/* Feedback for essay */}
            {answerSubmitted && (
              <div className="mt-8 text-center animate-fade-in">
                <div className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold text-xl shadow-lg">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Essay submitted. Awaiting teacher review.
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {shuffledOptions.map((option, idx) => {
            const colorConfig = OPTION_COLORS[idx] || OPTION_COLORS[0];
            const isSelected = selectedAnswer === option.id;
            const isCorrect = option.isCorrect;
            const showFeedback = answerSubmitted && !settings?.hideCorrectAnswers;

            let feedbackClass = '';
            let borderClass = '';
            if (showFeedback) {
              if (isCorrect) {
                feedbackClass = 'bg-gradient-to-br from-emerald-500 to-green-600 ring-4 ring-emerald-400 dark:ring-emerald-500';
                borderClass = 'border-emerald-400 dark:border-emerald-500';
              } else if (isSelected && !isCorrect) {
                feedbackClass = 'bg-gradient-to-br from-red-500 to-rose-600 ring-4 ring-red-400 dark:ring-red-500 opacity-60';
                borderClass = 'border-red-400 dark:border-red-500';
              }
            } else if (answerSubmitted && isSelected) {
              feedbackClass = 'ring-4 ring-blue-400 dark:ring-blue-500';
              borderClass = 'border-blue-400 dark:border-blue-500';
            }

            return (
              <button
                key={option.id}
                onClick={() => !answerSubmitted && handleAnswer(option.id)}
                disabled={answerSubmitted}
                className={`
                  ${feedbackClass || colorConfig.bg} ${!showFeedback && !answerSubmitted && colorConfig.hover}
                  ${isSelected && !showFeedback && !answerSubmitted ? `ring-4 ${colorConfig.ring}` : ''}
                  p-6 rounded-2xl text-white font-bold text-xl shadow-xl
                  transition-all transform hover:scale-[1.03] active:scale-[0.98] disabled:cursor-not-allowed
                  flex items-center gap-4 min-h-[100px] border-2 ${borderClass || 'border-transparent'}
                  relative overflow-hidden group
                `}
              >
                {/* Icon Badge */}
                <div className="flex-shrink-0 w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-3xl font-black shadow-lg group-hover:scale-110 transition-transform">
                  {colorConfig.icon}
                </div>
                
                {/* Answer Text */}
                <span className="flex-1 text-left leading-tight">{option.text || `Answer ${idx + 1}`}</span>
                
                {/* Feedback Icons */}
                {showFeedback && isCorrect && (
                  <div className="flex-shrink-0 w-12 h-12 bg-white/30 rounded-full flex items-center justify-center animate-bounce">
                    <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                {showFeedback && isSelected && !isCorrect && (
                  <div className="flex-shrink-0 w-12 h-12 bg-white/30 rounded-full flex items-center justify-center">
                    <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
          </div>
        )}

        {/* Feedback Message for MCQ */}
        {currentQuestion.type !== 'identification' && currentQuestion.type !== 'paragraph' && answerSubmitted && !settings?.hideCorrectAnswers && (
          <div className="mt-10 text-center animate-fade-in">
            <div className={`inline-flex items-center gap-3 px-8 py-5 rounded-2xl text-white font-bold text-2xl shadow-xl ${
              currentQuestion.options?.find(opt => opt.id === selectedAnswer)?.isCorrect
                ? 'bg-gradient-to-r from-emerald-500 to-green-600'
                : 'bg-gradient-to-r from-red-500 to-rose-600'
            }`}>
              <span className="text-3xl">
                {currentQuestion.options?.find(opt => opt.id === selectedAnswer)?.isCorrect ? '🎉' : '❌'}
              </span>
              {currentQuestion.options?.find(opt => opt.id === selectedAnswer)?.isCorrect
                ? 'Correct!'
                : 'Incorrect'}
            </div>
          </div>
        )}
        {currentQuestion.type !== 'identification' && currentQuestion.type !== 'paragraph' && answerSubmitted && settings?.hideCorrectAnswers && (
          <div className="mt-10 text-center animate-fade-in">
            <div className="inline-flex items-center gap-3 px-8 py-5 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-bold text-2xl shadow-xl">
              <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Answer Submitted
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
