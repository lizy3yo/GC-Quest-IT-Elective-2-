"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";
import { BookOpen, FileText, Upload, ClipboardPaste } from "lucide-react";

type ContentType = 'flashcards' | 'summary';
type InputMethod = 'upload' | 'paste' | 'topic';

export default function AIStudioPage() {
  const router = useRouter();
  const [contentType, setContentType] = useState<ContentType>('flashcards');
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

  // Content options
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [questionCount, setQuestionCount] = useState(20);
  // Quiz/exam-specific options removed (this page focuses on flashcards & summaries)

  // Title / summary options (copied from Study Mode behavior)
  const [customTitle, setCustomTitle] = useState('');
  const [summaryType, setSummaryType] = useState<'brief' | 'detailed' | 'bullet-points' | 'outline'>('outline');
  const [summaryLength, setSummaryLength] = useState<'short' | 'medium' | 'long'>('medium');

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedClass, setSelectedClass] = useState("");
  const [classes, setClasses] = useState<any[]>([]);
  
  // Class search state
  const [classSearch, setClassSearch] = useState("");
  const [showClassDropdown, setShowClassDropdown] = useState(false);
  const [selectedClassIndex, setSelectedClassIndex] = useState(-1);
  const classInputRef = useRef<HTMLDivElement | null>(null);
  
  // Subject options from teacher's classes (removed UI; kept classes list)

  // Handle URL parameters to pre-select content type and class
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const typeParam = searchParams.get('type');
      const classIdParam = searchParams.get('classId');
      
      if (typeParam && (typeParam === 'flashcards' || typeParam === 'summary')) {
        setContentType(typeParam);
      }
      
      if (classIdParam) {
        setSelectedClass(classIdParam);
      }
    }
  }, []);

  // Load teacher's classes
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
        }
      } catch (error) {
        showError('Failed to load classes', 'Load Error');
      }
    };
    loadClasses();
  }, [showError]);

  const handleFilesAdd = (newFiles: FileList | null) => {
    if (!newFiles || newFiles.length === 0) {
      console.log('No files to add');
      return;
    }
    console.log('Adding files:', Array.from(newFiles).map(f => ({ name: f.name, size: f.size, type: f.type })));
    const fileArray = Array.from(newFiles);
    
    setFiles((prev) => {
      const updated = [...prev, ...fileArray].slice(0, 20); // Limit to 20 files
      console.log('Files state updated:', updated.length, 'files');
      return updated;
    });
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File input changed:', e.target.files);
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
    
    return hasContent;
  };

  const handleGenerate = async () => {
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

      console.log('🚀 Starting generation:', {
        contentType,
        inputMethod,
        filesCount: files.length,
        pasteTextLength: pasteText.length,
        userId,
      });

      // Handle flashcards and summaries (using student API endpoints)
      if (contentType === 'flashcards' || contentType === 'summary') {
        let endpoint = '';
        let response: Response;

        if (inputMethod === 'upload') {
          // Use file-based generation
          endpoint = contentType === 'flashcards' 
            ? `/api/student_page/flashcard/generate-from-file?userId=${userId}`
            : `/api/student_page/summary/generate-from-file?userId=${userId}`;

          const formData = new FormData();
          formData.append('file', files[0]);
          formData.append('difficulty', difficulty);
          // include optional title and class assignment
          if (customTitle && customTitle.trim().length > 0) formData.append('title', customTitle.trim());
          if (selectedClass) {
            formData.append('classId', selectedClass);
            // Find the class name and send it as subject
            const selectedClassData = classes.find(c => c._id === selectedClass);
            if (selectedClassData) {
              formData.append('subject', selectedClassData.name);
            }
          }

          if (contentType === 'flashcards') {
            formData.append('maxCards', String(questionCount));
            formData.append('aiProvider', 'gemini');
          } else {
            // map summaryLength to maxLength
            const maxLengthMap: Record<string, number> = { short: 100, medium: 300, long: 800 };
            formData.append('summaryType', summaryType);
            formData.append('maxLength', String(maxLengthMap[summaryLength] || 300));
          }

          console.log('Uploading file:', files[0].name, files[0].size, 'bytes');

          response = await fetch(endpoint, {
            method: 'POST',
            body: formData
          });
        } else if (inputMethod === 'paste') {
          // Use text-based generation
          endpoint = contentType === 'flashcards'
            ? `/api/student_page/flashcard/generate-from-text?userId=${userId}`
            : `/api/student_page/summary/generate-from-text?userId=${userId}`;

          console.log('Sending text content:', pasteText.length, 'characters');

          // Find the class name if a class is selected
          const selectedClassData = selectedClass ? classes.find(c => c._id === selectedClass) : null;
          
          response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: pasteText,
              difficulty,
              maxCards: contentType === 'flashcards' ? questionCount : undefined,
              summaryType: contentType === 'summary' ? summaryType : undefined,
              maxLength: contentType === 'summary' ? (summaryLength === 'short' ? 100 : summaryLength === 'long' ? 800 : 300) : undefined,
              aiProvider: contentType === 'flashcards' ? 'gemini' : undefined,
              title: customTitle && customTitle.trim().length > 0 ? customTitle.trim() : undefined,
              classId: selectedClass || undefined,
              subject: selectedClassData ? selectedClassData.name : undefined
            })
          });
        } else {
          showError('Topic-based generation not yet implemented for flashcards/summaries');
          return;
        }

        const data = await response.json();
        console.log('Generation result:', data);

        if (!response.ok || !data.success) {
          throw new Error(data.error || data.details || 'Generation failed');
        }

        const contentId = contentType === 'flashcards' 
          ? (data.flashcard?.id || data.flashcardId)
          : (data.summary?.id || data.summaryId);

        const successMsg = contentType === 'flashcards'
          ? `Generated ${data.flashcard?.cardsGenerated || questionCount} flashcards successfully!`
          : 'Summary generated successfully!';
        
        showSuccess(successMsg, 'Success');
        
        setTimeout(() => {
          router.push(`/teacher_page/library?createdId=${contentId}&type=${contentType}`);
        }, 400);
        return;
      }

      // quiz/exam functionality removed — this page only handles flashcards and summaries

    } catch (error) {
      console.error('Generation error:', error);
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
              AI Resources
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              Generate flashcards and summaries with AI-powered content creation
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
                  onClick={() => setContentType('flashcards')}
                  className={`px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
                    contentType === 'flashcards'
                      ? 'border-[#2E7D32] bg-[#E8F5E9] dark:bg-[#1C2B1C] text-[#2E7D32] dark:text-[#04C40A] font-semibold'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-[#2E7D32]/50 hover:bg-[#E8F5E9]/50 dark:hover:bg-[#1C2B1C]/50'
                  }`}
                >
                  <div className="flex items-center justify-center mb-2">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div className="text-lg font-bold">Flashcards</div>
                  <div className="text-xs mt-1">Study cards for learning</div>
                </button>

                <button
                  type="button"
                  onClick={() => setContentType('summary')}
                  className={`px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
                    contentType === 'summary'
                      ? 'border-[#2E7D32] bg-[#E8F5E9] dark:bg-[#1C2B1C] text-[#2E7D32] dark:text-[#04C40A] font-semibold'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-[#2E7D32]/50 hover:bg-[#E8F5E9]/50 dark:hover:bg-[#1C2B1C]/50'
                  }`}
                >
                  <div className="flex items-center justify-center mb-2">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="text-lg font-bold">Summary</div>
                  <div className="text-xs mt-1">Content summarization</div>
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
                  Generated content will be saved to your library for review and publishing.
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
                {/* Title (Optional) - First */}
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

                {/* Assign to Class - Second */}
                <div className="relative" ref={classInputRef}>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Assign to Class (Optional)
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

                {/* Difficulty Level */}
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

                {/* Flashcard-specific options */}
                {contentType === 'flashcards' && (
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Number of Flashcards</label>
                      <select
                        value={questionCount}
                        onChange={(e) => setQuestionCount(Number(e.target.value))}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                      >
                        <option value={5}>5 flashcards</option>
                        <option value={10}>10 flashcards</option>
                        <option value={20}>20 flashcards</option>
                        <option value={30}>30 flashcards</option>
                        <option value={40}>40 flashcards</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Summary-specific options */}
                {contentType === 'summary' && (
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Summary Type</label>
                      <select
                        value={summaryType}
                        onChange={(e) => setSummaryType(e.target.value as any)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                      >
                        <option value="outline">Outline</option>
                        <option value="brief">Brief</option>
                        <option value="detailed">Detailed</option>
                        <option value="bullet-points">Bullet Points</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Length</label>
                      <select
                        value={summaryLength}
                        onChange={(e) => setSummaryLength(e.target.value as any)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                      >
                        <option value="short">Short</option>
                        <option value="medium">Medium</option>
                        <option value="long">Long</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
