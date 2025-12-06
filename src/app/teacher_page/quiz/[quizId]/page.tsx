"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAlert } from "@/hooks/useAlert";
import KahootQuestionEditor, { Question as EditorQuestion } from "@/components/organisms/quiz/quiz/KahootQuestionEditor";
import StudentPreview from "@/components/organisms/quiz/quiz/StudentPreview";
import {
  Target, CheckCircle, Edit, Eye, Play, Lock, Unlock, 
  FileText, HelpCircle, BarChart3, Settings,
  Calendar, Clock, Users, Star, Trophy, Timer
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/atoms";

type Quiz = {
  _id: string;
  title: string;
  description?: string;
  category: string;
  published?: boolean;
  classId?: string;
  className?: string;
  questions?: any[];
  totalPoints?: number;
  timeLimitMins?: number;
  dueDate?: string;
  maxAttempts?: number;
  passingScore?: number;
  isLocked?: boolean;
  scheduledOpen?: string;
  scheduledClose?: string;
  settings?: {
    lockdown?: boolean;
    showProgress?: boolean;
    allowBacktrack?: boolean;
    autoSubmit?: boolean;
    shuffleQuestions?: boolean;
    shuffleOptions?: boolean;
    allowReview?: boolean;
    trackTabSwitching?: boolean;
    hideCorrectAnswers?: boolean;
  };
};

type Submission = {
  _id: string;
  studentId: string;
  studentName?: string;
  score: number;
  maxScore: number;
  submittedAt: string;
  timeSpent?: number;
  answers?: any[];
  passed?: boolean;
  tabSwitches?: number;
  tabSwitchDurations?: number[];
  totalAwayMs?: number;
};

function SettingToggle({ title, description, enabled, onToggle }: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggle();
  };
  
  return (
    <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="font-semibold text-slate-900 dark:text-white">{title}</div>
          <div className="text-sm text-slate-600 dark:text-slate-400">{description}</div>
        </div>
        <button
          onClick={handleClick}
          type="button"
          className={`px-3 py-1 rounded-full text-sm font-semibold transition-all cursor-pointer select-none ${
            enabled
              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
              : "bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300"
          }`}
        >
          {enabled ? "ON" : "OFF"}
        </button>
      </div>
    </div>
  );
}

