"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from '@/hooks/useAuth';
import Alert from "@/components/molecules/alert_template/alert_template/Alert";
import LoadingTemplate2 from '@/components/molecules/loading_template_2/loading_template_2/loading2';
import QuestionPagination from '@/components/molecules/QuestionPagination';

interface Question {
  id: string;
  type: string;
  title: string;
  description?: string;
  options?: string[];
  points?: number;
  items?: string[];
  pairs?: { left: string; right?: string }[];
  src?: string;
  alt?: string;
  required?: boolean;
}

interface GradedAnswer {
  questionId: string;
  studentAnswer: string | string[] | { [key: string]: string } | null;
  correctAnswer?: string | string[] | { [key: string]: string };
  isCorrect: boolean;
  points: number;
  maxPoints: number;
  needsManualGrading?: boolean;
  isManuallyGraded?: boolean;
}

interface Submission {
  id: string;
  score: number;
  maxScore: number;
  status: string;
  submittedAt: string;
  timeSpent?: number;
  attemptNumber: number;
  needsManualGrading: boolean;
  gradedAt?: string;
  feedback?: string;
  gradedAnswers?: GradedAnswer[];
  summaryStats?: {
    correctCount: number;
    incorrectCount: number;
    totalQuestions: number;
  };
}

interface Assessment {
  id: string;
  title: string;
  totalPoints?: number;
  maxAttempts?: number;
  dueDate?: string;
  questions?: Question[];
  subject?: string;
  instructor?: string;
  allowReview?: boolean;
}

