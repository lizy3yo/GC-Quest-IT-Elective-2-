"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAlert } from "@/hooks/useAlert";

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
  _id: string;
  studentId: string;
  studentName?: string;
  score: number;
  maxScore: number;
  submittedAt: string;
  timeTaken?: number;
  status?: string;
  gradedAnswers?: GradedAnswer[];
  tabSwitches?: number;
  tabSwitchDurations?: number[];
  totalAwayMs?: number;
}

interface Quiz {
  _id: string;
  title: string;
  questions?: any[];
  totalPoints?: number;
}

export default function QuizStudentSubmissionPage() {
  const router = useRouter();
  const params = useParams();
  const quizId = params?.quizId as string;
  const studentId = params?.studentId as string;
  const { showError, showSuccess } = useAlert();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [questionGrades, setQuestionGrades] = useState<Record<string, number>>({});
  const [savingQuestions, setSavingQuestions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    console.log('🎯 NEW ROUTE - Quiz Student Submission Page loaded', { quizId, studentId });
    if (quizId && studentId) {
      loadQuizAndSubmission();
    }
  }, [quizId, studentId]);

  const loadQuizAndSubmission = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');

      // Load quiz details
      const quizRes = await fetch(`/api/teacher_page/assessment/${quizId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!quizRes.ok) throw new Error("Failed to load quiz");
      const quizData = await quizRes.json();
      setQuiz(quizData.data?.assessment || quizData.data);

      // Load submission details - try the individual endpoint first
      let submissionRes = await fetch(
        `/api/teacher_page/assessment/${quizId}/student/${studentId}/submission`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (submissionRes.ok) {
        const submissionData = await submissionRes.json();
        console.log('📊 Deadline quiz - Submission data received:', submissionData);
        if (submissionData.success) {
          let sub = submissionData.data.submission;
          console.log('🔍 Deadline quiz - Tab switching data from individual endpoint:', {
            tabSwitches: sub?.tabSwitches,
            tabSwitchDurations: sub?.tabSwitchDurations,
            totalAwayMs: sub?.totalAwayMs
          });
          
          // If tab switching data is missing, fetch from submissions list endpoint
          if (sub.tabSwitches === undefined) {
            console.log('⚠️ Deadline quiz - Tab switching data missing, fetching from submissions list...');
            const submissionsRes = await fetch(
              `/api/teacher_page/assessment/${quizId}/submissions`,
              {
                headers: { 'Authorization': `Bearer ${token}` }
              }
            );
            
            if (submissionsRes.ok) {
              const submissionsData = await submissionsRes.json();
              const allSubmissions = submissionsData.data?.submissions || [];
              console.log('📋 Deadline quiz - All submissions:', allSubmissions.map((s: any) => ({
                id: s._id,
                studentId: s.studentId,
                tabSwitches: s.tabSwitches,
                totalAwayMs: s.totalAwayMs
              })));
              
              // Find this student's submission with tab switching data
              let matchingSubmission = allSubmissions.find((s: any) => 
                s.studentId === studentId && s._id === sub._id
              );
              
              if (!matchingSubmission) {
                matchingSubmission = allSubmissions.find((s: any) => 
                  s.studentId === studentId
                );
                console.log('🔍 Deadline quiz - Using any submission from student:', matchingSubmission);
              }
              
              if (matchingSubmission) {
                console.log('✅ Deadline quiz - Found tab switching data:', {
                  tabSwitches: matchingSubmission.tabSwitches,
                  tabSwitchDurations: matchingSubmission.tabSwitchDurations,
                  totalAwayMs: matchingSubmission.totalAwayMs
                });
                sub = {
                  ...sub,
                  tabSwitches: matchingSubmission.tabSwitches,
                  tabSwitchDurations: matchingSubmission.tabSwitchDurations,
                  totalAwayMs: matchingSubmission.totalAwayMs
                };
              } else {
                console.log('❌ Deadline quiz - No matching submission found for student:', studentId);
              }
            }
          } else {
            console.log('✅ Deadline quiz - Tab switching data already present:', {
              tabSwitches: sub.tabSwitches,
              tabSwitchDurations: sub.tabSwitchDurations,
              totalAwayMs: sub.totalAwayMs
            });
          }
          
          setSubmission(sub);

          // Initialize question grades for ALL questions
          if (sub?.gradedAnswers) {
            const initialGrades: Record<string, number> = {};
            sub.gradedAnswers.forEach((ga: GradedAnswer) => {
              initialGrades[ga.questionId] = ga.points || 0;
            });
            setQuestionGrades(initialGrades);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load data:", err);
      showError("Failed to load submission details");
    } finally {
      setLoading(false);
    }
  };

  const handleQuestionGrade = async (questionId: string) => {
    if (!submission) return;

    const points = questionGrades[questionId] || 0;

    setSavingQuestions(prev => ({ ...prev, [questionId]: true }));
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(
        `/api/teacher_page/assessment/${quizId}/student/${studentId}/question-grade`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ questionId, points })
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        // Update local state without reloading the page
        setSubmission(prev => {
          if (!prev) return prev;
          
          // Find the graded answer and update its points
          const updatedGradedAnswers = prev.gradedAnswers?.map(ga => {
            if (ga.questionId === questionId) {
              return {
                ...ga,
                points: points,
                isCorrect: points > 0,
                isManuallyGraded: true
              };
            }
            return ga;
          });
          
          // Recalculate total score
          const newScore = updatedGradedAnswers?.reduce((sum, ga) => sum + ga.points, 0) || 0;
          
          return {
            ...prev,
            gradedAnswers: updatedGradedAnswers,
            score: newScore,
            status: 'graded'
          };
        });
        
        showSuccess('Grade saved successfully!');
      } else {
        throw new Error('Failed to save grade');
      }
    } catch (error) {
      console.error("Error saving grade:", error);
      showError('Failed to save grade');
    } finally {
      setSavingQuestions(prev => ({ ...prev, [questionId]: false }));
    }
  };

  const renderAnswer = (answer: string | string[] | { [key: string]: string } | null) => {
    if (answer === null || answer === undefined) {
      return <span className="text-slate-400 italic">No answer provided</span>;
    }

    if (Array.isArray(answer)) {
      return (
        <div className="space-y-1">
          {answer.map((item, index) => (
            <div key={index} className="text-sm">• {item}</div>
          ))}
        </div>
      );
    }

    if (typeof answer === 'object') {
      return (
        <div className="space-y-1">
          {Object.entries(answer).map(([key, value]) => (
            <div key={key} className="text-sm">{key} → {value}</div>
          ))}
        </div>
      );
    }

    // Display as plain text (not code)
    return <div className="whitespace-pre-wrap break-words">{answer}</div>;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#1C2B1C] dark:border-white border-t-transparent"></div>
      </div>
    );
  }

  if (!quiz || !submission) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Submission not found</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl mb-6 border border-slate-200 dark:border-slate-700">
          

          <button
            onClick={() => router.push(`/teacher_page/quiz/${quizId}`)}
            className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Quiz Results
          </button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                Student Submission Review
              </h1>
              <p className="text-slate-600 dark:text-slate-400">{quiz.title}</p>
            </div>
            
            {/* Tab Switching Summary */}
            {submission.tabSwitches !== undefined && submission.tabSwitches > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <div className="font-bold text-amber-800 dark:text-amber-300">Tab Switching Detected</div>
                    <div className="text-sm text-amber-700 dark:text-amber-400">
                      {submission.tabSwitches} switch{submission.tabSwitches !== 1 ? 'es' : ''}
                      {submission.totalAwayMs !== undefined && submission.totalAwayMs > 0 && (
                        <span> • Away: {Math.floor(submission.totalAwayMs / 60000)}m {Math.floor((submission.totalAwayMs % 60000) / 1000)}s</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Student Info Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-700 sticky top-6">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">
                Student Information
              </h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-medium text-slate-600 dark:text-slate-400">Name:</span>
                  <div className="text-slate-800 dark:text-slate-200 font-semibold">
                    {submission.studentName || (submission as any).studentEmail?.split('@')[0] || "Unknown Student"}
                  </div>
                </div>
                <div>
                  <span className="font-medium text-slate-600 dark:text-slate-400">Email:</span>
                  <div className="text-slate-800 dark:text-slate-200">
                    {(submission as any).studentEmail || "N/A"}
                  </div>
                </div>
                <div>
                  <span className="font-medium text-slate-600 dark:text-slate-400">Submitted:</span>
                  <div className="text-slate-800 dark:text-slate-200">
                    {new Date(submission.submittedAt).toLocaleString()}
                  </div>
                </div>
                <div>
                  <span className="font-medium text-slate-600 dark:text-slate-400">Score:</span>
                  <div className="text-3xl font-bold text-rose-600 dark:text-rose-400 my-2">
                    {submission.score}/{submission.maxScore}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    {((submission.score / submission.maxScore) * 100).toFixed(1)}%
                  </div>
                </div>
                {submission.timeTaken && (
                  <div>
                    <span className="font-medium text-slate-600 dark:text-slate-400">Time Spent:</span>
                    <div className="text-slate-800 dark:text-slate-200">
                      {Math.floor(submission.timeTaken / 60)}m {submission.timeTaken % 60}s
                    </div>
                  </div>
                )}
                <div>
                  <span className="font-medium text-slate-600 dark:text-slate-400">Attempt:</span>
                  <div className="text-slate-800 dark:text-slate-200">
                    {(submission as any).attemptNumber || 1}
                  </div>
                </div>
                <div>
                  <span className="font-medium text-slate-600 dark:text-slate-400">Status:</span>
                  <div className={`inline-block px-3 py-1 text-xs rounded-full mt-1 ${
                    submission.status === 'graded'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                  }`}>
                    {submission.status}
                  </div>
                </div>
                
                {/* Tab Switching Tracking - Always show */}
                <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{(submission.tabSwitches || 0) > 0 ? '⚠️' : '✅'}</span>
                    <span className="font-semibold text-amber-800 dark:text-amber-300">
                      {(submission.tabSwitches || 0) > 0 ? 'Tab Switching Detected' : 'No Tab Switching'}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium text-amber-700 dark:text-amber-400">Switches:</span>
                      <span className="ml-2 text-amber-900 dark:text-amber-200 font-bold">
                        {submission.tabSwitches ?? 0} time{(submission.tabSwitches || 0) !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {submission.totalAwayMs !== undefined && submission.totalAwayMs > 0 && (
                      <div>
                        <span className="font-medium text-amber-700 dark:text-amber-400">Total Time Away:</span>
                        <span className="ml-2 text-amber-900 dark:text-amber-200 font-bold">
                          {Math.floor(submission.totalAwayMs / 60000)}m {Math.floor((submission.totalAwayMs % 60000) / 1000)}s
                        </span>
                      </div>
                    )}
                    {submission.tabSwitchDurations && submission.tabSwitchDurations.length > 0 && (
                      <div className="mt-2">
                        <span className="font-medium text-amber-700 dark:text-amber-400 block mb-1">Duration per switch:</span>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {submission.tabSwitchDurations.map((duration, index) => (
                            <div key={index} className="text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                              <span className="font-mono bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded">#{index + 1}</span>
                              <span>{Math.floor(duration / 1000)}s</span>
                              <div className="flex-1 bg-amber-200 dark:bg-amber-800 rounded-full h-1.5 overflow-hidden">
                                <div 
                                  className="bg-amber-500 dark:bg-amber-500 h-full rounded-full"
                                  style={{ width: `${Math.min((duration / 30000) * 100, 100)}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Answers Review */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-6">
                Answer Review
              </h3>

              <div className="space-y-4">
                {submission.gradedAnswers?.map((gradedAnswer, index) => {
                  const question = quiz.questions?.find(q => q.id === gradedAnswer.questionId);

                  return (
                    <div key={gradedAnswer.questionId} className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-slate-800 dark:text-slate-200">
                            Question {index + 1}
                          </h4>
                          <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                            {question?.title || 'Question'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            gradedAnswer.isCorrect
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}>
                            {gradedAnswer.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                          </span>
                          <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                            {gradedAnswer.points}/{gradedAnswer.maxPoints} pts
                          </span>
                        </div>
                      </div>

                      <div className="space-y-3 text-sm">
                        <div>
                          <span className="font-medium text-slate-600 dark:text-slate-400">Student Answer:</span>
                          <div className="mt-1 p-3 bg-white dark:bg-slate-800 rounded-lg text-slate-800 dark:text-slate-200">
                            {renderAnswer(gradedAnswer.studentAnswer)}
                          </div>
                        </div>

                        {gradedAnswer.correctAnswer && !gradedAnswer.needsManualGrading && (
                          <div>
                            <span className="font-medium text-slate-600 dark:text-slate-400">Correct Answer:</span>
                            <div className="mt-1 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-700 dark:text-green-300">
                              {renderAnswer(gradedAnswer.correctAnswer)}
                            </div>
                          </div>
                        )}

                        {/* Allow score modification for ALL questions */}
                        <div className="mt-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                            📝 Adjust Score
                          </p>
                          <div className="flex items-center gap-3">
                            <input
                              type="number"
                              min="0"
                              max={gradedAnswer.maxPoints}
                              step="0.5"
                              value={questionGrades[gradedAnswer.questionId] ?? gradedAnswer.points}
                              onChange={(e) => setQuestionGrades(prev => ({
                                ...prev,
                                [gradedAnswer.questionId]: parseFloat(e.target.value) || 0
                              }))}
                              className="w-24 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500"
                            />
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                              / {gradedAnswer.maxPoints} points
                            </span>
                            <button
                              onClick={() => handleQuestionGrade(gradedAnswer.questionId)}
                              disabled={savingQuestions[gradedAnswer.questionId]}
                              className="ml-auto px-4 py-2 bg-gradient-to-r from-rose-600 to-pink-600 text-white rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold transition-all"
                            >
                              {savingQuestions[gradedAnswer.questionId] ? 'Saving...' : '💾 Update Score'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
