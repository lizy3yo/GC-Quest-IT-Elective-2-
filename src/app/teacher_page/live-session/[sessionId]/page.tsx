"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";

interface Participant {
  id: string;
  name: string;
  avatar?: string;
  score: number;
  streak: number;
  lastAnswerTime?: number;
  isConnected: boolean;
}

interface Question {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  timeLimit: number;
  points: number;
}

interface Answer {
  studentId: string;
  studentName: string;
  answerIndex: number;
  isCorrect: boolean;
  timeElapsed: number;
  points: number;
}

type SessionState = 'lobby' | 'question' | 'results' | 'leaderboard' | 'finished';

export default function LiveSessionPage() {
  const params = useParams();
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const sessionId = params?.sessionId as string;

  // Session data
  const [sessionState, setSessionState] = useState<SessionState>('lobby');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [sessionCode, setSessionCode] = useState("");
  const [sessionTitle, setSessionTitle] = useState("");

  // WebSocket for real-time updates
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load session data
  useEffect(() => {
    if (!sessionId) return;
    
    const loadSession = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const response = await fetch(`/api/teacher_page/live-session/${sessionId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });

        const data = await response.json();
        if (data.success) {
          setQuestions(data.session.questions || []);
          setSessionCode(data.session.code);
          setSessionTitle(data.session.title);
          setParticipants(data.session.participants || []);
        }
      } catch (error) {
        console.error('Failed to load session:', error);
        showError('Failed to load session', 'Error');
      }
    };

    loadSession();
  }, [sessionId]);

  // WebSocket connection
  useEffect(() => {
    if (!sessionId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/websocket?session=${sessionId}&type=teacher`;

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
      };

      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case 'participant_joined':
            setParticipants(prev => [...prev, data.participant]);
            showSuccess(`${data.participant.name} joined!`, 'New Participant');
            break;
          
          case 'participant_left':
            setParticipants(prev => prev.filter(p => p.id !== data.participantId));
            break;
          
          case 'answer_submitted':
            setAnswers(prev => [...prev, data.answer]);
            break;
          
          case 'session_ended':
            setSessionState('finished');
            break;
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected');
      };

    } catch (error) {
      console.error('WebSocket connection failed:', error);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [sessionId]);

  // Timer for questions
  useEffect(() => {
    if (sessionState === 'question') {
      const currentQuestion = questions[currentQuestionIndex];
      if (!currentQuestion) return;

      setTimeRemaining(currentQuestion.timeLimit);

      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            showResults();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      };
    }
  }, [sessionState, currentQuestionIndex]);

  const startSession = () => {
    if (participants.length === 0) {
      showError('Wait for participants to join', 'No Participants');
      return;
    }
    setSessionState('question');
    broadcastMessage({ type: 'session_started' });
  };

  const showResults = () => {
    setSessionState('results');
    calculateScores();
    broadcastMessage({ 
      type: 'show_results',
      questionId: questions[currentQuestionIndex].id,
      correctAnswer: questions[currentQuestionIndex].correctAnswer
    });
  };

  const calculateScores = () => {
    const currentQuestion = questions[currentQuestionIndex];
    const updatedParticipants = participants.map(p => {
      const answer = answers.find(a => a.studentId === p.id);
      if (!answer) return p;

      const basePoints = answer.isCorrect ? currentQuestion.points : 0;
      const timeBonus = answer.isCorrect 
        ? Math.floor((1 - answer.timeElapsed / currentQuestion.timeLimit) * (currentQuestion.points * 0.5))
        : 0;
      const totalPoints = basePoints + timeBonus;

      return {
        ...p,
        score: p.score + totalPoints,
        streak: answer.isCorrect ? p.streak + 1 : 0,
        lastAnswerTime: answer.timeElapsed
      };
    });

    setParticipants(updatedParticipants);
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setAnswers([]);
      setSessionState('leaderboard');
      
      setTimeout(() => {
        setSessionState('question');
        broadcastMessage({ 
          type: 'next_question',
          questionIndex: currentQuestionIndex + 1
        });
      }, 5000);
    } else {
      endSession();
    }
  };

  const endSession = () => {
    setSessionState('finished');
    broadcastMessage({ type: 'session_ended' });
  };

  const broadcastMessage = (message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  };

  const copySessionCode = () => {
    navigator.clipboard.writeText(sessionCode);
    showSuccess('Session code copied!', 'Copied');
  };

  const currentQuestion = questions[currentQuestionIndex];
  const sortedParticipants = [...participants].sort((a, b) => b.score - a.score);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-800 to-orange-700 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 mb-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{sessionTitle}</h1>
              <div className="flex items-center gap-4">
                <div className="bg-white/20 px-4 py-2 rounded-full">
                  <span className="text-white font-mono text-lg">Code: {sessionCode}</span>
                </div>
                <button
                  onClick={copySessionCode}
                  className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-full text-white transition-colors"
                >
                  📋 Copy
                </button>
              </div>
            </div>
            <div className="text-right">
              <div className="text-5xl font-bold text-white mb-2">
                {participants.length}
              </div>
              <div className="text-white/80">Participants</div>
            </div>
          </div>
        </div>

        {/* Lobby */}
        {sessionState === 'lobby' && (
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-12 border border-white/20 text-center">
              <div className="text-8xl mb-6">🎮</div>
              <h2 className="text-4xl font-bold text-white mb-4">Waiting for Players...</h2>
              <p className="text-xl text-white/80 mb-8">
                Students can join using code: <span className="font-mono font-bold">{sessionCode}</span>
              </p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {participants.map((p) => (
                  <div key={p.id} className="bg-white/20 rounded-2xl p-4 text-center transform hover:scale-105 transition-transform">
                    <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full mx-auto mb-2 flex items-center justify-center text-2xl">
                      {p.avatar || '👤'}
                    </div>
                    <div className="text-white font-semibold">{p.name}</div>
                  </div>
                ))}
              </div>

              <button
                onClick={startSession}
                disabled={participants.length === 0}
                className={`px-12 py-6 rounded-2xl text-2xl font-bold transition-all transform hover:scale-105 ${
                  participants.length === 0
                    ? 'bg-gray-500 cursor-not-allowed text-gray-300'
                    : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-2xl'
                }`}
              >
                🚀 Start Session
              </button>
            </div>
          </div>
        )}

        {/* Question State */}
        {sessionState === 'question' && currentQuestion && (
          <div className="space-y-6">
            {/* Progress & Timer */}
            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <div className="text-white/80">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-white/80">
                    {answers.length} / {participants.length} answered
                  </div>
                  <div className={`text-4xl font-bold ${timeRemaining <= 5 ? 'text-red-300 animate-pulse' : 'text-white'}`}>
                    {timeRemaining}s
                  </div>
                </div>
              </div>
              <div className="w-full bg-white/20 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-cyan-400 to-blue-500 h-3 rounded-full transition-all duration-1000"
                  style={{ width: `${(timeRemaining / currentQuestion.timeLimit) * 100}%` }}
                />
              </div>
            </div>

            {/* Question */}
            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-12 border border-white/20 text-center">
              <h2 className="text-4xl font-bold text-white mb-12">{currentQuestion.question}</h2>
              
              <div className="grid grid-cols-2 gap-6">
                {currentQuestion.options.map((option, index) => {
                  const answerCount = answers.filter(a => a.answerIndex === index).length;
                  const colors = [
                    'from-red-500 to-pink-500',
                    'from-blue-500 to-cyan-500',
                    'from-yellow-500 to-orange-500',
                    'from-green-500 to-emerald-500'
                  ];
                  
                  return (
                    <div
                      key={index}
                      className={`bg-gradient-to-br ${colors[index]} rounded-3xl p-8 transform transition-all relative overflow-hidden`}
                    >
                      <div className="relative z-10">
                        <div className="text-6xl font-bold text-white mb-4">
                          {['A', 'B', 'C', 'D'][index]}
                        </div>
                        <div className="text-2xl text-white font-semibold mb-4">
                          {option}
                        </div>
                        <div className="text-lg text-white/80">
                          {answerCount} {answerCount === 1 ? 'answer' : 'answers'}
                        </div>
                      </div>
                      {answerCount > 0 && (
                        <div
                          className="absolute bottom-0 left-0 right-0 bg-white/30 transition-all duration-500"
                          style={{ height: `${(answerCount / participants.length) * 100}%` }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-4 justify-center">
              <button
                onClick={showResults}
                className="bg-white/20 hover:bg-white/30 px-8 py-4 rounded-2xl text-white font-bold transition-colors"
              >
                ⏭️ Skip to Results
              </button>
            </div>
          </div>
        )}

        {/* Results State */}
        {sessionState === 'results' && currentQuestion && (
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-12 border border-white/20 text-center">
              <h2 className="text-4xl font-bold text-white mb-8">📊 Results</h2>
              
              <div className="grid grid-cols-2 gap-6 mb-8">
                {currentQuestion.options.map((option, index) => {
                  const answerCount = answers.filter(a => a.answerIndex === index).length;
                  const isCorrect = index === currentQuestion.correctAnswer;
                  const percentage = participants.length > 0 
                    ? Math.round((answerCount / participants.length) * 100)
                    : 0;
                  
                  return (
                    <div
                      key={index}
                      className={`rounded-3xl p-8 transform transition-all ${
                        isCorrect
                          ? 'bg-gradient-to-br from-green-500 to-emerald-500 ring-4 ring-green-300'
                          : 'bg-white/20'
                      }`}
                    >
                      <div className="text-4xl font-bold text-white mb-2">
                        {['A', 'B', 'C', 'D'][index]}
                      </div>
                      <div className="text-xl text-white font-semibold mb-4">
                        {option}
                      </div>
                      <div className="text-3xl font-bold text-white mb-2">
                        {percentage}%
                      </div>
                      <div className="text-white/80">
                        {answerCount} {answerCount === 1 ? 'student' : 'students'}
                      </div>
                      {isCorrect && (
                        <div className="mt-4 text-2xl">✅</div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                onClick={nextQuestion}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-12 py-6 rounded-2xl text-2xl font-bold text-white shadow-2xl transform hover:scale-105 transition-all"
              >
                {currentQuestionIndex < questions.length - 1 ? '➡️ Next Question' : '🏁 Finish Session'}
              </button>
            </div>
          </div>
        )}

        {/* Leaderboard State */}
        {sessionState === 'leaderboard' && (
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-12 border border-white/20">
            <h2 className="text-4xl font-bold text-white text-center mb-8">🏆 Leaderboard</h2>
            
            <div className="space-y-4">
              {sortedParticipants.slice(0, 10).map((p, index) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-4 p-6 rounded-2xl transform transition-all ${
                    index === 0
                      ? 'bg-gradient-to-r from-yellow-500 to-orange-500 scale-105'
                      : index === 1
                      ? 'bg-gradient-to-r from-gray-400 to-gray-500'
                      : index === 2
                      ? 'bg-gradient-to-r from-orange-600 to-orange-700'
                      : 'bg-white/20'
                  }`}
                >
                  <div className="text-4xl font-bold text-white w-16">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                  </div>
                  <div className="flex-1">
                    <div className="text-2xl font-bold text-white">{p.name}</div>
                    {p.streak > 1 && (
                      <div className="text-white/80">🔥 {p.streak} streak!</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-white">{p.score.toLocaleString()}</div>
                    <div className="text-white/80">points</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Finished State */}
        {sessionState === 'finished' && (
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-12 border border-white/20 text-center">
            <div className="text-8xl mb-6">🎉</div>
            <h2 className="text-5xl font-bold text-white mb-8">Session Complete!</h2>
            
            {sortedParticipants.length > 0 && (
              <div className="mb-12">
                <h3 className="text-3xl font-bold text-white mb-6">🏆 Top 3</h3>
                <div className="flex justify-center gap-8">
                  {sortedParticipants.slice(0, 3).map((p, index) => (
                    <div key={p.id} className="text-center">
                      <div className="text-6xl mb-2">
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                      </div>
                      <div className="text-2xl font-bold text-white mb-2">{p.name}</div>
                      <div className="text-4xl font-bold text-yellow-300">{p.score}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-4 justify-center">
              <button
                onClick={() => router.push('/teacher_page/history')}
                className="bg-white/20 hover:bg-white/30 px-8 py-4 rounded-2xl text-white font-bold transition-colors"
              >
                📊 View Details
              </button>
              <button
                onClick={() => router.push('/teacher_page/ai-studio')}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-8 py-4 rounded-2xl text-white font-bold transition-colors"
              >
                ➕ Create New Session
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
