"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type MultipleChoiceQuestion = {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: string;
  topic: string;
  points: number;
};

type WrittenQuestion = {
  question: string;
  expectedAnswer: string;
  rubric: string[];
  difficulty: string;
  topic: string;
  points: number;
};

type PracticeTest = {
  _id?: string;
  title: string;
  description: string;
  subject: string;
  difficulty: string;
  timeLimit: number;
  totalPoints: number;
  multipleChoiceQuestions: MultipleChoiceQuestion[];
  writtenQuestions: WrittenQuestion[];
  topics: string[];
  learningObjectives: string[];
  instructions: string;
};

type Answer = {
  questionIndex: number;
  questionType: 'multiple-choice' | 'written';
  selectedAnswer?: number;
  writtenAnswer?: string;
  timeSpent: number;
};

// Kahoot-style option colors
const OPTION_COLORS = [
  { bg: 'bg-red-500', hover: 'hover:bg-red-600', ring: 'ring-red-400', icon: '▲' },
  { bg: 'bg-blue-500', hover: 'hover:bg-blue-600', ring: 'ring-blue-400', icon: '◆' },
  { bg: 'bg-yellow-500', hover: 'hover:bg-yellow-600', ring: 'ring-yellow-400', icon: '●' },
  { bg: 'bg-green-500', hover: 'hover:bg-green-600', ring: 'ring-green-400', icon: '■' },
];

