"use client";

import React, { useState, useEffect, useRef } from "react";
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

export default function StudentLiveExamPage({
  params
}: {
  params: Promise<{ studentclassId: string; examId: string }>
}) {
  const router = useRouter();
  const { showSuccess, showError, showWarning } = useToast();

  const [studentclassId, setStudentclassId] = useState<string | null>(null);
  const [examId, setExamId] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [waitingForTeacher, setWaitingForTeacher] = useState(true); // Always start in waiting mode for live exams
  const [hasJoined, setHasJoined] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState<string>('');
  const toastShownRef = useRef(false);
  const loadingRef = useRef(true);

  console.log('🎬 Component render - State:', { 
    sessionStarted, 
    waitingForTeacher, 
    hasJoined,
    loading,
    hasAssessment: !!assessment 
  });

  useEffect(() => {
    const unwrap = async () => {
      const p = await params;
      setStudentclassId(p.studentclassId);
      setExamId(p.examId);
    };
    unwrap();
  }, [params]);

  // Tab switching detection
  useEffect(() => {
    if (!sessionStarted || !assessment?.settings?.trackTabSwitching) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        showWarning("⚠️ Tab switching detected! Your activity is being monitored.", "Warning");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [sessionStarted, assessment, showWarning]);

  useEffect(() => {
    if (!studentclassId || !examId) {
      console.log('⏳ Waiting for params...', { studentclassId, examId });
      return;
    }
    
    console.log('🚀 Starting fetch and join...', { studentclassId, examId });
    
    let isMounted = true;
    let checkSessionInterval: NodeJS.Timeout | null = null;
    let loadingTimeout: NodeJS.Timeout | null = null;

    const init = async () => {
      try {
        await fetchAssessment();
        if (!isMounted) return;
        
        await joinLiveSession();
        if (!isMounted) return;
        
        // Clear loading timeout since we successfully loaded
        if (loadingTimeout) {
          clearTimeout(loadingTimeout);
          loadingTimeout = null;
        }
        
        // Start polling for session status every 2 seconds
        checkSessionInterval = setInterval(() => {
          if (isMounted) {
            checkLiveSessionStatus();
          }
        }, 2000);

        // Safety timeout - if still loading after 10 seconds, show error
        loadingTimeout = setTimeout(() => {
          if (isMounted && loadingRef.current) {
            console.error('⏰ Loading timeout!');
            showError('Loading timeout. Please try again.');
            setLoading(false);
            loadingRef.current = false;
          }
        }, 10000);
      } catch (error) {
        console.error('Init error:', error);
        if (isMounted) {
          setLoading(false);
          loadingRef.current = false;
          if (loadingTimeout) clearTimeout(loadingTimeout);
        }
      }
    };

    init();

    // Cleanup: Leave lobby when component unmounts (student navigates away)
    return () => {
      isMounted = false;
      if (checkSessionInterval) clearInterval(checkSessionInterval);
      if (loadingTimeout) clearTimeout(loadingTimeout);
      leaveLiveSession();
    };
  }, [studentclassId, examId]);

  const fetchAssessment = async () => {
    try {
      console.log('📥 Fetching assessment...', { studentclassId, examId });
      const token = localStorage.getItem("accessToken");
      
      if (!token) {
        throw new Error("No access token found. Please log in again.");
      }
      
      const response = await fetch(`/api/student_page/class/${studentclassId}/assessment/${examId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        let errorMessage = "Failed to load exam";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          console.error('📥 Response error:', errorData);
          
          // Check if it's a locked assessment
          if (response.status === 403 || errorMessage.toLowerCase().includes('locked')) {
            setIsLocked(true);
            setLockMessage(errorMessage);
            setLoading(false);
            setInitialLoadComplete(true);
            return; // Don't throw error, just show locked state
          }
        } catch {
          const errorText = await response.text();
          console.error('📥 Response error:', errorText);
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('📥 Result:', result);
      
      if (!result.success) {
        throw new Error(result.error || "Failed to load exam");
      }

      if (!result.data?.assessment) {
        throw new Error("No assessment data received");
      }

      setAssessment(result.data.assessment);
      console.log('✅ Assessment loaded successfully');
    } catch (error) {
      console.error("Error fetching exam:", error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showError("Failed to load exam: " + errorMessage);
      
      // Don't navigate away immediately, let user see the error
      setTimeout(() => {
        router.back();
      }, 3000);
      
      throw error; // Re-throw to be caught by init()
    } finally {
      console.log('📥 Setting loading to false');
      setLoading(false);
      setInitialLoadComplete(true);
      loadingRef.current = false;
    }
  };

  const joinLiveSession = async () => {
    try {
      console.log('📞 Joining live session...', { studentclassId, examId });
      const token = localStorage.getItem("accessToken");
      const response = await fetch(`/api/student_page/class/${studentclassId}/assessment/${examId}/live-session`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('📞 Join response status:', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('📞 Join result:', result);
        setHasJoined(true);
        
        // Check if session is already active
        if (result.data?.liveSession?.isActive) {
          console.log('✅ Session is already active!');
          setSessionStarted(true);
          setWaitingForTeacher(false);
        } else {
          console.log('⏳ Session not active yet, staying in lobby');
        }
      } else {
        console.error('❌ Failed to join session:', response.status);
      }
    } catch (error) {
      console.error("Error joining live session:", error);
    }
  };

  const checkLiveSessionStatus = async () => {
    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch(`/api/student_page/class/${studentclassId}/assessment/${examId}/live-session`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const result = await response.json();
        const isActive = result.data?.liveSession?.isActive || false;
        console.log('🔄 Polling session status:', { isActive, sessionStarted, waitingForTeacher, toastShown: toastShownRef.current });
        
        // Only show toast and update state if transitioning from not started to started
        if (isActive && !sessionStarted && !toastShownRef.current) {
          console.log('🎉 Teacher started the exam!');
          toastShownRef.current = true;
          setSessionStarted(true);
          setWaitingForTeacher(false);
          showSuccess("Teacher has started the exam!");
        } else if (!isActive && sessionStarted) {
          // Session ended
          console.log('🛑 Session ended');
          setSessionStarted(false);
        }
      }
    } catch (error) {
      console.error("Error checking live session status:", error);
    }
  };

  const leaveLiveSession = async () => {
    try {
      console.log('👋 Leaving live session...');
      const token = localStorage.getItem("accessToken");
      await fetch(`/api/student_page/class/${studentclassId}/assessment/${examId}/live-session`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ action: 'leave' })
      });
    } catch (error) {
      console.error("Error leaving live session:", error);
    }
  };

  const handleSubmit = async (answers: Record<string, any>, metadata: {
    tabSwitches: number;
    tabSwitchDurations: number[];
    timeSpent: number;
  }) => {
    try {
      const submissionData = {
        answers: Object.entries(answers).map(([questionId, answer]) => ({
          questionId,
          answer
        })),
        submittedAt: new Date().toISOString(),
        timeSpent: metadata.timeSpent,
        tabSwitches: metadata.tabSwitches,
        tabSwitchDurations: metadata.tabSwitchDurations
      ,
      startTime: (metadata as any).startTime,
      totalAwayMs: (metadata as any).totalAwayMs
      };

      const token = localStorage.getItem("accessToken");
      const response = await fetch(`/api/student_page/class/${studentclassId}/assessment/${examId}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(submissionData)
      });

      if (!response.ok) throw new Error("Submission failed");

      const result = await response.json();
      if (!result.success) throw new Error(result.error || "Failed to submit exam");

      showSuccess("Exam submitted successfully!");

      setTimeout(() => {
        router.push(`/student_page/student_class/${studentclassId}/assessment/${examId}/results`);
      }, 1500);
    } catch (error) {
      console.error("Submission error:", error);
      showError(error instanceof Error ? error.message : "Failed to submit exam");
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

  console.log('🔍 Debug State:', { 
    loading, 
    waitingForTeacher, 
    sessionStarted, 
    hasAssessment: !!assessment,
    hasJoined,
    studentclassId,
    examId
  });

  // Show loading while fetching assessment data - only show "not found" after initial load is complete
  if (loading || !initialLoadComplete) {
    console.log('⏳ Still loading...');
    return <LoadingTemplate2 title="Loading live exam..." />;
  }

  // Show locked screen if assessment is locked
  if (isLocked) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-6">
        <div className="max-w-lg w-full">
          {/* Main Card */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 p-10 text-center">
            {/* Lock Icon */}
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 rounded-2xl mb-6 shadow-lg">
              <svg className="w-10 h-10 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>

            {/* Title */}
            <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-3">
              Assessment Locked
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">
              {lockMessage || "This assessment is currently locked and cannot be accessed."}
            </p>

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

  if (!assessment || !studentclassId || !examId) {
    console.log('⏳ Waiting for data:', { assessment: !!assessment, studentclassId, examId });
    return <LoadingTemplate2 title="Loading live exam..." />;
  }

  // Show waiting room if session hasn't started
  // For live exams, ALWAYS show waiting room unless session is explicitly started
  const shouldShowWaitingRoom = !sessionStarted;
  console.log('🎯 Checking waiting room condition:', { 
    waitingForTeacher, 
    sessionStarted, 
    shouldShowWaitingRoom,
    willRenderWaitingRoom: shouldShowWaitingRoom
  });
  
  if (shouldShowWaitingRoom) {
    console.log('🚪 Rendering waiting room...');
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-6">
        <div className="max-w-xl w-full">
          {/* Live Badge */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-100 to-orange-100 dark:from-red-900/40 dark:to-orange-900/40 text-red-700 dark:text-red-300 rounded-full text-sm font-bold border-2 border-red-200 dark:border-red-800 shadow-lg">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              Live Exam
            </div>
          </div>

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
                Waiting for teacher to start the exam...
              </p>

              {/* Loading Dots */}
              <div className="flex items-center justify-center gap-2 mb-8">
                <div className="w-3 h-3 bg-[#2E7D32] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-3 h-3 bg-[#2E7D32] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-3 h-3 bg-[#2E7D32] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3 mb-8">
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
                  <svg className="w-6 h-6 text-[#2E7D32] dark:text-emerald-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="text-2xl font-black text-[#2E7D32] dark:text-emerald-400">{assessment.questions?.length || 0}</div>
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-400">Questions</div>
                </div>
                
                <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                  <svg className="w-6 h-6 text-amber-600 dark:text-amber-400 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{assessment.totalPoints || 0}</div>
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-400">Points</div>
                </div>
                
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-2xl font-black text-blue-600 dark:text-blue-400">{assessment.timeLimitMins || '∞'}</div>
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-400">Minutes</div>
                </div>
              </div>

              {/* Status Message */}
              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-xl p-4 mb-6 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center justify-center gap-2 text-amber-700 dark:text-amber-300 font-medium">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Get ready! The exam will start soon
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                {hasJoined && (
                  <div className="flex-1 px-5 py-3 bg-gradient-to-r from-emerald-100 to-green-100 dark:from-emerald-900/30 dark:to-green-900/30 rounded-xl text-[#2E7D32] dark:text-emerald-400 font-bold border-2 border-emerald-200 dark:border-emerald-800 flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    You're in the lobby
                  </div>
                )}
                <button
                  onClick={() => router.back()}
                  className="flex-1 px-5 py-3 bg-gradient-to-r from-red-100 to-rose-100 dark:from-red-900/30 dark:to-rose-900/30 hover:from-red-200 hover:to-rose-200 dark:hover:from-red-900/50 dark:hover:to-rose-900/50 rounded-xl text-red-600 dark:text-red-400 font-bold border-2 border-red-200 dark:border-red-800 transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Leave Lobby
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Track progress for live monitoring
  const handleQuestionAnswer = async (questionId: string, answer: any) => {
    try {
      const token = localStorage.getItem("accessToken");
      await fetch(`/api/student_page/class/${studentclassId}/assessment/${examId}/live-answer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          questionId,
          answer,
          timeSpent: 0
        })
      });
      console.log('📝 Progress updated for question:', questionId);
    } catch (error) {
      console.error("Error updating progress:", error);
    }
  };

  console.log('🎮 Rendering assessment player...');
  return (
    <StudentAssessmentPlayer
      assessmentId={examId}
      classId={studentclassId}
      questions={transformQuestions(assessment.questions)}
      title={assessment.title}
      totalPoints={assessment.totalPoints}
      timeLimitMins={assessment.timeLimitMins}
      settings={assessment.settings}
      isLiveMode={true}
      onSubmit={handleSubmit}
      onQuestionAnswer={handleQuestionAnswer}
    />
  );
}
