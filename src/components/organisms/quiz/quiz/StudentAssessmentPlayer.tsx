"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export interface AssessmentQuestion {
  id: string;
  title: string;
  type: 'mcq' | 'identification' | 'paragraph' | 'short' | 'checkboxes';
  options?: Array<{ id: string; text: string; isCorrect?: boolean }>;
  correctAnswer?: string | string[];
  answer?: string;
  points?: number;
  timeLimit?: number;
  image?: string;
}

interface StudentAssessmentPlayerProps {
  assessmentId: string;
  classId: string;
  questions: AssessmentQuestion[];
  title: string;
  totalPoints?: number;
  timeLimitMins?: number;
  settings?: {
    showProgress?: boolean;
    shuffleQuestions?: boolean;
    shuffleOptions?: boolean;
    allowReview?: boolean;
    lockdown?: boolean;
    trackTabSwitching?: boolean;
    hideCorrectAnswers?: boolean;
    allowBacktrack?: boolean;
  };
  isLiveMode?: boolean; // Skip start screen for live exams
  onQuestionAnswer?: (questionId: string, answer: any) => Promise<void>; // Live progress tracking
  onSubmit: (answers: Record<string, any>, metadata: {
    tabSwitches: number;
    tabSwitchDurations: number[];
    timeSpent: number;
    startTime?: string;
    totalAwayMs?: number;
  }) => Promise<void>;
}

