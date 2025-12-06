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
};

export default function LiveExamSession() {
  const router = useRouter();
  const params = useParams();
  const examId = params?.examId as string;
  const { showError, showSuccess } = useAlert();

  const [exam, setExam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<Player[]>([]);
  const [sessionActive, setSessionActive] = useState(false);

  useEffect(() => {
    if (examId) {
      loadExam();
      checkSessionStatus(); // Check if session already active
    }
  }, [examId]);

  // Auto-start and auto-end based on scheduled times
  useEffect(() => {
    if (!exam) return;

    const checkSchedule = async () => {
      const now = new Date();
      const scheduledOpen = exam.scheduledOpen ? new Date(exam.scheduledOpen) : null;
      const scheduledClose = exam.scheduledClose ? new Date(exam.scheduledClose) : null;

      // Auto-start if within scheduled time
      if (scheduledOpen && scheduledClose && now >= scheduledOpen && now < scheduledClose) {
        if (!sessionActive) {
          try {
            const token = localStorage.getItem('accessToken');
            await fetch(`/api/teacher_page/assessment/${examId}/live-session`, {
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
          await fetch(`/api/teacher_page/assessment/${examId}/live-session`, {
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
  }, [exam, sessionActive, examId]);

  // Poll for students joining/leaving and their progress
  useEffect(() => {
    if (!examId) return;
    
    checkStudentsJoined();
    const pollInterval = setInterval(() => {
      checkStudentsJoined();
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [examId]);

  const loadExam = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/teacher_page/assessment/${examId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (!res.ok) throw new Error("Failed to load exam");
      const data = await res.json();
      setExam(data.data?.assessment || data.data);
    } catch (err) {
      showError("Failed to load exam");
    } finally {
      setLoading(false);
    }
  };

  const checkSessionStatus = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/teacher_page/assessment/${examId}/live-session`, {
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
      const response = await fetch(`/api/teacher_page/assessment/${examId}/live-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'start' })
      });

      if (response.ok) {
        setSessionActive(true);
        showSuccess('Exam started! Students can now begin.');
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
      const sessionResponse = await fetch(`/api/teacher_page/assessment/${examId}/live-session`, {
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
        const progressResponse = await fetch(`/api/teacher_page/assessment/${examId}/live-progress`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (progressResponse.ok) {
          const progressResult = await progressResponse.json();
          const studentProgress = progressResult.data?.students || [];
          
          console.log('📊 Student progress data:', studentProgress);
          
          // Merge student list with progress data and include away status
          if (studentStats.length > 0) {
            const newPlayers = studentStats.map((student: any) => {
              const progress = studentProgress.find((p: any) => p.studentId === student.studentId);
              const status = statusMap[student.studentId] || {};
              const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Unknown Student';
              
              console.log(`Student ${fullName}: score=${progress?.score}, currentQ=${progress?.currentQuestion}`);
              
              return {
                id: student.studentId,
                name: fullName,
                email: student.email || '',
                currentQuestion: progress?.currentQuestion || 0,
                score: progress?.score || 0,
                connected: !(status.away === true),
                away: !!status.away,
                totalAwayMs: status.totalAwayMs || 0,
                tabSwitches: status.tabSwitches || 0
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
      await fetch(`/api/teacher_page/assessment/${examId}/live-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'end' })
      });
      
      setPlayers([]);
      setSessionActive(false);
      showSuccess('Session ended. Ready for new students!');
    } catch (error) {
      console.error('Error ending live session:', error);
      showError('Failed to end session');
    }
  };

  const handleExitToExam = () => {
    // Check if came from class page
    const storedClassId = sessionStorage.getItem('class_origin_id');
    if (storedClassId) {
      // Redirect back to class page with correct tabs via URL params
      router.push(`/teacher_page/classes/${storedClassId}?tab=resourcesassessments&assessmentTab=exams`);
    } else if (window.history.length > 1) {
      router.back();
    } else {
      router.push(`/teacher_page/exam/${examId}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header Skeleton */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 mb-6 border-2 border-slate-200 dark:border-slate-700 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                <div>
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32 mb-2"></div>
                  <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-64 mb-3"></div>
                  <div className="flex gap-3">
                    <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-full w-28"></div>
                    <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-full w-32"></div>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="h-12 bg-slate-200 dark:bg-slate-700 rounded-xl w-36"></div>
              </div>
            </div>
          </div>

          {/* Main Content Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 border-2 border-slate-200 dark:border-slate-700 animate-pulse">
                <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-48 mb-6"></div>
                <div className="text-center py-8">
                  <div className="w-24 h-24 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-4"></div>
                  <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-64 mx-auto mb-3"></div>
                  <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-80 mx-auto mb-6"></div>
                  <div className="h-16 bg-slate-200 dark:bg-slate-700 rounded-2xl w-64 mx-auto"></div>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border-2 border-slate-200 dark:border-slate-700 animate-pulse">
              <div className="h-7 bg-slate-200 dark:bg-slate-700 rounded w-40 mb-4"></div>
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="p-4 bg-slate-100 dark:bg-slate-700/50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-200 dark:bg-slate-600 rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-5 bg-slate-200 dark:bg-slate-600 rounded w-32 mb-1"></div>
                        <div className="h-3 bg-slate-200 dark:bg-slate-600 rounded w-24"></div>
                      </div>
                      <div className="h-8 bg-slate-200 dark:bg-slate-600 rounded w-12"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
        <div className="text-slate-900 dark:text-white text-2xl">Exam not found</div>
      </div>
    );
  }

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 mb-6 border-2 border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                sessionActive ? 'bg-red-500 animate-pulse' : 'bg-yellow-500'
              }`}>
                <span className="text-3xl">{sessionActive ? '🔴' : '⏸️'}</span>
              </div>
              <div>
                <div className="text-slate-700 dark:text-white/80 text-sm font-semibold uppercase tracking-wider">
                  {sessionActive ? 'Session In Progress' : 'Lobby - Ready to Start'}
                </div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{exam.title}</h1>
                <div className="flex items-center gap-4 mt-2">
                  <div className="px-4 py-2 bg-green-500 rounded-full text-white font-semibold">
                    {players.length} Students
                  </div>
                  <div className="px-4 py-2 bg-blue-500 rounded-full text-white font-semibold">
                    {exam.questions.length} Questions
                  </div>
                  {sessionActive && (
                    <div className="px-4 py-2 bg-red-500 rounded-full text-white font-semibold animate-pulse">
                      ● LIVE
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleExitToExam}
                className="px-6 py-3 bg-slate-600 hover:bg-slate-700 text-white rounded-xl font-semibold transition-all"
              >
                ← Exit Live Mode
              </button>
              {sessionActive && (
                <button
                  onClick={handleEndSession}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-all"
                >
                  🛑 End Session
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main Content - Live Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Live Progress Overview */}
          <div className="lg:col-span-2">
            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border-2 border-white/20">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-6">
                {sessionActive ? '📊 Live Progress' : '🚪 Lobby'}
              </h2>
              
              {!sessionActive ? (
                /* LOBBY - Waiting to start */
                <div className="space-y-6">
                  <div className="text-center py-8">
                    <div className="text-6xl mb-4">📝</div>
                    <h3 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
                      {players.length > 0 ? 'Ready to Begin' : 'Waiting for Students...'}
                    </h3>
                    <p className="text-slate-700 dark:text-white/80 text-lg mb-6">
                      {players.length > 0 
                        ? 'Students are in the lobby. Start when ready.' 
                        : 'Students will join automatically from their class page'
                      }
                    </p>
                    
                    <button
                      onClick={startLiveSession}
                      disabled={players.length === 0}
                      className="px-12 py-6 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-2xl font-bold text-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-2xl"
                    >
                      🚀 Start Exam ({players.length} student{players.length !== 1 ? 's' : ''})
                    </button>
                    
                    {players.length === 0 && (
                      <p className="text-gray-500 dark:text-gray-500 text-sm mt-6">
                        💡 Waiting for students to join the lobby...
                      </p>
                    )}
                  </div>

                  {/* Lobby Leaderboard */}
                  {players.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-xl font-bold text-slate-900 dark:text-white">🏆 Leaderboard</h4>
                      {sortedPlayers.map((player, idx) => (
                        <div key={player.id} className="bg-white/20 backdrop-blur-sm rounded-xl p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                              idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-amber-600' : 'bg-slate-600'
                            }`}>
                              {idx + 1}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-white">{player.name}</div>
                              {player.email && (
                                <div className="text-xs text-slate-600 dark:text-white/60">{player.email}</div>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-slate-900 dark:text-white">{player.score}</div>
                            <div className="text-xs text-slate-700 dark:text-white/80">points</div>
                          </div>
                        </div>
                      ))}
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
                        {players.filter(p => p.currentQuestion >= exam.questions.length).length}
                      </div>
                      <div className="text-slate-700 dark:text-white/80 text-sm">Completed</div>
                    </div>
                    <div className="bg-blue-500/20 backdrop-blur-sm rounded-xl p-4 text-center">
                      <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                        {players.filter(p => p.currentQuestion > 0 && p.currentQuestion < exam.questions.length).length}
                      </div>
                      <div className="text-slate-700 dark:text-white/80 text-sm">In Progress</div>
                    </div>
                  </div>

                  {/* Student Progress Bars */}
                  <div className="space-y-3">
                    {sortedPlayers.map((player, idx) => {
                      const progress = (player.currentQuestion / exam.questions.length) * 100;
                      const isComplete = player.currentQuestion >= exam.questions.length;
                      
                      return (
                        <div key={player.id} className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gradient-to-br from-[#2E7D32] to-[#1B5E20] rounded-full flex items-center justify-center text-white font-bold text-sm">
                                {idx + 1}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-900 dark:text-white">{player.name}</div>
                                {player.email && (
                                  <div className="text-xs text-slate-600 dark:text-white/60">{player.email}</div>
                                )}
                              </div>
                              {player.away && (
                                <span className="ml-2 text-sm bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full">
                                  👁️ Away
                                </span>
                              )}
                              {player.tabSwitches !== undefined && player.tabSwitches > 0 && (
                                <span className="ml-2 text-sm bg-amber-200 text-amber-800 px-2 py-1 rounded-full">
                                  ⚠️ {player.tabSwitches}x
                                </span>
                              )}
                              {isComplete && <span className="text-green-600 dark:text-green-400">✓ Done</span>}
                            </div>
                            <div className="text-slate-700 dark:text-white/80 text-sm">
                              {player.currentQuestion}/{exam.questions.length} questions
                            </div>
                          </div>
                          <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 ${
                                isComplete ? 'bg-green-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${progress}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                )
              )}
            </div>
          </div>

          {/* Student List Sidebar */}
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border-2 border-white/20">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
              🏆 Leaderboard ({players.length})
            </h3>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {players.length === 0 ? (
                <div className="text-center py-8 text-slate-600 dark:text-white/60">
                  No students yet...
                </div>
              ) : (
                sortedPlayers.map((player, idx) => {
                  const isComplete = player.currentQuestion >= exam.questions.length;
                  return (
                    <div key={player.id} className={`p-4 rounded-xl ${
                      isComplete ? 'bg-green-500/30' : 'bg-white/20'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                            idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-amber-600' : 'bg-slate-600'
                          }`}>
                            {idx + 1}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">{player.name}</div>
                            {player.email && (
                              <div className="text-xs text-slate-600 dark:text-white/60">{player.email}</div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-slate-900 dark:text-white">{player.score}</div>
                          <div className="text-xs text-slate-700 dark:text-white/80">points</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="text-slate-700 dark:text-white/80">
                          {isComplete ? '✅ Completed' : `Question ${player.currentQuestion}/${exam.questions.length}`}
                        </div>
                        {player.away && (
                          <div className="text-amber-600 dark:text-yellow-300">👁️ Away</div>
                        )}
                      </div>
                      {player.tabSwitches !== undefined && player.tabSwitches > 0 && (
                        <div className="text-xs text-amber-600 dark:text-amber-300 mt-1">
                          ⚠️ {player.tabSwitches} tab switch{player.tabSwitches !== 1 ? 'es' : ''}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
