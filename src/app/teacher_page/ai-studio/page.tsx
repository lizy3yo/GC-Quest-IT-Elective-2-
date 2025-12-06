"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";
import { FileText, GraduationCap, Upload, ClipboardPaste } from "lucide-react";

type ContentType = 'quiz' | 'exam';
type InputMethod = 'upload' | 'paste' | 'topic';

export default function AIStudioPage() {
  const router = useRouter();
  const [contentType, setContentType] = useState<ContentType>('quiz');
  const [inputMethod, setInputMethod] = useState<InputMethod>('upload');
  const { showSuccess, showError, showInfo } = useToast();

  // Upload state
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Paste state
  const [pasteText, setPasteText] = useState("");
  const MAX_CHARS = 100000;

  // Topic/AI generation state
  const [topic, setTopic] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [learningObjectives, setLearningObjectives] = useState("");

  // Load initial values from localStorage
  const getInitialDifficulty = (): 'easy' | 'medium' | 'hard' => {
    if (typeof window === 'undefined') return 'medium';
    const savedPrefs = localStorage.getItem('ai_studio_prefs');
    if (savedPrefs) {
      try {
        const prefs = JSON.parse(savedPrefs);
        return prefs.difficulty || 'medium';
      } catch (err) {
        return 'medium';
      }
    }
    return 'medium';
  };

  const getInitialQuestionCount = (): number => {
    if (typeof window === 'undefined') return 5;
    const savedPrefs = localStorage.getItem('ai_studio_prefs');
    if (savedPrefs) {
      try {
        const prefs = JSON.parse(savedPrefs);
        return prefs.questionCount || 5;
      } catch (err) {
        return 5;
      }
    }
    return 5;
  };

  const getInitialIncludeExplanations = (): boolean => {
    if (typeof window === 'undefined') return true;
    const savedPrefs = localStorage.getItem('ai_studio_prefs');
    if (savedPrefs) {
      try {
        const prefs = JSON.parse(savedPrefs);
        return prefs.includeExplanations !== undefined ? prefs.includeExplanations : true;
      } catch (err) {
        return true;
      }
    }
    return true;
  };

  const getInitialAutoGrade = (): boolean => {
    if (typeof window === 'undefined') return true;
    const savedPrefs = localStorage.getItem('ai_studio_prefs');
    if (savedPrefs) {
      try {
        const prefs = JSON.parse(savedPrefs);
        return prefs.autoGrade !== undefined ? prefs.autoGrade : true;
      } catch (err) {
        return true;
      }
    }
    return true;
  };

  // Content options
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>(getInitialDifficulty);
  const [questionCount, setQuestionCount] = useState(getInitialQuestionCount);
  const [includeExplanations, setIncludeExplanations] = useState(getInitialIncludeExplanations);
  const [autoGrade, setAutoGrade] = useState(getInitialAutoGrade);
  const [isLive, setIsLive] = useState(true);
  const [liveStyle, setLiveStyle] = useState<'kahoot' | 'quizizz'>('kahoot');
  // Quizizz-style assignment (not live) options
  const [isQuizizzAssign, setIsQuizizzAssign] = useState(false);
  const [assignmentDeadline, setAssignmentDeadline] = useState<string>("");

  // Load initial state from localStorage
  const getInitialQuestionTypes = () => {
    if (typeof window === 'undefined') return {
      identification: false,
      multipleChoice: false,
      trueOrFalse: false,
      paragraph: false
    };
    
    const savedPrefs = localStorage.getItem('ai_studio_prefs');
    if (savedPrefs) {
      try {
        const prefs = JSON.parse(savedPrefs);
        return prefs.questionTypes || {
          identification: false,
          multipleChoice: false,
          trueOrFalse: false,
          paragraph: false
        };
      } catch (err) {
        console.error("Failed to load preferences:", err);
      }
    }
    return {
      identification: false,
      multipleChoice: false,
      trueOrFalse: false,
      paragraph: false
    };
  };

  // Question types selection
  const [questionTypes, setQuestionTypes] = useState<{
    identification: boolean;
    multipleChoice: boolean;
    trueOrFalse: boolean;
    paragraph: boolean;
  }>(getInitialQuestionTypes);

  const [isInitialized, setIsInitialized] = useState(false);

  // Mark as initialized after mount (all values loaded via lazy initialization)
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  // Save preferences to localStorage whenever they change (but only after initialization)
  useEffect(() => {
    if (!isInitialized) return;
    
    const prefs = {
      questionTypes,
      difficulty,
      questionCount,
      includeExplanations,
      autoGrade,
    };
    localStorage.setItem('ai_studio_prefs', JSON.stringify(prefs));
  }, [isInitialized, questionTypes, difficulty, questionCount, includeExplanations, autoGrade]);

  // Title / summary options (copied from Study Mode behavior)
  const [customTitle, setCustomTitle] = useState('');

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedClass, setSelectedClass] = useState("");
  const [classes, setClasses] = useState<unknown[]>([]);
  
  // Class search state
  const [classSearch, setClassSearch] = useState("");
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [selectedClassIndex, setSelectedClassIndex] = useState(-1);
  const classInputRef = useRef<HTMLDivElement | null>(null);
  
  // Subject options from teacher's classes (removed UI; kept classes list)

  // Load teacher's classes and auto-select from URL parameter
  useEffect(() => {
    const loadClasses = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const response = await fetch('/api/teacher_page/class', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });
        const data = await response.json();
        if (data.success) {
          const classList = data.data?.classes || [];
          setClasses(classList);
          
          // Auto-select class from URL parameter if provided
          const params = new URLSearchParams(window.location.search);
          const classIdFromUrl = params.get('classId');
          if (classIdFromUrl) {
            const selectedClassObj: any = classList.find((c: any) => c._id === classIdFromUrl);
            if (selectedClassObj) {
              setSelectedClass(classIdFromUrl);
              setClassSearch(selectedClassObj.name);
            }
          }
          
          // Extract unique subjects from classes (kept for potential future use)
          // const subjects = [...new Set(classList.map((c: any) => c.subject).filter(Boolean))] as string[];
          // setUserSubjects(subjects);
        }
      } catch (error) {
        showError('Failed to load classes', 'Load Error');
      }
    };
    loadClasses();
  }, [showError]);

  const handleFilesAdd = (newFiles: FileList | null) => {
    if (!newFiles || newFiles.length === 0) {
      return;
    }
    const fileArray = Array.from(newFiles);
    
    setFiles((prev) => {
      const updated = [...prev, ...fileArray].slice(0, 20); // Limit to 20 files
      if (updated.length >= 20) {
        showInfo('Maximum 20 files allowed', 'File Limit');
      }
      return updated;
    });
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      handleFilesAdd(selectedFiles);
      // Clear input after processing to allow selecting the same file again
      setTimeout(() => {
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }, 100);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleFilesAdd(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();

  const removeFileAt = (index: number) => setFiles((p) => p.filter((_, i) => i !== index));

  // Class search handlers
  const filteredClasses = classes.filter((cls: any) => 
    cls.name?.toLowerCase().includes(classSearch.toLowerCase()) ||
    cls.subject?.toLowerCase().includes(classSearch.toLowerCase())
  );

  const handleClassSelect = (classId: string, className: string, classSubject: string) => {
    setSelectedClass(classId);
    setClassSearch(className);
    setShowClassDropdown(false);
    setSelectedClassIndex(-1);
  };

  const handleClassSearchChange = (value: string) => {
    setClassSearch(value);
    setSelectedClass("");
    setShowClassDropdown(true);
  };

  const handleClassKeyDown = (e: React.KeyboardEvent) => {
    if (!showClassDropdown) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedClassIndex(prev => 
        prev < filteredClasses.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedClassIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Enter' && selectedClassIndex >= 0) {
      e.preventDefault();
      const cls: any = filteredClasses[selectedClassIndex];
      handleClassSelect(cls._id, cls.name, cls.subject);
    } else if (e.key === 'Escape') {
      setShowClassDropdown(false);
      setSelectedClassIndex(-1);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (classInputRef.current && !classInputRef.current.contains(event.target as Node)) {
        setShowClassDropdown(false);
        setSelectedClassIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const canGenerate = () => {
    const hasContent = 
      (inputMethod === 'upload' && files.length > 0) ||
      (inputMethod === 'paste' && pasteText.trim().length > 50) ||
      (inputMethod === 'topic' && topic.trim().length > 0);
    
    const hasClass = selectedClass && selectedClass.trim().length > 0;
    
    // For quiz/exam, ensure at least one question type is selected
    const hasQuestionType = (contentType === 'quiz' || contentType === 'exam') 
      ? Object.values(questionTypes).some(type => type === true)
      : true;
    
    return hasContent && hasClass && hasQuestionType;
  };

  const handleGenerate = async () => {
    if (!selectedClass || selectedClass.trim().length === 0) {
      showError('Please select a class to assign this assessment to', 'Class Required');
      return;
    }
    
    // Check if at least one question type is selected for quiz/exam
    if ((contentType === 'quiz' || contentType === 'exam') && !Object.values(questionTypes).some(type => type === true)) {
      showError('Please select at least one question type', 'Question Type Required');
      return;
    }
    
    if (!canGenerate()) {
      showError('Please provide content to generate from', 'Missing Content');
      return;
    }

    setIsGenerating(true);
    try {
      const token = localStorage.getItem('accessToken');
      
      // Get user ID for student API endpoints
      let userId: string | null = null;
      try {
        const currentRes = await fetch("/api/v1/users/current", {
          credentials: "include",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
        });
        if (currentRes.ok) {
          const currentJson = await currentRes.json();
          userId = currentJson?.user?._id ?? null;
        }
      } catch (err) {
        // ignore
      }
      if (!userId) userId = localStorage.getItem("userId") || null;
      if (!userId) {
        // generate dev id
        userId = `temp-user-${Date.now()}`;
        localStorage.setItem("userId", userId);
      }

      // Note: flashcards/summary functionality removed from this page.

      // Handle quiz/exam generation using teacher API endpoints
      if (contentType === 'quiz' || contentType === 'exam') {
        let endpoint = '';
        let response: Response;

        const category = contentType === 'quiz' ? 'Quiz' : 'Exam';

        if (inputMethod === 'upload') {
          // Use file-based generation
          endpoint = `/api/teacher_page/assessment/generate-from-file`;

          const formData = new FormData();
          formData.append('file', files[0]);
          formData.append('category', category);
          formData.append('difficulty', difficulty);
          formData.append('questionCount', String(questionCount));
          formData.append('includeExplanations', String(includeExplanations));
          formData.append('questionTypes', JSON.stringify(questionTypes));
          
          if (customTitle && customTitle.trim().length > 0) {
            formData.append('title', customTitle.trim());
          }
          if (selectedClass) {
            formData.append('classId', selectedClass);
          }
          if (assignmentDeadline) {
            formData.append('dueDate', assignmentDeadline);
          }
          // Always save as draft - teacher will publish from drafts tab
          formData.append('autoPublish', 'false');

          const token = localStorage.getItem('accessToken');
          response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: formData,
            credentials: 'include'
          });
        } else if (inputMethod === 'paste') {
          // Use text-based generation
          endpoint = `/api/teacher_page/assessment/generate-from-text`;

          const token = localStorage.getItem('accessToken');
          response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              content: pasteText,
              category,
              difficulty,
              questionCount,
              includeExplanations,
              questionTypes,
              title: customTitle && customTitle.trim().length > 0 ? customTitle.trim() : undefined,
              classId: selectedClass || undefined,
              dueDate: assignmentDeadline || undefined,
              autoPublish: false // Always save as draft - teacher will publish from drafts tab
            }),
            credentials: 'include'
          });
        } else {
          showError('Topic-based generation not yet implemented for quizzes/exams', 'Not Implemented');
          return;
        }

        const data = await response.json();

        if (!response.ok || !data.success) {
          const errorMsg = data.details || data.error || 'Generation failed';
          throw new Error(errorMsg);
        }

        const assessmentId = data.data?.assessment?.id;
        const questionsGenerated = data.data?.assessment?.questionsGenerated || questionCount;

        const successMsg = `Generated ${questionsGenerated} questions for your ${category.toLowerCase()} successfully! Saved as draft.`;
        
        showSuccess(successMsg, 'Success');
        
        // Always redirect to assessment page with draft tab active
        setTimeout(() => {
          router.push(`/teacher_page/assessment?tab=drafts`);
        }, 400);
        return;
      }

    } catch (error) {
      showError(error instanceof Error ? error.message : 'Failed to generate content', 'Generation Failed');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900" style={{ padding: '1.5rem' }}>
      <div style={{ maxWidth: '80rem', marginLeft: 'auto', marginRight: 'auto' }}>
        {/* Header Card */}
        <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-8 mb-8 overflow-hidden">
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#2E7D32]/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-400/5 rounded-full blur-3xl" />
          
          <div className="relative">
            <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2">
              AI Assessments
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              Generate quizzes and exams with AI-powered content creation
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Content Type & Input */}
          <div className="lg:col-span-2 space-y-6">
            {/* Content Type Selection */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border-2 border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">What would you like to create?</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setContentType('quiz')}
                  className={`px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
                    contentType === 'quiz'
                      ? 'border-[#2E7D32] bg-[#E8F5E9] dark:bg-[#1C2B1C] text-[#2E7D32] dark:text-[#04C40A] font-semibold'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-[#2E7D32]/50 hover:bg-[#E8F5E9]/50 dark:hover:bg-[#1C2B1C]/50'
                  }`}
                >
                  <div className="flex items-center justify-center mb-2">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="text-lg font-bold">Quiz</div>
                  <div className="text-xs mt-1">Interactive quiz for practice</div>
                </button>

                <button
                  type="button"
                  onClick={() => setContentType('exam')}
                  className={`px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
                    contentType === 'exam'
                      ? 'border-[#2E7D32] bg-[#E8F5E9] dark:bg-[#1C2B1C] text-[#2E7D32] dark:text-[#04C40A] font-semibold'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-[#2E7D32]/50 hover:bg-[#E8F5E9]/50 dark:hover:bg-[#1C2B1C]/50'
                  }`}
                >
                  <div className="flex items-center justify-center mb-2">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <div className="text-lg font-bold">Exam</div>
                  <div className="text-xs mt-1">Formal assessment test</div>
                </button>
              </div>
            </div>

            {/* Info Card */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl p-4 border-2 border-green-200 dark:border-green-800">
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-green-900 dark:text-green-300 mb-1">
                    AI-Powered Generation
                  </h4>
                  <p className="text-xs text-green-700 dark:text-green-400">
                    Our AI creates high-quality educational content tailored to your specifications. Review and customize before publishing.
                  </p>
                </div>
              </div>
            </div>

            {/* Input Method Tabs */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border-2 border-slate-200 dark:border-slate-700">
              <div className="grid grid-cols-2 gap-2 mb-6">
                <button
                  onClick={() => setInputMethod('upload')}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                    inputMethod === 'upload'
                      ? 'bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] text-white shadow-md'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload File</span>
                </button>
                <button
                  onClick={() => setInputMethod('paste')}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                    inputMethod === 'paste'
                      ? 'bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] text-white shadow-md'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  <ClipboardPaste className="w-4 h-4" />
                  <span>Paste Text</span>
                </button>
              </div>

              {/* Content area */}
              <div className="mb-6">
                {/* Upload Input */}
                {inputMethod === 'upload' && (
                  <div>
                  {files.length === 0 ? (
                    <div
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl p-12 text-center bg-slate-50 dark:bg-slate-700/50 hover:border-green-400 transition-colors cursor-pointer"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] rounded-2xl flex items-center justify-center">
                          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                        </div>
                      </div>
                      <p className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Drop your files here or click to browse
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        PDF, DOCX, TXT, MD files supported (max 10MB)
                      </p>
                      <input
                        ref={fileInputRef}
                        onChange={handleFileInput}
                        type="file"
                        accept=".pdf,.docx,.txt,.md,.doc"
                        className="hidden"
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {files.map((f, i) => (
                        <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div>
                              <div className="font-medium text-slate-900 dark:text-white">{f.name}</div>
                              <div className="text-sm text-slate-500 dark:text-slate-400">{(f.size / 1024).toFixed(1)} KB</div>
                            </div>
                          </div>
                          <button
                            onClick={() => removeFileAt(i)}
                            className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-400 hover:border-green-400 hover:text-[#2E7D32] transition-colors"
                      >
                        + Add More Files
                      </button>
                      <input
                        ref={fileInputRef}
                        onChange={handleFileInput}
                        type="file"
                        accept=".pdf,.docx,.txt,.md,.doc"
                        className="hidden"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Paste Input */}
              {inputMethod === 'paste' && (
                <div className="flex flex-col">
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value.slice(0, MAX_CHARS))}
                    placeholder="Paste your lecture notes, textbook content, or study material here..."
                    className="w-full h-[280px] px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#2E7D32] resize-none"
                  />
                  <div className="mt-2 text-sm text-slate-500 dark:text-slate-400 text-right">
                    {pasteText.length.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters
                  </div>
                </div>
              )}

              {/* Topic Input */}
              {inputMethod === 'topic' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Topic / Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="e.g., Photosynthesis, World War II, Quadratic Equations"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Grade Level
                      </label>
                      <select
                        value={gradeLevel}
                        onChange={(e) => setGradeLevel(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#2E7D32]"
                      >
                        <option value="">Select grade</option>
                        <option value="Elementary">Elementary (K-5)</option>
                        <option value="Middle School">Middle School (6-8)</option>
                        <option value="High School">High School (9-12)</option>
                        <option value="College">College/University</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Learning Objectives (optional)
                    </label>
                    <textarea
                      value={learningObjectives}
                      onChange={(e) => setLearningObjectives(e.target.value)}
                      placeholder="One objective per line&#10;e.g.,&#10;- Understand the process of photosynthesis&#10;- Identify the key components&#10;- Explain the role of chlorophyll"
                      rows={4}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#2E7D32] resize-y"
                    />
                  </div>
                </div>
              )}
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={!canGenerate() || isGenerating}
                className={`w-full py-4 rounded-2xl font-bold text-lg transition-all duration-300 ${
                  !canGenerate() || isGenerating
                    ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-500 cursor-not-allowed'
                    : 'bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] text-white shadow-lg hover:shadow-xl hover:scale-105'
                }`}
              >
                {isGenerating ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Generating...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>Generate with AI</span>
                  </div>
                )}
              </button>

              {/* Info message */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl mt-4">
                <p className="text-sm text-blue-700 dark:text-blue-300 text-center">
                  All assessments are saved as drafts. You can review and publish them from the Drafts tab.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column - Options & Generate */}
          <div className="space-y-6">
            {/* Options */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border-2 border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Settings</h3>
              
              <div className="space-y-4">
                {(contentType === 'quiz' || contentType === 'exam') && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Title (Optional)
                      </label>
                      <input
                        type="text"
                        value={customTitle}
                        onChange={(e) => setCustomTitle(e.target.value)}
                        placeholder="Auto-generated if empty"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="relative" ref={classInputRef}>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Assign to Class <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={classSearch}
                          onChange={(e) => handleClassSearchChange(e.target.value)}
                          onFocus={() => setShowClassDropdown(true)}
                          onKeyDown={handleClassKeyDown}
                          placeholder="Search or select a class..."
                          className="w-full px-3 py-2 pr-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent"
                          required
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                      </div>
                      {showClassDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {filteredClasses.length > 0 ? (
                            filteredClasses.map((cls: any, index) => (
                              <button
                                key={cls._id}
                                type="button"
                                onClick={() => handleClassSelect(cls._id, cls.name, cls.subject)}
                                className={`w-full text-left px-4 py-2 transition-all duration-150 first:rounded-t-lg last:rounded-b-lg ${
                                  index === selectedClassIndex
                                    ? 'bg-[#2E7D32] dark:bg-[#2E7D32] text-white font-semibold'
                                    : 'bg-white dark:bg-gray-800 hover:bg-[#E8F5E9] dark:hover:bg-[#1C2B1C]/50 text-gray-900 dark:text-white hover:text-[#2E7D32] dark:hover:text-[#04C40A]'
                                }`}
                              >
                                {cls.name}
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                              {classes.length === 0 ? 'No classes found' : 'No matching classes found'}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Assignment Type
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => { setIsLive(true); setIsQuizizzAssign(false); }}
                          className={`px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
                            isLive
                              ? 'border-[#2E7D32] bg-[#E8F5E9] dark:bg-[#1C2B1C] text-[#2E7D32] dark:text-[#04C40A] font-semibold'
                              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-[#2E7D32]/50 hover:bg-[#E8F5E9]/50 dark:hover:bg-[#1C2B1C]/50'
                          }`}
                        >
                          <div className="text-lg font-bold">Live</div>
                          <div className="text-xs mt-1">Real-time session</div>
                        </button>

                        <button
                          type="button"
                          onClick={() => { setIsLive(false); setIsQuizizzAssign(true); setLiveStyle('quizizz'); }}
                          className={`px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
                            isQuizizzAssign
                              ? 'border-[#2E7D32] bg-[#E8F5E9] dark:bg-[#1C2B1C] text-[#2E7D32] dark:text-[#04C40A] font-semibold'
                              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-[#2E7D32]/50 hover:bg-[#E8F5E9]/50 dark:hover:bg-[#1C2B1C]/50'
                          }`}
                        >
                          <div className="text-lg font-bold">Assignment</div>
                          <div className="text-xs mt-1">With deadline</div>
                        </button>
                      </div>
                      {isQuizizzAssign && (
                        <div className="mt-3">
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Deadline</label>
                          <input
                            type="datetime-local"
                            value={assignmentDeadline}
                            onChange={(e) => setAssignmentDeadline(e.target.value)}
                            min={new Date().toISOString().slice(0, 16)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                          />
                          <div className="text-xs text-slate-400 mt-1">Students must submit before this time</div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Number of Questions
                      </label>
                      <select
                        value={questionCount}
                        onChange={(e) => setQuestionCount(Number(e.target.value))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                      >
                        <option value={5}>5 questions</option>
                        <option value={10}>10 questions</option>
                        <option value={15}>15 questions</option>
                        <option value={20}>20 questions</option>
                        <option value={25}>25 questions</option>
                        <option value={30}>30 questions</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Question Types
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center gap-3 cursor-pointer group p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                          <input
                            type="checkbox"
                            checked={questionTypes.identification}
                            onChange={(e) => setQuestionTypes(prev => ({ ...prev, identification: e.target.checked }))}
                            className="w-4 h-4 rounded border-slate-300 accent-[#2E7D32] focus:ring-[#2E7D32]"
                          />
                          <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">
                            Identification
                          </span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer group p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                          <input
                            type="checkbox"
                            checked={questionTypes.multipleChoice}
                            onChange={(e) => setQuestionTypes(prev => ({ ...prev, multipleChoice: e.target.checked }))}
                            className="w-4 h-4 rounded border-slate-300 accent-[#2E7D32] focus:ring-[#2E7D32]"
                          />
                          <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">
                            Multiple Choice
                          </span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer group p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                          <input
                            type="checkbox"
                            checked={questionTypes.trueOrFalse}
                            onChange={(e) => setQuestionTypes(prev => ({ ...prev, trueOrFalse: e.target.checked }))}
                            className="w-4 h-4 rounded border-slate-300 accent-[#2E7D32] focus:ring-[#2E7D32]"
                          />
                          <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">
                            True or False
                          </span>
                        </label>

                        <label className="flex items-center gap-3 cursor-pointer group p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                          <input
                            type="checkbox"
                            checked={questionTypes.paragraph}
                            onChange={(e) => setQuestionTypes(prev => ({ ...prev, paragraph: e.target.checked }))}
                            className="w-4 h-4 rounded border-slate-300 accent-[#2E7D32] focus:ring-[#2E7D32]"
                          />
                          <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">
                            Essay
                          </span>
                        </label>
                      </div>
                    </div>
                  </>
                )}

                {/* Subject removed from Settings */}

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Difficulty Level
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['easy', 'medium', 'hard'] as const).map((level) => (
                      <button
                        key={level}
                        onClick={() => setDifficulty(level)}
                        className={`px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                          difficulty === level
                            ? 'bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] text-white shadow-md'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                      >
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {(contentType === 'quiz' || contentType === 'exam') && (
                  <>
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={includeExplanations}
                          onChange={(e) => setIncludeExplanations(e.target.checked)}
                          className="w-5 h-5 rounded border-slate-300 accent-[#2E7D32] focus:ring-[#2E7D32]"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">
                          Include explanations
                        </span>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={autoGrade}
                          onChange={(e) => setAutoGrade(e.target.checked)}
                          className="w-5 h-5 rounded border-slate-300 accent-[#2E7D32] focus:ring-[#2E7D32]"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">
                          Auto-grade responses
                        </span>
                      </label>
                    </div>
                  </>
                )}

                {/* Flashcard-specific and Summary-specific options */}
                {/* flashcards options removed */}

                {/* summary options removed */}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
