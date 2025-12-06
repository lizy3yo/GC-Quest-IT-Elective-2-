"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import QuestionTypeRadio from "@/components/molecules/QuestionTypeRadio";
import LibrarySelectionRadio from "@/components/molecules/LibrarySelectionRadio";
import MultiFileProgressModal from "@/components/molecules/MultiFileProgressModal";
import { Globe, Lock } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";

type MultipleChoiceQuestion = {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: string;
  topic: string;
  points: number;
};

type WrittenQuestion = {
  question: string;
  expectedAnswer: string;
  rubric: string[];
  difficulty: string;
  topic: string;
  points: number;
};

type PracticeTest = {
  title: string;
  description: string;
  subject: string;
  difficulty: string;
  timeLimit: number;
  totalPoints: number;
  multipleChoiceQuestions: MultipleChoiceQuestion[];
  writtenQuestions: WrittenQuestion[];
  topics: string[];
  learningObjectives: string[];
  instructions: string;
};

function GeneratePracticeTestContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showSuccess, showError, showInfo } = useToast();
  
  const [showCustomModal, setShowCustomModal] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [practiceTest, setPracticeTest] = useState<PracticeTest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isPublic, setIsPublic] = useState(false); // New state for public/private selection

  // Multi-file progress tracking
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  // Subject/class selection
  const [subject, setSubject] = useState('');
  const [userSubjects, setUserSubjects] = useState<string[]>([]);

  // Customization options
  const [maxQuestions, setMaxQuestions] = useState(20);
  const [questionType, setQuestionType] = useState<'both' | 'multiple-choice' | 'written'>('both');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [timeLimit, setTimeLimit] = useState(30);
  const [customTitle, setCustomTitle] = useState('');

  // Get source info
  const source = searchParams.get('source');
  const sets = searchParams.get('sets');
  const summaries = searchParams.get('summaries');
  const hasFiles = searchParams.get('hasFiles') === 'true';

  // Progress modal state
  const [progressStartTime, setProgressStartTime] = useState(0);

  // Fetch user's enrolled classes to get subjects
  const fetchUserSubjects = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch('/api/student_page/class?active=true', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.success && data.data.classes) {
        const subjects = data.data.classes.map((cls: any) => cls.subject as string);
        const uniqueSubjects = Array.from(new Set(subjects)) as string[];
        setUserSubjects(uniqueSubjects);
      }
    } catch (error) {
      console.error('Error fetching user subjects:', error);
    }
  };

  useEffect(() => {
    // Get userId - try from API first, then localStorage
    async function getUserId() {
      let uid: string | null = null;
      try {
        const token = localStorage.getItem("accessToken");
        if (token) {
          const currentRes = await fetch("/api/v1/users/current", {
            credentials: "include",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          });
          if (currentRes.ok) {
            const json = await currentRes.json().catch(() => ({} as unknown));
            uid = json?.user?._id;
          }
        }
      } catch (e) {
        // ignore
      }
      if (!uid) uid = localStorage.getItem('userId');
      if (!uid) {
        uid = `temp-user-${Date.now()}`;
        localStorage.setItem('userId', uid);
      }
      setUserId(uid);
      
      // Fetch user's enrolled classes
      if (uid) {
        fetchUserSubjects();
      }
    }
    getUserId();
    
    // If source is upload, retrieve the files from sessionStorage
    if (source === 'upload') {
      const storedFilesData = sessionStorage.getItem('practice_test_upload_files');
      console.log('Stored files data:', storedFilesData ? 'Found' : 'Not found');
      
      if (storedFilesData) {
        try {
          const filesData = JSON.parse(storedFilesData);
          console.log('Parsed files data:', filesData?.length || 0, 'files');
          
          if (filesData && filesData.length > 0) {
            // Convert all base64 files back to File objects
            const filePromises = filesData.map((fileData: { name: string; type: string; data: string }) =>
              fetch(fileData.data)
                .then(res => res.blob())
                .then(blob => new File([blob], fileData.name, { type: fileData.type }))
            );
            
            Promise.all(filePromises)
              .then((files: File[]) => {
                console.log('Files recreated successfully:', files.length);
                setUploadedFiles(files);
              })
              .catch(err => {
                console.error('Failed to recreate files from base64:', err);
                showError('Failed to load uploaded files. Please try again.');
                router.push('/student_page/practice_tests');
              });
          } else {
            console.error('No files in stored data');
            showError('No files found. Please select files to upload.');
            router.push('/student_page/practice_tests');
          }
        } catch (e) {
          console.error('Failed to parse stored files JSON:', e);
          showError('Failed to load uploaded files. Please try again.');
          router.push('/student_page/practice_tests');
        }
      } else {
        console.error('No stored files data in sessionStorage');
        showError('No files found. Please select files to upload.');
        router.push('/student_page/practice_tests');
      }
    }
  }, [source, router, showError]);

  const handleGenerate = async () => {
    if (!userId) return;
    
    setShowCustomModal(false);
    setIsGenerating(true);
    setProgressStartTime(Date.now());
    setCurrentFileIndex(0);
    setSuccessCount(0);
    setFailedCount(0);
    setError(null);

    try {
      let fetchOptions: RequestInit;

      if (source === 'upload' && uploadedFiles.length > 0) {
        // Combine all uploaded files into one practice test
        // Convert files to base64 and send as JSON
        const filePromises = uploadedFiles.map(file => {
          return new Promise<{ name: string; type: string; data: string }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve({
                name: file.name,
                type: file.type,
                data: reader.result as string
              });
            };
            reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
            reader.readAsDataURL(file);
          });
        });
        
        const filesData = await Promise.all(filePromises);
        
        const requestBody = {
          userId,
          source: 'mixed',
          uploadedFilesData: filesData,
          maxQuestions,
          includeMultipleChoice: questionType === 'both' || questionType === 'multiple-choice',
          includeWritten: questionType === 'both' || questionType === 'written',
          difficulty,
          timeLimit,
          title: customTitle || 'Combined Practice Test',
          subject: subject || undefined
        };

        fetchOptions = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        };

        // Clean up session storage
        sessionStorage.removeItem('practice_test_upload_files');
      } else {
        // For other sources, use JSON
        const requestBody: any = {
          userId,
          maxQuestions,
          includeMultipleChoice: questionType === 'both' || questionType === 'multiple-choice',
          includeWritten: questionType === 'both' || questionType === 'written',
          difficulty,
          timeLimit,
          title: customTitle || undefined
        };

        if (source === 'paste') {
          const text = sessionStorage.getItem('practice_test_paste_text');
          if (!text) {
            throw new Error('No text found');
          }
          requestBody.source = 'paste';
          requestBody.pastedText = text;
          if (subject) requestBody.subject = subject;
        } else if (sets || summaries || hasFiles) {
          // Combined selection - can include flashcards, summaries, and/or files
          requestBody.source = 'mixed';
          
          if (sets) {
            requestBody.flashcardIds = sets.split(',');
          }
          if (summaries) {
            requestBody.summaryIds = summaries.split(',');
          }
          if (hasFiles) {
            // Get uploaded files from sessionStorage
            const storedFilesData = sessionStorage.getItem('practice_test_upload_files');
            if (storedFilesData) {
              requestBody.uploadedFilesData = JSON.parse(storedFilesData);
            }
          }
        } else {
          throw new Error('No source specified');
        }

        fetchOptions = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        };
      }

      const res = await fetch('/api/student_page/practice-test/generate', fetchOptions);

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate practice test');
      }

      const generatedTest = data.practiceTest;
      setPracticeTest(generatedTest);
      
      // Automatically save to library after generation
      await saveToLibrary(generatedTest);
      
      // Clean up session storage
      sessionStorage.removeItem('practice_test_paste_text');
      sessionStorage.removeItem('practice_test_upload_files');

    } catch (err: any) {
      setError(err.message || 'Failed to generate practice test');
    } finally {
      setIsGenerating(false);
    }
  };

  const saveToLibrary = async (testToSave: unknown) => {
    if (!testToSave || !userId) return;
    
    try {
      const sourceType = source === 'paste' ? 'paste' : source === 'upload' ? 'upload' : 'flashcards';
      const sourceIds = sets ? sets.split(',') : [];

      const res = await fetch('/api/student_page/practice-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          practiceTest: testToSave,
          sourceType,
          sourceIds,
          isPublic
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save');
      }

      console.log(`✅ Practice test saved to ${isPublic ? 'public' : 'private'} library!`);
      showSuccess(`Practice test saved to ${isPublic ? 'public' : 'private'} library!`, 'Success');
      
    } catch (err: unknown) {
      console.error('Failed to save practice test:', err);
      showError('Failed to save practice test. Please try again.');
      throw err;
    }
  };

  const handleViewInLibrary = () => {
    if (!practiceTest) return;
    
    // Navigate to appropriate library based on selection
    const libraryPath = isPublic ? 'public_library' : 'private_library';
    router.push(`/student_page/${libraryPath}?tab=practice_tests&subject=${encodeURIComponent(practiceTest.subject)}`);
  };



  const handleTakeTest = () => {
    if (!practiceTest) return;
    // Store test in session and navigate to take test page
    sessionStorage.setItem('current_practice_test', JSON.stringify(practiceTest));
    router.push('/student_page/practice_tests/take');
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Customization Modal */}
      {showCustomModal && !isGenerating && !practiceTest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                Customize Practice Test
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Configure your test settings before generating
              </p>

              <div className="space-y-6">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Test Title (Optional)
                  </label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="Leave empty for auto-generated title"
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>

                {/* Subject/Class Selection - Only show for upload and paste sources */}
                {(source === 'upload' || source === 'paste') && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Subject/Class <span className="text-red-500">*</span>
                    </label>
                    {userSubjects.length > 0 ? (
                      <select
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        required
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        <option value="">Select subject (required)</option>
                        {userSubjects.map((subj, index) => (
                          <option key={index} value={subj}>
                            {subj}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Enter subject (e.g., Mathematics, Science)"
                        required
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    )}
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {userSubjects.length > 0 
                        ? 'Select the class/subject for this practice test' 
                        : 'Enter a subject name for this practice test'}
                    </p>
                  </div>
                )}

                {/* Questions */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Questions (max. 100)
                  </label>
                  <input
                    type="number"
                    value={maxQuestions}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Allow free typing, only store valid numbers
                      if (value === '') {
                        setMaxQuestions(0);
                      } else {
                        const num = parseInt(value);
                        if (!isNaN(num) && num >= 0) {
                          setMaxQuestions(num);
                        }
                      }
                    }}
                    onBlur={(e) => {
                      // Validate on blur (when user leaves the field)
                      const value = parseInt(e.target.value);
                      if (isNaN(value) || value < 5) {
                        setMaxQuestions(5);
                      } else if (value > 100) {
                        setMaxQuestions(100);
                      }
                    }}
                    min="5"
                    max="100"
                    className={`w-full px-4 py-2 rounded-lg border bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 ${
                      maxQuestions < 5 || maxQuestions > 100
                        ? 'border-red-500 dark:border-red-500'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  />
                  {maxQuestions < 5 && maxQuestions !== 0 && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      Minimum 5 questions required
                    </p>
                  )}
                  {maxQuestions > 100 && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      Maximum 100 questions allowed
                    </p>
                  )}
                  {maxQuestions >= 5 && maxQuestions <= 100 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Total questions to generate (minimum 5, maximum 100)
                    </p>
                  )}
                </div>

                {/* Time Limit */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Timer (minutes)
                  </label>
                  <input
                    type="number"
                    value={timeLimit}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Allow free typing, only store valid numbers
                      if (value === '') {
                        setTimeLimit(0);
                      } else {
                        const num = parseInt(value);
                        if (!isNaN(num) && num >= 0) {
                          setTimeLimit(num);
                        }
                      }
                    }}
                    onBlur={(e) => {
                      // Validate on blur (when user leaves the field)
                      const value = parseInt(e.target.value);
                      if (isNaN(value) || value < 5) {
                        setTimeLimit(5);
                      }
                    }}
                    min="5"
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>

                {/* Question Types */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                    Question Types
                  </label>
                  <QuestionTypeRadio
                    value={questionType}
                    onValueChange={(value) => setQuestionType(value as 'both' | 'multiple-choice' | 'written')}
                    options={[
                      {
                        value: 'multiple-choice',
                        label: 'Multiple choice',
                        icon: (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )
                      },
                      {
                        value: 'written',
                        label: 'Written',
                        icon: (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        )
                      },
                      {
                        value: 'both',
                        label: 'Both',
                        icon: (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                          </svg>
                        )
                      }
                    ]}
                  />
                </div>

                {/* Library Selection */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                    Save To
                  </label>
                  <LibrarySelectionRadio isPublic={isPublic} onValueChange={setIsPublic} />
                </div>

                {/* Buttons at bottom */}
                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => router.back()}
                    className="flex-1 px-6 py-3 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={((source === 'upload' || source === 'paste') && !subject)}
                    className="flex-1 px-6 py-3 rounded-xl bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] text-white font-medium hover:bg-[#2E7D32]/90 dark:hover:bg-[hsl(142.1,76.2%,36.3%)]/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all"
                  >
                    Generate Test
                  </button>
                </div>
                {((source === 'upload' || source === 'paste') && !subject) && (
                  <p className="text-sm text-red-600 text-center">Please select a subject/class to continue</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading Modal */}
      <MultiFileProgressModal
        isOpen={isGenerating}
        title="Generating Practice Test"
        subtitle="AI is creating your questions..."
        currentFileIndex={currentFileIndex}
        totalFiles={source === 'upload' && uploadedFiles.length > 0 ? uploadedFiles.length : 1}
        currentFileName={source === 'upload' && uploadedFiles.length > 0 ? uploadedFiles[currentFileIndex]?.name || "Practice Test" : customTitle || "Practice Test"}
        successCount={successCount}
        failedCount={0}
        startTime={progressStartTime}
        showCloseButton={false}
      />

      {/* Error State */}
      {error && !isGenerating && (
        <div className="max-w-2xl mx-auto mt-12">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
              Generation Failed
            </h3>
            <p className="text-red-700 dark:text-red-300 mb-4">{error}</p>
            <button
              onClick={() => {
                setError(null);
                setShowCustomModal(true);
              }}
              className="px-6 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Success - Show Generated Test */}
      {practiceTest && !isGenerating && (
        <div className="space-y-6">
          {/* Compact Header with Buttons */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-6">
              <div className="flex items-start justify-between gap-6 mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {practiceTest.title}
                    </h1>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap rounded-full bg-[#E8F5E9] text-[#2E7D32] dark:bg-[#1C2B1C] dark:text-[#04C40A]">
                      {isPublic ? (
                        <>
                          <Globe className="w-3 h-3" />
                          Public
                        </>
                      ) : (
                        <>
                          <Lock className="w-3 h-3" />
                          Private
                        </>
                      )}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap rounded-full bg-[#E8F5E9] text-[#2E7D32] dark:bg-[#1C2B1C] dark:text-[#04C40A]">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                      {maxQuestions} Questions
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[0.6875rem] font-semibold whitespace-nowrap rounded-full bg-[#E8F5E9] text-[#2E7D32] dark:bg-[#1C2B1C] dark:text-[#04C40A]">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {practiceTest.timeLimit} min
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">{practiceTest.description}</p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-3 flex-shrink-0">
                  <button
                    onClick={handleTakeTest}
                    className="px-6 py-2.5 bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] text-white rounded-lg font-semibold hover:bg-[#2E7D32]/90 dark:hover:bg-[hsl(142.1,76.2%,36.3%)]/90 shadow-md hover:shadow-lg transition-all whitespace-nowrap"
                  >
                    Take Test Now
                  </button>
                  <button
                    onClick={handleViewInLibrary}
                    className="px-6 py-2.5 rounded-lg border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all whitespace-nowrap"
                  >
                    View in Library
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Question Preview */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Question Preview
              </h3>
            </div>

            <div className="p-6 space-y-8">
              {/* Multiple Choice Questions */}
              {practiceTest.multipleChoiceQuestions.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                    Multiple Choice ({practiceTest.multipleChoiceQuestions.length} questions)
                  </h4>
                  <div className="space-y-6">
                    {practiceTest.multipleChoiceQuestions.slice(0, 3).map((q, idx) => (
                      <div key={idx} className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4">
                        <div className="flex items-start gap-3 mb-3">
                          <span className="flex-shrink-0 w-8 h-8 bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] text-white rounded-full flex items-center justify-center font-semibold">
                            {idx + 1}
                          </span>
                          <p className="font-medium text-slate-900 dark:text-slate-100 flex-1">
                            {q.question}
                          </p>
                        </div>
                        <div className="ml-11 space-y-2">
                          {q.options.map((opt, optIdx) => (
                            <div
                              key={optIdx}
                              className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                              <div className="w-6 h-6 rounded-full border-2 border-slate-300 dark:border-slate-600"></div>
                              <span className="text-slate-700 dark:text-slate-300">{opt}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Written Questions */}
              {practiceTest.writtenQuestions.length > 0 && (
                <div>
                  <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
                    Written Response ({practiceTest.writtenQuestions.length} questions)
                  </h4>
                  <div className="space-y-6">
                    {practiceTest.writtenQuestions.slice(0, 2).map((q, idx) => (
                      <div key={idx} className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4">
                        <div className="flex items-start gap-3 mb-3">
                          <span className="flex-shrink-0 w-8 h-8 bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] text-white rounded-full flex items-center justify-center font-semibold">
                            {idx + 1}
                          </span>
                          <p className="font-medium text-slate-900 dark:text-slate-100 flex-1">
                            {q.question}
                          </p>
                        </div>
                        <div className="ml-11">
                          <div className="h-24 bg-white dark:bg-slate-800 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


    </div>
  );
}

export default function GeneratePracticeTestPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <GeneratePracticeTestContent />
    </Suspense>
  );
}