export default function TakeTestPage() {
  const router = useRouter();
  const [practiceTest, setPracticeTest] = useState<PracticeTest | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1); // -1 = start screen
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Combined questions array for easier navigation
  const [allQuestions, setAllQuestions] = useState<Array<{
    type: 'multiple-choice' | 'written';
    question: MultipleChoiceQuestion | WrittenQuestion;
    originalIndex: number;
  }>>([]);

  useEffect(() => {
    // Load test from session storage
    const testData = sessionStorage.getItem('current_practice_test');
    if (!testData) {
      alert('No practice test found. Please start a test from the practice tests page.');
      router.push('/student_page/practice_tests');
      return;
    }

    try {
      const test = JSON.parse(testData) as PracticeTest;
      
      // Validate and set defaults
      if (!test.multipleChoiceQuestions) test.multipleChoiceQuestions = [];
      if (!test.writtenQuestions) test.writtenQuestions = [];

      test.multipleChoiceQuestions = test.multipleChoiceQuestions.map(q => ({
        ...q,
        points: q.points || 0,
        options: q.options || [],
        difficulty: q.difficulty || 'medium',
        topic: q.topic || ''
      }));

      test.writtenQuestions = test.writtenQuestions.map(q => ({
        ...q,
        points: q.points || 0,
        difficulty: q.difficulty || 'medium',
        topic: q.topic || '',
        rubric: q.rubric || []
      }));

      const totalQuestionsCount = test.multipleChoiceQuestions.length + test.writtenQuestions.length;
      if (totalQuestionsCount === 0) {
        alert('This practice test has no questions. Please generate a test first.');
        router.push('/student_page/practice_tests');
        return;
      }
      
      setPracticeTest(test);
      setTimeRemaining(test.timeLimit * 60);

      // Build combined questions array
      const combined: typeof allQuestions = [];
      test.multipleChoiceQuestions.forEach((q, idx) => {
        combined.push({ type: 'multiple-choice', question: q, originalIndex: idx });
      });
      test.writtenQuestions.forEach((q, idx) => {
        combined.push({ type: 'written', question: q, originalIndex: idx });
      });
      setAllQuestions(combined);

      // Get userId
      const uid = localStorage.getItem('userId') || `temp-user-${Date.now()}`;
      setUserId(uid);

      // Initialize answers array
      const initialAnswers: Answer[] = combined.map((_, idx) => ({
        questionIndex: idx,
        questionType: idx < test.multipleChoiceQuestions.length ? 'multiple-choice' : 'written',
        timeSpent: 0
      }));
      setAnswers(initialAnswers);

    } catch (error) {
      console.error('Failed to load practice test:', error);
      alert('Failed to load practice test. Please try again.');
      router.push('/student_page/practice_tests');
    }
  }, [router]);

  // Timer countdown - only when test has started
  useEffect(() => {
    if (!practiceTest || timeRemaining <= 0 || currentQuestionIndex < 0) return;

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [practiceTest, timeRemaining, currentQuestionIndex]);

  const handleAutoSubmit = () => {
    handleSubmit();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startTest = () => {
    setCurrentQuestionIndex(0);
    setStartTime(Date.now());
    setQuestionStartTime(Date.now());
  };

  const updateTimeSpent = () => {
    const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);
    setAnswers(prev => {
      const updated = [...prev];
      if (updated[currentQuestionIndex]) {
        updated[currentQuestionIndex].timeSpent += timeSpent;
      }
      return updated;
    });
    setQuestionStartTime(Date.now());
  };

  const handleMultipleChoiceAnswer = (optionIndex: number) => {
    if (answerSubmitted) return;
    
    updateTimeSpent();
    setAnswers(prev => {
      const updated = [...prev];
      updated[currentQuestionIndex] = {
        ...updated[currentQuestionIndex],
        selectedAnswer: optionIndex
      };
      return updated;
    });
    
    setAnswerSubmitted(true);
    
    // Auto-advance after short delay
    setTimeout(() => {
      nextQuestion();
    }, 500);
  };

  const handleWrittenSubmit = () => {
    if (answerSubmitted || !typedAnswer.trim()) return;
    
    updateTimeSpent();
    setAnswers(prev => {
      const updated = [...prev];
      updated[currentQuestionIndex] = {
        ...updated[currentQuestionIndex],
        writtenAnswer: typedAnswer
      };
      return updated;
    });
    
    setAnswerSubmitted(true);
    
    setTimeout(() => {
      nextQuestion();
    }, 500);
  };

  const nextQuestion = () => {
    if (currentQuestionIndex >= allQuestions.length - 1) {
      // Last question - auto submit
      handleSubmit();
      return;
    }
    
    setCurrentQuestionIndex(prev => prev + 1);
    setAnswerSubmitted(false);
    setTypedAnswer('');
    setQuestionStartTime(Date.now());
  };

  const handleSubmit = async () => {
    if (!practiceTest || !userId || isSubmitting) return;
    
    updateTimeSpent();
    setIsSubmitting(true);

    try {
      const totalTimeSpent = startTime ? Math.floor((Date.now() - startTime) / 1000) : (practiceTest.timeLimit * 60) - timeRemaining;

      const response = await fetch('/api/student_page/practice-test/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          practiceTestId: practiceTest._id || 'temp',
          practiceTest,
          answers,
          timeSpent: totalTimeSpent
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit');
      }

      // Mark practice test as completed
      try {
        await fetch(`/api/student_page/practice-test/${practiceTest._id}?userId=${userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isRead: true })
        });
        
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const bc = new BroadcastChannel('notewise.library.updates');
          bc.postMessage({ type: 'practice_test', id: practiceTest._id, isRead: true });
          bc.close();
        }
        localStorage.setItem('notewise.library.lastUpdate', JSON.stringify({ type: 'practice_test', id: practiceTest._id, isRead: true }));
      } catch (e) { /* ignore */ }

      sessionStorage.setItem('last_submission_id', data.submission._id);
      sessionStorage.removeItem('current_practice_test');
      router.push('/student_page/practice_tests/results');

    } catch (error: any) {
      alert(error.message || 'Failed to submit test');
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (!practiceTest) {
    return (
      <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900 z-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#2E7D32] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading practice test...</p>
        </div>
      </div>
    );
  }

  const totalQuestions = allQuestions.length;
  const currentQ = allQuestions[currentQuestionIndex];
  const isStartScreen = currentQuestionIndex === -1;
  const isFinished = currentQuestionIndex >= totalQuestions;

  // Start Screen
  if (isStartScreen) {
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
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{practiceTest.title}</h1>
              <p className="text-slate-600 dark:text-slate-400 mb-4">{practiceTest.description}</p>
              <div className="flex items-center justify-center gap-4 text-sm">
                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-full">
                  {totalQuestions} questions
                </span>
                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-full">
                  {practiceTest.timeLimit} minutes
                </span>
                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-full capitalize">
                  {practiceTest.difficulty}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="font-semibold text-amber-900 dark:text-amber-300 mb-1">Timed Test</h3>
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  You have {practiceTest.timeLimit} minutes to complete this test. The timer will start when you click "Start Test".
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={startTest}
            className="w-full px-12 py-4 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl font-semibold text-lg shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Start Test</span>
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

  // Submitting screen
  if (isFinished || isSubmitting) {
    return (
      <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900 z-50 flex items-center justify-center p-6">
        <div className="max-w-4xl w-full text-center">
          <div className="w-16 h-16 border-4 border-[#2E7D32] border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Submitting...</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Please wait while we submit your answers
          </p>
        </div>
      </div>
    );
  }

  // Question Screen - Kahoot style
  return (
    <div className="fixed inset-0 bg-slate-50 dark:bg-slate-900 z-50 overflow-auto">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="text-slate-900 dark:text-white font-semibold text-lg">
            Question {currentQuestionIndex + 1} of {totalQuestions}
          </div>
          <div className="w-48 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#2E7D32] transition-all duration-300"
              style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className={`px-4 py-2 rounded-lg font-semibold text-base ${
            timeRemaining <= 60 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 animate-pulse' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
          }`}>
            <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {formatTime(timeRemaining)}
          </div>
          <button
            onClick={() => setShowExitConfirm(true)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors"
          >
            Exit & Submit
          </button>
        </div>
      </div>

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Exit Test?</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-2">
              You have answered {answers.filter(a => a.selectedAnswer !== undefined || (a.writtenAnswer && a.writtenAnswer.trim())).length} out of {totalQuestions} questions.
            </p>
            <p className="text-amber-600 dark:text-amber-400 text-sm mb-6">
              Your current progress will be submitted and you will see your results.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Continue Test
              </button>
              <button
                onClick={() => { setShowExitConfirm(false); handleSubmit(); }}
                disabled={isSubmitting}
                className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : 'Submit & Exit'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto p-6">
        {/* Question */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-8 mb-8 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              currentQ.type === 'multiple-choice' 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
            }`}>
              {currentQ.type === 'multiple-choice' ? 'Multiple Choice' : 'Written Response'}
            </span>
            <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-400">
              {currentQ.question.points} pts
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-semibold text-slate-900 dark:text-white text-center leading-tight">
            {currentQ.question.question}
          </h2>
        </div>

        {/* Answer Options */}
        {currentQ.type === 'multiple-choice' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(currentQ.question as MultipleChoiceQuestion).options.map((option, idx) => {
              const colorConfig = OPTION_COLORS[idx] || OPTION_COLORS[0];
              const isSelected = answers[currentQuestionIndex]?.selectedAnswer === idx;

              return (
                <button
                  key={idx}
                  onClick={() => handleMultipleChoiceAnswer(idx)}
                  disabled={answerSubmitted}
                  className={`
                    ${isSelected ? `ring-4 ${colorConfig.ring}` : ''} 
                    ${colorConfig.bg} ${!answerSubmitted && colorConfig.hover}
                    p-8 rounded-3xl text-white font-bold text-2xl shadow-2xl
                    transition-all transform hover:scale-105 disabled:cursor-not-allowed
                    flex items-center justify-center gap-4 min-h-[120px]
                  `}
                >
                  <span className="text-5xl">{colorConfig.icon}</span>
                  <span className="flex-1 text-center">{option}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 border-2 border-slate-200 dark:border-slate-700 shadow-lg">
              <textarea
                value={typedAnswer}
                onChange={(e) => setTypedAnswer(e.target.value)}
                disabled={answerSubmitted}
                placeholder="Type your answer here..."
                className="w-full px-6 py-6 bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white text-xl font-medium placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-4 focus:ring-[#2E7D32]/50 rounded-2xl border-2 border-slate-300 dark:border-slate-600 disabled:opacity-50 min-h-[200px] resize-none"
                autoFocus
              />
              <button
                onClick={handleWrittenSubmit}
                disabled={answerSubmitted || !typedAnswer.trim()}
                className="w-full mt-6 px-8 py-4 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl font-semibold text-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {answerSubmitted ? '✓ Submitted' : 'Submit Answer'}
              </button>
            </div>
          </div>
        )}

        {/* Feedback Message */}
        {answerSubmitted && (
          <div className="mt-8 text-center">
            <div className="inline-block px-8 py-4 rounded-2xl text-white font-bold text-2xl bg-blue-500">
              ✓ Answer Submitted
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
