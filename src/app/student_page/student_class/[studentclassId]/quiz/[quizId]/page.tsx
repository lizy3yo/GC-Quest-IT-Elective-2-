"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";
import LoadingTemplate2 from "@/components/molecules/loading_template_2/loading_template_2/loading2";
import StudentAssessmentPlayer, { AssessmentQuestion } from "@/components/organisms/quiz/quiz/StudentAssessmentPlayer";

interface Assessment {
  _id: string;
  title: string;
  description?: string;
  questions: any[];
  totalPoints?: number;
  timeLimitMins?: number;
  maxAttempts?: number;
  isLocked?: boolean;
  scheduledOpen?: string | null;
  scheduledClose?: string | null;
  dueDate?: string | null;
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
}

export default function StudentQUIZPage({
  params
}: {
  params: Promise<{ studentclassId: string; quizId: string }>
}) {
  const router = useRouter();
  const { showSuccess, showError, showWarning } = useToast();

  const [studentclassId, setStudentclassId] = useState<string | null>(null);
  const [quizId, setQuizId] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<any>(null);
  const [accessLockedInfo, setAccessLockedInfo] = useState<any>(null);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const unwrap = async () => {
      const p = await params;
      setStudentclassId(p.studentclassId);
      setQuizId(p.quizId);
    };
    unwrap();
  }, [params]);

  useEffect(() => {
    if (!studentclassId || !quizId) return;
    fetchAssessment();
  }, [studentclassId, quizId]);

  // Tab switching detection
  useEffect(() => {
    if (!hasStarted || !assessment?.settings?.trackTabSwitching) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        showWarning("⚠️ Tab switching detected! Your activity is being monitored.", "Warning");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [hasStarted, assessment, showWarning]);

  const fetchAssessment = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("accessToken");
      
      // First fetch the assessment to check if it has a deadline (offline quiz)
      const response = await fetch(`/api/student_page/class/${studentclassId}/assessment/${quizId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const result = await response.json();
      if (!response.ok) {
        // If the API indicates the assessment is locked, show helpful information instead of navigating away
        if (response.status === 403 && result?.data && result.data.locked) {
          setAccessLockedInfo(result.data);
          setAccessMessage(result.error || 'This assessment is currently locked');
          return;
        }
        throw new Error(result.error || "Failed to load quiz");
      }

      if (!result.success) throw new Error(result.error || "Failed to load quiz");

      const assessmentData = result.data.assessment;
      
      // Check if this is an offline quiz (has deadline) - no lobby needed
      const isOfflineQUIZ = assessmentData.scheduledClose || assessmentData.dueDate;
      
      // Only check for live session if this is NOT an offline quiz with deadline
      if (!isOfflineQUIZ) {
        try {
          const liveCheckResponse = await fetch(`/api/student_page/class/${studentclassId}/assessment/${quizId}/live-session`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (liveCheckResponse.ok) {
            const liveResult = await liveCheckResponse.json();
            // If there's ANY live session data (even without students), redirect to live lobby
            // This ensures students always go to lobby when teacher opens live session
            if (liveResult.data?.liveSession) {
              console.log('🔴 Live session exists, redirecting to live lobby...');
              router.replace(`/student_page/student_class/${studentclassId}/quiz/live/${quizId}`);
              return;
            }
          }
        } catch (liveCheckError) {
          console.log('No live session detected, continuing with regular quiz flow');
        }
        
        // Check if this assessment is configured as live mode - redirect to live lobby
        if (assessmentData.deliveryMode === 'live' || assessmentData.isLive || result.data.isLiveSession) {
          console.log('🔴 Live quiz detected (deliveryMode: live), redirecting to live lobby...');
          router.replace(`/student_page/student_class/${studentclassId}/quiz/live/${quizId}`);
          return;
        }
      }

      setAssessment(assessmentData);
      setSubmissionStatus(result.data.submissionStatus || null);
    } catch (error) {
      console.error("Error fetching quiz:", error);
      showError("Failed to load quiz");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  const handleSubmit = async (answers: Record<string, any>, metadata: {
    tabSwitches: number;
    tabSwitchDurations: number[];
    timeSpent: number;
    startTime?: string;
    totalAwayMs?: number;
  }) => {
    try {
      const submissionData: any = {
        answers: Object.entries(answers).map(([questionId, answer]) => ({
          questionId,
          answer
        })),
        submittedAt: new Date().toISOString(),
        timeSpent: metadata.timeSpent,
        tabSwitches: metadata.tabSwitches,
        tabSwitchDurations: metadata.tabSwitchDurations,
        startTime: metadata.startTime,
        totalAwayMs: metadata.totalAwayMs
      };

      const token = localStorage.getItem("accessToken");
      const response = await fetch(`/api/student_page/class/${studentclassId}/assessment/${quizId}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(submissionData)
      });

      if (!response.ok) throw new Error("Submission failed");

      const result = await response.json();
      if (!result.success) throw new Error(result.error || "Failed to submit quiz");

      showSuccess("quiz submitted successfully!");

      setTimeout(() => {
        router.push(`/student_page/student_class/${studentclassId}/assessment/${quizId}/results`);
      }, 1500);
    } catch (error) {
      console.error("Submission error:", error);
      showError(error instanceof Error ? error.message : "Failed to submit quiz");
      throw error;
    }
  };

  // Transform questions to match AssessmentQuestion interface
  const transformQuestions = (questions: any[]): AssessmentQuestion[] => {
    return questions.map(q => ({
      id: q.id,
      title: q.title,
      type: q.type,
      options: q.options?.map((opt: any, idx: number) => ({
        id: typeof opt === 'string' ? `opt-${idx}` : opt.id,
        text: typeof opt === 'string' ? opt : opt.text,
        isCorrect: opt.isCorrect
      })),
      correctAnswer: q.correctAnswer || q.answer,
      points: q.points,
      timeLimit: q.timeLimit,
      image: q.image || q.src
    }));
  };

  if (loading) {
    return <LoadingTemplate2 title="Loading quiz..." />;
  }

  // If the server told us the assessment is locked, show a prominent locked screen
  if (accessMessage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-6 flex items-center justify-center relative overflow-hidden">
        {/* Background Decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-20 w-72 h-72 bg-gradient-to-br from-amber-200/30 to-orange-200/30 dark:from-amber-900/20 dark:to-orange-900/20 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-gradient-to-tr from-slate-200/50 to-slate-300/50 dark:from-slate-700/30 dark:to-slate-600/30 rounded-full blur-3xl" />
        </div>

        <div className="max-w-lg w-full relative z-10">
          {/* Main Card */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 p-10 text-center">
            {/* Lock Icon */}
            <div className="relative inline-flex items-center justify-center mb-6">
              <div className="w-24 h-24 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 rounded-2xl flex items-center justify-center shadow-lg">
                <svg className="w-12 h-12 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-3">
              Assessment Locked
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">{accessMessage}</p>

            {/* Schedule Info */}
            {(accessLockedInfo?.scheduledOpen || accessLockedInfo?.scheduledClose || accessLockedInfo?.dueDate) && (
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700/50 dark:to-slate-700/30 rounded-2xl p-6 mb-8 border border-slate-200 dark:border-slate-600">
                <div className="space-y-4">
                  {accessLockedInfo?.scheduledOpen && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#2E7D32]/10 dark:bg-[#2E7D32]/20 rounded-xl flex items-center justify-center">
                          <svg className="w-5 h-5 text-[#2E7D32]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <span className="text-slate-600 dark:text-slate-400 font-medium">Opens at</span>
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white">{formatDateTime(accessLockedInfo.scheduledOpen)}</span>
                    </div>
                  )}
                  {accessLockedInfo?.scheduledClose && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-xl flex items-center justify-center">
                          <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <span className="text-slate-600 dark:text-slate-400 font-medium">Closes at</span>
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white">{formatDateTime(accessLockedInfo.scheduledClose)}</span>
                    </div>
                  )}
                  {accessLockedInfo?.dueDate && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/20 rounded-xl flex items-center justify-center">
                          <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </div>
                        <span className="text-slate-600 dark:text-slate-400 font-medium">Due date</span>
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white">{formatDateTime(accessLockedInfo.dueDate)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Go Back Button */}
            <button
              onClick={() => router.back()}
              className="w-full bg-gradient-to-r from-[#2E7D32] to-[#1B5E20] hover:from-[#1B5E20] hover:to-[#0D4A14] text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }


  // Show loading if assessment not loaded yet
  if (!assessment || !studentclassId || !quizId) {
    return <LoadingTemplate2 title="Loading quiz..." />;
  }

  // Show start screen if quiz hasn't been started yet
  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-6">
        <div className="max-w-xl w-full">
          {/* Main Card */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-10 text-center overflow-hidden relative">
            {/* Decorative Background */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#2E7D32]/10 to-transparent rounded-full blur-3xl" />
            
            <div className="relative">
              {/* Icon */}
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-[#2E7D32] to-[#1B5E20] rounded-2xl mb-6 shadow-xl">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              
              {/* Title */}
              <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-3">
                {assessment.title}
              </h1>
              
              <p className="text-lg text-slate-600 dark:text-slate-400 mb-6">
                {assessment.questions.length} {assessment.questions.length === 1 ? 'question' : 'questions'}
              </p>

              {/* Lockdown warning if enabled */}
              {assessment.settings?.lockdown && (
                <div className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 rounded-xl p-4 mb-6 border border-red-200 dark:border-red-800">
                  <div className="flex items-center justify-center gap-2 text-red-700 dark:text-red-300 font-medium">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Lockdown Mode Enabled
                  </div>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    You cannot leave this assessment once started. Tab switching will be monitored.
                  </p>
                </div>
              )}

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3 mb-8">
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-2xl font-black text-blue-600 dark:text-blue-400">{assessment.timeLimitMins || '∞'}</div>
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-400">Minutes</div>
                </div>
                
                <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                  <svg className="w-6 h-6 text-amber-600 dark:text-amber-400 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{assessment.totalPoints || assessment.questions.length}</div>
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-400">Points</div>
                </div>
                
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
                  <svg className="w-6 h-6 text-[#2E7D32] dark:text-emerald-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="text-2xl font-black text-[#2E7D32] dark:text-emerald-400">{assessment.questions.length}</div>
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-400">Questions</div>
                </div>
              </div>

              {/* Access / Start */}
              {accessMessage ? (
                <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-xl p-4 mb-6 border border-amber-200 dark:border-amber-800">
                  <div className="font-semibold text-amber-900 dark:text-amber-300 mb-2">{accessMessage}</div>
                  {accessLockedInfo?.scheduledOpen && (
                    <div className="text-sm text-amber-700 dark:text-amber-400">Opens at: <strong>{formatDateTime(accessLockedInfo.scheduledOpen)}</strong></div>
                  )}
                  {accessLockedInfo?.scheduledClose && (
                    <div className="text-sm text-amber-700 dark:text-amber-400">Closes at: <strong>{formatDateTime(accessLockedInfo.scheduledClose)}</strong></div>
                  )}
                  {accessLockedInfo?.dueDate && (
                    <div className="text-sm text-amber-700 dark:text-amber-400">Due date: <strong>{formatDateTime(accessLockedInfo.dueDate)}</strong></div>
                  )}
                </div>
              ) : submissionStatus && submissionStatus.canRetake === false ? (
                <div className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 rounded-xl p-4 mb-6 border border-red-200 dark:border-red-800">
                  <div className="font-semibold text-red-900 dark:text-red-300 mb-2">Maximum attempts reached</div>
                  <div className="text-sm text-red-700 dark:text-red-400 mb-4">You have used {submissionStatus.submissionCount}/{assessment.maxAttempts || submissionStatus.submissionCount} attempts.</div>
                  <button
                    onClick={() => router.push(`/student_page/student_class/${studentclassId}/assessment/${quizId}/results`)}
                    className="px-6 py-3 bg-gradient-to-r from-[#2E7D32] to-[#1B5E20] hover:from-[#1B5E20] hover:to-[#0D4A14] text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-xl"
                  >
                    View Results
                  </button>
                </div>
              ) : null}

              {/* Action Buttons */}
              {!accessMessage && !(submissionStatus && submissionStatus.canRetake === false) && (
                <button
                  onClick={() => setHasStarted(true)}
                  className="w-full px-6 py-4 bg-gradient-to-r from-[#2E7D32] to-[#1B5E20] hover:from-[#1B5E20] hover:to-[#0D4A14] text-white rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 mb-4"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Start Assessment
                </button>
              )}

              <button
                onClick={() => router.back()}
                className="w-full px-5 py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl text-slate-700 dark:text-slate-300 font-medium transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Go Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show the actual quiz player after start button is clicked
  return (
    <StudentAssessmentPlayer
      assessmentId={quizId}
      classId={studentclassId}
      questions={transformQuestions(assessment.questions)}
      title={assessment.title}
      totalPoints={assessment.totalPoints}
      timeLimitMins={assessment.timeLimitMins}
      settings={assessment.settings}
      isLiveMode={true}
      onSubmit={handleSubmit}
    />
  );
}
