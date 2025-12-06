"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAlert } from "@/hooks/useAlert";

type Player = {
  id: string;
  name: string;
  email?: string;
  currentQuestion: number;
  score: number;
  connected: boolean;
  away?: boolean;
  totalAwayMs?: number;
  tabSwitches?: number;
  isComplete?: boolean;
  isInProgress?: boolean;
};

export default function LiveQUIZSession() {
  const router = useRouter();
  const params = useParams();
  const quizId = params?.quizId as string;
  const { showError, showSuccess } = useAlert();

  const [quiz, setQuiz] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);
  const [sessionActive, setSessionActive] = useState(false);

  useEffect(() => {
    if (quizId) {
      loadQuiz();
      checkSessionStatus(); // Check if session already active
    }
  }, [quizId]);

  // Auto-start and auto-end based on scheduled times
  useEffect(() => {
    if (!quiz) return;

    const checkSchedule = async () => {
      const now = new Date();
      const scheduledOpen = quiz.scheduledOpen ? new Date(quiz.scheduledOpen) : null;
      const scheduledClose = quiz.scheduledClose ? new Date(quiz.scheduledClose) : null;

      // Auto-start if within scheduled time
      if (scheduledOpen && scheduledClose && now >= scheduledOpen && now < scheduledClose) {
        if (!sessionActive) {
          try {
            const token = localStorage.getItem('accessToken');
            await fetch(`/api/teacher_page/assessment/${quizId}/live-session`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ action: 'start' })
            });
            setSessionActive(true);
            console.log('🕒 Auto-started live session based on schedule');
          } catch (error) {
            console.error('Error auto-starting session:', error);
          }
        }
      }

      // Auto-end if past deadline
      if (scheduledClose && now >= scheduledClose && sessionActive) {
        try {
          const token = localStorage.getItem('accessToken');
          await fetch(`/api/teacher_page/assessment/${quizId}/live-session`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ action: 'end' })
          });
          setSessionActive(false);
          showSuccess('Live session ended automatically (deadline reached)');
          console.log('🕒 Auto-ended live session based on deadline');
        } catch (error) {
          console.error('Error auto-ending session:', error);
        }
      }
    };

    checkSchedule();
    const scheduleInterval = setInterval(checkSchedule, 10000); // Check every 10 seconds

    return () => clearInterval(scheduleInterval);
  }, [quiz, sessionActive, quizId]);

  // Poll for students joining/leaving and their progress - 500ms for real-time updates
  useEffect(() => {
    if (!quizId) return;
    
    checkStudentsJoined();
    const pollInterval = setInterval(() => {
      checkStudentsJoined();
    }, 500);

    return () => clearInterval(pollInterval);
  }, [quizId]);

  const loadQuiz = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/teacher_page/assessment/${quizId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (!res.ok) throw new Error("Failed to load quiz");
      const data = await res.json();
      setQuiz(data.data?.assessment || data.data);
    } catch (err) {
      showError("Failed to load quiz");
    } finally {
      setLoading(false);
    }
  };

  const checkSessionStatus = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/teacher_page/assessment/${quizId}/live-session`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const result = await response.json();
        // Only set active if the session explicitly has isActive = true
        const isActive = result.data?.liveSession?.isActive === true;
        setSessionActive(isActive);
        console.log('📊 Session status:', { isActive });
      }
    } catch (error) {
      console.error('Error checking session status:', error);
    }
  };

  const startLiveSession = async () => {
    if (players.length === 0) {
      showError("Wait for at least one student to join");
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/teacher_page/assessment/${quizId}/live-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'start' })
      });

      if (response.ok) {
        setSessionActive(true);
        showSuccess('quiz started! Students can now begin.');
      }
    } catch (error) {
      console.error('Error starting live session:', error);
      showError('Failed to start session');
    }
  };

  const checkStudentsJoined = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      
      // Get session status
      const sessionResponse = await fetch(`/api/teacher_page/assessment/${quizId}/live-session`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (sessionResponse.ok) {
        const sessionResult = await sessionResponse.json();
        const liveSession = sessionResult.data?.liveSession || {};
        const studentStats = sessionResult.data?.studentStats || [];
        const statusMap = liveSession?.studentStatus || {};

        // Update session active status
        const isActive = liveSession?.isActive === true;
        setSessionActive(isActive);

        // Get real-time progress
        const progressResponse = await fetch(`/api/teacher_page/assessment/${quizId}/live-progress`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (progressResponse.ok) {
          const progressResult = await progressResponse.json();
          const studentProgress = progressResult.data?.students || [];
          
          console.log('📊 Student progress data:', studentProgress);
          
          // Merge student list with progress data and include away status
          console.log('📊 statusMap:', statusMap);
          console.log('📊 studentStats:', studentStats);
          
          if (studentStats.length > 0) {
            const newPlayers = studentStats.map((student: any) => {
              const progress = studentProgress.find((p: any) => p.studentId === student.studentId);
              const status = statusMap[student.studentId] || {};
              const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Unknown Student';
              
              // Use score from progress API, fallback to studentStats score
              const finalScore = progress?.score ?? student.score ?? 0;
              
              // Debug tab switching data
              console.log(`Student ${fullName}: tabSwitches=${student.tabSwitches || status.tabSwitches || 0}, totalAwayMs=${student.totalAwayMs || status.totalAwayMs || 0}, away=${student.away || status.away}`);
              
              return {
                id: student.studentId,
                name: fullName,
                email: student.email || '',
                currentQuestion: progress?.currentQuestion ?? student.currentQuestion ?? 0,
                score: finalScore,
                connected: !(status.away === true),
                away: student.away || status.away || false,
                totalAwayMs: student.totalAwayMs || status.totalAwayMs || 0,
                tabSwitches: student.tabSwitches || status.tabSwitches || 0,
                isComplete: progress?.isComplete ?? false,
                isInProgress: progress?.isInProgress ?? false
              };
            });
            setPlayers(newPlayers);
          } else if (studentStats.length === 0 && players.length > 0) {
            setPlayers([]);
          }
        }
      }
    } catch (error) {
      console.error('Error checking students:', error);
    }
  };

  const handleEndSession = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      
      // End the live session
      await fetch(`/api/teacher_page/assessment/${quizId}/live-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'end' })
      });
      
      // Lock the assessment
      await fetch(`/api/teacher_page/assessment/${quizId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isLocked: true })
      });
      
      setPlayers([]);
      setSessionActive(false);
      showSuccess('Session ended and quiz locked!');
      console.log('🔒 Assessment locked after ending session');
    } catch (error) {
      console.error('Error ending live session:', error);
      showError('Failed to end session');
    }
  };

  const handleExitToQUIZ = () => {
    // Check if came from class page
    const storedClassId = sessionStorage.getItem('class_origin_id');
    if (storedClassId) {
      // Redirect back to class page with correct tabs via URL params
      router.push(`/teacher_page/classes/${storedClassId}?tab=resourcesassessments&assessmentTab=quizzes`);
    } else if (window.history.length > 1) {
      router.back();
    } else {
      router.push(`/teacher_page/quiz/${quizId}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#2E7D32] dark:border-white border-t-transparent"></div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#2E7D32] dark:border-white border-t-transparent"></div>
      </div>
    );
  }

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-lg ${
                sessionActive 
                  ? 'bg-gradient-to-br from-red-500 to-red-600' 
                  : 'bg-gradient-to-br from-amber-400 to-orange-500'
              }`}>
                {sessionActive ? (
                  <span className="w-4 h-4 bg-white rounded-full animate-pulse"></span>
                ) : (
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {sessionActive ? 'Session In Progress' : 'Lobby - Ready to Start'}
                  </span>
                  {sessionActive && (
                    <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold rounded-full animate-pulse">
                      ● LIVE
                    </span>
                  )}
                </div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white">{quiz.title}</h1>
                <div className="flex items-center gap-3 mt-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2E7D32]/10 dark:bg-[#2E7D32]/20 text-[#2E7D32] dark:text-emerald-400 rounded-lg text-sm font-bold">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                    </svg>
                    {players.length} Students
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-bold">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {quiz.questions.length} Questions
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              {!sessionActive && (
                <button
                  onClick={startLiveSession}
                  disabled={players.length === 0}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#2E7D32] to-[#1B5E20] hover:from-[#1B5E20] hover:to-[#0D4A14] text-white rounded-xl font-semibold transition-all flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Start quiz ({players.length})
                </button>
              )}
              <button
                onClick={handleExitToQUIZ}
                className="px-5 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-semibold transition-all flex items-center gap-2 border border-slate-200 dark:border-slate-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Exit Live Mode
              </button>
              {sessionActive && (
                <button
                  onClick={handleEndSession}
                  className="px-5 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-semibold transition-all flex items-center gap-2 shadow-lg"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  </svg>
                  End Session
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main Content - Live Dashboard */}
        <div className={`grid gap-6 ${sessionActive ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1'}`}>
          {/* Live Progress Overview */}
          <div className={sessionActive ? 'lg:col-span-2' : ''}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  sessionActive 
                    ? 'bg-blue-100 dark:bg-blue-900/30' 
                    : 'bg-amber-100 dark:bg-amber-900/30'
                }`}>
                  {sessionActive ? (
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                  {sessionActive ? 'Live Progress' : 'Lobby'}
                </h2>
              </div>
              
              {!sessionActive ? (
                /* LOBBY - Waiting for students */
                <div className="space-y-6">
                  {players.length === 0 ? (
                    /* Empty state - waiting for students */
                    <div className="text-center py-12">
                      <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-100 dark:bg-slate-700 rounded-2xl mb-6">
                        <svg className="w-10 h-10 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </div>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">
                        Waiting for Students...
                      </h3>
                      <p className="text-slate-500 dark:text-slate-400 text-lg mb-6">
                        Students will join automatically from their class page
                      </p>
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-2 h-2 bg-[#2E7D32] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-[#2E7D32] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-[#2E7D32] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  ) : (
                    /* Students in lobby */
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-[#2E7D32] rounded-full animate-pulse"></div>
                          <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                            {players.length} student{players.length !== 1 ? 's' : ''} in lobby
                          </span>
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Ready to start</span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {players.map((player) => (
                          <div key={player.id} className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 flex items-center gap-3 border border-slate-200 dark:border-slate-600">
                            <div className="w-10 h-10 bg-gradient-to-br from-[#2E7D32] to-[#1B5E20] rounded-xl flex items-center justify-center text-white font-bold shadow-md">
                              {player.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-slate-900 dark:text-white truncate">{player.name}</div>
                              {player.email && (
                                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{player.email}</div>
                              )}
                            </div>
                            <div className="flex items-center gap-1 px-2 py-1 bg-[#2E7D32]/10 dark:bg-[#2E7D32]/20 rounded-lg">
                              <div className="w-1.5 h-1.5 bg-[#2E7D32] rounded-full"></div>
                              <span className="text-xs font-medium text-[#2E7D32] dark:text-emerald-400">Ready</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* SESSION IS ACTIVE - Show live progress */
                players.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-8xl mb-6">📝</div>
                    <h3 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">Session In Progress</h3>
                    <p className="text-slate-700 dark:text-white/80 text-xl">
                      Waiting for students to join the active session...
                    </p>
                  </div>
                ) : (
                <div className="space-y-4">
                  {/* Progress Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-slate-900 dark:text-white">{players.length}</div>
                      <div className="text-slate-700 dark:text-white/80 text-sm">Total Students</div>
                    </div>
                    <div className="bg-green-500/20 backdrop-blur-sm rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-green-700 dark:text-green-300">
                        {players.filter(p => p.isComplete).length}
                      </div>
                      <div className="text-slate-700 dark:text-white/80 text-sm">Completed</div>
                    </div>
                    <div className="bg-blue-500/20 backdrop-blur-sm rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                        {players.filter(p => !p.isComplete && p.currentQuestion > 0).length}
                      </div>
                      <div className="text-slate-700 dark:text-white/80 text-sm">In Progress</div>
                    </div>
                  </div>

                  {/* Student Progress Bars */}
                  <div className="space-y-3">
                    {sortedPlayers.map((player, idx) => {
                      const progress = (player.currentQuestion / quiz.questions.length) * 100;
                      const isComplete = player.isComplete;
                      
                      return (
                        <div key={player.id} className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 border border-slate-200 dark:border-slate-600">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gradient-to-br from-[#2E7D32] to-[#1B5E20] rounded-full flex items-center justify-center text-white font-bold text-sm">
                                {idx + 1}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-900 dark:text-white">{player.name}</div>
                                {player.email && (
                                  <div className="text-xs text-slate-600 dark:text-slate-400">{player.email}</div>
                                )}
                              </div>
                              {player.away && (
                                <span className="ml-2 text-sm bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full">
                                  👁️ Away
                                </span>
                              )}
                              {isComplete && <span className="text-green-600 dark:text-green-400">✓ Done</span>}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-slate-700 dark:text-slate-300 text-sm">
                                {player.currentQuestion}/{quiz.questions.length} questions
                              </span>
                              <span className="text-[#2E7D32] dark:text-emerald-400 font-bold text-sm">
                                {player.score} pts
                              </span>
                            </div>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-3 overflow-hidden mb-2">
                            <div
                              className={`h-full transition-all duration-500 ${
                                isComplete ? 'bg-green-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${progress}%` }}
                            ></div>
                          </div>
                          {/* Tab Switching Info */}
                          {((player.tabSwitches !== undefined && player.tabSwitches > 0) || (player.totalAwayMs !== undefined && player.totalAwayMs > 0)) && (
                            <div className="flex items-center gap-3 text-sm">
                              {player.tabSwitches !== undefined && player.tabSwitches > 0 && (
                                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  {player.tabSwitches} tab switch{player.tabSwitches !== 1 ? 'es' : ''}
                                </span>
                              )}
                              {player.totalAwayMs !== undefined && player.totalAwayMs > 0 && (
                                <span className="text-slate-500 dark:text-slate-400">
                                  Away: {Math.floor(player.totalAwayMs / 60000)}m {Math.floor((player.totalAwayMs % 60000) / 1000)}s
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                )
              )}
            </div>
          </div>

          {/* Student List Sidebar - Only show when session is active */}
          {sessionActive && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
              </svg>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Leaderboard ({players.length})
              </h3>
            </div>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {players.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">No students yet...</p>
                </div>
              ) : (
                sortedPlayers.map((player, idx) => {
                  const isComplete = player.isComplete;
                  return (
                    <div key={player.id} className={`p-4 rounded-xl border ${
                      isComplete 
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' 
                        : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-md ${
                            idx === 0 ? 'bg-gradient-to-br from-amber-400 to-amber-500' : idx === 1 ? 'bg-gradient-to-br from-slate-400 to-slate-500' : idx === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700' : 'bg-gradient-to-br from-slate-500 to-slate-600'
                          }`}>
                            {idx + 1}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white text-sm">{player.name}</div>
                            {player.email && (
                              <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[120px]">{player.email}</div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-black text-[#2E7D32] dark:text-emerald-400">{player.score}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">pts</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <div className={`font-medium ${isComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
                          {isComplete ? (
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              Completed
                            </span>
                          ) : `Question ${player.currentQuestion}/${quiz.questions.length}`}
                        </div>
                        {player.away && (
                          <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full text-xs font-medium">
                            Away
                          </span>
                        )}
                      </div>
                      {player.tabSwitches !== undefined && player.tabSwitches > 0 && (
                        <div className="mt-2 px-2 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg text-xs font-medium inline-flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          {player.tabSwitches} tab switch{player.tabSwitches !== 1 ? 'es' : ''}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
