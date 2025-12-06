"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAlert } from "@/hooks/useAlert";

type Quiz = {
  _id: string;
  title: string;
  description?: string;
  questions?: any[];
};

type SessionSettings = {
  gameMode: 'classic' | 'team' | 'race' | 'challenge';
  showLeaderboard: boolean;
  musicEnabled: boolean;
  pointsMultiplier: number;
  timeBonus: boolean;
  powerUpsEnabled: boolean;
  randomNameGenerator: boolean;
};

export default function LiveSessionPage() {
  const router = useRouter();
  const { showError, showSuccess } = useAlert();

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [sessionCode, setSessionCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [sessionActive, setSessionActive] = useState(false);
  const [participants, setParticipants] = useState<any[]>([]);
  
  const [settings, setSettings] = useState<SessionSettings>({
    gameMode: 'classic',
    showLeaderboard: true,
    musicEnabled: true,
    pointsMultiplier: 1,
    timeBonus: true,
    powerUpsEnabled: false,
    randomNameGenerator: true,
  });

  useEffect(() => {
    loadQuizzes();
  }, []);

  const loadQuizzes = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/teacher_page/assessment?category=Quiz&published=true', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setQuizzes(data.data?.assessments || []);
      }
    } catch (err) {
      showError("Failed to load quizzes");
    } finally {
      setLoading(false);
    }
  };

  const generateSessionCode = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setSessionCode(code);
    return code;
  };

  const handleStartSession = () => {
    if (!selectedQuiz) {
      showError("Please select a quiz first");
      return;
    }

    const code = generateSessionCode();
    setSessionActive(true);
    showSuccess(`Live session started! Code: ${code}`);
  };

  const handleEndSession = () => {
    setSessionActive(false);
    setParticipants([]);
    setSessionCode("");
    showSuccess("Session ended");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#1C2B1C] dark:border-white border-t-transparent"></div>
      </div>
    );
  }

  if (sessionActive && selectedQuiz) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Live Session Header */}
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 mb-6 border-2 border-white/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                  <span className="text-3xl">🔴</span>
                </div>
                <div>
                  <div className="text-white/80 text-sm font-semibold uppercase tracking-wider">Live Session</div>
                  <h1 className="text-3xl font-bold text-white">{selectedQuiz.title}</h1>
                  <div className="flex items-center gap-4 mt-2">
                    <div className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full text-white font-bold text-2xl">
                      {sessionCode}
                    </div>
                    <div className="px-4 py-2 bg-green-500 rounded-full text-white font-semibold">
                      {participants.length} Players
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleEndSession}
                  className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-all"
                >
                  🛑 End Session
                </button>
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Game Controls */}
            <div className="lg:col-span-2 space-y-6">
              {/* Waiting Lobby */}
              <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border-2 border-white/20">
                <div className="text-center">
                  <div className="text-8xl mb-6 animate-bounce">🎮</div>
                  <h2 className="text-4xl font-bold text-white mb-4">Waiting for Players...</h2>
                  <p className="text-white/80 text-xl mb-8">
                    Students can join using the code above at <br />
                    <span className="font-mono font-bold text-2xl text-yellow-300">gcquest.com/join</span>
                  </p>
                  
                  {/* QR Code Placeholder */}
                  <div className="bg-white rounded-2xl p-8 inline-block mb-6">
                    <div className="w-48 h-48 bg-slate-200 rounded-xl flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-6xl mb-2">📱</div>
                        <div className="text-sm text-slate-600">QR Code</div>
                      </div>
                    </div>
                  </div>

                  {/* Game Controls */}
                  <div className="space-y-4">
                    <button
                      disabled={participants.length === 0}
                      className="w-full px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-2xl font-bold text-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-2xl hover:scale-105"
                    >
                      🚀 Start Game
                    </button>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <button className="px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-xl font-semibold transition-all">
                        ⚙️ Settings
                      </button>
                      <button className="px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-xl font-semibold transition-all">
                        🎵 {settings.musicEnabled ? 'Music ON' : 'Music OFF'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Participants List */}
            <div className="space-y-6">
              <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border-2 border-white/20">
                <h3 className="text-2xl font-bold text-white mb-4">
                  Players ({participants.length})
                </h3>
                
                {participants.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">👥</div>
                    <p className="text-white/60">No players yet</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {participants.map((p, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-white/20 backdrop-blur-sm rounded-xl flex items-center gap-3 animate-slideIn"
                      >
                        <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold">
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-white">{p.name}</div>
                        </div>
                        <div className="text-white/80">✓</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Stats */}
              <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 border-2 border-white/20">
                <h3 className="text-xl font-bold text-white mb-4">Session Info</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-white">
                    <span>Questions</span>
                    <span className="font-bold">{selectedQuiz.questions?.length || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-white">
                    <span>Game Mode</span>
                    <span className="font-bold capitalize">{settings.gameMode}</span>
                  </div>
                  <div className="flex items-center justify-between text-white">
                    <span>Time Bonus</span>
                    <span className="font-bold">{settings.timeBonus ? 'ON' : 'OFF'}</span>
                  </div>
                  <div className="flex items-center justify-between text-white">
                    <span>Leaderboard</span>
                    <span className="font-bold">{settings.showLeaderboard ? 'ON' : 'OFF'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Quiz Selection Screen
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 mb-8 border-2 border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-5xl font-bold text-white mb-2 flex items-center gap-4">
                🔴 Live Quiz Session
                <span className="text-3xl animate-pulse">●</span>
              </h1>
              <p className="text-white/80 text-xl">
                Host interactive quizzes like Kahoot & Quizizz
              </p>
            </div>
            <button
              onClick={() => {
                if (window.history.length > 1) {
                  router.back();
                } else {
                  router.push('/teacher_page/assessment');
                }
              }}
              className="px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-xl font-semibold transition-all"
            >
              ← Back
            </button>
          </div>
        </div>

        {/* Game Mode Selection */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 mb-8 border-2 border-white/20">
          <h2 className="text-3xl font-bold text-white mb-6">🎮 Choose Game Mode</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { 
                mode: 'classic', 
                label: 'Classic', 
                icon: '🎯', 
                desc: 'Individual play',
                color: 'from-blue-500 to-cyan-500'
              },
              { 
                mode: 'team', 
                label: 'Team Mode', 
                icon: '👥', 
                desc: 'Collaborate in teams',
                color: 'from-green-500 to-emerald-500'
              },
              { 
                mode: 'race', 
                label: 'Race Mode', 
                icon: '🏁', 
                desc: 'Speed competition',
                color: 'from-orange-500 to-red-500'
              },
              { 
                mode: 'challenge', 
                label: 'Challenge', 
                icon: '⚡', 
                desc: 'Survival mode',
                color: 'from-purple-500 to-pink-500'
              },
            ].map((mode) => (
              <button
                key={mode.mode}
                onClick={() => setSettings({ ...settings, gameMode: mode.mode as any })}
                className={`p-6 rounded-2xl font-bold transition-all transform hover:scale-105 ${
                  settings.gameMode === mode.mode
                    ? `bg-gradient-to-br ${mode.color} text-white shadow-2xl scale-105`
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                <div className="text-5xl mb-3">{mode.icon}</div>
                <div className="text-xl mb-1">{mode.label}</div>
                <div className="text-sm opacity-80">{mode.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Quiz Selection */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 mb-8 border-2 border-white/20">
          <h2 className="text-3xl font-bold text-white mb-6">📝 Select Quiz</h2>
          
          {quizzes.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📚</div>
              <p className="text-white/80 text-xl mb-6">No published quizzes available</p>
              <button
                onClick={() => router.push('/teacher_page/quiz/create')}
                className="px-6 py-3 bg-white text-purple-900 rounded-xl font-semibold hover:shadow-xl transition-all"
              >
                Create Your First Quiz
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quizzes.map((quiz) => (
                <div
                  key={quiz._id}
                  onClick={() => setSelectedQuiz(quiz)}
                  className={`p-6 rounded-2xl cursor-pointer transition-all transform hover:scale-105 ${
                    selectedQuiz?._id === quiz._id
                      ? 'bg-white text-purple-900 shadow-2xl scale-105'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="text-4xl">🎯</div>
                    <div className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-sm font-semibold">
                      {quiz.questions?.length || 0} questions
                    </div>
                  </div>
                  <h3 className="text-xl font-bold mb-2">{quiz.title}</h3>
                  {quiz.description && (
                    <p className="text-sm opacity-80 line-clamp-2">{quiz.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Advanced Settings */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 mb-8 border-2 border-white/20">
          <h2 className="text-3xl font-bold text-white mb-6">⚙️ Advanced Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white/10 rounded-xl">
                <div className="text-white">
                  <div className="font-semibold">Show Leaderboard</div>
                  <div className="text-sm opacity-80">Display rankings during game</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showLeaderboard}
                    onChange={(e) => setSettings({ ...settings, showLeaderboard: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-14 h-7 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-500"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-white/10 rounded-xl">
                <div className="text-white">
                  <div className="font-semibold">Background Music</div>
                  <div className="text-sm opacity-80">Play music during session</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.musicEnabled}
                    onChange={(e) => setSettings({ ...settings, musicEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-14 h-7 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-500"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-white/10 rounded-xl">
                <div className="text-white">
                  <div className="font-semibold">Time Bonus Points</div>
                  <div className="text-sm opacity-80">Reward faster answers</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.timeBonus}
                    onChange={(e) => setSettings({ ...settings, timeBonus: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-14 h-7 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-500"></div>
                </label>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white/10 rounded-xl">
                <div className="text-white">
                  <div className="font-semibold">Power-Ups</div>
                  <div className="text-sm opacity-80">Enable special abilities</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.powerUpsEnabled}
                    onChange={(e) => setSettings({ ...settings, powerUpsEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-14 h-7 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-500"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 bg-white/10 rounded-xl">
                <div className="text-white">
                  <div className="font-semibold">Random Names</div>
                  <div className="text-sm opacity-80">Generate fun nicknames</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.randomNameGenerator}
                    onChange={(e) => setSettings({ ...settings, randomNameGenerator: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-14 h-7 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-500"></div>
                </label>
              </div>

              <div className="p-4 bg-white/10 rounded-xl">
                <div className="text-white mb-3">
                  <div className="font-semibold">Points Multiplier</div>
                  <div className="text-sm opacity-80">Adjust scoring difficulty</div>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={settings.pointsMultiplier}
                  onChange={(e) => setSettings({ ...settings, pointsMultiplier: parseInt(e.target.value) })}
                  className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-white text-sm mt-2">
                  <span>1x</span>
                  <span className="font-bold text-yellow-300">{settings.pointsMultiplier}x</span>
                  <span>5x</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Start Button removed by request */}
      </div>
    </div>
  );
}