export default function QuizDetailPage() {
  const router = useRouter();
  const params = useParams();
  const quizId = params?.quizId as string;
  const { showError, showSuccess } = useAlert();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "questions" | "results" | "analytics" | "settings">("overview");
  const [editMode, setEditMode] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editingOverview, setEditingOverview] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkTimeLimit, setBulkTimeLimit] = useState<number>(0);
  const [bulkPoints, setBulkPoints] = useState<number>(1);
  const [liveSessionActive, setLiveSessionActive] = useState(false);

  // Helper function to format datetime for input
  const formatDateTimeLocal = (dateString: string | undefined) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      const offset = date.getTimezoneOffset();
      const localDate = new Date(date.getTime() - (offset * 60 * 1000));
      return localDate.toISOString().slice(0, 16);
    } catch (error) {
      console.error('Error formatting date:', error);
      return "";
    }
  };

  useEffect(() => {
    if (quizId) {
      loadQuiz();
      loadSubmissions();
      loadClasses();
      checkLiveSession();
    }
  }, [quizId]);

  const loadQuiz = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/teacher_page/assessment/${quizId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (!res.ok) throw new Error("Failed to load quiz");
      const data = await res.json();
      console.log('Quiz API response:', data);
      
      // Normalize questions to ensure they have proper structure
      const quizData = data.data?.assessment || data.data;
      
      // Ensure settings object exists with all fields
      const defaultSettings = {
        showProgress: true,
        shuffleQuestions: false,
        shuffleOptions: false,
        allowReview: true,
        lockdown: false,
        trackTabSwitching: false,
        hideCorrectAnswers: false,
        allowBacktrack: true,
        autoSubmit: false
      };
      
      quizData.settings = {
        ...defaultSettings,
        ...(quizData.settings || {})
      };
      
      if (quizData?.questions) {
        quizData.questions = quizData.questions.map((q: any, idx: number) => {
          const normalizedQuestion = {
            ...q,
            id: q.id || `q_${Date.now()}_${idx}`,
          };
          
          // Ensure options array exists and is properly structured
          if (q.options && Array.isArray(q.options)) {
            normalizedQuestion.options = q.options.map((opt: any, optIdx: number) => {
              if (typeof opt === 'string') {
                return {
                  id: `opt_${Date.now()}_${idx}_${optIdx}`,
                  text: opt,
                  isCorrect: q.correctAnswer === opt,
                  color: ['Red', 'Blue', 'Yellow', 'Green'][optIdx] || 'Red',
                };
              }
              return {
                id: opt.id || `opt_${Date.now()}_${idx}_${optIdx}`,
                text: opt.text || '',
                isCorrect: opt.isCorrect || q.correctAnswer === opt.text,
                color: opt.color || ['Red', 'Blue', 'Yellow', 'Green'][optIdx] || 'Red',
              };
            });
          } else {
            normalizedQuestion.options = [];
          }
          
          return normalizedQuestion;
        });
      }
      
      setQuiz(quizData);
    } catch (err) {
      console.error("Failed to load quiz:", err);
      showError("Failed to load quiz");
    } finally {
      setLoading(false);
    }
  };

  const checkLiveSession = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/teacher_page/assessment/${quizId}/live-session`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const result = await response.json();
        const isActive = result.data?.liveSession?.isActive === true;
        setLiveSessionActive(isActive);
      }
    } catch (error) {
      console.error('Error checking live session:', error);
    }
  };

  const loadSubmissions = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/teacher_page/assessment/${quizId}/submissions`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (res.ok) {
        const data = await res.json();
        const raw: Submission[] = data.data?.submissions || [];

        // Deduplicate submissions: keep best attempt per student (highest percentage),
        // tiebreak by most recent submittedAt
        const byStudent = new Map<string, Submission>();
        for (const s of raw) {
          const pct = s.maxScore ? s.score / s.maxScore : 0;
          const existing = byStudent.get(s.studentId);
          if (!existing) {
            byStudent.set(s.studentId, s);
            continue;
          }
          const existingPct = existing.maxScore ? existing.score / existing.maxScore : 0;
          if (pct > existingPct) {
            byStudent.set(s.studentId, s);
          } else if (pct === existingPct) {
            if (new Date(s.submittedAt) > new Date(existing.submittedAt)) {
              byStudent.set(s.studentId, s);
            }
          }
        }

        const deduped = Array.from(byStudent.values());
        setSubmissions(deduped);
      }
    } catch (err) {
      console.error("Failed to load submissions:", err);
    }
  };

  const loadClasses = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/teacher_page/class', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (res.ok) {
        const data = await res.json();
        setClasses(data.data?.classes || []);
      }
    } catch (err) {
      console.error("Failed to load classes:", err);
    }
  };

  const handlePublish = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/teacher_page/assessment/${quizId}/publish`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ published: !quiz?.published }),
      });
      
      if (res.ok) {
        showSuccess(quiz?.published ? "quiz unpublished" : "quiz published successfully!");
        loadQuiz();
      } else {
        const errorData = await res.json();
        showError(errorData.error || "Failed to publish quiz");
      }
    } catch (err) {
      console.error("Publish error:", err);
      showError("Failed to publish quiz");
    }
  };

  const handleSaveQuestions = async (updatedQuestions: EditorQuestion[]) => {
    try {
      const token = localStorage.getItem('accessToken');
      
      const questionsForBackend = updatedQuestions.map((q) => {
        const transformed: any = {
          id: q.id,
          type: q.type,
          title: q.title,
          points: q.points || 1,
        };

        if ((q.type === 'mcq' || q.type === 'true-false') && q.options) {
          // Preserve full option objects with isCorrect property
          transformed.options = q.options.map((opt: any) => {
            if (typeof opt === 'string') {
              return { text: opt, isCorrect: false };
            }
            return {
              id: opt.id,
              text: opt.text,
              isCorrect: !!opt.isCorrect,
              color: opt.color
            };
          });
          
          const correctOptions = q.options.filter((opt: any) => opt.isCorrect);
          if (correctOptions.length > 0) {
            transformed.correctAnswer = q.type === 'mcq' 
              ? (correctOptions[0].text || String(correctOptions[0]))
              : correctOptions.map((opt: any) => (opt && opt.text) || String(opt));
          }
        }

        if (q.type === 'identification' && q.correctAnswer) {
          transformed.correctAnswer = q.correctAnswer;
        }

        if (q.description) transformed.description = q.description;
        if (q.timeLimit !== undefined) transformed.timeLimit = q.timeLimit;
        
        return transformed;
      });
      
      const totalPoints = questionsForBackend.reduce((sum, q) => sum + (q.points || 1), 0);
      
      const res = await fetch(`/api/teacher_page/assessment/${quizId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          questions: questionsForBackend,
          totalPoints: totalPoints
        }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        showSuccess("Questions saved successfully!");
        loadQuiz();
        setEditMode(false);
      } else {
        showError(data.error || "Failed to save questions");
      }
    } catch (err) {
      console.error('Save error:', err);
      showError("Failed to save questions");
    }
  };

  const addNewQuestion = () => {
    const newQuestion: EditorQuestion = {
      id: `q_${Date.now()}`,
      type: 'mcq',
      title: '',
      timeLimit: 0,
      points: 1,
      options: [
        { id: `opt_${Date.now()}_1`, text: '', isCorrect: false, color: 'Red' },
        { id: `opt_${Date.now()}_2`, text: '', isCorrect: false, color: 'Blue' },
      ],
    };
    const updated = [...(quiz?.questions || []), newQuestion];
    const totalPoints = updated.reduce((sum, q) => sum + (q.points || 1), 0);
    setQuiz({ ...quiz!, questions: updated, totalPoints });
  };

  const duplicateQuestion = (questionId: string) => {
    const question = quiz?.questions?.find(q => q.id === questionId);
    if (!question) return;
    
    const duplicated = {
      ...question,
      id: `q_${Date.now()}`,
      options: question.options?.map((opt: any, idx: number) => ({
        ...opt,
        id: `opt_${Date.now()}_${idx}`,
      })),
    };
    const updated = [...(quiz?.questions || []), duplicated];
    const totalPoints = updated.reduce((sum, q) => sum + (q.points || 1), 0);
    setQuiz({ ...quiz!, questions: updated, totalPoints });
  };

  const deleteQuestion = (questionId: string) => {
    const updated = quiz?.questions?.filter(q => q.id !== questionId) || [];
    const totalPoints = updated.reduce((sum, q) => sum + (q.points || 1), 0);
    setQuiz({ ...quiz!, questions: updated, totalPoints });
  };

  const updateQuestion = (questionId: string, updatedQuestion: EditorQuestion) => {
    const updated = quiz?.questions?.map(q => q.id === questionId ? updatedQuestion : q) || [];
    const totalPoints = updated.reduce((sum, q) => sum + (q.points || 1), 0);
    setQuiz({ ...quiz!, questions: updated, totalPoints });
  };

  const toggleQuestionSelection = (questionId: string) => {
    setSelectedQuestions(prev => 
      prev.includes(questionId) 
        ? prev.filter(id => id !== questionId)
        : [...prev, questionId]
    );
  };

  const selectAllQuestions = () => {
    if (selectedQuestions.length === quiz?.questions?.length) {
      setSelectedQuestions([]);
    } else {
      setSelectedQuestions(quiz?.questions?.map(q => q.id) || []);
    }
  };

  const applyBulkEdit = () => {
    if (selectedQuestions.length === 0) return;
    
    const updated = quiz?.questions?.map(q => {
      if (selectedQuestions.includes(q.id)) {
        return {
          ...q,
          timeLimit: bulkTimeLimit,
          points: bulkPoints
        };
      }
      return q;
    }) || [];
    
    const totalPoints = updated.reduce((sum, q) => sum + (q.points || 1), 0);
    setQuiz({ ...quiz!, questions: updated, totalPoints });
    setShowBulkEdit(false);
    setSelectedQuestions([]);
    showSuccess(`Updated ${selectedQuestions.length} question(s)`);
  };

  const handleSettingToggle = async (settingKey: string) => {
    if (!quiz || !quiz.settings) return;
    
    const currentValue = quiz.settings[settingKey as keyof typeof quiz.settings];
    const newValue = !currentValue;
    
    const newSettings = {
      ...quiz.settings,
      [settingKey]: newValue
    };

    setQuiz(prev => prev ? { ...prev, settings: newSettings } : prev);

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/teacher_page/assessment/${quizId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ settings: newSettings }),
      });

      if (res.ok) {
        showSuccess(`Setting updated successfully!`);
      } else {
        showError("Failed to update setting");
        loadQuiz();
      }
    } catch (err) {
      showError("Failed to update setting");
      loadQuiz();
    }
  };

  const handleLockToggle = async () => {
    if (!quiz) return;
    
    const newLockState = !quiz.isLocked;
    
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/teacher_page/assessment/${quizId}/lock`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isLocked: newLockState }),
      });
      
      if (res.ok) {
        showSuccess(newLockState ? "quiz locked successfully!" : "quiz unlocked - students can now access!");
        await loadQuiz();
      } else {
        const data = await res.json();
        showError(data.error || "Failed to update lock status");
        await loadQuiz();
      }
    } catch (err) {
      showError("Failed to update lock status");
      await loadQuiz();
    }
  };

  const handleScheduleChange = async (type: 'open' | 'close', dateTimeValue: string) => {
    if (!quiz) return;
    
    const scheduledValue = dateTimeValue ? new Date(dateTimeValue).toISOString() : null;
    const fieldName = type === 'open' ? 'scheduledOpen' : 'scheduledClose';
    
    try {
      const token = localStorage.getItem('accessToken');
      
      // Include passingScore in the request to save it along with the schedule
      const requestBody: any = { 
        [fieldName]: scheduledValue 
      };
      
      // Always include passingScore when setting schedules (default to 70 if not set)
      if (scheduledValue) {
        requestBody.passingScore = quiz.passingScore || 70;
      }
      
      const res = await fetch(`/api/teacher_page/assessment/${quizId}/lock`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      if (res.ok) {
        if (scheduledValue) {
          const action = type === 'open' ? 'unlock' : 'lock';
          showSuccess(`quiz scheduled to ${action} at ${new Date(scheduledValue).toLocaleString()}`);
        } else {
          const action = type === 'open' ? 'unlock' : 'lock';
          showSuccess(`Scheduled ${action} cleared`);
        }
        await loadQuiz();
      } else {
        const data = await res.json();
        showError(data.error || "Failed to update schedule");
        await loadQuiz();
      }
    } catch (err) {
      showError("Failed to update schedule");
      await loadQuiz();
    }
  };

  const handleSaveOverview = async () => {
    if (!quiz) return;
    
    try {
      const token = localStorage.getItem('accessToken');
      
      const totalTimeLimit = quiz.questions?.reduce((sum, q) => sum + (q.timeLimit || 0), 0) || 0;
      
      const res = await fetch(`/api/teacher_page/assessment/${quizId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          classId: quiz.classId,
          dueDate: quiz.dueDate,
          timeLimitMins: Math.ceil(totalTimeLimit / 60),
          maxAttempts: quiz.maxAttempts,
          passingScore: quiz.passingScore,
        }),
      });
      
      if (res.ok) {
        showSuccess("quiz information updated successfully!");
        setEditingOverview(false);
        loadQuiz();
      } else {
        const data = await res.json();
        showError(data.error || "Failed to update quiz information");
      }
    } catch (err) {
      showError("Failed to update quiz information");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header Skeleton */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl mb-6 border border-slate-200 dark:border-slate-700 animate-pulse">
            <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-16 mb-4"></div>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-9 bg-slate-200 dark:bg-slate-700 rounded w-64"></div>
                  <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-full w-16"></div>
                  <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-full w-24"></div>
                  <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-full w-28"></div>
                </div>
                <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-96"></div>
              </div>
              <div className="flex gap-2">
                <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-lg w-28"></div>
                <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-lg w-28"></div>
                <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-lg w-28"></div>
              </div>
            </div>

            {/* Quick Stats Skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                  <div className="w-5 h-5 bg-slate-200 dark:bg-slate-700 rounded mb-2"></div>
                  <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-12 mb-1"></div>
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs Skeleton */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 animate-pulse">
            <div className="border-b border-slate-200 dark:border-slate-700 px-6 pt-4">
              <div className="flex gap-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-20 mb-4"></div>
                ))}
              </div>
            </div>

            {/* Content Skeleton */}
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-40"></div>
                <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-lg w-24"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                    <div className="h-4 bg-slate-200 dark:bg-slate-600 rounded w-20 mb-2"></div>
                    <div className="h-6 bg-slate-200 dark:bg-slate-600 rounded w-48"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">quiz not found</h2>
        </div>
      </div>
    );
  }

  const averageScore = submissions.length > 0
    ? submissions.reduce((sum, s) => sum + (s.maxScore > 0 ? (s.score / s.maxScore) * 100 : 0), 0) / submissions.length
    : 0;

  // Calculate pass rate - use passed field if available, otherwise calculate from score
  const passingThreshold = quiz?.passingScore || 70;
  const passRate = submissions.length > 0
    ? (submissions.filter(s => {
        // Use passed field if available, otherwise calculate
        if (s.passed !== undefined) return s.passed;
        const percentage = s.maxScore > 0 ? (s.score / s.maxScore) * 100 : 0;
        return percentage >= passingThreshold;
      }).length / submissions.length) * 100
    : 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl mb-6 border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => {
              // Check if came from class page
              const storedClassId = sessionStorage.getItem('class_origin_id');
              if (storedClassId) {
                // Redirect back to class page with correct tabs via URL params
                router.push(`/teacher_page/classes/${storedClassId}?tab=resourcesassessments&assessmentTab=quizzes`);
              } else if (window.history.length > 1) {
                router.back();
              } else {
                const storedTab = sessionStorage.getItem('assessment_tab');
                const tabParam = storedTab ? `?tab=${storedTab}` : '';
                router.push(`/teacher_page/assessment${tabParam}`);
              }
            }}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors mb-4 inline-flex items-center text-slate-900 dark:text-white"
          >
            ← Back
          </button>
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                  {quiz.title}
                </h1>
                <span className="px-3 py-1 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-full text-xs font-semibold">
                  quiz
                </span>
                {quiz.published ? (
                  <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-semibold flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Published
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-400 rounded-full text-xs font-semibold flex items-center gap-1">
                    <Edit className="w-3 h-3" /> Draft
                  </span>
                )}
                {quiz.settings?.lockdown && (
                  <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full text-xs font-semibold flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Secure Mode
                  </span>
                )}
              </div>
              {quiz.description && (
                <p className="text-slate-600 dark:text-slate-400">{quiz.description}</p>
              )}
            </div>
            <TooltipProvider>
              <div className="flex gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShowPreview(true)}
                      className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" /> Preview
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Preview quiz as a student</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handlePublish}
                      className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                        quiz.published
                          ? "border border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                          : "border border-[#2E7D32] text-[#2E7D32] hover:bg-green-50 dark:hover:bg-green-900/20"
                      }`}
                    >
                      {quiz.published ? (
                        <>
                          <Lock className="w-4 h-4" /> Unpublish
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" /> Publish
                        </>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{quiz.published ? "Make quiz unavailable to students" : "Make quiz available to students"}</p>
                  </TooltipContent>
                </Tooltip>

                {/* Only show Start Live button for QUIZs without a deadline */}
                {!quiz?.scheduledClose && !quiz?.dueDate && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={async () => {
                          if (!quiz?.published) {
                            showError('Please publish the quiz before starting a live session');
                            return;
                          }
                          // Unlock quiz when starting live mode
                          try {
                            const token = localStorage.getItem('accessToken');
                            const response = await fetch(`/api/teacher_page/assessment/${quizId}`, {
                              method: 'PATCH',
                              headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                              },
                              body: JSON.stringify({ isLocked: false })
                            });
                            
                            if (response.ok) {
                              console.log('✅ quiz unlocked successfully');
                              // Reload quiz data to reflect changes
                              await loadQuiz();
                            }
                          } catch (error) {
                            console.error('Error unlocking quiz:', error);
                          }
                          router.push(`/teacher_page/quiz/live/${quizId}`);
                        }}
                        disabled={!quiz?.published}
                        className={`px-4 py-2 text-white rounded-lg font-semibold transition-all flex items-center gap-2 ${
                          !quiz?.published
                            ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed opacity-50'
                            : liveSessionActive 
                              ? 'bg-orange-600 dark:bg-orange-600 hover:bg-orange-700 hover:shadow-lg' 
                              : 'bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] hover:shadow-lg'
                        }`}
                      >
                        <Play className="w-4 h-4" />
                        {liveSessionActive ? 'Resume Session' : 'Start Live'}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{!quiz?.published ? 'Publish the quiz first to start a live session' : liveSessionActive ? 'Resume the active live session' : 'Start a live quiz session'}</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </TooltipProvider>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-6">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 mb-2" />
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{quiz.questions?.length || 0}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Questions</div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <Star className="w-5 h-5 text-green-600 dark:text-green-400 mb-2" />
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{quiz.totalPoints || 0}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Points</div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <Users className="w-5 h-5 text-purple-600 dark:text-purple-400 mb-2" />
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{submissions.length}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Submissions</div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <BarChart3 className="w-5 h-5 text-orange-600 dark:text-orange-400 mb-2" />
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{averageScore.toFixed(0)}%</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Avg Score</div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              <Trophy className="w-5 h-5 text-green-600 dark:text-green-400 mb-2" />
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{passRate.toFixed(0)}%</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Pass Rate</div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
              {quiz.isLocked ? (
                <Lock className="w-5 h-5 text-gray-600 dark:text-gray-400 mb-2" />
              ) : (
                <Unlock className="w-5 h-5 text-gray-600 dark:text-gray-400 mb-2" />
              )}
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {quiz.isLocked ? "Locked" : "Unlocked"}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Access Status</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 mb-6">
          <div className="flex gap-4 border-b border-slate-200 dark:border-slate-700 px-6 pt-4">
            {[
              { key: "overview", label: "Overview" },
              { key: "questions", label: "Questions" },
              { key: "results", label: "Results" },
              { key: "analytics", label: "Analytics" },
              { key: "settings", label: "Settings" }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? "text-slate-900 dark:text-white border-b-2 border-slate-900 dark:border-white -mb-[2px]"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">quiz Information</h3>
                  {!editingOverview ? (
                    <button
                      onClick={() => setEditingOverview(true)}
                      className="px-4 py-2 bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] text-white rounded-lg font-semibold hover:shadow-lg transition-all flex items-center gap-2"
                    >
                      <Edit className="w-4 h-4" /> Edit Info
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSaveOverview();
                        }}
                        className="px-4 py-2 bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] text-white rounded-lg font-semibold hover:shadow-lg transition-all flex items-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" /> Save
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditingOverview(false);
                          loadQuiz();
                        }}
                        className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-semibold transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-xl">
                    <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Class</div>
                    {editingOverview ? (
                      <select
                        value={quiz.classId || ""}
                        onChange={(e) => setQuiz({ ...quiz, classId: e.target.value || undefined })}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">No class assigned</option>
                        {classes.map((cls) => (
                          <option key={cls._id} value={cls._id}>
                            {cls.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="font-semibold text-slate-900 dark:text-white">{quiz.className || "No class assigned"}</div>
                    )}
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-xl">
                    <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Due Date</div>
                    {editingOverview ? (
                      <input
                        type="datetime-local"
                        value={formatDateTimeLocal(quiz.dueDate)}
                        onChange={(e) => setQuiz({ ...quiz, dueDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:[color-scheme:dark]"
                      />
                    ) : (
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {quiz.dueDate ? new Date(quiz.dueDate).toLocaleString() : "No deadline"}
                      </div>
                    )}
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-xl">
                    <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Time Limit</div>
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {(() => {
                        const totalSeconds = quiz.questions?.reduce((sum, q) => sum + (q.timeLimit || 0), 0) || 0;
                        const minutes = Math.floor(totalSeconds / 60);
                        const seconds = totalSeconds % 60;
                        return totalSeconds > 0 
                          ? `${minutes}m ${seconds}s (from questions)` 
                          : "No limit";
                      })()}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Calculated from individual question time limits
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-xl">
                    <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Max Attempts</div>
                    {editingOverview ? (
                      <input
                        type="number"
                        value={quiz.maxAttempts || 1}
                        onChange={(e) => setQuiz({ ...quiz, maxAttempts: parseInt(e.target.value) || 1 })}
                        min={1}
                        max={10}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <div className="font-semibold text-slate-900 dark:text-white">{quiz.maxAttempts || "Unlimited"}</div>
                    )}
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-xl">
                    <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Passing Score</div>
                    {editingOverview ? (
                      <input
                        type="number"
                        value={quiz.passingScore || 70}
                        onChange={(e) => setQuiz({ ...quiz, passingScore: parseInt(e.target.value) || 70 })}
                        min={0}
                        max={100}
                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <div className="font-semibold text-slate-900 dark:text-white">{quiz.passingScore ? `${quiz.passingScore}%` : "Not set"}</div>
                    )}
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-xl">
                    <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total Points</div>
                    <div className="font-semibold text-slate-900 dark:text-white">{quiz.totalPoints || 0} points</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Calculated from question points
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "questions" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Questions ({quiz.questions?.length || 0})</h3>
                  <div className="flex gap-2">
                    {editMode && (
                      <>
                        {selectedQuestions.length > 0 && (
                          <button
                            onClick={() => setShowBulkEdit(true)}
                            className="px-4 py-2 bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] text-white rounded-lg font-semibold hover:shadow-lg transition-all flex items-center gap-2"
                          >
                            <Settings className="w-4 h-4" /> Bulk Edit ({selectedQuestions.length})
                          </button>
                        )}
                        <button
                          onClick={() => handleSaveQuestions(quiz.questions || [])}
                          className="px-6 py-2 bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] text-white rounded-lg font-semibold hover:shadow-lg transition-all flex items-center gap-2"
                        >
                          <CheckCircle className="w-4 h-4" /> Save Changes
                        </button>
                        <button
                          onClick={() => {
                            loadQuiz();
                            setEditMode(false);
                            setSelectedQuestions([]);
                          }}
                          className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-semibold transition-all"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    {!editMode && (
                      <button
                        onClick={() => setEditMode(true)}
                        className="px-6 py-2 bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] text-white rounded-lg font-semibold hover:shadow-lg transition-all flex items-center gap-2"
                      >
                        <Edit className="w-4 h-4" /> Edit Questions
                      </button>
                    )}
                  </div>
                </div>

                {/* Bulk Edit Panel */}
                {editMode && selectedQuestions.length > 0 && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-xl border-2 border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Settings className="w-6 h-6 text-blue-600" />
                        <div>
                          <div className="font-bold text-blue-900 dark:text-blue-100">
                            {selectedQuestions.length} question{selectedQuestions.length > 1 ? 's' : ''} selected
                          </div>
                          <div className="text-sm text-blue-700 dark:text-blue-300">
                            Click "Bulk Edit" to apply changes to all selected questions
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedQuestions([])}
                        className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                      >
                        Clear Selection
                      </button>
                    </div>
                  </div>
                )}

                {/* Select All Checkbox */}
                {editMode && quiz.questions && quiz.questions.length > 0 && (
                  <div className="flex items-center gap-3 p-3 bg-slate-100 dark:bg-slate-700 rounded-lg">
                    <input
                      type="checkbox"
                      checked={selectedQuestions.length === quiz.questions.length}
                      onChange={selectAllQuestions}
                      className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <label className="font-semibold text-slate-700 dark:text-slate-300 cursor-pointer" onClick={selectAllQuestions}>
                      Select All Questions
                    </label>
                  </div>
                )}

                {editMode ? (
                  <div className="space-y-6">
                    {quiz.questions && quiz.questions.length > 0 ? (
                      quiz.questions.map((q: any, idx: number) => {
                        const isSelected = selectedQuestions.includes(q.id);
                        return (
                          <div key={q.id || idx} className="relative">
                            <div className="absolute top-4 left-4 z-10">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleQuestionSelection(q.id)}
                                className="w-6 h-6 rounded border-white/30 text-blue-600 focus:ring-blue-500 cursor-pointer shadow-lg"
                              />
                            </div>
                            <div className={`transition-all ${isSelected ? 'ring-4 ring-blue-500 rounded-3xl' : ''}`}>
                              <KahootQuestionEditor
                                question={q}
                                questionNumber={idx + 1}
                                onChange={(updated) => updateQuestion(q.id, updated)}
                                onDelete={() => deleteQuestion(q.id)}
                                onDuplicate={() => duplicateQuestion(q.id)}
                              />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-12 text-slate-500">
                        <div className="text-6xl mb-4">📝</div>
                        <p>No questions yet. Click "Add Question" to get started!</p>
                      </div>
                    )}
                    
                    <button
                      onClick={addNewQuestion}
                      className="w-full py-6 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white rounded-2xl font-bold text-xl shadow-xl hover:shadow-2xl transition-all flex items-center justify-center gap-3"
                    >
                      <span className="text-3xl">+</span>
                      Add Question
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {quiz.questions && quiz.questions.length > 0 ? (
                      quiz.questions.map((q: any, idx: number) => (
                        <div key={q.id || idx} className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="px-3 py-1 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-full text-xs font-semibold">
                                Q{idx + 1}
                              </span>
                              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-semibold">
                                {q.type?.toUpperCase()}
                              </span>
                            </div>
                            <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                              {q.points || 1} pts
                            </span>
                          </div>
                          <div className="font-semibold mb-3 text-slate-900 dark:text-white">{q.title}</div>
                          {q.options && (
                            <div className="space-y-2 mt-3">
                              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Answer Choices:</div>
                              {q.options.map((opt: any, optIdx: number) => {
                                const isCorrect = q.correctAnswer === opt.text || opt.isCorrect;
                                return (
                                  <div
                                    key={optIdx}
                                    className={`p-3 rounded-lg text-sm flex items-center justify-between border-2 transition-all ${
                                      isCorrect
                                        ? "bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-green-500 dark:border-green-400 text-green-800 dark:text-green-300 font-semibold shadow-md"
                                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                                    }`}
                                  >
                                    <span className="flex items-center gap-2">
                                      <span className={`font-bold ${isCorrect ? 'text-green-600 dark:text-green-400' : ''}`}>
                                        {String.fromCharCode(65 + optIdx)}.
                                      </span>
                                      {opt.text || opt}
                                    </span>
                                    {isCorrect && (
                                      <span className="flex items-center gap-1 bg-green-600 dark:bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                        Correct Answer
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-slate-500">No questions added yet</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === "results" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">Student Results ({submissions.length})</h3>
                  <button
                    onClick={() => {/* Export logic */}}
                    className="px-4 py-2 bg-rose-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                  >
                    📥 Export Results
                  </button>
                </div>

                {submissions.length > 0 ? (
                  <div className="space-y-3">
                    {submissions.map((submission) => (
                      <div
                        key={submission._id}
                        className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl hover:shadow-md transition-all cursor-pointer"
                        onClick={() => {
                          router.push(`/teacher_page/quiz/${quizId}/student/${submission.studentId}`);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-rose-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                              {submission.studentName?.charAt(0) || "?"}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-white">{submission.studentName || "Unknown Student"}</div>
                              <div className="text-sm text-slate-600 dark:text-slate-400">
                                Submitted {new Date(submission.submittedAt).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-2">
                              <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                                {((submission.score / submission.maxScore) * 100).toFixed(0)}%
                              </div>
                              {submission.passed !== undefined && (
                                <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                  submission.passed
                                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                    : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                                }`}>
                                  {submission.passed ? "✅ PASSED" : "❌ FAILED"}
                                </div>
                              )}
                            </div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                              {submission.score}/{submission.maxScore} points
                            </div>
                            {submission.timeSpent && (
                              <div className="text-xs text-slate-500">
                                ⏱️ {Math.floor(submission.timeSpent / 60)}m {submission.timeSpent % 60}s
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Tab Switching Indicator */}
                        {submission.tabSwitches !== undefined && submission.tabSwitches > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600">
                            <div className="flex items-center gap-4 text-sm">
                              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                                <span>⚠️</span>
                                <span className="font-semibold">{submission.tabSwitches} tab switch{submission.tabSwitches !== 1 ? 'es' : ''}</span>
                              </div>
                              {submission.totalAwayMs !== undefined && submission.totalAwayMs > 0 && (
                                <div className="text-amber-600 dark:text-amber-400">
                                  <span className="font-medium">Away: {Math.floor(submission.totalAwayMs / 60000)}m {Math.floor((submission.totalAwayMs % 60000) / 1000)}s</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <div className="text-6xl mb-4">📊</div>
                    <div>No submissions yet</div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "analytics" && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">quiz Analytics</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl">
                    <div className="text-4xl mb-2">📊</div>
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{averageScore.toFixed(1)}%</div>
                    <div className="text-sm text-blue-600 dark:text-blue-400">Average Score</div>
                  </div>
                  <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl">
                    <div className="text-4xl mb-2">✅</div>
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400">{passRate.toFixed(0)}%</div>
                    <div className="text-sm text-green-600 dark:text-green-400">Pass Rate</div>
                  </div>
                  <div className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl">
                    <div className="text-4xl mb-2">⏱️</div>
                    <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                      {(() => {
                        if (submissions.length === 0) return '0m';
                        const avgSeconds = submissions.reduce((sum, s) => sum + (s.timeSpent || 0), 0) / submissions.length;
                        const mins = Math.floor(avgSeconds / 60);
                        const secs = Math.floor(avgSeconds % 60);
                        return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
                      })()}
                    </div>
                    <div className="text-sm text-purple-600 dark:text-purple-400">Avg Time</div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "settings" && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">quiz Settings</h3>
                
                {/* Access Control Section */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-xl border-2 border-blue-200 dark:border-blue-800">
                  <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    🔐 Access Control
                  </h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-lg">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">Current Status</div>
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                          {quiz.isLocked ? "🔒 quiz is locked - students cannot access" : "🔓 quiz is unlocked - students can access"}
                        </div>
                      </div>
                      <button
                        onClick={() => handleLockToggle()}
                        className={`px-6 py-3 rounded-xl font-bold text-white shadow-lg transition-all ${
                          quiz.isLocked
                            ? "bg-gradient-to-r from-green-600 to-emerald-600 hover:shadow-xl"
                            : "bg-gradient-to-r from-red-600 to-pink-600 hover:shadow-xl"
                        }`}
                      >
                        {quiz.isLocked ? "🔓 Unlock Now" : "🔒 Lock Now"}
                      </button>
                    </div>
                    
                    <div className="p-4 bg-white dark:bg-slate-800 rounded-lg">
                      <div className="font-semibold text-slate-900 dark:text-white mb-2">📅 Schedule Auto-Unlock (Live Date)</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                        Set when the quiz will automatically unlock
                      </div>
                      <div className="flex gap-3">
                        <input
                          type="datetime-local"
                          value={formatDateTimeLocal(quiz.scheduledOpen)}
                          onChange={(e) => handleScheduleChange('open', e.target.value)}
                          className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white dark:[color-scheme:dark]"
                        />
                        {quiz.scheduledOpen && (
                          <button
                            onClick={() => handleScheduleChange('open', "")}
                            className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-all"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      {quiz.scheduledOpen && (
                        <div className="mt-2 text-sm text-green-600 dark:text-green-400">
                          🔓 Will unlock: {new Date(quiz.scheduledOpen).toLocaleString()}
                        </div>
                      )}
                    </div>
                    
                    <div className="p-4 bg-white dark:bg-slate-800 rounded-lg">
                      <div className="font-semibold text-slate-900 dark:text-white mb-2">🔒 Schedule Auto-Lock (Deadline)</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                        Set when the quiz will automatically lock
                      </div>
                      <div className="flex gap-3">
                        <input
                          type="datetime-local"
                          value={formatDateTimeLocal(quiz.scheduledClose)}
                          onChange={(e) => handleScheduleChange('close', e.target.value)}
                          className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white dark:[color-scheme:dark]"
                        />
                        {quiz.scheduledClose && (
                          <button
                            onClick={() => handleScheduleChange('close', "")}
                            className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-all"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      {quiz.scheduledClose && (
                        <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                          🔒 Will lock: {new Date(quiz.scheduledClose).toLocaleString()}
                        </div>
                      )}
                    </div>
                    
                    <div className="p-4 bg-white dark:bg-slate-800 rounded-lg">
                      <div className="font-semibold text-slate-900 dark:text-white mb-2">✅ Pass Rate</div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                        Set the minimum percentage students need to pass
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={quiz.passingScore || 70}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 70;
                            setQuiz({ ...quiz, passingScore: value });
                          }}
                          min={0}
                          max={100}
                          className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white font-semibold text-lg"
                        />
                        <button
                          onClick={async () => {
                            try {
                              const token = localStorage.getItem('accessToken');
                              const res = await fetch(`/api/teacher_page/assessment/${quizId}/lock`, {
                                method: 'POST',
                                headers: {
                                  'Authorization': `Bearer ${token}`,
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({ passingScore: quiz.passingScore || 70 }),
                              });
                              if (res.ok) {
                                showSuccess('Pass rate updated successfully!');
                                await loadQuiz();
                              } else {
                                showError('Failed to update pass rate');
                              }
                            } catch (err) {
                              showError('Failed to update pass rate');
                            }
                          }}
                          className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:shadow-lg transition-all font-semibold"
                        >
                          💾 Save
                        </button>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        Default is 70%. Students scoring below this will be marked as failed.
                      </div>
                    </div>
                  </div>
                </div>

                {/* quiz Settings */}
                <h4 className="text-lg font-bold text-slate-900 dark:text-white mt-6 mb-4">quiz Options</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <SettingToggle
                    title="Show Progress"
                    description="Display progress bar"
                    enabled={quiz.settings?.showProgress === true}
                    onToggle={() => handleSettingToggle('showProgress')}
                  />
                  <SettingToggle
                    title="Shuffle Questions"
                    description="Randomize question order"
                    enabled={quiz.settings?.shuffleQuestions === true}
                    onToggle={() => handleSettingToggle('shuffleQuestions')}
                  />
                  <SettingToggle
                    title="Shuffle Options"
                    description="Randomize answer choices"
                    enabled={quiz.settings?.shuffleOptions === true}
                    onToggle={() => handleSettingToggle('shuffleOptions')}
                  />
                  <SettingToggle
                    title="Allow Review"
                    description="Let students review answers"
                    enabled={quiz.settings?.allowReview === true}
                    onToggle={() => handleSettingToggle('allowReview')}
                  />
                  <SettingToggle
                    title="Lockdown Mode"
                    description="Can't leave once started"
                    enabled={quiz.settings?.lockdown === true}
                    onToggle={() => handleSettingToggle('lockdown')}
                  />
                  <SettingToggle
                    title="Track Tab Switching"
                    description="Monitor when students leave tab"
                    enabled={quiz.settings?.trackTabSwitching === true}
                    onToggle={() => handleSettingToggle('trackTabSwitching')}
                  />
                  <SettingToggle
                    title="Hide Correct Answers"
                    description="Don't show correct answers after submission"
                    enabled={quiz.settings?.hideCorrectAnswers === true}
                    onToggle={() => handleSettingToggle('hideCorrectAnswers')}
                  />
                  <SettingToggle
                    title="Allow Backtrack"
                    description="Go back to previous questions"
                    enabled={quiz.settings?.allowBacktrack === true}
                    onToggle={() => handleSettingToggle('allowBacktrack')}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Student Preview Modal */}
      {showPreview && quiz.questions && quiz.questions.length > 0 && (
        <StudentPreview
          questions={quiz.questions}
          quizTitle={quiz.title}
          onClose={() => setShowPreview(false)}
          settings={quiz.settings}
        />
      )}

      {/* Bulk Edit Modal */}
      {showBulkEdit && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Settings className="w-8 h-8 text-blue-600" />
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Bulk Edit</h3>
              </div>
              <button
                onClick={() => setShowBulkEdit(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
              <div className="text-sm text-blue-900 dark:text-blue-100">
                Applying changes to <span className="font-bold">{selectedQuestions.length}</span> selected question{selectedQuestions.length > 1 ? 's' : ''}
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="w-full text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Time Limit (seconds)
                </label>
                <select
                  value={bulkTimeLimit}
                  onChange={(e) => setBulkTimeLimit(parseInt(e.target.value))}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={0}>No timer (default)</option>
                  <option value={5}>5 seconds</option>
                  <option value={10}>10 seconds</option>
                  <option value={20}>20 seconds</option>
                  <option value={30}>30 seconds</option>
                  <option value={60}>1 minute</option>
                  <option value={120}>2 minutes</option>
                  <option value={180}>3 minutes</option>
                  <option value={300}>5 minutes</option>
                </select>
              </div>

              <div>
                <label className="w-full text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                  <Star className="w-4 h-4" /> Points per Question
                </label>
                <input
                  type="number"
                  value={bulkPoints}
                  onChange={(e) => setBulkPoints(parseInt(e.target.value) || 1)}
                  min={1}
                  max={100}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={applyBulkEdit}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold hover:shadow-lg transition-all"
              >
                ✓ Apply to {selectedQuestions.length} Question{selectedQuestions.length > 1 ? 's' : ''}
              </button>
              <button
                onClick={() => setShowBulkEdit(false)}
                className="px-6 py-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
