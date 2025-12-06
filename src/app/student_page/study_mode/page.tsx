"use client";
import "../dashboard/styles.css";
import React, { useRef, useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";
import MultiFileProgressModal, { type MultiFileProgressState } from "@/components/molecules/MultiFileProgressModal";

function StudyModeContent() {
  const router = useRouter();
  const [tab, setTab] = useState<"paste" | "upload" | "class-files">("upload");
  // create type: summary | flashcards
  const [createType, setCreateType] = useState<'summary' | 'flashcards'>('summary');


  // paste state
  const [pasteText, setPasteText] = useState("");
  const pasteRef = useRef<HTMLTextAreaElement | null>(null);
  const MAX_CHARS = 100000;

  // upload state
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { showError, showSuccess, showInfo } = useToast();
  
  // Multi-file generation progress state
  const [multiFileProgress, setMultiFileProgress] = useState<MultiFileProgressState>({
    isOpen: false,
    currentFileIndex: 0,
    totalFiles: 0,
    currentFileName: '',
    successCount: 0,
    failedCount: 0,
    startTime: 0,
  });
  const [alert, setAlert] = useState<{ isVisible: boolean; type: 'success' | 'error' | 'warning' | 'info'; message: string }>({ isVisible: false, type: 'info', message: '' });
  const hideAlert = () => setAlert({ ...alert, isVisible: false });

  // summary options
  const [summaryType, setSummaryType] = useState<'brief' | 'detailed' | 'bullet-points' | 'outline'>('outline');
  const [summaryLength, setSummaryLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [customTitle, setCustomTitle] = useState('');
  // flashcard options
  const [maxCards, setMaxCards] = useState<number>(20);
  const [maxCardsError, setMaxCardsError] = useState<string>('');
  // public/private option
  const [isPublic, setIsPublic] = useState<boolean>(false);
  // subject/class selection for flashcards
  const [subject, setSubject] = useState<string>('');
  const [userSubjects, setUserSubjects] = useState<string[]>([]);
  // search state for subject selection
  const [subjectSearch, setSubjectSearch] = useState<string>('');
  const [showSubjectDropdown, setShowSubjectDropdown] = useState<boolean>(false);
  const [selectedSubjectIndex, setSelectedSubjectIndex] = useState<number>(-1);
  const subjectInputRef = useRef<HTMLInputElement | null>(null);

  // class files state
  const [classes, setClasses] = useState<unknown[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedResource, setSelectedResource] = useState('');
  const [classFilesLoading, setClassFilesLoading] = useState(false);
  // search state for class selection
  const [classSearch, setClassSearch] = useState<string>('');
  const [showClassDropdown, setShowClassDropdown] = useState<boolean>(false);
  const [selectedClassIndex, setSelectedClassIndex] = useState<number>(-1);
  const classInputRef = useRef<HTMLInputElement | null>(null);

  // localStorage keys for persisting options
  const SUMMARY_OPTIONS_KEY = 'study_mode_summary_options_v1';
  const FLASHCARD_OPTIONS_KEY = 'study_mode_flashcard_options_v1';
  // keep loaded values for options (we no longer persist/restore the custom title)
  const loadedSummaryRef = React.useRef<{ summaryType?: string; summaryLength?: string } | null>(null);
  const loadedFlashRef = React.useRef<{ maxCards?: number } | null>(null);

  // Load saved options on mount
  useEffect(() => {
    try {
      const s = localStorage.getItem(SUMMARY_OPTIONS_KEY);
      if (s) {
        const parsed = JSON.parse(s || '{}');
        if (parsed.summaryType) setSummaryType(parsed.summaryType);
        if (parsed.summaryLength) setSummaryLength(parsed.summaryLength);
        // store option values but do NOT restore titles
        loadedSummaryRef.current = { summaryType: parsed.summaryType, summaryLength: parsed.summaryLength };
      }
    } catch (e) {
      // ignore localStorage errors
    }
    try {
      const f = localStorage.getItem(FLASHCARD_OPTIONS_KEY);
      if (f) {
        const parsed = JSON.parse(f || '{}');
        if (parsed.maxCards) setMaxCards(Number(parsed.maxCards));
        loadedFlashRef.current = { maxCards: Number(parsed.maxCards) };
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // We intentionally do NOT auto-restore titles when switching create type so users can enter a new title.

  // Persist summary options when they change
  useEffect(() => {
    try {
      const obj = { summaryType, summaryLength };
      localStorage.setItem(SUMMARY_OPTIONS_KEY, JSON.stringify(obj));
    } catch (e) {
      // ignore
    }
  }, [summaryType, summaryLength]);

  // Persist flashcard options when they change
  useEffect(() => {
    try {
      const obj = { maxCards };
      localStorage.setItem(FLASHCARD_OPTIONS_KEY, JSON.stringify(obj));
    } catch (e) {
      // ignore
    }
  }, [maxCards]);

  // Get userId on component mount
  useEffect(() => {
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
    }
    getUserId();
  }, []);

  // Fetch user's enrolled classes to get subjects
  useEffect(() => {
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
        console.log('Fetched classes data:', data);
        
        if (data.success && data.data.classes) {
          const subjects = data.data.classes.map((cls: any) => cls.subject as string);
          const uniqueSubjects = Array.from(new Set(subjects)) as string[];
          console.log('User enrolled subjects:', uniqueSubjects);
          setUserSubjects(uniqueSubjects);
        }
      } catch (error) {
        console.error('Error fetching user subjects:', error);
      }
    };

    if (userId) {
      fetchUserSubjects();
    }
  }, [userId]);

  // support preselect via query param: ?create=flashcards|summary
  const searchParams = useSearchParams();
  useEffect(() => {
    try {
      const createParam = searchParams?.get?.('create') || '';
      if (createParam) {
        const v = createParam.toLowerCase();
        if (v === 'flashcards' || v === 'flashcard') setCreateType('flashcards');
        else if (v === 'summary' || v === 'summaries') setCreateType('summary');
      }
    } catch (e) {
      // ignore
    }
  }, [searchParams]);

  // Reset subject search when switching tabs
  useEffect(() => {
    setSubjectSearch(subject);
  }, [tab, createType, subject]);

  // Reset class search when class is selected or tab changes
  useEffect(() => {
    if (selectedClass) {
      const selectedClassObj = classes.find((c: any) => c.id === selectedClass) as any;
      if (selectedClassObj) {
        setClassSearch(`${selectedClassObj.name} - ${selectedClassObj.subject}`);
      }
    } else {
      setClassSearch('');
    }
  }, [selectedClass, classes]);

  // Load classes when class-files tab is selected
  useEffect(() => {
    const loadClasses = async () => {
      try {
        const response = await fetch(`/api/student_page/flashcard/generate-from-class-file?userId=${userId}`);
        const data = await response.json();
        if (data.success) {
          setClasses(data.classes);
        }
      } catch (error) {
        console.error('Failed to load classes:', error);
      }
    };

    if (tab === 'class-files' && userId) {
      loadClasses();
    }
  }, [tab, userId]);

  const handlePasteInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    if (v.length <= MAX_CHARS) setPasteText(v);
    if (alert.isVisible) hideAlert();
  };

  const handlePasteDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const list = e.dataTransfer.files;
    if (list && list.length > 0) {
      const file = list[0];
      const textTypes = [
        "text/",
        "application/json",
        "application/xml",
        "application/xhtml+xml",
        "application/javascript",
      ];
      if (
        textTypes.some((t) => file.type.startsWith(t)) ||
        file.name.match(/\.(txt|md|csv|json|xml|html?|js)$/i)
      ) {
        const reader = new FileReader();
        reader.onload = () => {
          const txt = String(reader.result || "");
          const combined = pasteText ? pasteText + "\n\n" + txt : txt;
          setPasteText(combined.slice(0, MAX_CHARS));
        };
        reader.readAsText(file);
      }
    } else {
      const dtText = e.dataTransfer.getData("text");
      if (dtText)
        setPasteText((prev) => (prev ? prev + "\n\n" + dtText : dtText).slice(0, MAX_CHARS));
    }
  };

  const handlePasteDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => e.preventDefault();

  const handleFilesAdd = (newFiles: FileList | null) => {
    if (!newFiles || newFiles.length === 0) {
      console.log('No files to add');
      return;
    }
    console.log('Adding files:', Array.from(newFiles).map(f => ({ name: f.name, size: f.size, type: f.type })));
    const fileArray = Array.from(newFiles);

    // clear previous generation errors when we have valid files
    hideAlert();

    setFiles((prev) => {
      const updated = [...prev, ...fileArray].slice(0, 20);
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

  const handleClassFileGeneration = async () => {
    if (!selectedClass || !selectedResource) {
      showError('Please select a class and resource', 'Selection Required');
      return;
    }

    // Validate subject for flashcards
    if ((createType === 'flashcards' || createType === 'summary') && (!subject || subject.trim() === '')) {
      showError('Please select a subject/class for this set', 'Subject Required');
      return;
    }

    // Get the selected resource name for the progress modal
    const selectedClassObj = classes.find((c: any) => c.id === selectedClass) as any;
    const selectedResourceObj = selectedClassObj?.resources?.find((r: any) => r.id === selectedResource);
    const fileName = selectedResourceObj?.name || customTitle || 'Class File';

    setClassFilesLoading(true);
    hideAlert();

    // Show progress modal
    setMultiFileProgress({
      isOpen: true,
      currentFileIndex: 0,
      totalFiles: 1,
      currentFileName: fileName,
      successCount: 0,
      failedCount: 0,
      startTime: Date.now(),
    });

    try {
      console.log('Processing class file...');

      let response: Response;

      if (createType === 'summary') {
        response = await fetch(`/api/student_page/summary/generate-from-class-file?userId=${userId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            classId: selectedClass,
            resourceId: selectedResource,
            title: customTitle || 'Summary from Class File',
            summaryType,
            maxLength: summaryLength === 'short' ? 200 : summaryLength === 'medium' ? 350 : 500,
            isPublic
          })
        });
      } else {
        response = await fetch(`/api/student_page/flashcard/generate-from-class-file?userId=${userId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            classId: selectedClass,
            resourceId: selectedResource,
            title: customTitle || 'Flashcards from Class File',
            difficulty: 'medium',
            aiProvider: 'gemini',
            maxCards,
            subject: subject || undefined
          })
        });
      }

      const data = await response.json();
      console.log('Class file processing result:', data);

      if (data.success) {
        // Update progress modal with success
        setMultiFileProgress(prev => ({ ...prev, successCount: 1 }));
        
        // Close modal after a brief moment
        setTimeout(() => {
          setMultiFileProgress(prev => ({ ...prev, isOpen: false }));
        }, 500);

        const successMsg = createType === 'summary' 
          ? `Summary generated successfully from class file` 
          : `Generated ${data.flashcard?.cardsGenerated || maxCards} flashcards from class file`;
        showSuccess(successMsg, 'Generation Complete');

        setTimeout(() => {
          const timestamp = Date.now();
          if (createType === 'summary') {
            router.push(isPublic ? `/student_page/public_library?tab=summaries&refresh=${timestamp}` : `/student_page/private_library?tab=summaries&refresh=${timestamp}`);
          } else {
            router.push(isPublic ? `/student_page/public_library?tab=flashcards&refresh=${timestamp}` : `/student_page/private_library?tab=flashcards&refresh=${timestamp}`);
          }
        }, 600);
      } else {
        // Update progress modal with failure
        setMultiFileProgress(prev => ({ ...prev, failedCount: 1 }));
        // Use details if available for more specific error message
        const errorMsg = data.details || data.error || 'Failed to generate from class file';
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error('Class file processing error:', error);
      setMultiFileProgress(prev => ({ ...prev, isOpen: false }));
      const msg = error instanceof Error ? error.message : 'Failed to generate from class file';
      showError(msg, 'Generation Failed');
    } finally {
      setClassFilesLoading(false);
    }
  };

  const hasContent = files.length > 0 || pasteText.trim().length > 0;
  const needsSubject = createType === 'flashcards' || createType === 'summary';
  const allowGenerate = hasContent && (!needsSubject || (subject && subject.trim().length > 0));

  // Filter subjects based on search input
  const filteredSubjects = userSubjects.filter(subj => 
    subj.toLowerCase().includes(subjectSearch.toLowerCase())
  );

  // Handle subject selection from dropdown
  const handleSubjectSelect = (selectedSubject: string) => {
    setSubject(selectedSubject);
    setSubjectSearch(selectedSubject);
    setShowSubjectDropdown(false);
    setSelectedSubjectIndex(-1);
  };

  // Handle subject search input
  const handleSubjectSearchChange = (value: string) => {
    setSubjectSearch(value);
    setSubject(value);
    setShowSubjectDropdown(true);
    setSelectedSubjectIndex(-1);
  };

  // Handle keyboard navigation for subject dropdown
  const handleSubjectKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSubjectDropdown) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSubjectIndex(prev => 
          prev < filteredSubjects.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSubjectIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedSubjectIndex >= 0 && selectedSubjectIndex < filteredSubjects.length) {
          handleSubjectSelect(filteredSubjects[selectedSubjectIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowSubjectDropdown(false);
        setSelectedSubjectIndex(-1);
        break;
    }
  };

  // Filter classes based on search input
  // Only show classes that have at least one accessible file
  // If the search matches a selected class format "Name - Subject", show all classes with files
  const classesWithFiles = classes.filter((cls: any) => 
    cls.resources?.some((r: any) => r.hasUrl) || cls.resourceCount > 0
  );
  const isSelectedClassFormat = selectedClass && classesWithFiles.some((cls: any) => 
    classSearch === `${cls.name} - ${cls.subject}`
  );
  const filteredClasses = isSelectedClassFormat 
    ? classesWithFiles 
    : classesWithFiles.filter((cls: any) => 
        cls.name.toLowerCase().includes(classSearch.toLowerCase()) ||
        cls.subject.toLowerCase().includes(classSearch.toLowerCase())
      );

  // Handle class selection from dropdown
  const handleClassSelect = (classId: string) => {
    setSelectedClass(classId);
    setSelectedResource('');
    const selectedClassObj = classes.find((c: any) => c.id === classId) as any;
    if (selectedClassObj) {
      setClassSearch(`${selectedClassObj.name} - ${selectedClassObj.subject}`);
      if (selectedClassObj.subject) {
        setSubject(selectedClassObj.subject);
        setSubjectSearch(selectedClassObj.subject);
      }
    }
    setShowClassDropdown(false);
    setSelectedClassIndex(-1);
  };

  // Handle class search input
  const handleClassSearchChange = (value: string) => {
    setClassSearch(value);
    // If user clears the input or modifies it, reset the selected class
    const matchingClass = classes.find((cls: any) => 
      `${cls.name} - ${cls.subject}` === value
    );
    if (!matchingClass) {
      setSelectedClass('');
      setSelectedResource('');
    }
    setShowClassDropdown(true);
    setSelectedClassIndex(-1);
  };

  // Handle keyboard navigation for class dropdown
  const handleClassKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showClassDropdown) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedClassIndex(prev => 
          prev < filteredClasses.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedClassIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedClassIndex >= 0 && selectedClassIndex < filteredClasses.length) {
          handleClassSelect((filteredClasses[selectedClassIndex] as any).id);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowClassDropdown(false);
        setSelectedClassIndex(-1);
        break;
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (subjectInputRef.current && !subjectInputRef.current.contains(event.target as Node)) {
        setShowSubjectDropdown(false);
      }
      if (classInputRef.current && !classInputRef.current.contains(event.target as Node)) {
        setShowClassDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGenerate = async () => {
    if (!allowGenerate || !userId) return;
    await generateSummary();
  };

  const generateSummary = async () => {
    setIsGenerating(true);
    hideAlert();

    // Validate subject for flashcards and summaries
    if ((createType === 'flashcards' || createType === 'summary')) {
      if (!subject || subject.trim() === '') {
        showError('Please select a subject/class before generating this set', 'Subject Required');
        setIsGenerating(false);
        return;
      }
    }

    console.log('🚀 Starting generation:', {
      createType,
      tab,
      filesCount: files.length,
      pasteTextLength: pasteText.length,
      userId,
      subject: createType === 'flashcards' ? subject : 'N/A'
    });

    try {
      // Convert summary length to word count
      const getMaxLength = (length: 'short' | 'medium' | 'long') => {
        switch (length) {
          case 'short': return 200;
          case 'medium': return 350;
          case 'long': return 500;
          default: return 350;
        }
      };

      const maxLength = getMaxLength(summaryLength);

      // Handle multiple files with progress modal
      if (tab === "upload" && files.length > 1) {
        // Multi-file generation
        setMultiFileProgress({
          isOpen: true,
          currentFileIndex: 0,
          totalFiles: files.length,
          currentFileName: files[0].name,
          successCount: 0,
          failedCount: 0,
          startTime: Date.now(),
        });

        let successCount = 0;
        let failedCount = 0;

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setMultiFileProgress(prev => ({
            ...prev,
            currentFileIndex: i,
            currentFileName: file.name,
          }));

          try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('title', file.name.replace(/\.[^/.]+$/, '')); // Remove extension for title
            formData.append('isPublic', String(isPublic));
            if (subject) formData.append('subject', subject);

            let response: Response;
            if (createType === 'summary') {
              formData.append('summaryType', summaryType);
              formData.append('maxLength', maxLength.toString());
              response = await fetch(`/api/student_page/summary/generate-from-file?userId=${userId}`, {
                method: 'POST',
                body: formData
              });
            } else {
              formData.append('maxCards', String(maxCards));
              response = await fetch(`/api/student_page/flashcard/generate-from-file?userId=${userId}`, {
                method: 'POST',
                body: formData
              });
            }

            const data = await response.json();
            if (response.ok && data.success) {
              successCount++;
            } else {
              failedCount++;
              console.error(`Failed to process ${file.name}:`, data.error);
            }
          } catch (err) {
            failedCount++;
            console.error(`Error processing ${file.name}:`, err);
          }

          setMultiFileProgress(prev => ({
            ...prev,
            successCount,
            failedCount,
          }));
        }

        // Close modal and show results
        setMultiFileProgress(prev => ({ ...prev, isOpen: false }));
        
        if (successCount > 0) {
          const libraryType = isPublic ? 'public' : 'private';
          showSuccess(
            `Generated ${successCount} ${createType === 'summary' ? 'summaries' : 'flashcard sets'}${failedCount > 0 ? ` (${failedCount} failed)` : ''}`,
            'Generation Complete'
          );
          setTimeout(() => {
            const timestamp = Date.now();
            if (createType === 'summary') {
              router.push(isPublic ? `/student_page/public_library?tab=summaries&refresh=${timestamp}` : `/student_page/private_library?tab=summaries&refresh=${timestamp}`);
            } else {
              router.push(isPublic ? `/student_page/public_library?tab=flashcards&refresh=${timestamp}` : `/student_page/private_library?tab=flashcards&refresh=${timestamp}`);
            }
          }, 400);
        } else {
          showError('All files failed to process. Please try again.', 'Generation Failed');
        }
        
        setIsGenerating(false);
        return;
      }

      // Single file or text generation - also use progress modal
      const fileName = tab === "upload" && files.length > 0 ? files[0].name : (customTitle || 'Text content');
      setMultiFileProgress({
        isOpen: true,
        currentFileIndex: 0,
        totalFiles: 1,
        currentFileName: fileName,
        successCount: 0,
        failedCount: 0,
        startTime: Date.now(),
      });

      let response: Response | undefined;

      if (createType === 'summary') {
        if (tab === "upload" && files.length > 0) {
          const formData = new FormData();
          formData.append('file', files[0]);
          formData.append('title', customTitle || files[0].name);
          formData.append('summaryType', summaryType);
          formData.append('maxLength', maxLength.toString());
          formData.append('isPublic', String(isPublic));
          if (subject) formData.append('subject', subject);

          response = await fetch(`/api/student_page/summary/generate-from-file?userId=${userId}`, {
            method: 'POST',
            body: formData
          });
        } else {
          const requestBody = {
            content: pasteText,
            title: customTitle || 'Study Notes Summary',
            summaryType,
            maxLength,
            subject,
            isPublic
          };

          response = await fetch(`/api/student_page/summary/generate-from-text?userId=${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });
        }

      } else if (createType === 'flashcards') {
        // generate flashcards
        if (tab === "upload" && files.length > 0) {
          const formData = new FormData();
          formData.append('file', files[0]);
          formData.append('title', customTitle || files[0].name);
          formData.append('maxCards', String(maxCards));
          formData.append('isPublic', String(isPublic));
          formData.append('subject', subject);

          response = await fetch(`/api/student_page/flashcard/generate-from-file?userId=${userId}`, {
            method: 'POST',
            body: formData
          });
        } else {
          const requestBody = {
            content: pasteText,
            title: customTitle || 'Flashcards from notes',
            maxCards,
            isPublic,
            subject
          };

          response = await fetch(`/api/student_page/flashcard/generate-from-text?userId=${userId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          });
        }

      }

      if (!response) {
        throw new Error('Invalid create type selected');
      }

      const data = await response.json();
      if (!response.ok || !data.success) {
        setMultiFileProgress(prev => ({ ...prev, failedCount: 1 }));
        throw new Error(data.error || 'Failed to generate');
      }

      // Update progress modal with success
      setMultiFileProgress(prev => ({ ...prev, successCount: 1 }));

      // Close modal and redirect
      setMultiFileProgress(prev => ({ ...prev, isOpen: false }));

      // Success - redirect to the appropriate library tab
      const libraryType = isPublic ? 'public' : 'private';
      const successMsg = createType === 'summary' 
        ? `Summary generated successfully and added to your ${libraryType} library` 
        : `Flashcards generated successfully and added to your ${libraryType} library`;
      showSuccess(successMsg, 'Generation Complete');

      setTimeout(() => {
        const timestamp = Date.now();
        if (createType === 'summary') {
          router.push(isPublic ? `/student_page/public_library?tab=summaries&refresh=${timestamp}` : `/student_page/private_library?tab=summaries&refresh=${timestamp}`);
        } else if (createType === 'flashcards') {
          router.push(isPublic ? `/student_page/public_library?tab=flashcards&refresh=${timestamp}` : `/student_page/private_library?tab=flashcards&refresh=${timestamp}`);
        }
      }, 400);

    } catch (error) {
      console.error('Summary generation failed:', error);
      const msg = error instanceof Error ? error.message : 'Failed to generate summary';
      setMultiFileProgress(prev => ({ ...prev, isOpen: false }));
      showError(msg, 'Generation Failed');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900" style={{ padding: '1.5rem' }}>
      {/* Multi-file Generation Progress Modal */}
      <MultiFileProgressModal
        isOpen={multiFileProgress.isOpen}
        onClose={() => setMultiFileProgress(prev => ({ ...prev, isOpen: false }))}
        title={`Generating ${createType === 'summary' ? 'Summaries' : 'Flashcards'}`}
        currentFileIndex={multiFileProgress.currentFileIndex}
        totalFiles={multiFileProgress.totalFiles}
        currentFileName={multiFileProgress.currentFileName}
        successCount={multiFileProgress.successCount}
        failedCount={multiFileProgress.failedCount}
        startTime={multiFileProgress.startTime}
      />

      <div style={{ maxWidth: '80rem', marginLeft: 'auto', marginRight: 'auto' }}>
        {/* Header Card - matching ai-studio style */}
        <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-8 mb-8 overflow-hidden">
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#2E7D32]/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-400/5 rounded-full blur-3xl" />
          
          <div className="relative">
            <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2">
              Study Mode
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              Generate AI-powered summaries and flashcards from your study materials
            </p>
          </div>
        </div>

        {/* Input Method Tabs - matching Private Library style */}
        <div className="mb-8 bg-transparent">
          <div className="flex gap-6 border-b border-slate-200 dark:border-slate-700">
            {(["upload", "paste", "class-files"] as const).map((t) => {
              const label = t === "paste" ? "Paste Text" : t === "class-files" ? "Class Files" : "Upload Files";
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`py-3 text-sm font-medium transition-colors ${
                    tab === t
                      ? 'text-[#2E7D32] dark:!text-[hsl(142.1,76.2%,36.3%)] border-b-2 border-[#2E7D32] dark:!border-[hsl(142.1,76.2%,36.3%)] -mb-[2px]'
                      : 'text-slate-600 dark:text-slate-400 hover:text-[#2E7D32] dark:hover:text-white'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Create Type Selection */}
        <div className="mb-6">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">What would you like to create?</div>
          <div className="flex gap-3">
            <button
              onClick={() => setCreateType('summary')}
              className={`flex-1 text-left p-4 rounded-lg border transition-all ${
                createType === 'summary' 
                  ? 'border-[#2E7D32] dark:border-[#04C40A] bg-[#E8F5E9] dark:bg-[#1C2B1C] shadow-sm' 
                  : 'border-gray-200 dark:border-gray-700 bg-white/0 dark:bg-transparent hover:border-[#2E7D32] dark:hover:border-[#04C40A] hover:bg-[#E8F5E9]/50 dark:hover:bg-[#1C2B1C]/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-5 h-5 transition-colors ${createType === 'summary' ? 'text-[#2E7D32] dark:text-[#04C40A]' : 'text-gray-600 dark:text-gray-400'}`}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                  </svg>
                </div>
                <div className={`font-semibold transition-colors ${createType === 'summary' ? 'text-[#2E7D32] dark:text-[#04C40A]' : 'text-gray-900 dark:text-white'}`}>Summary</div>
              </div>
              <div className={`text-xs transition-colors ${createType === 'summary' ? 'text-[#2E7D32]/70 dark:text-[#04C40A]/70' : 'text-gray-500 dark:text-gray-400'}`}>AI-generated study summary</div>
            </button>
            <button
              onClick={() => setCreateType('flashcards')}
              className={`flex-1 text-left p-4 rounded-lg border transition-all ${
                createType === 'flashcards' 
                  ? 'border-[#2E7D32] dark:border-[#04C40A] bg-[#E8F5E9] dark:bg-[#1C2B1C] shadow-sm' 
                  : 'border-gray-200 dark:border-gray-700 bg-white/0 dark:bg-transparent hover:border-[#2E7D32] dark:hover:border-[#04C40A] hover:bg-[#E8F5E9]/50 dark:hover:bg-[#1C2B1C]/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-5 h-5 transition-colors ${createType === 'flashcards' ? 'text-[#2E7D32] dark:text-[#04C40A]' : 'text-gray-600 dark:text-gray-400'}`}>
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5,3C3.89,3 3,3.89 3,5V19C3,20.11 3.89,21 5,21H19C20.11,21 21,20.11 21,19V5C21,3.89 20.11,3 19,3H5M5,5H19V19H5V5M7,7V9H17V7H7M7,11V13H17V11H7M7,15V17H14V15H7Z" />
                  </svg>
                </div>
                <div className={`font-semibold transition-colors ${createType === 'flashcards' ? 'text-[#2E7D32] dark:text-[#04C40A]' : 'text-gray-900 dark:text-white'}`}>Flashcards</div>
              </div>
              <div className={`text-xs transition-colors ${createType === 'flashcards' ? 'text-[#2E7D32]/70 dark:text-[#04C40A]/70' : 'text-gray-500 dark:text-gray-400'}`}>Interactive study cards</div>
            </button>
          </div>
        </div>

        {/* Options */}
        <div className="mb-6 p-4 rounded-xl">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-4">{createType === 'summary' ? 'Summary Options' : 'Flashcard Options'}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {createType === 'summary' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Summary Type</label>
                  <select
                    value={summaryType}
                    onChange={(e) => setSummaryType(e.target.value as "outline" | "brief" | "detailed" | "bullet-points")}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent"
                  >
                    <option value="outline">Outline Format</option>
                    <option value="detailed">Detailed Summary</option>
                    <option value="brief">Brief Overview</option>
                    <option value="bullet-points">Bullet Points</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Length</label>
                  <select
                    value={summaryLength}
                    onChange={(e) => setSummaryLength(e.target.value as "short" | "medium" | "long")}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent"
                  >
                    <option value="short">Short</option>
                    <option value="medium">Medium</option>
                    <option value="long">Long</option>
                  </select>
                </div>

                {/* Subject/Class search for summaries (required) - hidden when using Class Files tab (class selection provides subject) */}
                {tab !== 'class-files' && (
                  <div className="relative" ref={subjectInputRef}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Subject/Class <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <input
                        type="text"
                        value={subjectSearch}
                        onChange={(e) => handleSubjectSearchChange(e.target.value)}
                        onFocus={() => setShowSubjectDropdown(true)}
                        onKeyDown={handleSubjectKeyDown}
                        placeholder="Search or select a subject/class..."
                        className="w-full px-3 py-2 pr-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent"
                        required
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                    </div>
                    {showSubjectDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredSubjects.length > 0 ? (
                          filteredSubjects.map((subj, index) => (
                            <button
                              key={subj}
                              type="button"
                              onClick={() => handleSubjectSelect(subj)}
                              className={`w-full text-left px-4 py-2 transition-all duration-150 first:rounded-t-lg last:rounded-b-lg ${
                                index === selectedSubjectIndex
                                  ? 'bg-[#2E7D32] dark:bg-[#2E7D32] text-white font-semibold'
                                  : 'bg-white dark:bg-gray-800 hover:bg-[#E8F5E9] dark:hover:bg-[#1C2B1C]/50 text-gray-900 dark:text-white hover:text-[#2E7D32] dark:hover:text-[#04C40A]'
                              }`}
                            >
                              {subj}
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                            {userSubjects.length === 0 ? 'No enrolled classes found' : 'No matching classes found'}
                          </div>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Search or choose from your enrolled classes</p>
                  </div>
                )}

                {/* Hide title field when multiple files are uploaded OR when using class-files tab (has its own title field) */}
                {!(tab === 'upload' && files.length > 1) && tab !== 'class-files' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Title (Optional)</label>
                    <input 
                      type="text" 
                      value={customTitle} 
                      onChange={(e) => setCustomTitle(e.target.value)} 
                      placeholder="Auto-generated if empty" 
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent" 
                    />
                  </div>
                )}
              </>
            )}

            {createType === 'flashcards' && (
              <>
                {/* For flashcards: hide the top-level subject selector when using Class Files tab (class select provides subject) */}
                {tab !== 'class-files' && (
                  <>
                    <div className="relative" ref={subjectInputRef}>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Subject/Class <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={subjectSearch}
                          onChange={(e) => handleSubjectSearchChange(e.target.value)}
                          onFocus={() => setShowSubjectDropdown(true)}
                          onKeyDown={handleSubjectKeyDown}
                          placeholder="Search or select a subject/class..."
                          className="w-full px-3 py-2 pr-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent"
                          required
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                      </div>
                      {showSubjectDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {filteredSubjects.length > 0 ? (
                            filteredSubjects.map((subj, index) => (
                              <button
                                key={subj}
                                type="button"
                                onClick={() => handleSubjectSelect(subj)}
                                className={`w-full text-left px-4 py-2 transition-all duration-150 first:rounded-t-lg last:rounded-b-lg ${
                                  index === selectedSubjectIndex
                                    ? 'bg-[#2E7D32] dark:bg-[#2E7D32] text-white font-semibold'
                                    : 'bg-white dark:bg-gray-800 hover:bg-[#E8F5E9] dark:hover:bg-[#1C2B1C]/50 text-gray-900 dark:text-white hover:text-[#2E7D32] dark:hover:text-[#04C40A]'
                                }`}
                              >
                                {subj}
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                              {userSubjects.length === 0 ? 'No enrolled classes found' : 'No matching classes found'}
                            </div>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Search or choose from your enrolled classes
                      </p>
                    </div>
                    {/* Hide title field when multiple files are uploaded - each file uses its own name */}
                    {!(tab === 'upload' && files.length > 1) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Title (Optional)</label>
                        <input 
                          type="text" 
                          value={customTitle} 
                          onChange={(e)=>setCustomTitle(e.target.value)} 
                          placeholder="Auto-generated if empty" 
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent" 
                        />
                      </div>
                    )}
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Number of Flashcards</label>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <button
                      type="button"
                      onClick={() => setMaxCards(10)}
                      className={`px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
                        maxCards === 10
                          ? 'border-[#2E7D32] bg-[#E8F5E9] dark:bg-[#1C2B1C] text-[#2E7D32] dark:text-[#04C40A] font-semibold'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-[#2E7D32]/50 hover:bg-[#E8F5E9]/50 dark:hover:bg-[#1C2B1C]/50'
                      }`}
                    >
                      <div className="text-lg font-bold">10</div>
                      <div className="text-xs mt-1">Quick</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMaxCards(20)}
                      className={`px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
                        maxCards === 20
                          ? 'border-[#2E7D32] bg-[#E8F5E9] dark:bg-[#1C2B1C] text-[#2E7D32] dark:text-[#04C40A] font-semibold'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-[#2E7D32]/50 hover:bg-[#E8F5E9]/50 dark:hover:bg-[#1C2B1C]/50'
                      }`}
                    >
                      <div className="text-lg font-bold">20</div>
                      <div className="text-xs mt-1">Standard</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMaxCards(30)}
                      className={`px-4 py-3 rounded-xl border-2 transition-all duration-200 ${
                        maxCards === 30
                          ? 'border-[#2E7D32] bg-[#E8F5E9] dark:bg-[#1C2B1C] text-[#2E7D32] dark:text-[#04C40A] font-semibold'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-[#2E7D32]/50 hover:bg-[#E8F5E9]/50 dark:hover:bg-[#1C2B1C]/50'
                      }`}
                    >
                      <div className="text-lg font-bold">30</div>
                      <div className="text-xs mt-1">Comprehensive</div>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="5"
                      max="50"
                      value={maxCards}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (e.target.value === '') {
                          setMaxCards(20);
                          setMaxCardsError('');
                        } else if (value < 5) {
                          setMaxCards(value);
                          setMaxCardsError('Minimum 5 flashcards required');
                        } else if (value > 50) {
                          setMaxCards(value);
                          setMaxCardsError('Maximum 50 flashcards allowed');
                        } else {
                          setMaxCards(value);
                          setMaxCardsError('');
                        }
                      }}
                      className={`w-full px-3 py-2 pr-20 rounded-lg border ${
                        maxCardsError 
                          ? 'border-red-500 dark:border-red-500' 
                          : 'border-gray-200 dark:border-gray-700'
                      } bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 ${
                        maxCardsError 
                          ? 'focus:ring-red-500' 
                          : 'focus:ring-[#2E7D32]'
                      } focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-gray-500 pointer-events-none">
                      Custom
                    </div>
                  </div>
                  {maxCardsError && (
                    <p className="text-xs text-red-500 dark:text-red-400 mt-1 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {maxCardsError}
                    </p>
                  )}
                  {!maxCardsError && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      More flashcards provide better coverage but take longer to generate
                    </p>
                  )}
                </div>
              </>
            )}
            
          </div>

          {/* Public/Private Toggle */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#2E7D32]/30 dark:peer-focus:ring-[#2E7D32]/50 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#2E7D32]"></div>
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  Make this set public
                  <svg className="w-4 h-4 text-[#2E7D32] dark:text-[#04C40A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {isPublic 
                    ? `This ${createType === 'summary' ? 'summary' : 'flashcard set'} will be shared in the public library for others to discover and use`
                    : `This ${createType === 'summary' ? 'summary' : 'flashcard set'} will only be visible to you in your private library`
                  }
                </p>
              </div>
            </label>
          </div>
        </div>

        <div className="mb-20 sm:mb-24">
          {tab === "paste" && (
            <div className="relative">
              <textarea
                ref={pasteRef}
                value={pasteText}
                onChange={handlePasteInput}
                onDrop={handlePasteDrop}
                onDragOver={handlePasteDragOver}
                placeholder={createType === 'flashcards' ? "Paste your content here (notes, articles, study materials)..." : "Paste your notes here. We'll do the rest."}
                className="w-full min-h-[200px] sm:min-h-[300px] lg:min-h-[400px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-6 text-gray-900 dark:text-white resize-vertical text-sm sm:text-base focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent transition-colors"
              />
              <div className="absolute right-3 sm:right-4 bottom-3 sm:bottom-4 text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-2 py-1 rounded">
                {pasteText.length}/{MAX_CHARS}
              </div>
            </div>
          )}

          {tab === "upload" && (
            <div>
              {/* Info Card - Moved to top */}
              <div className="mb-6 flex items-start gap-3 p-4 bg-[#E8F5E9] dark:bg-[#1C2B1C] rounded-xl border border-[#2E7D32]/20 dark:border-[#2E7D32]/30">
                <div className="w-8 h-8 bg-[#2E7D32]/10 dark:bg-[#2E7D32]/20 rounded-md flex items-center justify-center flex-shrink-0">
                  <div className="w-5 h-5 text-[#2E7D32] dark:text-[#04C40A]">
                    {createType === 'summary' ? (
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M5,3C3.89,3 3,3.89 3,5V19C3,20.11 3.89,21 5,21H19C20.11,21 21,20.11 21,19V5C21,3.89 20.11,3 19,3H5M5,5H19V19H5V5M7,7V9H17V7H7M7,11V13H17V11H7M7,15V17H14V15H7Z" />
                      </svg>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-sm sm:text-base font-medium text-gray-900 dark:text-white">
                    {createType === 'summary' ? 'AI Summary' : 'Flashcards'}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    {createType === 'summary' ? 'Generate concise AI-powered summaries of your study material' : 'Create interactive flashcards from your notes'}
                  </div>
                </div>
              </div>

              {/* show drop/browse area only when no files selected */}
              {/* Hidden file input - always rendered */}
              <input
                ref={fileInputRef}
                onChange={handleFileInput}
                type="file"
                accept=".pdf,.docx,.txt,.md,.doc"
                className="hidden"
                multiple
              />

              {files.length === 0 ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl py-8 sm:py-12 lg:py-16 flex flex-col items-center justify-center gap-4 text-center bg-white dark:bg-gray-800 min-h-[200px] sm:min-h-[300px] lg:min-h-[400px]"
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-sky-400 to-indigo-500 rounded-md flex items-center justify-center text-white text-xs sm:text-sm font-bold">DOC</div>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-pink-400 to-rose-500 rounded-md flex items-center justify-center text-white text-xs sm:text-sm font-bold">PDF</div>
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-gray-400 to-gray-500 rounded-md flex items-center justify-center text-white text-xs sm:text-sm font-bold">TXT</div>
                  </div>
                  <div className="text-gray-700 dark:text-gray-300 font-medium text-sm sm:text-base">
                    {createType === 'flashcards' ? 'Upload files for AI processing' : 'Drag notes, slides, or readings here'}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    PDF, Word, Text files (max 10MB) - Processed with advanced AI
                  </div>
                  <div className="mt-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 sm:px-6 py-2 sm:py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-full shadow-sm text-sm font-medium text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                    >
                      Browse files
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{f.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{(f.size / 1024).toFixed(1)} KB</div>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFileAt(i)}
                        className="ml-3 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {/* Add more files button */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full p-4 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 hover:border-[#2E7D32] dark:hover:border-[#2E7D32] hover:bg-[#E8F5E9] dark:hover:bg-[#1C2B1C] transition-colors flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400 hover:text-[#2E7D32] dark:hover:text-[#04C40A]"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="text-sm font-medium">Add more files</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === "class-files" && (
            <div className="panel panel-padded-lg">
              {/* Header with icon */}
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-[#E8F5E9] dark:bg-[#1C2B1C] flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-[#2E7D32] dark:text-[#04C40A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Generate from Class Files</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Select files uploaded by your teachers and generate {createType === 'summary' ? 'summaries' : 'flashcards'} with AI
                  </p>
                </div>
              </div>

              {/* Form Fields Container */}
              <div className="space-y-5">
                {/* Class Selection */}
                <div className="relative" ref={classInputRef}>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Select Class <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={classSearch}
                      onChange={(e) => handleClassSearchChange(e.target.value)}
                      onFocus={() => setShowClassDropdown(true)}
                      onClick={() => setShowClassDropdown(true)}
                      onKeyDown={handleClassKeyDown}
                      placeholder="Search or select a class..."
                      className="w-full pl-11 pr-10 py-3 rounded-xl border border-gray-200 dark:border-[#2E2E2E] bg-white dark:bg-[#090909] text-gray-900 dark:text-white focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                      disabled={classFilesLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowClassDropdown(!showClassDropdown)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      disabled={classFilesLoading}
                    >
                      <svg className={`w-5 h-5 transition-transform ${showClassDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  {showClassDropdown && !classFilesLoading && (
                    <div className="absolute z-20 w-full mt-2 bg-white dark:bg-[#090909] border border-gray-200 dark:border-[#2E2E2E] rounded-xl shadow-xl max-h-64 overflow-y-auto">
                      {filteredClasses.length > 0 ? (
                        filteredClasses.map((cls: any, index: number) => (
                          <button
                            key={cls.id}
                            type="button"
                            onClick={() => handleClassSelect(cls.id)}
                            className={`w-full text-left px-4 py-3 transition-all duration-150 first:rounded-t-xl last:rounded-b-xl border-b border-gray-100 dark:border-[#2E2E2E] last:border-b-0 ${
                              index === selectedClassIndex
                                ? 'bg-[#2E7D32] dark:bg-[#2E7D32]'
                                : 'bg-white dark:bg-[#090909] hover:bg-[#E8F5E9] dark:hover:bg-[#1C2B1C]'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                index === selectedClassIndex
                                  ? 'bg-white/20'
                                  : 'bg-[#E8F5E9] dark:bg-[#1C2B1C]'
                              }`}>
                                <svg className={`w-4 h-4 ${index === selectedClassIndex ? 'text-white' : 'text-[#2E7D32] dark:text-[#04C40A]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className={`text-sm font-semibold truncate ${
                                  index === selectedClassIndex
                                    ? 'text-white'
                                    : 'text-gray-900 dark:text-white'
                                }`}>
                                  {cls.name}
                                </div>
                                <div className={`text-xs mt-0.5 flex items-center gap-2 ${
                                  index === selectedClassIndex
                                    ? 'text-white/80'
                                    : 'text-gray-500 dark:text-gray-400'
                                }`}>
                                  <span>{cls.subject}</span>
                                  <span>•</span>
                                  <span>{cls.resourceCount} file{cls.resourceCount !== 1 ? 's' : ''}</span>
                                </div>
                              </div>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-6 text-center">
                          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-[#1C2B1C] flex items-center justify-center">
                            <svg className="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              {classesWithFiles.length === 0 ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                              ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              )}
                            </svg>
                          </div>
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
                            {classesWithFiles.length === 0 ? 'No classes with files' : 'No matching classes found'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {classesWithFiles.length === 0 
                              ? 'None of your classes have uploaded files yet' 
                              : 'Try a different search term'}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Resource Selection */}
                {selectedClass && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Select File <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <select
                        value={selectedResource}
                        onChange={(e) => setSelectedResource(e.target.value)}
                        className="w-full pl-11 pr-10 py-3 rounded-xl border border-gray-200 dark:border-[#2E2E2E] bg-white dark:bg-[#090909] text-gray-900 dark:text-white focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent appearance-none cursor-pointer transition-all"
                        disabled={classFilesLoading}
                      >
                        <option value="">Choose a file...</option>
                        {(classes.find((c: any) => c.id === selectedClass) as any)?.resources
                          .filter((resource: any) => resource.hasUrl)
                          .map((resource: any) => (
                            <option key={resource.id} value={resource.id}>
                              {resource.name} ({resource.type})
                              {resource.sizeBytes && ` - ${(resource.sizeBytes / 1024 / 1024).toFixed(2)} MB`}
                            </option>
                          ))}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    {(classes.find((c: any) => c.id === selectedClass) as any)?.resources.filter((r: any) => r.hasUrl).length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        No accessible files in this class
                      </p>
                    )}
                  </div>
                )}
                  
                {/* Title Field */}
                {selectedClass && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Title (Optional)</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                      </div>
                      <input 
                        type="text" 
                        value={customTitle} 
                        onChange={(e)=>setCustomTitle(e.target.value)} 
                        placeholder="Auto-generated if empty" 
                        className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 dark:border-[#2E2E2E] bg-white dark:bg-[#090909] text-gray-900 dark:text-white focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent transition-all" 
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Ready to Process Card */}
              {selectedClass && selectedResource && (
                <div className="mt-6 bg-[#E8F5E9] dark:bg-[#1C2B1C] p-4 rounded-xl border border-[#2E7D32]/20 dark:border-[#2E7D32]/30">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#2E7D32]/10 dark:bg-[#04C40A]/10 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-[#2E7D32] dark:text-[#04C40A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#2E7D32] dark:text-[#04C40A]">
                        Ready to process
                      </p>
                      <p className="text-xs text-[#2E7D32]/80 dark:text-[#04C40A]/80 mt-1">
                        Selected file from <span className="font-medium">{(classes.find((c: any) => c.id === selectedClass) as any)?.name}</span>. AI will analyze the content and generate {createType === 'summary' ? 'a summary' : 'flashcards'}.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Generate Button */}
              <div className="mt-6">
                <button
                  type="button"
                  onClick={handleClassFileGeneration}
                  disabled={classFilesLoading || !selectedClass || !selectedResource}
                  className={`w-full py-3.5 px-6 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-3 ${
                    classFilesLoading || !selectedClass || !selectedResource
                      ? "bg-gray-200 dark:bg-[#2E2E2E] text-gray-400 dark:text-gray-500 cursor-not-allowed"
                      : "bg-[#2E7D32] dark:bg-[#2E7D32] text-white shadow-lg shadow-[#2E7D32]/25 hover:shadow-xl hover:shadow-[#2E7D32]/30 hover:scale-[1.01] active:scale-[0.99]"
                  }`}
                >
                  {classFilesLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Generating {createType === 'summary' ? 'Summary' : 'Flashcards'}...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span>Generate {createType === 'summary' ? 'Summary' : `${maxCards} Flashcards`}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Empty State when no class selected */}
              {!selectedClass && (
                <div className="mt-6 py-8 flex flex-col items-center justify-center text-center border-2 border-dashed border-gray-200 dark:border-[#2E2E2E] rounded-xl">
                  <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-[#1C2B1C] flex items-center justify-center mb-4">
                    <svg className="w-7 h-7 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Select a class to get started</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">Choose from your enrolled classes above</p>
                </div>
              )}
            </div>
          )}

          {/* Alerts are shown via the global Alert component (useAlert) */}
        </div>

        {/* Generate Button - Fixed on mobile, inline on desktop */}
        <div className="fixed sm:static bottom-4 left-4 right-4 sm:bottom-auto sm:left-auto sm:right-auto z-50 sm:z-auto mt-0 sm:mt-8">
          {/* Only show this button for paste and upload tabs, not for class-files */}
          {tab !== 'class-files' && (
            <div className="bg-white dark:bg-gray-800 sm:bg-transparent sm:dark:bg-transparent p-4 sm:p-0 rounded-xl sm:rounded-none shadow-lg sm:shadow-none border sm:border-none border-gray-200 dark:border-gray-700 flex items-center justify-between sm:justify-end gap-4">
              <div className="text-sm text-gray-400 sm:hidden">
                {files.length > 0
                  ? `${files.length} file${files.length > 1 ? 's' : ''}`
                  : pasteText.trim().length > 0
                    ? "Text ready"
                    : "No content"}{" "}
              </div>
              <div className="hidden sm:block text-sm text-gray-400 mr-4">
                {files.length > 0
                  ? files.length
                  : pasteText.trim().length > 0
                    ? 1
                    : 0}{" "}
                selected
              </div>
              <button
                onClick={handleGenerate}
                disabled={!allowGenerate || isGenerating || (createType === 'flashcards' && maxCardsError !== '')}
                className={`px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 ${!allowGenerate || isGenerating || (createType === 'flashcards' && maxCardsError !== '')
                  ? "bg-gray-600/30 text-gray-300 cursor-not-allowed"
                  : "bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] text-white shadow-lg hover:scale-[1.02] hover:shadow-xl"
                  } w-full sm:w-auto`}
              >
                {isGenerating && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                )}
                {isGenerating ? `Generating ${createType === 'summary' ? 'Summary' : 'Flashcards'}...` : `Generate ${createType === 'summary' ? 'Summary' : 'Flashcards'}`}
              </button>
            </div>
          )}
        </div>

        <div className="max-w-2xl mx-auto mt-8 text-xs text-gray-500 dark:text-gray-400">
          This product is enhanced with AI and may provide incorrect or problematic content. Do not
          enter any personal data.
        </div>
      </div>


    </div>
  );
}

export default function StudyModePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900" style={{ padding: '1.5rem' }}>
        <div style={{ maxWidth: '80rem', marginLeft: 'auto', marginRight: 'auto' }}>
          {/* Header Card Skeleton */}
          <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-8 mb-8 overflow-hidden">
            <div className="animate-pulse">
              <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-48 mb-3"></div>
              <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-96"></div>
            </div>
          </div>
          
          {/* Tabs Skeleton */}
          <div className="mb-8 border-b border-slate-200 dark:border-slate-700">
            <div className="flex gap-6 animate-pulse">
              <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-24 py-3"></div>
              <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-24 py-3"></div>
              <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-24 py-3"></div>
            </div>
          </div>
          
          {/* Content Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 p-6 animate-pulse">
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-48 mb-4"></div>
                <div className="h-40 bg-slate-200 dark:bg-slate-700 rounded"></div>
              </div>
            </div>
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-200 dark:border-slate-700 p-6 animate-pulse">
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-32 mb-4"></div>
                <div className="space-y-3">
                  <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded"></div>
                  <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    }>
      <StudyModeContent />
    </Suspense>
  );
}