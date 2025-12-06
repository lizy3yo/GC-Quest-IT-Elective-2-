"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";

type QuestionType = 'mcq' | 'checkboxes' | 'short' | 'paragraph' | 'identification' | 'enumeration' | 'match';

type Question = {
  id: string;
  type: QuestionType;
  title: string;
  options?: string[];
  correctAnswer?: string | string[];
  points: number;
  requiresManualGrading?: boolean;
  pairs?: { left: string; right?: string }[];
  items?: string[];
};

type Class = {
  _id: string;
  name: string;
};

export default function CreateQUIZPage() {
  const router = useRouter();
  const { showError, showSuccess } = useToast();

  // Basic Info
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [classId, setClassId] = useState("");
  const [classes, setClasses] = useState<Class[]>([]);

  // Questions
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question>({
    id: Date.now().toString(),
    type: 'mcq',
    title: "",
    options: ["", "", "", ""],
    correctAnswer: "",
    points: 5,
  });

  // quiz-specific Settings
  const [settings, setSettings] = useState({
    // Security
    lockdownMode: false,
    preventTabSwitch: true,
    disableCopyPaste: true,
    fullscreenRequired: false,
    webcamProctoring: false,
    
    // Timing
    timeLimitMins: 60,
    autoSubmit: true,
    showTimeRemaining: true,
    
    // Scheduling
    availableFrom: "",
    dueDate: "",
    availableUntil: "",
    
    // Attempts & Grading
    maxAttempts: 1,
    passingScore: 60,
    showResults: "after_due",
    allowReview: false,
    
    // Navigation
    allowBacktrack: false,
    oneQuestionAtTime: true,
    randomizeQuestions: false,
    randomizeOptions: true,
    
    // Display
    showProgress: true,
    showQuestionNumbers: true,
    showPoints: true,
    
    // Feedback
    showCorrectAnswers: false,
    partialCredit: true,
    immediateGrading: false,
  });

  const [activeTab, setActiveTab] = useState<"basic" | "questions" | "security" | "grading" | "schedule">("basic");
  const [loading, setLoading] = useState(false);

  // Load saved draft from localStorage on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem('QUIZ_draft');
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        setTitle(draft.title || "");
        setDescription(draft.description || "");
        setInstructions(draft.instructions || "");
        setClassId(draft.classId || "");
        setQuestions(draft.questions || []);
        setSettings(draft.settings || settings);
      } catch (err) {
        console.error("Failed to load draft:", err);
      }
    }
    loadClasses();
  }, []);

  // Save draft to localStorage whenever form data changes
  useEffect(() => {
    const draft = {
      title,
      description,
      instructions,
      classId,
      questions,
      settings,
    };
    localStorage.setItem('QUIZ_draft', JSON.stringify(draft));
  }, [title, description, instructions, classId, questions, settings]);

  const loadClasses = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/teacher_page/class', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setClasses(data.data?.classes || []);
      }
    } catch (err) {
      console.error("Failed to load classes:", err);
    }
  };

  const handleAddQuestion = () => {
    if (!currentQuestion.title.trim()) {
      showError("Please enter a question");
      return;
    }
    
    if (currentQuestion.type === 'mcq' || currentQuestion.type === 'checkboxes') {
      const validOptions = currentQuestion.options?.filter(opt => opt.trim()) || [];
      if (validOptions.length < 2) {
        showError("Please add at least 2 options");
        return;
      }
      if (!currentQuestion.correctAnswer || (Array.isArray(currentQuestion.correctAnswer) && currentQuestion.correctAnswer.length === 0)) {
        showError("Please select the correct answer");
        return;
      }
    }

    setQuestions([...questions, { ...currentQuestion }]);
    setCurrentQuestion({
      id: Date.now().toString(),
      type: 'mcq',
      title: "",
      options: ["", "", "", ""],
      correctAnswer: "",
      points: 5,
    });
  };

  const handleRemoveQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const handleUpdateOption = (index: number, value: string) => {
    const newOptions = [...(currentQuestion.options || [])];
    newOptions[index] = value;
    setCurrentQuestion({ ...currentQuestion, options: newOptions });
  };

  const handleAddOption = () => {
    setCurrentQuestion({
      ...currentQuestion,
      options: [...(currentQuestion.options || []), ""]
    });
  };

  const handleSaveQUIZ = async (publish: boolean = false) => {
    if (!title.trim()) {
      showError("Please enter an quiz title");
      return;
    }

    if (questions.length === 0) {
      showError("Please add at least one question");
      return;
    }

    if (!settings.dueDate && publish) {
      showError("Please set a due date before publishing");
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);
      
      const res = await fetch('/api/teacher_page/assessment', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description,
          instructions,
          category: 'quiz',
          type: 'Mixed',
          format: 'online',
          classId: classId || undefined,
          questions,
          published: publish,
          timeLimitMins: settings.timeLimitMins,
          maxAttempts: settings.maxAttempts,
          passingScore: settings.passingScore,
          dueDate: settings.dueDate || undefined,
          availableFrom: settings.availableFrom || undefined,
          availableUntil: settings.availableUntil || undefined,
          shuffleQuestions: settings.randomizeQuestions,
          shuffleOptions: settings.randomizeOptions,
          showResults: settings.showResults,
          allowReview: settings.allowReview,
          totalPoints,
          settings: {
            lockdown: settings.lockdownMode,
            showProgress: settings.showProgress,
            allowBacktrack: settings.allowBacktrack,
            autoSubmit: settings.autoSubmit,
          }
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Clear draft from localStorage after successful save
        localStorage.removeItem('QUIZ_draft');
        showSuccess(publish ? "quiz published successfully!" : "quiz saved as draft");
        router.push(`/teacher_page/quiz/${data.data._id}`);
      } else {
        throw new Error("Failed to save quiz");
      }
    } catch (err) {
      showError("Failed to save quiz");
    } finally {
      setLoading(false);
    }
  };

  const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl mb-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  if (window.history.length > 1) {
                    router.back();
                  } else {
                    router.push('/teacher_page/assessment');
                  }
                }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                ← Back
              </button>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent">
                  📋 Create New quiz
                </h1>
                <p className="text-slate-600 dark:text-slate-400">Design comprehensive QUIZs with advanced security</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleSaveQUIZ(false)}
                disabled={loading}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50"
              >
                💾 Save Draft
              </button>
              <button
                onClick={() => handleSaveQUIZ(true)}
                disabled={loading}
                className="px-6 py-2 bg-gradient-to-r from-rose-600 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50"
              >
                ✅ Publish quiz
              </button>
            </div>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-lg mb-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Questions:</span>
              <span className="px-3 py-1 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-full font-semibold">
                {questions.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Total Points:</span>
              <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full font-semibold">
                {totalPoints}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Time Limit:</span>
              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full font-semibold">
                {settings.timeLimitMins}m
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Security:</span>
              <span className={`px-3 py-1 rounded-full font-semibold ${
                settings.lockdownMode 
                  ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-400"
              }`}>
                {settings.lockdownMode ? "🔒 Locked" : "🔓 Normal"}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
          <div className="flex gap-2 p-2 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
            {[
              { key: "basic", label: "Basic Info", icon: "📝" },
              { key: "questions", label: "Questions", icon: "❓", badge: questions.length },
              { key: "security", label: "Security", icon: "🔒" },
              { key: "grading", label: "Grading", icon: "📊" },
              { key: "schedule", label: "Schedule", icon: "📅" }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex-1 px-4 py-3 rounded-xl font-semibold transition-all relative whitespace-nowrap ${
                  activeTab === tab.key
                    ? "bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-md"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                }`}
              >
                {tab.icon} {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-1 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Basic Info Tab */}
            {activeTab === "basic" && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold mb-2">quiz Title *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter quiz title..."
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add a description for your quiz..."
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">quiz Instructions</label>
                  <textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="Add detailed instructions for students..."
                    rows={5}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Assign to Class *</label>
                  <select
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                  >
                    <option value="">Select a class</option>
                    {classes.map((cls) => (
                      <option key={cls._id} value={cls._id}>{cls.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Questions Tab */}
            {activeTab === "questions" && (
              <div className="space-y-6">
                {/* Same as quiz but with different styling */}
                {questions.length > 0 && (
                  <div className="space-y-3 mb-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Added Questions ({questions.length})</h3>
                    {questions.map((q, idx) => (
                      <div key={q.id} className="p-4 bg-rose-50 dark:bg-rose-900/20 rounded-xl border border-rose-200 dark:border-rose-800">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="px-3 py-1 bg-rose-600 text-white rounded-full text-xs font-semibold">
                                Q{idx + 1}
                              </span>
                              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-semibold">
                                {q.type.toUpperCase()}
                              </span>
                              <span className="text-sm text-slate-600 dark:text-slate-400">{q.points} pts</span>
                              {q.requiresManualGrading && (
                                <span className="px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-full text-xs font-semibold">
                                  Manual Grading
                                </span>
                              )}
                            </div>
                            <div className="font-semibold">{q.title}</div>
                          </div>
                          <button
                            onClick={() => handleRemoveQuestion(q.id)}
                            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add New Question - Similar to quiz */}
                <div className="p-6 bg-slate-50 dark:bg-slate-700/50 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Add New Question</h3>

                  <div className="mb-4">
                    <label className="block text-sm font-semibold mb-2">Question Type</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { type: 'mcq', label: 'Multiple Choice', icon: '⭕' },
                        { type: 'checkboxes', label: 'Checkboxes', icon: '☑️' },
                        { type: 'short', label: 'Short Answer', icon: '✍️' },
                        { type: 'paragraph', label: 'Essay', icon: '📄' },
                        { type: 'identification', label: 'Fill in Blank', icon: '📝' },
                        { type: 'enumeration', label: 'List', icon: '📋' },
                        { type: 'match', label: 'Matching', icon: '🔗' },
                      ].map((qt) => (
                        <button
                          key={qt.type}
                          onClick={() => {
                            const requiresManual = ['short', 'paragraph'].includes(qt.type);
                            setCurrentQuestion({ 
                              ...currentQuestion, 
                              type: qt.type as QuestionType,
                              requiresManualGrading: requiresManual
                            });
                          }}
                          className={`p-3 rounded-xl font-semibold transition-all ${
                            currentQuestion.type === qt.type
                              ? "bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-md"
                              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600"
                          }`}
                        >
                          <div className="text-2xl mb-1">{qt.icon}</div>
                          <div className="text-xs">{qt.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-semibold mb-2">Question *</label>
                    <input
                      type="text"
                      value={currentQuestion.title}
                      onChange={(e) => setCurrentQuestion({ ...currentQuestion, title: e.target.value })}
                      placeholder="Enter your question..."
                      className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                    />
                  </div>

                  {(currentQuestion.type === 'mcq' || currentQuestion.type === 'checkboxes') && (
                    <div className="mb-4">
                      <label className="block text-sm font-semibold mb-2">Answer Options</label>
                      <div className="space-y-2">
                        {currentQuestion.options?.map((option, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input
                              type={currentQuestion.type === 'mcq' ? 'radio' : 'checkbox'}
                              name="correct-answer"
                              checked={
                                currentQuestion.type === 'mcq'
                                  ? currentQuestion.correctAnswer === option
                                  : Array.isArray(currentQuestion.correctAnswer) && currentQuestion.correctAnswer.includes(option)
                              }
                              onChange={() => {
                                if (currentQuestion.type === 'mcq') {
                                  setCurrentQuestion({ ...currentQuestion, correctAnswer: option });
                                } else {
                                  const current = Array.isArray(currentQuestion.correctAnswer) ? currentQuestion.correctAnswer : [];
                                  const newAnswers = current.includes(option)
                                    ? current.filter(a => a !== option)
                                    : [...current, option];
                                  setCurrentQuestion({ ...currentQuestion, correctAnswer: newAnswers });
                                }
                              }}
                              className="w-5 h-5"
                            />
                            <input
                              type="text"
                              value={option}
                              onChange={(e) => handleUpdateOption(idx, e.target.value)}
                              placeholder={`Option ${idx + 1}`}
                              className="flex-1 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                            />
                          </div>
                        ))}
                        <button
                          onClick={handleAddOption}
                          className="px-4 py-2 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-lg font-semibold hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-all"
                        >
                          + Add Option
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mb-4">
                    <label className="block text-sm font-semibold mb-2">Points</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={currentQuestion.points}
                      onChange={(e) => setCurrentQuestion({ ...currentQuestion, points: parseInt(e.target.value) || 5 })}
                      className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg"
                    />
                  </div>

                  <button
                    onClick={handleAddQuestion}
                    className="w-full px-6 py-3 bg-gradient-to-r from-rose-600 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                  >
                    ➕ Add Question
                  </button>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === "security" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">🔒 Security Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold flex items-center gap-2">
                            <span>🔒</span> Lockdown Mode
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">Maximum security</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.lockdownMode}
                            onChange={(e) => setSettings({ ...settings, lockdownMode: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-rose-300 dark:peer-focus:ring-rose-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-rose-600"></div>
                        </label>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">Prevent Tab Switch</div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">Detect tab changes</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.preventTabSwitch}
                            onChange={(e) => setSettings({ ...settings, preventTabSwitch: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-rose-300 dark:peer-focus:ring-rose-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-rose-600"></div>
                        </label>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">Disable Copy/Paste</div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">Prevent cheating</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.disableCopyPaste}
                            onChange={(e) => setSettings({ ...settings, disableCopyPaste: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-rose-300 dark:peer-focus:ring-rose-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-rose-600"></div>
                        </label>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">Fullscreen Required</div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">Force fullscreen mode</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.fullscreenRequired}
                            onChange={(e) => setSettings({ ...settings, fullscreenRequired: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-rose-300 dark:peer-focus:ring-rose-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-rose-600"></div>
                        </label>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">📹 Webcam Proctoring</div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">Monitor via webcam</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.webcamProctoring}
                            onChange={(e) => setSettings({ ...settings, webcamProctoring: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-rose-300 dark:peer-focus:ring-rose-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-rose-600"></div>
                        </label>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">Auto Submit</div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">Submit when time expires</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.autoSubmit}
                            onChange={(e) => setSettings({ ...settings, autoSubmit: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-rose-300 dark:peer-focus:ring-rose-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-rose-600"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">📐 Navigation Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">Allow Backtrack</div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">Go back to questions</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.allowBacktrack}
                            onChange={(e) => setSettings({ ...settings, allowBacktrack: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-rose-300 dark:peer-focus:ring-rose-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-rose-600"></div>
                        </label>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">One Question at a Time</div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">Single question view</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.oneQuestionAtTime}
                            onChange={(e) => setSettings({ ...settings, oneQuestionAtTime: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-rose-300 dark:peer-focus:ring-rose-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-rose-600"></div>
                        </label>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">Randomize Questions</div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">Shuffle question order</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.randomizeQuestions}
                            onChange={(e) => setSettings({ ...settings, randomizeQuestions: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-rose-300 dark:peer-focus:ring-rose-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-rose-600"></div>
                        </label>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">Randomize Options</div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">Shuffle answer choices</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.randomizeOptions}
                            onChange={(e) => setSettings({ ...settings, randomizeOptions: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-rose-300 dark:peer-focus:ring-rose-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-rose-600"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Time Limit (minutes)</label>
                  <input
                    type="number"
                    min="15"
                    max="480"
                    value={settings.timeLimitMins}
                    onChange={(e) => setSettings({ ...settings, timeLimitMins: parseInt(e.target.value) || 60 })}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl"
                  />
                </div>
              </div>
            )}

            {/* Grading Tab */}
            {activeTab === "grading" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">📊 Grading Settings</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold mb-2">Passing Score (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={settings.passingScore}
                        onChange={(e) => setSettings({ ...settings, passingScore: parseInt(e.target.value) || 60 })}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-2">Maximum Attempts</label>
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={settings.maxAttempts}
                        onChange={(e) => setSettings({ ...settings, maxAttempts: parseInt(e.target.value) || 1 })}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-2">Show Results</label>
                      <select
                        value={settings.showResults}
                        onChange={(e) => setSettings({ ...settings, showResults: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl"
                      >
                        <option value="immediately">Immediately after submission</option>
                        <option value="after_due">After due date</option>
                        <option value="never">Never (manual release)</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold">Allow Review</div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">Let students review</div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.allowReview}
                              onChange={(e) => setSettings({ ...settings, allowReview: e.target.checked })}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-rose-300 dark:peer-focus:ring-rose-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-rose-600"></div>
                          </label>
                        </div>
                      </div>

                      <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold">Partial Credit</div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">Award partial points</div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={settings.partialCredit}
                              onChange={(e) => setSettings({ ...settings, partialCredit: e.target.checked })}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-rose-300 dark:peer-focus:ring-rose-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-rose-600"></div>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Schedule Tab */}
            {activeTab === "schedule" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">📅 Schedule Settings</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">Available From</label>
                      <input
                        type="datetime-local"
                        value={settings.availableFrom}
                        onChange={(e) => setSettings({ ...settings, availableFrom: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white dark:[color-scheme:dark]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">Due Date *</label>
                      <input
                        type="datetime-local"
                        value={settings.dueDate}
                        onChange={(e) => setSettings({ ...settings, dueDate: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white dark:[color-scheme:dark]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">Available Until</label>
                      <input
                        type="datetime-local"
                        value={settings.availableUntil}
                        onChange={(e) => setSettings({ ...settings, availableUntil: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white dark:[color-scheme:dark]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