export default function StudentAssessmentPlayer({
  assessmentId,
  classId,
  questions,
  title,
  totalPoints,
  timeLimitMins,
  settings,
  isLiveMode = false,
  onQuestionAnswer,
  onSubmit
}: StudentAssessmentPlayerProps) {
  const router = useRouter();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(isLiveMode ? 0 : -1); // Skip start screen for live mode
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [typedAnswer, setTypedAnswer] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [globalTimeLeft, setGlobalTimeLeft] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [tabSwitchDurations, setTabSwitchDurations] = useState<number[]>([]);
  const [lastVisibilityChange, setLastVisibilityChange] = useState<number | null>(null);
  const [quizStarted, setQuizStarted] = useState(isLiveMode); // Auto-start for live mode
  const [startTime, setStartTime] = useState<number | null>(isLiveMode ? Date.now() : null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false); // Confirmation before final submit

  // Shuffle questions and options ONCE at the beginning
  const [displayQuestions, setDisplayQuestions] = useState<AssessmentQuestion[]>([]);
  const [shuffledOptionsMap, setShuffledOptionsMap] = useState<Record<string, any[]>>({});
  const [hasInitialized, setHasInitialized] = useState(false);
  
  // Initialize shuffle only once when component mounts or questions change
  useEffect(() => {
    if (hasInitialized || questions.length === 0) return;
    
    // Shuffle questions if enabled
    let questionsToDisplay = [...questions];
    if (settings?.shuffleQuestions) {
      questionsToDisplay = [...questions].sort(() => Math.random() - 0.5);
    }
    setDisplayQuestions(questionsToDisplay);
    
    // Pre-shuffle all options for all questions once
    const optionsMap: Record<string, any[]> = {};
    questionsToDisplay.forEach(q => {
      if (q.options && q.options.length > 0) {
        if (settings?.shuffleOptions) {
          optionsMap[q.id] = [...q.options].sort(() => Math.random() - 0.5);
        } else {
          optionsMap[q.id] = [...q.options];
        }
      } else {
        optionsMap[q.id] = [];
      }
    });
    setShuffledOptionsMap(optionsMap);
    setHasInitialized(true);
  }, [questions, settings?.shuffleQuestions, settings?.shuffleOptions, hasInitialized]);

  // Get shuffled options for current question from the pre-computed map
  const shuffledOptions = displayQuestions[currentQuestionIndex] 
    ? (shuffledOptionsMap[displayQuestions[currentQuestionIndex].id] || displayQuestions[currentQuestionIndex].options || [])
    : [];

  const currentQuestion = displayQuestions[currentQuestionIndex];
  const isWaitingScreen = currentQuestionIndex === -1;
  // Only consider finished if questions have been initialized AND we've gone past all of them
  const isFinished = hasInitialized && displayQuestions.length > 0 && currentQuestionIndex >= displayQuestions.length;

  // Global timer for entire assessment
  useEffect(() => {
    if (timeLimitMins && quizStarted && !isFinished) {
      setGlobalTimeLeft(timeLimitMins * 60);
    }
  }, [timeLimitMins, quizStarted, isFinished]);

  useEffect(() => {
    if (globalTimeLeft !== null && globalTimeLeft > 0 && quizStarted && !isFinished) {
      const timer = setInterval(() => {
        setGlobalTimeLeft(prev => {
          if (prev === null || prev <= 1) {
            handleFinalSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [globalTimeLeft, quizStarted, isFinished]);

  // Tab switching detection
  useEffect(() => {
    if (!quizStarted || !settings?.trackTabSwitching) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setLastVisibilityChange(Date.now());
        setTabSwitches(prev => prev + 1);
        // Notify server that student went away (for teacher live view)
        try {
          const token = localStorage.getItem('accessToken');
          fetch(`/api/student_page/class/${classId}/assessment/${assessmentId}/live-session`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ action: 'away' })
          }).catch(err => console.error('Failed to notify away:', err));
        } catch (err) {
          console.error('Failed to send away notification', err);
        }
      } else {
        if (lastVisibilityChange) {
          const duration = Date.now() - lastVisibilityChange;
          setTabSwitchDurations(prev => [...prev, duration]);
          setLastVisibilityChange(null);
          // Notify server that student returned and include duration
          try {
            const token = localStorage.getItem('accessToken');
            fetch(`/api/student_page/class/${classId}/assessment/${assessmentId}/live-session`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ action: 'return', duration })
            }).catch(err => console.error('Failed to notify return:', err));
          } catch (err) {
            console.error('Failed to send return notification', err);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [quizStarted, lastVisibilityChange, settings?.trackTabSwitching]);

  // Prevent leaving if lockdown mode is enabled
  useEffect(() => {
    if (!quizStarted || !settings?.lockdown) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'You cannot leave this assessment once started. Your progress will be lost.';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [quizStarted, settings?.lockdown]);

  // Intercept in-app back navigation (browser back / SPA popstate) during lockdown
  useEffect(() => {
    if (!quizStarted || !settings?.lockdown) return;

    const onPopState = (e: PopStateEvent) => {
      e.preventDefault();
      // Show confirmation modal instead of immediately submitting
      if (!isSubmitting) {
        setShowExitConfirm(true);
      }
      // Re-push state so the user stays on the page until they confirm
      try { window.history.pushState(null, '', window.location.href); } catch {}
    };

    // Push a state so popstate will fire when user presses back
    try { window.history.pushState(null, '', window.location.href); } catch {}
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [quizStarted, settings?.lockdown, isSubmitting]);

  // Per-question timer (from StudentPreview)
  useEffect(() => {
    if (currentQuestion && !answerSubmitted && currentQuestion.timeLimit) {
      // Only set timer if question has a timeLimit
      setTimeLeft(currentQuestion.timeLimit);
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
    } else if (currentQuestion && !currentQuestion.timeLimit) {
      // No timer for this question
      setTimeLeft(0);
    }
  }, [currentQuestionIndex, answerSubmitted]);

  const handleTimeout = () => {
    // Per-question timeout - move to next question (answer may be empty)
    setAnswerSubmitted(true);
    nextQuestion();
  };

  const handleAnswer = async (optionId: string) => {
    if (answerSubmitted) return;
    setSelectedAnswer(optionId);
    
    // Save answer immediately - use the option text, not the ID
    if (currentQuestion) {
      // Find the actual option text from the option ID
      const selectedOption = shuffledOptions.find(opt => opt.id === optionId);
      const answerValue = selectedOption ? selectedOption.text : optionId;
      
      setAnswers(prev => ({
        ...prev,
        [currentQuestion.id]: answerValue
      }));
      
      // Send live progress update with the actual answer text
      if (onQuestionAnswer) {
        onQuestionAnswer(currentQuestion.id, answerValue).catch(err => 
          console.error('Failed to update live progress:', err)
        );
      }
    }
    
    // Auto-advance to next question
    setAnswerSubmitted(true);
    nextQuestion();
  };

  const nextQuestion = () => {
    setCurrentQuestionIndex(currentQuestionIndex + 1);
    setSelectedAnswer(null);
    setTypedAnswer('');
    setAnswerSubmitted(false);
  };

  const handleSubmitTypedAnswer = () => {
    if (!typedAnswer.trim()) return;
    
    // Save answer
    if (currentQuestion) {
      setAnswers(prev => ({
        ...prev,
        [currentQuestion.id]: typedAnswer
      }));
      
      // Send live progress update
      if (onQuestionAnswer) {
        onQuestionAnswer(currentQuestion.id, typedAnswer).catch(err => 
          console.error('Failed to update live progress:', err)
        );
      }
    }
    
    setAnswerSubmitted(true);
    nextQuestion();
  };

  const handleFinalSubmit = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    const timeSpent = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
    const totalAwayMs = tabSwitchDurations.reduce((s, v) => s + v, 0);
    
    try {
      await onSubmit(answers, {
        tabSwitches,
        tabSwitchDurations,
        timeSpent,
        // include startTime and totalAwayMs so server can make deadline decisions
        startTime: startTime ? new Date(startTime).toISOString() : undefined,
        totalAwayMs
      } as any);
      // After successful submit, navigate to results page for this assessment
      try {
        router.push(`/student_page/student_class/${classId}/assessment/${assessmentId}/results`);
      } catch (err) {
        // ignore navigation errors
      }
    } catch (error) {
      console.error('Error submitting assessment:', error);
      setIsSubmitting(false);
    }
  };

  // Handle confirm modal actions
  const confirmExitAndSubmit = () => {
    setShowExitConfirm(false);
    if (!isSubmitting) {
      handleFinalSubmit();
    }
  };

  const cancelExit = () => {
    setShowExitConfirm(false);
  };

  const startQuiz = () => {
    setCurrentQuestionIndex(0);
    setQuizStarted(true);
    setStartTime(Date.now());
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Waiting Screen
  if (isWaitingScreen) {
    return (
      <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900 z-50 flex items-center justify-center p-6">
        <div className="max-w-4xl w-full">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 mb-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-[#2E7D32] rounded-full mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{title}</h1>
              <p className="text-slate-600 dark:text-slate-400">
                {displayQuestions.length} {displayQuestions.length === 1 ? 'question' : 'questions'}
              </p>
            </div>
          </div>

          {settings?.lockdown && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-4">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <h3 className="font-semibold text-red-900 dark:text-red-300 mb-1">Lockdown Mode Enabled</h3>
                  <p className="text-sm text-red-700 dark:text-red-400">You cannot leave this assessment once started</p>
                </div>
              </div>
            </div>
          )}
          
          {settings?.trackTabSwitching && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <div>
                  <h3 className="font-semibold text-amber-900 dark:text-amber-300 mb-1">Tab Switching Monitored</h3>
                  <p className="text-sm text-amber-700 dark:text-amber-400">Leaving this tab will be tracked</p>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={startQuiz}
            className="w-full px-12 py-4 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl font-semibold text-lg shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Start Assessment</span>
          </button>

          <button
            onClick={() => router.back()}
            className="w-full mt-4 px-6 py-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-medium border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Go Back</span>
          </button>
        </div>
      </div>
    );
  }

  // Finished - Auto-submit when all questions are done
  if (isFinished) {
    // Auto-submit when finished
    if (!isSubmitting) {
      handleFinalSubmit();
    }
    
    return (
      <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900 z-50 flex items-center justify-center p-6">
        <div className="max-w-4xl w-full text-center">
          <div className="text-8xl mb-6">📝</div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-4">Submitting...</h1>
          <div className="text-xl text-slate-600 dark:text-slate-400">
            Please wait while we submit your answers
          </div>
        </div>
      </div>
    );
  }

  // Loading state - wait for questions to initialize
  if (!hasInitialized || !currentQuestion) {
    return (
      <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900 z-50 flex items-center justify-center p-6">
        <div className="max-w-4xl w-full text-center">
          <div className="text-6xl mb-6">⏳</div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Loading Questions...</h1>
          <div className="text-lg text-slate-600 dark:text-slate-400">
            Please wait while we prepare your assessment
          </div>
        </div>
      </div>
    );
  }

  // Question Screen (exact copy from StudentPreview)
  const OPTION_COLORS = [
    { bg: 'bg-red-500', hover: 'hover:bg-red-600', ring: 'ring-red-400', icon: '▲' },
    { bg: 'bg-blue-500', hover: 'hover:bg-blue-600', ring: 'ring-blue-400', icon: '◆' },
    { bg: 'bg-yellow-500', hover: 'hover:bg-yellow-600', ring: 'ring-yellow-400', icon: '●' },
    { bg: 'bg-green-500', hover: 'hover:bg-green-600', ring: 'ring-green-400', icon: '■' },
  ];

  return (
    <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900 z-50 overflow-auto">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="text-slate-900 dark:text-white font-semibold text-lg">
            Question {currentQuestionIndex + 1} of {displayQuestions.length}
          </div>
          {(settings?.showProgress ?? true) && (
            <div className="w-48 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#2E7D32] transition-all duration-300"
                style={{ width: `${((currentQuestionIndex + 1) / displayQuestions.length) * 100}%` }}
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
          {globalTimeLeft !== null && (
            <div className={`px-4 py-2 rounded-lg font-semibold text-base ${
              globalTimeLeft <= 60 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 animate-pulse' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
            }`}>
              <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatTime(globalTimeLeft)}
            </div>
          )}
          {/* Exit / Submit button */}
          {settings?.lockdown ? (
            <button
              onClick={() => { if (!isSubmitting) setShowExitConfirm(true); }}
              disabled={isSubmitting}
              className={`px-4 py-2 rounded-lg font-medium ${isSubmitting ? 'bg-gray-400 cursor-not-allowed text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}
            >
              {isSubmitting ? 'Submitting...' : 'Exit & Submit'}
            </button>
          ) : (
            <button
              onClick={() => router.back()}
              className="px-4 py-2 rounded-lg font-medium bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300"
            >
              Exit
            </button>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {/* Timer - only show if question has timeLimit */}
        {currentQuestion?.timeLimit && (
          <div className="flex justify-center mb-8">
            <div className={`relative w-32 h-32 ${timeLeft <= 5 ? 'animate-pulse' : ''}`}>
              <svg className="transform -rotate-90 w-32 h-32">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="12"
                  fill="none"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke={timeLeft <= 5 ? '#ef4444' : '#22c55e'}
                  strokeWidth="12"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 56}`}
                  strokeDashoffset={`${2 * Math.PI * 56 * (1 - timeLeft / (currentQuestion?.timeLimit || 1))}`}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-4xl font-black ${timeLeft <= 5 ? 'text-red-400' : 'text-white'}`}>
                  {timeLeft}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Question */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-8 mb-8 border border-slate-200 dark:border-slate-700 shadow-sm">
          {currentQuestion?.image && (
            <img
              src={currentQuestion.image}
              alt="Question"
              className="w-full h-64 object-cover rounded-lg mb-6"
            />
          )}
          <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 dark:text-white text-center leading-tight">
            {currentQuestion.title}
          </h2>
        </div>

        {/* Answer Options */}
        {currentQuestion.type === 'identification' ? (
          <div className="max-w-3xl mx-auto">
            <div className="bg-white dark:bg-white/10 backdrop-blur-lg rounded-3xl p-8 border-2 border-slate-200 dark:border-white/20 shadow-lg">
              <input
                type="text"
                value={typedAnswer}
                onChange={(e) => setTypedAnswer(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && typedAnswer.trim() && handleSubmitTypedAnswer()}
                disabled={answerSubmitted}
                placeholder="Type your answer here..."
                className="w-full px-6 py-6 bg-slate-100 dark:bg-white/20 backdrop-blur-sm text-slate-900 dark:text-white text-3xl font-bold placeholder-slate-400 dark:placeholder-white/50 focus:outline-none focus:ring-4 focus:ring-[#2E7D32]/50 dark:focus:ring-white/50 rounded-2xl border-2 border-slate-300 dark:border-white/30 text-center disabled:opacity-50"
                autoFocus
              />
              <button
                onClick={handleSubmitTypedAnswer}
                disabled={answerSubmitted || !typedAnswer.trim()}
                className="w-full mt-6 px-8 py-4 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-lg font-semibold text-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {answerSubmitted ? '✓ Submitted' : 'Submit Answer'}
              </button>
            </div>
          </div>
        ) : currentQuestion.type === 'paragraph' ? (
          <div className="max-w-3xl mx-auto">
            <div className="bg-white dark:bg-white/10 backdrop-blur-lg rounded-3xl p-8 border-2 border-slate-200 dark:border-white/20 shadow-lg">
              <textarea
                value={typedAnswer}
                onChange={(e) => setTypedAnswer(e.target.value)}
                disabled={answerSubmitted}
                placeholder="Type your essay answer here..."
                className="w-full px-6 py-6 bg-slate-100 dark:bg-white/20 backdrop-blur-sm text-slate-900 dark:text-white text-xl font-bold placeholder-slate-400 dark:placeholder-white/50 focus:outline-none focus:ring-4 focus:ring-[#2E7D32]/50 dark:focus:ring-white/50 rounded-2xl border-2 border-slate-300 dark:border-white/30 text-center min-h-[120px] disabled:opacity-50"
                rows={6}
                autoFocus
              />
              <button
                onClick={handleSubmitTypedAnswer}
                disabled={answerSubmitted || !typedAnswer.trim()}
                className="w-full mt-6 px-8 py-4 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-lg font-semibold text-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {answerSubmitted ? '✓ Submitted' : 'Submit Answer'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {shuffledOptions.map((option, idx) => {
              const colorConfig = OPTION_COLORS[idx] || OPTION_COLORS[0];
              const isSelected = selectedAnswer === option.id;
              // Handle case where option might be a string or an object
              const optionText = typeof option === 'string' 
                ? option 
                : (typeof option.text === 'string' ? option.text : `Answer ${idx + 1}`);
              const optionId = typeof option === 'string' ? `opt-${idx}` : option.id;

              return (
                <button
                  key={optionId}
                  onClick={() => !answerSubmitted && handleAnswer(optionId)}
                  disabled={answerSubmitted}
                  className={`
                    ${isSelected ? `ring-4 ${colorConfig.ring}` : ''} ${colorConfig.bg} ${!answerSubmitted && colorConfig.hover}
                    p-8 rounded-3xl text-white font-bold text-2xl shadow-2xl
                    transition-all transform hover:scale-105 disabled:cursor-not-allowed
                    flex items-center justify-center gap-4 min-h-[120px]
                  `}
                >
                  <span className="text-5xl">{colorConfig.icon}</span>
                  <span className="flex-1 text-center">{optionText}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Exit confirmation modal */}
        {showExitConfirm && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60">
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full">
              <h3 className="text-2xl font-bold mb-4">Confirm Submit & Exit</h3>
              <p className="text-sm text-slate-700 mb-6">Lockdown mode is enabled. Leaving will submit your current answers and end the attempt. Are you sure you want to submit and exit?</p>
              <div className="flex gap-4 justify-end">
                <button onClick={cancelExit} className="px-4 py-2 rounded-md bg-gray-200">Cancel</button>
                <button onClick={confirmExitAndSubmit} className="px-4 py-2 rounded-md bg-red-600 text-white">Submit & Exit</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
