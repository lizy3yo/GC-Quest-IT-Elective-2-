'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
// import api from '@/lib/api';

interface AnalysisResult {
  title?: string;
  cards?: Array<{ question: string; answer: string }>;
  difficulty?: string;
  tags?: string[];
  summary?: string;
  content?: string;
}

interface AnalyzeResponse {
  result?: AnalysisResult;
  message?: string;
}

export default function UploadFlashcardPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string>('');

  // File upload states
  const [file, setFile] = useState<File | null>(null);
  const [deckTitle, setDeckTitle] = useState('');
  const [deckDescription, setDeckDescription] = useState('');
  const [category, setCategory] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Array<{ question: string; answer: string }>>([]);

  // AI analysis states
  const [activeTab, setActiveTab] = useState<'upload' | 'ai' | 'zapier-file' | 'class-files'>('upload');
  const [text, setText] = useState('');
  const [analysisType, setAnalysisType] = useState('flashcards');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AnalysisResult | null>(null);

  // New Zapier AI states
  const [zapierText, setZapierText] = useState('');
  const [zapierFile, setZapierFile] = useState<File | null>(null);
  const [zapierLoading, setZapierLoading] = useState(false);
  const [zapierResult, setZapierResult] = useState<any>(null);

  // Class files states
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedResource, setSelectedResource] = useState('');
  const [classFilesLoading, setClassFilesLoading] = useState(false);

  // Flashcard count states
  const [aiCardCount, setAiCardCount] = useState(20);
  const [zapierCardCount, setZapierCardCount] = useState(20);
  const [classFileCardCount, setClassFileCardCount] = useState(20);

  // Add a new state for parsing loading
  const [parsingLoading, setParsingLoading] = useState(false);

  // Editable cards built from parsed/AI results
  const [cards, setCards] = useState<Array<{ question: string; answer: string }>>([]);

  // Upload tab analysis type
  const [uploadAnalysisType, setUploadAnalysisType] = useState<'flashcards' | 'summary' | 'quiz'>('flashcards');

  const handleCardChange = (index: number, field: 'question' | 'answer', value: string) => {
    setCards(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleDeleteCard = (index: number) => {
    setCards(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddCard = () => {
    setCards(prev => [...prev, { question: '', answer: '' }]);
  };

  // Get userId from localStorage or context
  useEffect(() => {
    // Try to get userId from localStorage, with fallback to user object
    let storedUserId = localStorage.getItem('userId');

    if (!storedUserId) {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          storedUserId = user._id || '';
          // Store it for future use
          if (storedUserId) {
            localStorage.setItem('userId', storedUserId);
          }
        } catch (e) {
          console.error('Error parsing user from localStorage:', e);
          storedUserId = '';
        }
      }
    }

    setUserId(storedUserId || '');
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!deckTitle) {
        setDeckTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
      }
      parseFile(selectedFile);
    }
  };

  // Update parseFile with userId check, loading, and improved error handling
  const parseFile = async (file: File) => {
    setParsingLoading(true);
    try {
      let text = '';
      const fileType = file.type;
      const fileName = file.name.toLowerCase();

      if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
        text = await file.text();
      } else if (fileType === 'text/csv' || fileName.endsWith('.csv')) {
        text = await file.text();
        const lines = text.split('\n');
        const parsed = lines.slice(1).map(line => {
          const [question, answer] = line.split(',');
          return { question: question?.trim(), answer: answer?.trim() };
        }).filter(item => item.question && item.answer);
        if (uploadAnalysisType === 'flashcards') {
          setPreview(parsed.slice(0, 5));
          setCards(parsed);
        } else {
          // For summary/quiz, send file to analyze API with selected type
          if (!userId) { alert('Please log in to analyze files.'); return; }
          const formData = new FormData();
          formData.append('file', file);
          formData.append('analysisType', uploadAnalysisType);
          const response = await fetch(`/api/student_page/flashcard/analyze?userId=${userId}`, { method: 'POST', body: formData });
          const data = await response.json();
          if (response.ok) {
            if (uploadAnalysisType === 'summary' && data.result?.summary) {
              setCards([{ question: 'Summary', answer: data.result.summary }]);
              setPreview([{ question: 'Summary', answer: data.result.summary.substring(0, 200) + (data.result.summary.length > 200 ? '...' : '') }]);
            } else if (data.result?.cards?.length) {
              setCards(data.result.cards);
              setPreview(data.result.cards.slice(0, 5));
            } else {
              alert('No content generated from CSV.');
            }
          } else {
            alert(data.message || 'Failed to analyze CSV');
          }
        }
        return;
      } else if ((fileType === 'application/pdf' || fileName.endsWith('.pdf')) ||
        (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName.endsWith('.docx'))) {
        // Check if userId is available before calling API
        if (!userId) {
          alert('Please log in to parse PDF or DOCX files.');
          return;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('analysisType', uploadAnalysisType);

        console.log('Calling analyze API for file:', fileName); // Debug log
        const response = await fetch(`/api/student_page/flashcard/analyze?userId=${userId}`, {
          method: 'POST',
          body: formData,
        });

        let data: AnalyzeResponse;
        try {
          data = await response.json();
        } catch (e) {
          console.error('Failed to parse analyze API JSON response', e);
          alert('Failed to parse server response while analyzing file.');
          return;
        }
        console.log('API response:', data); // Debug log

        if (response.ok) {
          if (uploadAnalysisType === 'summary' && data.result?.summary) {
            setCards([{ question: 'Summary', answer: data.result.summary }]);
            setPreview([{ question: 'Summary', answer: data.result.summary.substring(0, 200) + (data.result.summary.length > 200 ? '...' : '') }]);
          } else if (data.result?.cards && data.result.cards.length > 0) {
            setPreview(data.result.cards.slice(0, 5));
            setCards(data.result.cards);
          } else {
            alert('No cards generated from file. Try a different type.');
          }
        } else {
          alert(`Failed to parse ${fileName.endsWith('.pdf') ? 'PDF' : 'DOCX'} file. Error: ${data.message || 'Unknown error'}. Ensure the file contains extractable text.`);
        }
        return;
      } else {
        alert('Unsupported file type. Please use CSV, TXT, PDF, or DOCX files.');
        return;
      }

      // For non-CSV files, set a preview message
      setPreview([{
        question: 'File uploaded successfully',
        answer: `${file.name} (${text.length} characters)`
      }]);
      setCards([]);

    } catch (error) {
      console.error('Error parsing file:', error);
      alert('Failed to parse file. Please try again.');
    } finally {
      setParsingLoading(false);
    }
  };

  const handleAIAnalyze = async () => {
    if (!text) {
      alert('Please paste some text to analyze');
      return;
    }

    setAiLoading(true);
    try {
      const formData = new FormData();
      if (text) formData.append('text', text);
      formData.append('analysisType', analysisType);

      const response = await fetch(`/api/student_page/flashcard/analyze?userId=${userId}`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setAiResult(data.result);
        if (data.result.title) setDeckTitle(data.result.title);
        if (data.result.cards) {
          setPreview(data.result.cards.slice(0, 5));
          setCards(data.result.cards);
        }
      } else {
        alert(data.message || 'Analysis failed');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      alert('Failed to analyze content');
    } finally {
      setAiLoading(false);
    }
  };

  // New Zapier AI handlers
  const handleZapierTextGeneration = async () => {
    if (!zapierText.trim()) {
      alert('Please enter some text content');
      return;
    }

    setZapierLoading(true);
    try {
      const response = await fetch(`/api/student_page/flashcard/generate-from-text?userId=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: zapierText,
          title: deckTitle || 'Zapier AI Flashcards',
          difficulty: 'medium',
          aiProvider: 'gemini',
          maxCards: aiCardCount
        })
      });

      const data = await response.json();
      if (data.success) {
        setZapierResult(data);
        setDeckTitle(data.flashcard.title);
        alert(`✅ Success! Generated ${data.flashcard.cardsGenerated} flashcards`);
        // Redirect to library
        if (isPublic) {
          router.push('/student_page/public_library');
        } else {
          router.push('/student_page/private_library');
        }
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('Failed to generate flashcards from text');
    } finally {
      setZapierLoading(false);
    }
  };

  const handleZapierFileGeneration = async () => {
    if (!zapierFile) {
      alert('Please select a file');
      return;
    }

    setZapierLoading(true);
    setZapierResult(null);

    try {
      // Step 1: First analyze/extract content from the file
      console.log('Step 1: Analyzing file content...');
      const analyzeFormData = new FormData();
      analyzeFormData.append('file', zapierFile);
      analyzeFormData.append('analysisType', 'flashcards');

      const analyzeResponse = await fetch(`/api/student_page/flashcard/analyze?userId=${userId}`, {
        method: 'POST',
        body: analyzeFormData
      });

      if (!analyzeResponse.ok) {
        throw new Error('Failed to analyze file content');
      }

      const analyzeData = await analyzeResponse.json();
      console.log('File analysis result:', analyzeData);

      if (!analyzeData.result?.content && (!analyzeData.result?.cards || analyzeData.result.cards.length === 0)) {
        throw new Error('Could not extract meaningful content from the file');
      }

      // Step 2: Generate flashcards using the extracted content
      console.log('Step 2: Generating flashcards...');
      let generatedCards = [];

      if (analyzeData.result.cards && analyzeData.result.cards.length > 0) {
        // Use cards from analysis if available
        generatedCards = analyzeData.result.cards.slice(0, zapierCardCount);
      } else if (analyzeData.result.content) {
        // Generate cards from extracted content using text API
        const textResponse = await fetch(`/api/student_page/flashcard/generate-from-text?userId=${userId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: analyzeData.result.content,
            title: deckTitle || zapierFile.name.replace(/\.[^/.]+$/, ''),
            difficulty: 'medium',
            aiProvider: 'gemini',
            maxCards: zapierCardCount
          })
        });

        if (textResponse.ok) {
          const textData = await textResponse.json();
          if (textData.success) {
            setZapierResult(textData);
            alert(`✅ Success! Generated ${textData.flashcard.cardsGenerated} flashcards from ${zapierFile.name}`);
            // Redirect to library
            if (isPublic) {
              router.push('/student_page/public_library');
            } else {
              router.push('/student_page/private_library');
            }
            return;
          }
        }
      }

      // Step 3: Create flashcard set if we have generated cards
      if (generatedCards.length > 0) {
        const createResponse = await fetch(`/api/student_page/flashcard?userId=${userId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: deckTitle || `${zapierFile.name} Flashcards`,
            cards: generatedCards,
            difficulty: analyzeData.result.difficulty || 'medium',
            tags: [...(analyzeData.result.tags || []), 'ai-generated', 'file-upload'],
            accessType: isPublic ? 'public' : 'private'
          })
        });

        if (createResponse.ok) {
          const createData = await createResponse.json();
          alert(`✅ Success! Generated ${generatedCards.length} flashcards from ${zapierFile.name}`);
          // Redirect to library
          if (isPublic) {
            router.push('/student_page/public_library');
          } else {
            router.push('/student_page/private_library');
          }
          return;
        }
      }

      throw new Error('Failed to generate flashcards from file content');

    } catch (error) {
      console.error('File processing error:', error);
      alert(`Failed to generate flashcards: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setZapierLoading(false);
    }
  };

  const handleClassFileGeneration = async () => {
    if (!selectedClass || !selectedResource) {
      alert('Please select a class and resource');
      return;
    }

    setClassFilesLoading(true);
    try {
      console.log('Processing class file for flashcard generation...');

      const response = await fetch(`/api/student_page/flashcard/generate-from-class-file?userId=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: selectedClass,
          resourceId: selectedResource,
          title: deckTitle,
          difficulty: 'medium',
          aiProvider: 'gemini',
          maxCards: classFileCardCount
        })
      });

      const data = await response.json();
      console.log('Class file processing result:', data);

      if (data.success) {
        if (data.flashcard.cardsGenerated > 1) {
          alert(`✅ Success! Generated ${data.flashcard.cardsGenerated} flashcards from class file`);
        } else {
          alert(`⚠️ Generated ${data.flashcard.cardsGenerated} flashcard. The file may need more processing time or contain limited extractable content.`);
        }

        // Redirect to library
        if (isPublic) {
          router.push('/student_page/public_library');
        } else {
          router.push('/student_page/private_library');
        }
      } else {
        alert(`Failed to generate flashcards: ${data.error}`);
      }
    } catch (error) {
      console.error('Class file processing error:', error);
      alert('Failed to generate flashcards from class file');
    } finally {
      setClassFilesLoading(false);
    }
  };

  // Load classes when class-files tab is selected
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

  // Load classes when switching to class-files tab
  useEffect(() => {
    if (activeTab === 'class-files') {
      loadClasses();
    }
  }, [activeTab]);

  const createFlashcardFromAI = async () => {
    const cardsSource = cards?.length ? cards : (aiResult?.cards?.length ? aiResult.cards : preview);
    if (!cardsSource || cardsSource.length === 0) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/student_page/flashcard?userId=${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: deckTitle || aiResult?.title || 'AI Generated Flashcards',
          cards: cardsSource,
          difficulty: aiResult?.difficulty || 'medium',
          tags: aiResult?.tags || ['ai-generated'],
          accessType: isPublic ? 'public' : 'private'
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (isPublic) {
          router.push('/student_page/public_library');
        } else {
          router.push('/student_page/private_library');
        }
      } else {
        alert(data.message || 'Failed to create flashcard set');
      }
    } catch (error) {
      console.error('Create flashcard error:', error);
      alert('Failed to create flashcard set');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'ai') {
      await createFlashcardFromAI();
    } else if (activeTab === 'zapier-file' || activeTab === 'class-files') {
      // These tabs handle submission in their own handlers
      return;
    } else {
      if (!file) return;
      if (!userId) { alert('Please log in to create a set.'); return; }
      if (preview.length === 0) { alert('No parsed cards found. Please use CSV or switch to AI Generate.'); return; }

      setLoading(true);
      try {
        const response = await fetch(`/api/student_page/flashcard?userId=${userId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: deckTitle || (file?.name?.replace(/\.[^/.]+$/, "")) || 'Uploaded Flashcards',
            cards: cards,
            difficulty: 'medium',
            tags: category ? [category] : [],
            accessType: isPublic ? 'public' : 'private'
          })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.message || 'Failed to create flashcard set');
        }

        if (isPublic) {
          router.push('/student_page/public_library');
        } else {
          router.push('/student_page/private_library');
        }
      } catch (error) {
        console.error('Failed to upload deck:', error);
        alert('Failed to create flashcard set from file.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center mb-4">
          <button
            onClick={() => router.back()}
            className="mr-4 p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Create Flashcard Set</h1>
        </div>
        <p className="text-slate-600 dark:text-slate-400">Import from file or generate with AI</p>
      </div>

      {/* Tab Selection */}
      <div className="mb-8">
        <div className="flex space-x-1 bg-slate-200 dark:bg-slate-700 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${activeTab === 'upload'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
          >
            📁 Upload File
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${activeTab === 'ai'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
          >
            🤖 AI Generate
          </button>
          <button
            onClick={() => setActiveTab('zapier-file')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${activeTab === 'zapier-file'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
          >
            ⚡ AI File Upload
          </button>
          <button
            onClick={() => setActiveTab('class-files')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${activeTab === 'class-files'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
          >
            🎓 Class Files
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* File Upload Tab */}
        {activeTab === 'upload' && (
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-6">Upload File</h2>

            {/* Upload analysis type */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Output Type:</label>
              <select
                value={uploadAnalysisType}
                onChange={(e) => setUploadAnalysisType(e.target.value as 'flashcards' | 'summary' | 'quiz')}
                className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="flashcards">Generate Flashcards</option>
                <option value="summary">Create Summary</option>
                <option value="quiz">Generate Quiz</option>
              </select>
            </div>

            <div className="mb-6">
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept=".csv,.txt,.pdf,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                  disabled={parsingLoading} // Disable during parsing
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <svg className="w-12 h-12 text-slate-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {parsingLoading ? 'Parsing file...' : file ? file.name : 'Choose a file to upload'}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Supports CSV, TXT, PDF, and DOCX files. For PDFs or DOCX, use AI Generate for advanced analysis.
                  </p>
                </label>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">File Format Requirements:</h4>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>• CSV: Two columns (Term, Definition)</li>
                <li>• TXT: Each line should be &quot;Term,Definition&quot;</li>
                <li>• PDF/DOCX: Text-based files (scanned images may not parse well)</li>
              </ul>
            </div>
          </div>
        )}

        {/* AI Analysis Tab */}
        {activeTab === 'ai' && (
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-6">AI Content Analyzer</h2>

            {/* Analysis Type Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Analysis Type:</label>
              <select
                value={analysisType}
                onChange={(e) => setAnalysisType(e.target.value)}
                className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="flashcards">Generate Flashcards</option>
                <option value="summary">Create Summary</option>
                <option value="quiz">Generate Quiz</option>
              </select>
            </div>

            {/* Text Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Paste Text:</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste your content here (notes, articles, study materials)..."
                rows={8}
                className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-vertical"
              />
            </div>

            {/* Flashcard Count Selection for AI Generate */}
            {analysisType === 'flashcards' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Number of Flashcards to Generate:
                </label>
                <select
                  value={aiCardCount}
                  onChange={(e) => setAiCardCount(parseInt(e.target.value))}
                  className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value={10}>10 flashcards</option>
                  <option value={15}>15 flashcards</option>
                  <option value={20}>20 flashcards</option>
                  <option value={25}>25 flashcards</option>
                  <option value={30}>30 flashcards</option>
                  <option value={40}>40 flashcards</option>
                  <option value={50}>50 flashcards</option>
                </select>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  More flashcards provide better coverage but take longer to generate
                </p>
              </div>
            )}

            {/* Removed file upload from AI tab to keep it text-only */}

            {/* Analyze Button */}
            <button
              type="button"
              onClick={handleAIAnalyze}
              disabled={aiLoading || (!text && !file)}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {aiLoading ? (
                <>
                  <svg className="animate-spin inline w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Analyzing with AI...
                </>
              ) : (
                '✨ Analyze Content'
              )}
            </button>

            {/* AI Results */}
            {aiResult && (
              <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-3">✅ Analysis Complete!</h3>

                {analysisType === 'flashcards' && aiResult.cards && (
                  <div>
                    <p className="text-sm text-green-800 dark:text-green-200 mb-2">
                      Generated {aiResult.cards.length} flashcards from your content
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300">
                      Preview will show below. You can edit the title and settings before creating.
                    </p>
                  </div>
                )}

                {analysisType === 'summary' && (
                  <div className="max-h-40 overflow-y-auto">
                    <h4 className="font-medium mb-2">Summary:</h4>
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                      {aiResult.summary || aiResult.content}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Zapier AI File Upload Tab */}
        {activeTab === 'zapier-file' && (
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-6">AI-Powered File Upload</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              Upload files and let AI generate flashcards using advanced processing via Zapier
            </p>

            {/* File Upload */}
            <div className="mb-6">
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-8 text-center">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.csv,.ppt,.pptx"
                  onChange={(e) => setZapierFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="zapier-file-upload"
                  disabled={zapierLoading}
                />
                <label htmlFor="zapier-file-upload" className="cursor-pointer">
                  <svg className="w-12 h-12 text-slate-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">
                    {zapierFile ? zapierFile.name : 'Choose a file for AI processing'}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    PDF, Word, PowerPoint, Text files (max 10MB) - Processed with advanced AI
                  </p>
                </label>
              </div>
            </div>

            {zapierFile && (
              <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Selected:</strong> {zapierFile.name} ({(zapierFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                  This file will be processed with AI to extract key concepts and generate high-quality flashcards
                </p>
              </div>
            )}

            {/* Flashcard Count Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Number of Flashcards to Generate:
              </label>
              <select
                value={zapierCardCount}
                onChange={(e) => setZapierCardCount(parseInt(e.target.value))}
                className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value={10}>10 flashcards</option>
                <option value={15}>15 flashcards</option>
                <option value={20}>20 flashcards</option>
                <option value={25}>25 flashcards</option>
                <option value={30}>30 flashcards</option>
                <option value={40}>40 flashcards</option>
                <option value={50}>50 flashcards</option>
              </select>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                More flashcards may take longer to generate but provide more comprehensive coverage
              </p>
            </div>

            <button
              type="button"
              onClick={handleZapierFileGeneration}
              disabled={zapierLoading || !zapierFile}
              className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {zapierLoading ? (
                <>
                  <svg className="animate-spin inline w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing file and generating {zapierCardCount} flashcards...
                </>
              ) : (
                `⚡ Generate ${zapierCardCount} Flashcards with AI`
              )}
            </button>

            {zapierLoading && (
              <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="flex items-center space-x-3">
                  <svg className="animate-spin w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Processing your file...
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-300">
                      Extracting content → Analyzing with AI → Generating {zapierCardCount} flashcards
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Class Files Tab */}
        {activeTab === 'class-files' && (
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-6">Generate from Class Files</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              Select files uploaded by your teachers and generate flashcards with AI
            </p>

            {/* Class Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Select Class *
              </label>
              <select
                value={selectedClass}
                onChange={(e) => {
                  setSelectedClass(e.target.value);
                  setSelectedResource('');
                }}
                className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                disabled={classFilesLoading}
              >
                <option value="">Choose a class...</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} - {cls.subject} ({cls.resourceCount} files)
                  </option>
                ))}
              </select>
            </div>

            {/* Resource Selection */}
            {selectedClass && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Select File *
                </label>
                <select
                  value={selectedResource}
                  onChange={(e) => setSelectedResource(e.target.value)}
                  className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  disabled={classFilesLoading}
                >
                  <option value="">Choose a file...</option>
                  {classes.find(c => c.id === selectedClass)?.resources
                    .filter((resource: any) => resource.hasUrl)
                    .map((resource: any) => (
                      <option key={resource.id} value={resource.id}>
                        {resource.name} ({resource.type})
                        {resource.sizeBytes && ` - ${(resource.sizeBytes / 1024 / 1024).toFixed(2)} MB`}
                      </option>
                    ))}
                </select>
                {classes.find(c => c.id === selectedClass)?.resources.filter((r: any) => r.hasUrl).length === 0 && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">No accessible files in this class</p>
                )}
              </div>
            )}

            {selectedClass && selectedResource && (
              <div className="mb-6 bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-200">
                  <strong>Ready to process:</strong> Selected file from {classes.find(c => c.id === selectedClass)?.name}
                </p>
                <p className="text-xs text-green-600 dark:text-green-300 mt-1">
                  AI will analyze the file content and generate relevant flashcards for studying
                </p>
              </div>
            )}

            {/* Flashcard Count Selection for Class Files */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Number of Flashcards to Generate:
              </label>
              <select
                value={classFileCardCount}
                onChange={(e) => setClassFileCardCount(parseInt(e.target.value))}
                className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value={10}>10 flashcards</option>
                <option value={15}>15 flashcards</option>
                <option value={20}>20 flashcards</option>
                <option value={25}>25 flashcards</option>
                <option value={30}>30 flashcards</option>
                <option value={40}>40 flashcards</option>
                <option value={50}>50 flashcards</option>
              </select>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                More flashcards provide comprehensive coverage of the class material
              </p>
            </div>

            <button
              type="button"
              onClick={handleClassFileGeneration}
              disabled={classFilesLoading || !selectedClass || !selectedResource}
              className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {classFilesLoading ? (
                <>
                  <svg className="animate-spin inline w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating {classFileCardCount} flashcards...
                </>
              ) : (
                `🎓 Generate ${classFileCardCount} Flashcards from Class File`
              )}
            </button>

            {classFilesLoading && (
              <div className="mt-4 bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
                <div className="flex items-center space-x-3">
                  <svg className="animate-spin w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-indigo-800 dark:text-indigo-200">
                      Processing class file...
                    </p>
                    <p className="text-xs text-indigo-600 dark:text-indigo-300">
                      Extracting content from class materials and generating {classFileCardCount} study flashcards
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Enhanced AI Text Tab */}
        {activeTab === 'ai' && (
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-6">AI Content Analyzer</h2>

            {/* Toggle between local AI and Zapier AI */}
            <div className="mb-6">
              <div className="flex space-x-4 mb-4">
                <button
                  onClick={() => setAnalysisType('local')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${analysisType === 'local'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                    }`}
                >
                  🔧 Local Processing
                </button>
                <button
                  onClick={() => setAnalysisType('zapier')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${analysisType === 'zapier'
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                    }`}
                >
                  ⚡ Zapier AI
                </button>
              </div>
            </div>

            {/* Text Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {analysisType === 'zapier' ? 'Text for Zapier AI Processing:' : 'Paste Text:'}
              </label>
              <textarea
                value={analysisType === 'zapier' ? zapierText : text}
                onChange={(e) => analysisType === 'zapier' ? setZapierText(e.target.value) : setText(e.target.value)}
                placeholder={analysisType === 'zapier'
                  ? "Paste your content here for advanced AI processing via Zapier..."
                  : "Paste your content here (notes, articles, study materials)..."}
                rows={8}
                className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-vertical"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {analysisType === 'zapier' ? zapierText.length : text.length} characters
                {analysisType === 'zapier' && ' (processed with advanced AI via Zapier)'}
              </p>
            </div>

            {/* Analysis Type Selection for Local Processing */}
            {analysisType !== 'zapier' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Analysis Type:</label>
                <select
                  value={analysisType === 'zapier' ? 'flashcards' : analysisType}
                  onChange={(e) => setAnalysisType(e.target.value)}
                  className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="flashcards">Generate Flashcards</option>
                  <option value="summary">Create Summary</option>
                  <option value="quiz">Generate Quiz</option>
                </select>
              </div>
            )}

            {/* Analyze Button */}
            <button
              type="button"
              onClick={analysisType === 'zapier' ? handleZapierTextGeneration : handleAIAnalyze}
              disabled={(analysisType === 'zapier' ? zapierLoading : aiLoading) ||
                (analysisType === 'zapier' ? !zapierText : !text)}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-white ${analysisType === 'zapier'
                ? 'bg-purple-600 hover:bg-purple-700'
                : 'bg-blue-600 hover:bg-blue-700'
                }`}
            >
              {(analysisType === 'zapier' ? zapierLoading : aiLoading) ? (
                <>
                  <svg className="animate-spin inline w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {analysisType === 'zapier' ? `Generating ${aiCardCount} flashcards...` : 'Analyzing with AI...'}
                </>
              ) : (
                analysisType === 'zapier' ? `⚡ Generate ${aiCardCount} Flashcards` : '✨ Analyze Content'
              )}
            </button>

            {/* AI Results */}
            {aiResult && analysisType !== 'zapier' && (
              <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-3">✅ Analysis Complete!</h3>

                {analysisType === 'flashcards' && aiResult.cards && (
                  <div>
                    <p className="text-sm text-green-800 dark:text-green-200 mb-2">
                      Generated {aiResult.cards.length} flashcards from your content
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300">
                      Preview will show below. You can edit the title and settings before creating.
                    </p>
                  </div>
                )}

                {analysisType === 'summary' && (
                  <div className="max-h-40 overflow-y-auto">
                    <h4 className="font-medium mb-2">Summary:</h4>
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                      {aiResult.summary || aiResult.content}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Set Information - ensure it appears when preview exists too */}
        {((activeTab === 'upload' && file) || (activeTab === 'ai' && (aiResult || preview.length > 0))) && (
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-6">Set Information</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={deckTitle}
                  onChange={(e) => setDeckTitle(e.target.value)}
                  className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Enter a title for your flashcard set"
                  required
                />
              </div>

              {activeTab === 'upload' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={deckDescription}
                    onChange={(e) => setDeckDescription(e.target.value)}
                    className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Add a description (optional)"
                    rows={3}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">Select category</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Science">Science</option>
                    <option value="History">History</option>
                    <option value="Language">Language</option>
                    <option value="Computer Science">Computer Science</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="flex items-center justify-center">
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={isPublic}
                      onChange={(e) => setIsPublic(e.target.checked)}
                      className="w-5 h-5 text-green-500 border-slate-300 dark:border-slate-600 rounded focus:ring-green-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Make this set public
                      </span>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Others can find and study your set
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Editable Cards */}
        {cards.length > 0 && (
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-6">
              Cards ({cards.length})
            </h2>
            <div className="space-y-4">
              {cards.map((card, index) => (
                <div key={index} className="border border-slate-200 dark:border-slate-600 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Question</label>
                      <input
                        type="text"
                        value={card.question}
                        onChange={(e) => handleCardChange(index, 'question', e.target.value)}
                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Answer</label>
                      <input
                        type="text"
                        value={card.answer}
                        onChange={(e) => handleCardChange(index, 'answer', e.target.value)}
                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end mt-3">
                    <button
                      type="button"
                      onClick={() => handleDeleteCard(index)}
                      className="px-3 py-1 text-sm text-white bg-red-600 hover:bg-red-700 rounded"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={handleAddCard}
                className="px-4 py-2 text-sm text-white bg-slate-700 hover:bg-slate-800 rounded"
              >
                + Add Card
              </button>
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end space-x-4 pb-8">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !deckTitle.trim() ||
              (activeTab === 'upload' && (!file || cards.length === 0)) ||
              (activeTab === 'ai' && cards.length === 0) ||
              (activeTab === 'zapier-file') ||
              (activeTab === 'class-files')}
            className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            style={{ display: (activeTab === 'zapier-file' || activeTab === 'class-files') ? 'none' : 'flex' }}
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Creating...</span>
              </>
            ) : (
              <span>
                {activeTab === 'ai' ? '✨ Create AI' : '📁 Create'} {isPublic ? 'Public' : 'Private'} Set
              </span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}