"use client";

import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '@/lib/ai/chatbot-service';
import ChatSessions from './ChatSessions';
import ConfirmModal from '@/components/molecules/ConfirmModal';

interface ChatbotProps {
  isAuthenticated?: boolean;
  className?: string;
}

export default function Chatbot({ isAuthenticated = false, className = '' }: ChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [uploadedFile, setUploadedFile] = useState<{ content: string; fileName: string } | null>(null);
  const [generationState, setGenerationState] = useState<{
    type: 'flashcard' | 'summary' | 'practice_test' | null;
    params: Record<string, any>;
  }>({ type: null, params: {} });
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [showGenerationForm, setShowGenerationForm] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [saveTitle, setSaveTitle] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showMenu) {
        const target = event.target as HTMLElement;
        if (!target.closest('.menu-container')) {
          setShowMenu(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  useEffect(() => {
    // Load initial suggestions - DISABLED to save API quota
    // Suggestions are now hardcoded below
    if (isOpen && messages.length === 0 && suggestions.length === 0) {
      // Set default suggestions without API call
      if (isAuthenticated) {
        setSuggestions([
          "How do I create practice quiz?",
          "How do I create flashcards?",
          "How do I generate a summary?",
          "What are the quiz modes available?",
          "How do I track student progress?"
        ]);
      } else {
        setSuggestions([
          "What features does GC Quest offer?",
          "How do live quiz presentations work?",
          "What is GC Quest?",
          "How do I get started?"
        ]);
      }
    }
  }, [isOpen, isAuthenticated]);

  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || inputMessage.trim();
    if (!textToSend || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: textToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          // Include auth token if available
          ...(typeof window !== 'undefined' && localStorage.getItem('accessToken') 
            ? { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
            : {})
        },
        body: JSON.stringify({
          message: textToSend,
          conversationHistory: messages,
          uploadedContent: null, // Don't send uploaded content for regular chat
          uploadedFileName: null
        })
      });

      if (!response.ok) {
        const responseText = await response.text();
        
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch {
          errorData = { error: 'Failed to parse error response', details: responseText };
        }
        
        throw new Error(errorData.details || errorData.error || 'Failed to get response');
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      if (data.suggestions) {
        setSuggestions(data.suggestions);
      }

    } catch (error) {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Please try again.'}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    const allowedTypes = [
      'text/plain',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];
    if (!allowedTypes.includes(file.type)) {
      alert('Please upload a TXT, PDF, DOC, or DOCX file');
      return;
    }

    // Check file size (max 10MB to match regular upload)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    try {
      setIsLoading(true);
      let textContent = '';

      if (file.type === 'text/plain') {
        // Plain text files
        textContent = await file.text();
      } else if (file.type === 'application/pdf') {
        // PDF files - need to parse
        try {
          // We'll send the file to the server for processing
          const formData = new FormData();
          formData.append('file', file);
          formData.append('action', 'extract');

          const response = await fetch('/api/chatbot/extract-file', {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            throw new Error('Failed to extract PDF content');
          }

          const data = await response.json();
          textContent = data.content;
        } catch (error) {
          alert('Failed to extract text from PDF. Please try a different file.');
          setIsLoading(false);
          return;
        }
      } else if (file.type.includes('word') || file.type.includes('document')) {
        // Word documents - need to parse
        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('action', 'extract');

          const response = await fetch('/api/chatbot/extract-file', {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            throw new Error('Failed to extract Word document content');
          }

          const data = await response.json();
          textContent = data.content;
        } catch (error) {
          alert('Failed to extract text from Word document. Please try a different file.');
          setIsLoading(false);
          return;
        }
      }

      if (!textContent || textContent.trim().length < 100) {
        alert('File content is too short or could not be extracted. Please ensure the file contains readable text.');
        setIsLoading(false);
        return;
      }

      setUploadedFile({
        content: textContent,
        fileName: file.name
      });
      
      setIsLoading(false);
      // Don't send a message, just show the quick action buttons
    } catch (error) {
      console.error('File upload error:', error);
      alert('Failed to read file');
      setIsLoading(false);
    }
  };

  const handlePasteText = () => {
    setShowPasteModal(true);
  };

  const confirmPasteText = () => {
    if (pasteText.trim()) {
      setUploadedFile({
        content: pasteText,
        fileName: 'Pasted Text'
      });
      setShowPasteModal(false);
      setPasteText('');
      
      // Don't send a message, just show the quick action buttons
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  const handleClearChat = () => {
    if (messages.length > 0) {
      setShowClearConfirm(true);
      setShowMenu(false);
    }
  };

  const confirmClearChat = () => {
    setMessages([]);
    setSuggestions([]);
    setUploadedFile(null);
  };

  const handleSaveSession = () => {
    if (messages.length === 0) {
      return;
    }

    if (!isAuthenticated) {
      return;
    }

    setShowSaveDialog(true);
    setShowMenu(false);
  };

  const confirmSaveSession = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        return;
      }

      const title = saveTitle.trim() || `Chat ${new Date().toLocaleDateString()}`;

      const response = await fetch('/api/chatbot/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          messages
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save session');
      }

      setShowSaveDialog(false);
      setSaveTitle('');
      
      // Show success message in chat
      const successMessage: ChatMessage = {
        role: 'assistant',
        content: '✅ Chat session saved successfully!',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, successMessage]);
    } catch (error) {
      console.error('Error saving session:', error);
      
      // Show error message in chat
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: '❌ Failed to save chat session. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleLoadSession = async (sessionId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch(`/api/chatbot/sessions/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load session');
      }

      const data = await response.json();
      setMessages(data.session.messages);
      setShowSessions(false);
      
      // Show success message
      const successMessage: ChatMessage = {
        role: 'assistant',
        content: '✅ Chat session loaded successfully!',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, successMessage]);
    } catch (error) {
      console.error('Error loading session:', error);
      
      // Show error message
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: '❌ Failed to load chat session. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  return (
    <>
      {/* Chatbot Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#1C2B1C] text-white rounded-full shadow-lg hover:shadow-xl hover:brightness-110 transition-all duration-200 flex items-center justify-center ${className}`}
        aria-label="Toggle chatbot"
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>

      {/* Chatbot Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[420px] h-[600px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col border border-gray-200 dark:border-gray-700">
          {/* Header */}
          <div className="bg-[#1C2B1C] text-white p-4 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold">GC Quest AI</h3>
                <p className="text-xs text-white/80">Your learning assistant</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAuthenticated && (
                <div className="relative menu-container">
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="hover:bg-white/20 rounded-lg p-1 transition-colors"
                    title="Chat options"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                  {showMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                      <button
                        onClick={() => {
                          setShowSessions(true);
                          setShowMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-t-lg flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        View Sessions
                      </button>
                      <button
                        onClick={handleSaveSession}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        Save Session
                      </button>
                      <button
                        onClick={handleClearChat}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-b-lg flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Clear Chat
                      </button>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-white/20 rounded-lg p-1 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
                <svg className="w-16 h-16 mx-auto mb-4 text-[#1C2B1C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <p className="text-sm">Hi! I'm your GC Quest AI assistant.</p>
                <p className="text-xs mt-2">Ask me anything about {isAuthenticated ? 'creating quizzes, flashcards, or how to use GC Quest' : 'GC Quest and how it can transform your learning'}!</p>
              </div>
            )}

            {messages.map((msg, idx) => {
              // Check if this is a library link message
              const isLibraryLink = msg.content.startsWith('[VIEW_LIBRARY:');
              const libraryUrl = isLibraryLink ? msg.content.match(/\[VIEW_LIBRARY:(.*?)\]/)?.[1] : null;

              if (isLibraryLink && libraryUrl) {
                return (
                  <div key={idx} className="flex justify-start">
                    <a
                      href={libraryUrl}
                      className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg hover:from-teal-600 hover:to-cyan-600 transition-all font-medium text-sm no-underline inline-flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      View in Library
                    </a>
                  </div>
                );
              }

              return (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <p className="text-xs opacity-70 mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl px-4 py-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && messages.length === 0 && (
            <div className="px-4 pb-2">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Suggested questions:</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="text-xs px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Uploaded File Indicator with Quick Actions */}
          {uploadedFile && !generationState.type && (
            <div className="px-4 pb-2 space-y-2">
              <div className="flex items-center gap-2 text-xs bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 px-3 py-2 rounded-lg">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="flex-1 truncate">{uploadedFile.fileName}</span>
                <button
                  onClick={() => {
                    setUploadedFile(null);
                    setGenerationState({ type: null, params: {} });
                  }}
                  className="hover:bg-teal-100 dark:hover:bg-teal-800 rounded p-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">What would you like to generate?</div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setGenerationState({ type: 'flashcard', params: {} });
                    setShowGenerationForm(true);
                  }}
                  className="text-xs px-3 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg hover:from-teal-600 hover:to-cyan-600 transition-colors font-medium"
                >
                  🃏 Flashcards
                </button>
                <button
                  onClick={() => {
                    setGenerationState({ type: 'summary', params: {} });
                    setShowGenerationForm(true);
                  }}
                  className="text-xs px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-colors font-medium"
                >
                  📝 Summary
                </button>
                <button
                  onClick={() => {
                    setGenerationState({ type: 'practice_test', params: {} });
                    setShowGenerationForm(true);
                  }}
                  className="text-xs px-3 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-colors font-medium"
                >
                  📋 Practice Test
                </button>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".txt,.pdf,.docx"
                className="hidden"
              />
              {isAuthenticated && (
                <>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-shrink-0 p-2 text-gray-500 hover:text-teal-500 dark:text-gray-400 dark:hover:text-teal-400 transition-colors"
                    title="Upload file"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </button>
                  <button
                    onClick={handlePasteText}
                    className="flex-shrink-0 p-2 text-gray-500 hover:text-teal-500 dark:text-gray-400 dark:hover:text-teal-400 transition-colors"
                    title="Paste text"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </button>
                </>
              )}
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                placeholder="Ask me anything..."
                className="flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white text-sm"
                disabled={isLoading}
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputMessage.trim() || isLoading}
                className="flex-shrink-0 p-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg hover:from-teal-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                title="Send message"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Session Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-96 max-w-[90vw]">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Save Chat Session</h3>
            <input
              type="text"
              value={saveTitle}
              onChange={(e) => setSaveTitle(e.target.value)}
              placeholder={`Chat ${new Date().toLocaleDateString()}`}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white mb-4"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowSaveDialog(false);
                  setSaveTitle('');
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSaveSession}
                className="px-4 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg hover:from-teal-600 hover:to-cyan-600 transition-all"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sessions List */}
      {showSessions && (
        <ChatSessions
          onClose={() => setShowSessions(false)}
          onLoadSession={handleLoadSession}
        />
      )}

      {/* Clear Chat Confirmation */}
      <ConfirmModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={confirmClearChat}
        title="Clear Chat"
        message="Are you sure you want to clear this chat? This action cannot be undone."
        confirmText="Clear"
        cancelText="Cancel"
        isDangerous={true}
      />

      {/* Generation Form Modal */}
      {showGenerationForm && generationState.type && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => {
            setShowGenerationForm(false);
            setGenerationState({ type: null, params: {} });
          }}></div>
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {generationState.type === 'flashcard' ? '🃏 Generate Flashcards' : 
                 generationState.type === 'summary' ? '📝 Generate Summary' : 
                 '📋 Generate Practice Test'}
              </h3>
              <button
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1"
                onClick={() => {
                  setShowGenerationForm(false);
                  setGenerationState({ type: null, params: {} });
                }}
                aria-label="Close"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Title - Always shown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Title (Optional)
                </label>
                <input
                  type="text"
                  value={generationState.params.title || ''}
                  onChange={(e) => setGenerationState(prev => ({
                    ...prev,
                    params: { ...prev.params, title: e.target.value }
                  }))}
                  placeholder="Auto-generated if empty"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Flashcard-specific fields */}
              {generationState.type === 'flashcard' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Number of Flashcards to Generate
                  </label>
                  <select
                    value={generationState.params.numCards || 20}
                    onChange={(e) => setGenerationState(prev => ({
                      ...prev,
                      params: { ...prev.params, numCards: parseInt(e.target.value) }
                    }))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value={10}>10 flashcards</option>
                    <option value={15}>15 flashcards</option>
                    <option value={20}>20 flashcards</option>
                    <option value={25}>25 flashcards</option>
                    <option value={30}>30 flashcards</option>
                    <option value={40}>40 flashcards</option>
                    <option value={50}>50 flashcards</option>
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    More flashcards provide better coverage but take longer to generate
                  </p>
                </div>
              )}

              {/* Summary-specific fields */}
              {generationState.type === 'summary' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Summary Type
                    </label>
                    <select
                      value={generationState.params.summaryType || 'outline'}
                      onChange={(e) => setGenerationState(prev => ({
                        ...prev,
                        params: { ...prev.params, summaryType: e.target.value }
                      }))}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="outline">Outline Format</option>
                      <option value="detailed">Detailed Summary</option>
                      <option value="brief">Brief Overview</option>
                      <option value="bullet-points">Bullet Points</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Length
                    </label>
                    <select
                      value={generationState.params.summaryLength || 'medium'}
                      onChange={(e) => setGenerationState(prev => ({
                        ...prev,
                        params: { ...prev.params, summaryLength: e.target.value }
                      }))}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="short">Short</option>
                      <option value="medium">Medium</option>
                      <option value="long">Long</option>
                    </select>
                  </div>
                </>
              )}

              {/* Practice Test-specific fields */}
              {generationState.type === 'practice_test' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Number of Questions
                    </label>
                    <input
                      type="number"
                      value={generationState.params.maxQuestions || 20}
                      onChange={(e) => setGenerationState(prev => ({
                        ...prev,
                        params: { ...prev.params, maxQuestions: parseInt(e.target.value) || 20 }
                      }))}
                      min="5"
                      max="100"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Time Limit (minutes)
                    </label>
                    <input
                      type="number"
                      value={generationState.params.timeLimit || 30}
                      onChange={(e) => setGenerationState(prev => ({
                        ...prev,
                        params: { ...prev.params, timeLimit: parseInt(e.target.value) || 30 }
                      }))}
                      min="5"
                      max="180"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Difficulty
                    </label>
                    <select
                      value={generationState.params.difficulty || 'medium'}
                      onChange={(e) => setGenerationState(prev => ({
                        ...prev,
                        params: { ...prev.params, difficulty: e.target.value }
                      }))}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Question Types
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={generationState.params.includeMultipleChoice !== false}
                        onChange={(e) => setGenerationState(prev => ({
                          ...prev,
                          params: { ...prev.params, includeMultipleChoice: e.target.checked }
                        }))}
                        className="w-4 h-4 text-teal-600 rounded"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Multiple Choice</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={generationState.params.includeWritten !== false}
                        onChange={(e) => setGenerationState(prev => ({
                          ...prev,
                          params: { ...prev.params, includeWritten: e.target.checked }
                        }))}
                        className="w-4 h-4 text-teal-600 rounded"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Written Response</span>
                    </label>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => {
                  setShowGenerationForm(false);
                  setGenerationState({ type: null, params: {} });
                }}
                className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setShowGenerationForm(false);
                  setIsLoading(true);
                  
                  try {
                    const response = await fetch('/api/chatbot', {
                      method: 'POST',
                      headers: { 
                        'Content-Type': 'application/json',
                        ...(typeof window !== 'undefined' && localStorage.getItem('accessToken') 
                          ? { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
                          : {})
                      },
                      body: JSON.stringify({
                        message: `Generate ${generationState.type}`,
                        conversationHistory: messages,
                        uploadedContent: uploadedFile?.content,
                        uploadedFileName: uploadedFile?.fileName,
                        generationParams: generationState
                      })
                    });

                    const data = await response.json();

                    const assistantMessage: ChatMessage = {
                      role: 'assistant',
                      content: data.message || data.error || 'Generation completed',
                      timestamp: new Date()
                    };

                    setMessages(prev => [...prev, assistantMessage]);

                    if (data.generationSuccess) {
                      setUploadedFile(null);
                      setGenerationState({ type: null, params: {} });
                      
                      // Add a clickable link message
                      if (data.libraryUrl) {
                        setTimeout(() => {
                          const linkMessage: ChatMessage = {
                            role: 'assistant',
                            content: `[VIEW_LIBRARY:${data.libraryUrl}]`,
                            timestamp: new Date()
                          };
                          setMessages(prev => [...prev, linkMessage]);
                        }, 500);
                      }
                    }
                  } catch (error) {
                    const errorMessage: ChatMessage = {
                      role: 'assistant',
                      content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Please try again.'}`,
                      timestamp: new Date()
                    };
                    setMessages(prev => [...prev, errorMessage]);
                  } finally {
                    setIsLoading(false);
                  }
                }}
                className="px-6 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg hover:from-teal-600 hover:to-cyan-600 transition-all"
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paste Text Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowPasteModal(false)}></div>
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Paste Your Text</h3>
              <button
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1"
                onClick={() => setShowPasteModal(false)}
                aria-label="Close"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Paste your study material here to generate flashcards, summaries, or practice tests.
            </p>

            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste your text here..."
              className="w-full h-64 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 dark:bg-gray-700 dark:text-white resize-none"
              autoFocus
            />

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 mb-4">
              {pasteText.length} characters (minimum 100 recommended)
            </p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowPasteModal(false);
                  setPasteText('');
                }}
                className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmPasteText}
                disabled={pasteText.trim().length < 50}
                className="px-6 py-2 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-lg hover:from-teal-600 hover:to-cyan-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
