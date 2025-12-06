'use client';

import React, { useState, useEffect } from 'react';

interface FlashcardGeneratorProps {
  userId: string;
}

interface ClassFile {
  id: string;
  name: string;
  type: string;
  description?: string;
  sizeBytes?: number;
  uploadedAt: string;
  hasUrl: boolean;
}

interface ClassInfo {
  id: string;
  name: string;
  subject: string;
  resourceCount: number;
  resources: ClassFile[];
}

export default function FlashcardGenerator({ userId }: FlashcardGeneratorProps) {
  const [activeTab, setActiveTab] = useState<'text' | 'file' | 'class'>('text');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Text input state
  const [textContent, setTextContent] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const [textDifficulty, setTextDifficulty] = useState('medium');
  const [textSubject, setTextSubject] = useState('');

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileTitle, setFileTitle] = useState('');
  const [fileDifficulty, setFileDifficulty] = useState('medium');
  const [fileSubject, setFileSubject] = useState('');

  // Class file state
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedResource, setSelectedResource] = useState<string>('');
  const [classTitle, setClassTitle] = useState('');
  const [classDifficulty, setClassDifficulty] = useState('medium');

  // Load classes on component mount
  useEffect(() => {
    if (activeTab === 'class') {
      loadClasses();
    }
  }, [activeTab]);

  const loadClasses = async () => {
    try {
      const response = await fetch(`/api/student_page/flashcard/generate-from-class-file?userId=${userId}`);
      const data = await response.json();
      
      if (data.success) {
        setClasses(data.classes);
      } else {
        setError(data.error);
      }
    } catch (error) {
      setError('Failed to load classes');
    }
  };

  const handleTextGeneration = async () => {
    if (!textContent.trim()) {
      setError('Please enter some text content');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/student_page/flashcard/generate-from-text?userId=${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: textContent,
          title: textTitle || 'Text-based Flashcards',
          difficulty: textDifficulty,
          subject: textSubject,
          aiProvider: 'gemini'
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setResult(data);
        setTextContent('');
        setTextTitle('');
      } else {
        setError(data.error);
      }
    } catch (error) {
      setError('Failed to generate flashcards from text');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileGeneration = async () => {
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', fileTitle || selectedFile.name);
      formData.append('difficulty', fileDifficulty);
      formData.append('subject', fileSubject);
      formData.append('aiProvider', 'gemini');

      const response = await fetch(`/api/student_page/flashcard/generate-from-file?userId=${userId}`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      
      if (data.success) {
        setResult(data);
        setSelectedFile(null);
        setFileTitle('');
      } else {
        setError(data.error);
      }
    } catch (error) {
      setError('Failed to generate flashcards from file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClassFileGeneration = async () => {
    if (!selectedClass || !selectedResource) {
      setError('Please select a class and resource');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/student_page/flashcard/generate-from-class-file?userId=${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          classId: selectedClass,
          resourceId: selectedResource,
          title: classTitle,
          difficulty: classDifficulty,
          aiProvider: 'gemini'
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setResult(data);
        setSelectedClass('');
        setSelectedResource('');
        setClassTitle('');
      } else {
        setError(data.error);
      }
    } catch (error) {
      setError('Failed to generate flashcards from class file');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedClassData = classes.find(c => c.id === selectedClass);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg">
        {/* Header */}
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">AI Flashcard Generator</h2>
          <p className="text-gray-600 mt-2">Generate flashcards using AI from text, files, or class materials</p>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('text')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'text'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              📝 Text Input
            </button>
            <button
              onClick={() => setActiveTab('file')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'file'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              📁 File Upload
            </button>
            <button
              onClick={() => setActiveTab('class')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'class'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              🎓 Class Files
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Text Input Tab */}
          {activeTab === 'text' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Text Content *
                </label>
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Paste or type your study content here..."
                  className="w-full h-40 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                />
                <p className="text-sm text-gray-500 mt-1">
                  {textContent.length} characters (minimum 50 required)
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title (Optional)
                  </label>
                  <input
                    type="text"
                    value={textTitle}
                    onChange={(e) => setTextTitle(e.target.value)}
                    placeholder="Flashcard set title"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subject (Optional)
                  </label>
                  <input
                    type="text"
                    value={textSubject}
                    onChange={(e) => setTextSubject(e.target.value)}
                    placeholder="e.g., Biology, History"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Difficulty
                  </label>
                  <select
                    value={textDifficulty}
                    onChange={(e) => setTextDifficulty(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleTextGeneration}
                disabled={isLoading || textContent.length < 50}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? '🔄 Generating Flashcards...' : '✨ Generate from Text'}
              </button>
            </div>
          )}

          {/* File Upload Tab */}
          {activeTab === 'file' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select File *
                </label>
                <input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  accept=".pdf,.doc,.docx,.txt,.csv,.ppt,.pptx"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Supported: PDF, Word, PowerPoint, Text files (max 10MB)
                </p>
              </div>

              {selectedFile && (
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-sm">
                    <strong>Selected:</strong> {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title (Optional)
                  </label>
                  <input
                    type="text"
                    value={fileTitle}
                    onChange={(e) => setFileTitle(e.target.value)}
                    placeholder="Flashcard set title"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subject (Optional)
                  </label>
                  <input
                    type="text"
                    value={fileSubject}
                    onChange={(e) => setFileSubject(e.target.value)}
                    placeholder="e.g., Biology, History"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Difficulty
                  </label>
                  <select
                    value={fileDifficulty}
                    onChange={(e) => setFileDifficulty(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleFileGeneration}
                disabled={isLoading || !selectedFile}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? '🔄 Processing File...' : '📁 Generate from File'}
              </button>
            </div>
          )}

          {/* Class Files Tab */}
          {activeTab === 'class' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Class *
                </label>
                <select
                  value={selectedClass}
                  onChange={(e) => {
                    setSelectedClass(e.target.value);
                    setSelectedResource('');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isLoading}
                >
                  <option value="">Choose a class...</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} - {cls.subject} ({cls.resourceCount} files)
                    </option>
                  ))}
                </select>
              </div>

              {selectedClassData && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select File *
                  </label>
                  <select
                    value={selectedResource}
                    onChange={(e) => setSelectedResource(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading}
                  >
                    <option value="">Choose a file...</option>
                    {selectedClassData.resources
                      .filter(resource => resource.hasUrl)
                      .map((resource) => (
                        <option key={resource.id} value={resource.id}>
                          {resource.name} ({resource.type})
                          {resource.sizeBytes && ` - ${(resource.sizeBytes / 1024 / 1024).toFixed(2)} MB`}
                        </option>
                      ))}
                  </select>
                  {selectedClassData.resources.filter(r => r.hasUrl).length === 0 && (
                    <p className="text-sm text-gray-500 mt-1">No accessible files in this class</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title (Optional)
                  </label>
                  <input
                    type="text"
                    value={classTitle}
                    onChange={(e) => setClassTitle(e.target.value)}
                    placeholder="Flashcard set title"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Difficulty
                  </label>
                  <select
                    value={classDifficulty}
                    onChange={(e) => setClassDifficulty(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleClassFileGeneration}
                disabled={isLoading || !selectedClass || !selectedResource}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? '🔄 Processing Class File...' : '🎓 Generate from Class File'}
              </button>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800">❌ {error}</p>
            </div>
          )}

          {/* Success Display */}
          {result && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
              <h3 className="text-green-800 font-semibold">✅ Success!</h3>
              <p className="text-green-700 mt-1">{result.message}</p>
              <div className="mt-2 text-sm text-green-600">
                <p>📚 Title: {result.flashcard.title}</p>
                <p>🃏 Cards Generated: {result.flashcard.cardsGenerated}</p>
                <p>⏱️ Processing Time: {result.flashcard.processingTime}ms</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}