export default function AssessmentResultsPage({ 
  params 
}: { 
  params: Promise<{ studentclassId: string; assessmentId: string }> 
}) {
  const router = useRouter();
  const { user } = useAuth();
  
  const [studentclassId, setStudentclassId] = useState<string | null>(null);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);


  // Alert state
  const [alertState, setAlertState] = useState<{
    isVisible: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    title?: string;
    autoClose?: boolean;
    autoCloseDelay?: number;
  }>({ isVisible: false, type: 'info', message: '', autoClose: true, autoCloseDelay: 5000 });

  const showAlert = (opts: { type?: 'success' | 'error' | 'warning' | 'info'; message: string; title?: string; autoClose?: boolean; autoCloseDelay?: number; }) => {
    setAlertState({
      isVisible: true,
      type: opts.type ?? 'info',
      message: opts.message,
      title: opts.title,
      autoClose: opts.autoClose ?? true,
      autoCloseDelay: opts.autoCloseDelay ?? 5000,
    });
  };

  // Extract params
  useEffect(() => {
    const unwrap = async () => {
      const p = await params;
      setStudentclassId(p.studentclassId);
      setAssessmentId(p.assessmentId);
    };
    unwrap();
  }, [params]);

  const fetchResults = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/student_page/class/${studentclassId}/assessment/${assessmentId}/results`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to load results: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to load results');
      }

      console.log('Results data received:', result.data);
      console.log('Assessment questions:', result.data.assessment?.questions?.length || 0);
      
      setAssessment(result.data.assessment);
      setSubmissions(result.data.submissions || []);
      
      // Select the latest submission by default
      if (result.data.submissions && result.data.submissions.length > 0) {
        const firstSubmission = result.data.submissions[0];
        console.log('Selected submission details:', {
          id: firstSubmission.id,
          hasGradedAnswers: !!(firstSubmission.gradedAnswers && firstSubmission.gradedAnswers.length > 0),
          gradedAnswersCount: firstSubmission.gradedAnswers?.length || 0,
          score: firstSubmission.score
        });
        setSelectedSubmission(firstSubmission);
      }

    } catch (error) {
      console.error('Error fetching results:', error);
      setError(error instanceof Error ? error.message : 'Failed to load results');
    } finally {
      setLoading(false);
    }
  };

  // Fetch results when studentclassId or assessmentId changes
  useEffect(() => {
    if (!studentclassId || !assessmentId) return;
    fetchResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentclassId, assessmentId]);

  // Reset question index when submission changes
  useEffect(() => {
    setCurrentQuestionIndex(0);
  }, [selectedSubmission?.id]);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  };

  const formatTime = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const getScoreColor = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 90) return 'text-green-600 dark:text-green-400';
    if (percentage >= 80) return 'text-blue-600 dark:text-blue-400';
    if (percentage >= 70) return 'text-yellow-600 dark:text-yellow-400';
    if (percentage >= 60) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'graded':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'submitted':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'late':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const renderAnswer = (answer: string | string[] | { [key: string]: string } | null, question?: Question) => {
    if (answer === null || answer === undefined || answer === '') {
      return <span className="text-slate-400 italic">No answer provided</span>;
    }

    // Handle case where answer is an option object with {id, text, isCorrect}
    if (typeof answer === 'object' && !Array.isArray(answer) && 'text' in answer) {
      return <span className="font-medium">{(answer as any).text}</span>;
    }

    // Handle case where answer is an option ID (e.g., "opt-0") - look up the actual text
    if (typeof answer === 'string' && answer.startsWith('opt-') && question?.options) {
      const optionIndex = parseInt(answer.split('-')[1]);
      if (!isNaN(optionIndex) && question.options[optionIndex]) {
        const opt = question.options[optionIndex];
        // Handle if option is an object or string
        return <span className="font-medium">{typeof opt === 'object' ? (opt as any).text : opt}</span>;
      }
    }

    if (Array.isArray(answer)) {
      if (answer.length === 0) {
        return <span className="text-slate-400 italic">No options selected</span>;
      }
      return (
        <div className="space-y-1">
          {answer.map((item, index) => {
            // Handle option objects in arrays
            let displayText: string;
            if (typeof item === 'object' && item !== null && 'text' in item) {
              displayText = (item as any).text;
            } else if (typeof item === 'string' && item.startsWith('opt-') && question?.options) {
              const optionIndex = parseInt(item.split('-')[1]);
              if (!isNaN(optionIndex) && question.options[optionIndex]) {
                const opt = question.options[optionIndex];
                displayText = typeof opt === 'object' ? (opt as any).text : opt;
              } else {
                displayText = item;
              }
            } else {
              displayText = typeof item === 'string' ? item : String(item);
            }
            return (
              <div key={index} className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></span>
                <span>{displayText}</span>
              </div>
            );
          })}
        </div>
      );
    }

    if (typeof answer === 'object') {
      // Check if it's an option-like object with text property
      if ('text' in answer) {
        return <span className="font-medium">{(answer as any).text}</span>;
      }
      const entries = Object.entries(answer).filter(([, value]) => value && typeof value === 'string' && value.trim() !== '');
      if (entries.length === 0) {
        return <span className="text-slate-400 italic">No matches provided</span>;
      }
      return (
        <div className="space-y-2">
          {entries.map(([key, value]) => (
            <div key={key} className="flex items-center space-x-3 p-2 bg-white dark:bg-slate-800 rounded border">
              <span className="font-medium">{key}</span>
              <span className="text-slate-500">→</span>
              <span className="text-blue-600 dark:text-blue-400">{typeof value === 'string' ? value : String(value)}</span>
            </div>
          ))}
        </div>
      );
    }

    // Handle long text answers
    if (typeof answer === 'string' && answer.length > 100) {
      return (
        <div className="whitespace-pre-wrap break-words p-3 bg-white dark:bg-slate-800 rounded border">
          {answer}
        </div>
      );
    }

    return <span className="font-medium">{answer}</span>;
  };

  if (loading) {
    return <LoadingTemplate2 title="Loading results..." />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 dark:text-red-400 mb-2">Error loading results</div>
          <div className="text-slate-600 dark:text-slate-300 text-sm">{error}</div>
          <button
            onClick={fetchResults}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!assessment || submissions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="text-slate-600 dark:text-slate-300 mb-4">No results found</div>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-slate-500 text-white rounded-md hover:bg-slate-600"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Alert
        type={alertState.type}
        message={alertState.message}
        title={alertState.title}
        isVisible={alertState.isVisible}
        onClose={() => setAlertState(s => ({ ...s, isVisible: false }))}
        autoClose={alertState.autoClose}
        autoCloseDelay={alertState.autoCloseDelay}
        position="top-right"
      />

      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 transition-colors">
        <div className="max-w-6xl mx-auto">
          {/* Header Card */}
          <header className="mb-6 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="flex items-center justify-between gap-4 p-8">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-14 h-14 bg-gradient-to-br from-[#2E7D32] to-[#1B5E20] rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white">Assessment Results</h1>
                    <p className="text-slate-600 dark:text-slate-400 font-medium">{assessment.title}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {assessment.totalPoints && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg text-sm font-bold">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      {assessment.totalPoints} Points
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm font-bold">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {assessment.questions?.length || 0} Questions
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  if (studentclassId) {
                    router.push(`/student_page/student_class/${studentclassId}`);
                  } else {
                    router.back();
                  }
                }}
                className="px-5 py-3 bg-gradient-to-r from-[#2E7D32] to-[#1B5E20] hover:from-[#1B5E20] hover:to-[#0D4A14] text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Class
              </button>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Submissions List */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 shadow-xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white">Your Attempts</h2>
                </div>

                <div className="space-y-3">
                  {submissions.map((submission) => (
                    <div
                      key={submission.id}
                      onClick={() => setSelectedSubmission(submission)}
                      className={`p-4 rounded-2xl border-2 cursor-pointer transition-all transform hover:scale-[1.02] ${
                        selectedSubmission?.id === submission.id
                          ? 'border-[#2E7D32] bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 shadow-lg'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-slate-900 dark:text-white">
                          Attempt {submission.attemptNumber}
                        </span>
                        <span className={`px-3 py-1 text-xs font-bold rounded-full ${getStatusBadge(submission.status)}`}>
                          {submission.status}
                        </span>
                      </div>

                      <div className={`text-2xl font-black mb-1 ${getScoreColor(submission.score, submission.maxScore)}`}>
                        {((submission.score / submission.maxScore) * 100).toFixed(1)}%
                      </div>
                      
                      <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
                        {submission.score.toFixed(1)}/{submission.maxScore} points
                      </div>

                      <div className="flex items-center gap-2 mt-3 text-xs text-slate-500 dark:text-slate-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {formatDate(submission.submittedAt)}
                      </div>

                      {submission.timeSpent && (
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formatTime(submission.timeSpent)}
                        </div>
                      )}
                    </div>
                  ))}

                  {submissions.length === 0 && (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="text-slate-600 dark:text-slate-400 font-medium">No submissions yet</div>
                      <div className="text-sm text-slate-400 dark:text-slate-500 mt-1">Complete the assessment to see results</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Selected Submission Details */}
            <div className="lg:col-span-2">
              {selectedSubmission && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-6">
                  <div>
                    {/* Header with Trophy */}
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="text-5xl">
                          {((selectedSubmission.score / selectedSubmission.maxScore) * 100) >= 80 ? '🏆' : 
                           ((selectedSubmission.score / selectedSubmission.maxScore) * 100) >= 60 ? '🎉' : 
                           ((selectedSubmission.score / selectedSubmission.maxScore) * 100) >= 40 ? '👍' : '💪'}
                        </div>
                        <div>
                          <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                            Attempt {selectedSubmission.attemptNumber}
                          </h2>
                          <p className="text-slate-600 dark:text-slate-400 font-medium">
                            {((selectedSubmission.score / selectedSubmission.maxScore) * 100) >= 80 ? 'Outstanding!' : 
                             ((selectedSubmission.score / selectedSubmission.maxScore) * 100) >= 60 ? 'Great Job!' : 
                             ((selectedSubmission.score / selectedSubmission.maxScore) * 100) >= 40 ? 'Good Effort!' : 'Keep Practicing!'}
                          </p>
                        </div>
                      </div>
                      {/* Retake button if allowed */}
                      {assessment?.maxAttempts && submissions.length < assessment.maxAttempts && (
                        <button
                          onClick={() => {
                            if (studentclassId && assessment) {
                              router.push(`/student_page/student_class/${studentclassId}/exam/${assessment.id}`);
                            }
                          }}
                          className="px-5 py-3 bg-gradient-to-r from-[#2E7D32] to-[#1B5E20] hover:from-[#1B5E20] hover:to-[#0D4A14] text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Try Again ({submissions.length}/{assessment.maxAttempts})
                        </button>
                      )}
                    </div>

                    {/* Score Summary */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl p-5 border-2 border-emerald-200 dark:border-emerald-800 text-center">
                        <div className={`text-3xl font-black mb-1 ${getScoreColor(selectedSubmission.score, selectedSubmission.maxScore)}`}>
                          {((selectedSubmission.score / selectedSubmission.maxScore) * 100).toFixed(1)}%
                        </div>
                        <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
                          {selectedSubmission.score.toFixed(1)}/{selectedSubmission.maxScore} pts
                        </div>
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-500 mt-1">Score</div>
                      </div>
                      
                      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-2xl p-5 border-2 border-blue-200 dark:border-blue-800 text-center">
                        <div className="text-3xl font-black text-blue-600 dark:text-blue-400 mb-1 capitalize">
                          {selectedSubmission.status}
                        </div>
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-500">Status</div>
                      </div>
                      
                      <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-2xl p-5 border-2 border-amber-200 dark:border-amber-800 text-center">
                        <div className="text-3xl font-black text-amber-600 dark:text-amber-400 mb-1">
                          {formatTime(selectedSubmission.timeSpent)}
                        </div>
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-500">Time Spent</div>
                      </div>
                    </div>

                    {/* Feedback */}
                    {selectedSubmission.feedback && (
                      <div className="mb-6 p-5 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-2xl border-2 border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center">
                            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg>
                          </div>
                          <h3 className="font-bold text-blue-800 dark:text-blue-200 text-lg">Teacher Feedback</h3>
                        </div>
                        <p className="text-blue-700 dark:text-blue-300 p-3 bg-white/50 dark:bg-slate-800/50 rounded-xl">{selectedSubmission.feedback}</p>
                      </div>
                    )}

                    {/* Manual Grading Notice */}
                    {selectedSubmission.needsManualGrading && (
                      <div className="mb-6 p-5 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-2xl border-2 border-amber-200 dark:border-amber-800">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/40 rounded-xl flex items-center justify-center">
                            <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="font-bold text-amber-800 dark:text-amber-200">Pending Review</h3>
                            <p className="text-sm text-amber-700 dark:text-amber-300">
                              This assessment contains questions that require manual grading. Your final score may change after teacher review.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Question Review - Only show if allowReview is enabled */}
                  {assessment?.allowReview !== false ? (
                    <div className="space-y-6 mt-6">
                      <div className="flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700/50 dark:to-slate-700/30 rounded-2xl p-4 border border-slate-200 dark:border-slate-600">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#2E7D32] to-[#1B5E20] rounded-xl flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                          </svg>
                        </div>
                        <h3 className="text-xl font-black text-slate-800 dark:text-slate-200">Question Review</h3>
                      </div>
                      {selectedSubmission.gradedAnswers && selectedSubmission.gradedAnswers.length > 0 && (
                        <div className="px-4 py-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm">
                          <span className="text-sm font-bold text-[#2E7D32] dark:text-emerald-400">
                            Question {currentQuestionIndex + 1}
                          </span>
                          <span className="text-sm text-slate-500 dark:text-slate-400"> of {selectedSubmission.gradedAnswers.length}</span>
                        </div>
                      )}
                    </div>
                    
                    {selectedSubmission.gradedAnswers && selectedSubmission.gradedAnswers.length > 0 && assessment?.questions ? (
                      <>
                        {(() => {
                          const gradedAnswer = selectedSubmission.gradedAnswers[currentQuestionIndex];
                          const question = assessment?.questions?.find(q => q.id === gradedAnswer.questionId);
                          
                          if (!question) {
                            return (
                              <div className="text-center py-8">
                                <div className="text-slate-500 dark:text-slate-400">Question not found</div>
                              </div>
                            );
                          }

                          return (
                            <div className="bg-white dark:bg-slate-800/50 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
                              {/* Question Header */}
                              <div className="flex items-start justify-between mb-5">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <span className="inline-flex items-center justify-center w-8 h-8 bg-gradient-to-br from-[#2E7D32] to-[#1B5E20] text-white text-sm font-bold rounded-lg">
                                      {currentQuestionIndex + 1}
                                    </span>
                                    <h4 className="font-bold text-lg text-slate-800 dark:text-slate-200">
                                      Question {currentQuestionIndex + 1}
                                    </h4>
                                    {question.points && (
                                      <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-lg">
                                        {question.points} pts
                                      </span>
                                    )}
                                  </div>
                                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 text-xs font-semibold rounded-lg uppercase tracking-wide">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                    </svg>
                                    {question.type.replace('_', ' ').replace('-', ' ')}
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-3">
                                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold rounded-xl ${
                                    gradedAnswer.isCorrect 
                                      ? 'bg-gradient-to-r from-emerald-100 to-green-100 dark:from-emerald-900/40 dark:to-green-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                      : 'bg-gradient-to-r from-red-100 to-rose-100 dark:from-red-900/40 dark:to-rose-900/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                                  }`}>
                                    {gradedAnswer.isCorrect ? (
                                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    ) : (
                                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                      </svg>
                                    )}
                                    {gradedAnswer.isCorrect ? 'Correct' : 'Incorrect'}
                                  </span>
                                  
                                  <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-xl">
                                    {gradedAnswer.points}/{gradedAnswer.maxPoints} pts
                                  </span>
                                </div>
                              </div>

                              {/* Question Content */}
                              <div className="mb-5 p-5 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700/50 dark:to-slate-700/30 rounded-2xl border border-slate-200 dark:border-slate-600">
                                <div className="font-semibold text-lg text-slate-800 dark:text-slate-200 mb-3 leading-relaxed">
                                  {question.title}
                                </div>
                                
                                {question.description && (
                                  <div className="text-sm text-slate-600 dark:text-slate-400 mb-4 p-3 bg-white/50 dark:bg-slate-800/50 rounded-xl border border-slate-200/50 dark:border-slate-600/50">
                                    {question.description}
                                  </div>
                                )}

                                {/* Question-specific content */}
                                {question.type === 'image' && question.src && (
                                  <div className="mb-4">
                                    <img
                                      src={question.src}
                                      alt={question.alt || question.title}
                                      className="max-w-full h-auto rounded-xl shadow-md border border-slate-200 dark:border-slate-600"
                                    />
                                  </div>
                                )}

                                {(question.type === 'mcq' || question.type === 'checkboxes') && question.options && (
                                  <div className="space-y-2">
                                    <div className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-2">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                      </svg>
                                      Options:
                                    </div>
                                    {question.options.map((option, optIndex) => {
                                      // Handle option being either a string or an object with text property
                                      const optionText = typeof option === 'string' ? option : (option as any)?.text || `Option ${optIndex + 1}`;
                                      return (
                                        <div key={optIndex} className="flex items-center gap-3 p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600">
                                          <span className="w-7 h-7 bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-400">
                                            {String.fromCharCode(65 + optIndex)}
                                          </span>
                                          <span className="text-sm text-slate-700 dark:text-slate-300">{optionText}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}

                                {question.type === 'match' && question.pairs && (
                                  <div className="space-y-2">
                                    <div className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-2">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                      </svg>
                                      Match the following:
                                    </div>
                                    {question.pairs.map((pair, pairIndex) => (
                                      <div key={pairIndex} className="flex items-center gap-3 p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-600">
                                        <span className="font-medium text-slate-700 dark:text-slate-300">{pair.left}</span>
                                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                        </svg>
                                        <span className="text-blue-600 dark:text-blue-400 font-medium">{pair.right || '___'}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {question.type === 'enumeration' && question.items && (
                                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 p-3 bg-white/50 dark:bg-slate-800/50 rounded-xl">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                    Expected items: <span className="font-bold">{question.items.length}</span>
                                  </div>
                                )}
                              </div>

                              {/* Answer Section */}
                              <div className="space-y-4">
                                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-2xl p-4 border-2 border-blue-200 dark:border-blue-800">
                                  <div className="flex items-center gap-2 mb-3">
                                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center">
                                      <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                      </svg>
                                    </div>
                                    <span className="text-sm font-bold text-blue-700 dark:text-blue-300">Your Answer</span>
                                  </div>
                                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl text-slate-800 dark:text-slate-200 border border-blue-100 dark:border-blue-900">
                                    {renderAnswer(gradedAnswer.studentAnswer, question)}
                                  </div>
                                </div>

                                {gradedAnswer.correctAnswer && !gradedAnswer.needsManualGrading && (
                                  <div className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-900/20 dark:to-green-900/20 rounded-2xl p-4 border-2 border-emerald-200 dark:border-emerald-800">
                                    <div className="flex items-center gap-2 mb-3">
                                      <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg flex items-center justify-center">
                                        <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      </div>
                                      <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Correct Answer</span>
                                    </div>
                                    <div className="p-3 bg-white dark:bg-slate-800 rounded-xl text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900">
                                      {renderAnswer(gradedAnswer.correctAnswer, question)}
                                    </div>
                                  </div>
                                )}

                                {gradedAnswer.needsManualGrading && !gradedAnswer.isManuallyGraded && (
                                  <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-2xl p-4 border-2 border-amber-200 dark:border-amber-800">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/40 rounded-xl flex items-center justify-center">
                                        <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                      </div>
                                      <div>
                                        <div className="font-bold text-amber-800 dark:text-amber-300">Pending Review</div>
                                        <div className="text-sm text-amber-700 dark:text-amber-400">
                                          This question is being reviewed by your teacher. Score may change after grading.
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {gradedAnswer.needsManualGrading && gradedAnswer.isManuallyGraded && (
                                  <div className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 rounded-2xl p-4 border-2 border-purple-200 dark:border-purple-800">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/40 rounded-xl flex items-center justify-center">
                                        <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                      </div>
                                      <div>
                                        <div className="font-bold text-purple-800 dark:text-purple-300">Teacher&apos;s Grade</div>
                                        <div className="text-lg font-black text-purple-600 dark:text-purple-400">
                                          {gradedAnswer.points}/{gradedAnswer.maxPoints} points
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Navigation */}
                        <div className="flex justify-center pt-6 mt-6 border-t-2 border-slate-200 dark:border-slate-700">
                          <QuestionPagination
                            currentQuestion={currentQuestionIndex + 1}
                            totalQuestions={selectedSubmission.gradedAnswers.length}
                            onNavigate={setCurrentQuestionIndex}
                          />
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="text-lg font-bold text-slate-600 dark:text-slate-400 mb-2">No detailed results available</div>
                        <div className="text-sm text-slate-400 dark:text-slate-500">
                          Your answers are being processed or this assessment requires manual grading.
                        </div>
                      </div>
                    )}
                    </div>
                  ) : (
                    /* Summary View - When review is not allowed */
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 border border-slate-200 dark:border-slate-700">
                      <div>
                        {/* Trophy/Emoji based on score */}
                        <div className="text-center mb-6">
                          <div className="text-7xl mb-4 animate-bounce">
                            {((selectedSubmission.score / selectedSubmission.maxScore) * 100) >= 80 ? '🏆' : 
                             ((selectedSubmission.score / selectedSubmission.maxScore) * 100) >= 60 ? '🎉' : 
                             ((selectedSubmission.score / selectedSubmission.maxScore) * 100) >= 40 ? '👍' : '💪'}
                          </div>
                          <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2">
                            {((selectedSubmission.score / selectedSubmission.maxScore) * 100) >= 80 ? 'Outstanding!' : 
                             ((selectedSubmission.score / selectedSubmission.maxScore) * 100) >= 60 ? 'Great Job!' : 
                             ((selectedSubmission.score / selectedSubmission.maxScore) * 100) >= 40 ? 'Good Effort!' : 'Keep Practicing!'}
                          </h2>
                          <p className="text-slate-600 dark:text-slate-400">Your submission has been recorded</p>
                        </div>

                        {/* Score Badge */}
                        <div className="flex justify-center mb-8">
                          <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-amber-400 to-yellow-400 dark:from-amber-600 dark:to-yellow-600 rounded-2xl shadow-lg">
                            <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            <span className="text-3xl font-black text-white">{selectedSubmission.score.toFixed(1)}</span>
                            <span className="text-lg font-semibold text-white/90">/ {selectedSubmission.maxScore} pts</span>
                          </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-3 gap-4 mb-8">
                          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-2xl p-5 border-2 border-emerald-200 dark:border-emerald-800 text-center">
                            <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center mx-auto mb-3">
                              <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mb-1">
                              {selectedSubmission.summaryStats?.correctCount ?? 0}
                            </div>
                            <div className="text-sm font-semibold text-slate-600 dark:text-slate-400">Correct</div>
                          </div>
                          
                          <div className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 rounded-2xl p-5 border-2 border-red-200 dark:border-red-800 text-center">
                            <div className="w-12 h-12 bg-red-100 dark:bg-red-900/40 rounded-xl flex items-center justify-center mx-auto mb-3">
                              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <div className="text-3xl font-black text-red-600 dark:text-red-400 mb-1">
                              {selectedSubmission.summaryStats?.incorrectCount ?? 0}
                            </div>
                            <div className="text-sm font-semibold text-slate-600 dark:text-slate-400">Incorrect</div>
                          </div>
                          
                          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-2xl p-5 border-2 border-blue-200 dark:border-blue-800 text-center">
                            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center mx-auto mb-3">
                              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div className="text-3xl font-black text-blue-600 dark:text-blue-400 mb-1">
                              {selectedSubmission.summaryStats?.totalQuestions ?? 0}
                            </div>
                            <div className="text-sm font-semibold text-slate-600 dark:text-slate-400">Questions</div>
                          </div>
                        </div>

                        {/* Accuracy Progress Bar */}
                        <div className="bg-white dark:bg-slate-700/50 rounded-2xl p-6 border-2 border-slate-200 dark:border-slate-600 mb-6">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-bold text-slate-700 dark:text-slate-300">Accuracy</span>
                            <span className="text-2xl font-black text-[#2E7D32] dark:text-emerald-400">
                              {((selectedSubmission.score / selectedSubmission.maxScore) * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="h-4 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-[#2E7D32] via-[#4CAF50] to-[#66BB6A] rounded-full transition-all duration-1000 ease-out"
                              style={{ width: `${(selectedSubmission.score / selectedSubmission.maxScore) * 100}%` }}
                            />
                          </div>
                        </div>

                        {/* Info Message */}
                        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-2xl p-5">
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 w-12 h-12 bg-amber-100 dark:bg-amber-900/40 rounded-xl flex items-center justify-center">
                              <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <h3 className="font-bold text-amber-900 dark:text-amber-300 text-lg mb-1">Review Not Available</h3>
                              <p className="text-sm text-amber-700 dark:text-amber-400">
                                Your teacher has disabled answer review for this assessment. Contact your teacher if you have questions about your results.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}