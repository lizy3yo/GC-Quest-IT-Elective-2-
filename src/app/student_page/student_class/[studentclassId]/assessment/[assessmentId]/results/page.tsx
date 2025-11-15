"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from '@/hooks/useAuth';
import Alert from "@/components/molecules/alert_template/Alert";
import LoadingTemplate2 from '@/components/atoms/loading_template_2/loading2';

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
}

interface Assessment {
  id: string;
  title: string;
  totalPoints?: number;
  dueDate?: string;
  questions?: Question[];
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

  // Fetch results
  useEffect(() => {
    if (!studentclassId || !assessmentId) return;
    fetchResults();
  }, [studentclassId, assessmentId]);

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

  const formatTime = (minutes?: number) => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
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

  const renderAnswer = (answer: string | string[] | { [key: string]: string } | null) => {
    if (answer === null || answer === undefined || answer === '') {
      return <span className="text-slate-400 italic">No answer provided</span>;
    }

    if (Array.isArray(answer)) {
      if (answer.length === 0) {
        return <span className="text-slate-400 italic">No options selected</span>;
      }
      return (
        <div className="space-y-1">
          {answer.map((item, index) => (
            <div key={index} className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      );
    }

    if (typeof answer === 'object') {
      const entries = Object.entries(answer).filter(([, value]) => value && value.trim() !== '');
      if (entries.length === 0) {
        return <span className="text-slate-400 italic">No matches provided</span>;
      }
      return (
        <div className="space-y-2">
          {entries.map(([key, value]) => (
            <div key={key} className="flex items-center space-x-3 p-2 bg-white dark:bg-slate-800 rounded border">
              <span className="font-medium">{key}</span>
              <span className="text-slate-500">→</span>
              <span className="text-blue-600 dark:text-blue-400">{value}</span>
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
          {/* Header banner - mirror student class style for visual consistency */}
          <header className="mb-6 rounded-lg bg-[#1C2B1C] text-white shadow-sm">
            <div className="flex items-center justify-between gap-4 p-6">
              <div className="min-w-0">
                <h1 className="text-2xl font-normal text-white truncate">Assessment Results</h1>
                <div className="mt-1 text-sm text-white/90 truncate">{assessment.title}</div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    if (studentclassId) {
                      router.push(`/student_page/student_class/${studentclassId}`);
                    } else {
                      router.back();
                    }
                  }}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded hover:bg-slate-100 dark:hover:bg-slate-600 text-sm"
                >
                  ← Back to Class
                </button>
              </div>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Submissions List */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-6">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">
                  Your Submissions
                </h2>

                <div className="space-y-3">
                  {submissions.map((submission) => (
                    <div
                      key={submission.id}
                      onClick={() => setSelectedSubmission(submission)}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                        selectedSubmission?.id === submission.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                          Attempt {submission.attemptNumber}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadge(submission.status)}`}>
                          {submission.status}
                        </span>
                      </div>

                      <div className={`text-lg font-bold ${getScoreColor(submission.score, submission.maxScore)}`}>
                        {submission.score.toFixed(1)}%
                      </div>

                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {formatDate(submission.submittedAt)}
                      </div>

                      {submission.timeSpent && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Time: {formatTime(submission.timeSpent)}
                        </div>
                      )}
                    </div>
                  ))}

                  {submissions.length === 0 && (
                    <div className="text-center py-8">
                      <div className="text-slate-500 dark:text-slate-400">No submissions yet</div>
                      <div className="text-sm text-slate-400 dark:text-slate-500 mt-2">You'll see your submissions here after you attempt the assessment.</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Selected Submission Details */}
            <div className="lg:col-span-2">
              {selectedSubmission && (
                <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-6">
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                      Attempt {selectedSubmission.attemptNumber} Details
                    </h2>
                  </div>

                  {/* Score Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center p-4 bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-100 dark:border-slate-700">
                      <div className={`text-2xl font-bold ${getScoreColor(selectedSubmission.score, selectedSubmission.maxScore)}`}>
                        {selectedSubmission.score.toFixed(1)}%
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">Score</div>
                    </div>
                    
                    <div className="text-center p-4 bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-100 dark:border-slate-700">
                      <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                        {selectedSubmission.status}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">Status</div>
                    </div>
                    
                    <div className="text-center p-4 bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-100 dark:border-slate-700">
                      <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                        {formatTime(selectedSubmission.timeSpent)}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">Time Spent</div>
                    </div>
                    
                    <div className="text-center p-4 bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-100 dark:border-slate-700">
                      <div className="text-2xl font-bold text-slate-800 dark:text-slate-200">
                        {formatDate(selectedSubmission.submittedAt).split(',')[0]}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400">Submitted</div>
                    </div>
                  </div>

                  {/* Feedback */}
                  {selectedSubmission.feedback && (
                    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-900/30">
                      <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Teacher Feedback</h3>
                      <p className="text-blue-700 dark:text-blue-300">{selectedSubmission.feedback}</p>
                    </div>
                  )}

                  {/* Manual Grading Notice */}
                  {selectedSubmission.needsManualGrading && (
                    <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-100 dark:border-yellow-900/30">
                      <h3 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Pending Review</h3>
                      <p className="text-yellow-700 dark:text-yellow-300">
                        This assessment contains questions that require manual grading. Your final score may change after teacher review.
                      </p>
                    </div>
                  )}

                  {/* Question Review */}
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Question Review</h3>
                    
                    {selectedSubmission.gradedAnswers && selectedSubmission.gradedAnswers.length > 0 && assessment?.questions ? (
                        selectedSubmission.gradedAnswers.map((gradedAnswer, index) => {
                        // Find the corresponding question
                        const question = assessment?.questions?.find(q => q.id === gradedAnswer.questionId);
                        if (!question) return null;

                        return (
                          <div key={gradedAnswer.questionId} className="border border-slate-200 dark:border-slate-700 rounded-lg p-6">
                            {/* Question Header */}
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex-1">
                                <h4 className="font-medium text-slate-800 dark:text-slate-200 mb-1">
                                  Question {index + 1}
                                  {question.points && <span className="text-sm text-slate-500 ml-2">({question.points} pts)</span>}
                                </h4>
                                <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                  {question.type.replace('_', ' ')}
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  gradedAnswer.isCorrect 
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                }`}>
                                  {gradedAnswer.isCorrect ? 'Correct' : 'Incorrect'}
                                </span>
                                
                                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                  {gradedAnswer.points}/{gradedAnswer.maxPoints} pts
                                </span>
                              </div>
                            </div>

                            {/* Question Content */}
                            <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
                              <div className="font-medium text-slate-800 dark:text-slate-200 mb-2">
                                {question.title}
                              </div>
                              
                              {question.description && (
                                <div className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                                  {question.description}
                                </div>
                              )}

                              {/* Question-specific content */}
                              {question.type === 'image' && question.src && (
                                <div className="mb-3">
                                  <img
                                    src={question.src}
                                    alt={question.alt || question.title}
                                    className="max-w-full h-auto rounded-lg shadow-sm"
                                  />
                                </div>
                              )}

                              {(question.type === 'mcq' || question.type === 'checkboxes') && question.options && (
                                <div className="space-y-1">
                                  <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Options:</div>
                                  {question.options.map((option, optIndex) => (
                                    <div key={optIndex} className="text-sm text-slate-700 dark:text-slate-300">
                                      {String.fromCharCode(65 + optIndex)}. {option}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {question.type === 'match' && question.pairs && (
                                <div className="space-y-1">
                                  <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">Match the following:</div>
                                  {question.pairs.map((pair, pairIndex) => (
                                    <div key={pairIndex} className="text-sm text-slate-700 dark:text-slate-300">
                                      {pair.left} → {pair.right || '___'}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {question.type === 'enumeration' && question.items && (
                                <div className="text-sm text-slate-600 dark:text-slate-400">
                                  Expected items: {question.items.length}
                                </div>
                              )}
                            </div>

                            {/* Answer Section */}
                            <div className="space-y-3">
                              <div>
                                <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Your Answer:</span>
                                <div className="mt-1 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-slate-800 dark:text-slate-200">
                                  {renderAnswer(gradedAnswer.studentAnswer)}
                                </div>
                              </div>

                              {gradedAnswer.correctAnswer && !gradedAnswer.needsManualGrading && (
                                <div>
                                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Correct Answer:</span>
                                  <div className="mt-1 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-300">
                                    {renderAnswer(gradedAnswer.correctAnswer)}
                                  </div>
                                </div>
                              )}

                              {gradedAnswer.needsManualGrading && !gradedAnswer.isManuallyGraded && (
                                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                  <div className="text-sm text-yellow-600 dark:text-yellow-400 italic">
                                    This question is being reviewed by your teacher. Score may change after grading.
                                  </div>
                                </div>
                              )}

                              {gradedAnswer.needsManualGrading && gradedAnswer.isManuallyGraded && (
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                  <div className="text-sm text-blue-600 dark:text-blue-400">
                                    <strong>Teacher's Grade:</strong> {gradedAnswer.points}/{gradedAnswer.maxPoints} points
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })) : (
                        <div className="text-center py-8">
                          <div className="text-slate-500 dark:text-slate-400 mb-2">No detailed results available</div>
                          <div className="text-sm text-slate-400 dark:text-slate-500">
                            Your answers are being processed or this assessment requires manual grading.
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}