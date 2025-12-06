"use client";

import React, { useState, useEffect } from 'react';
import ConfirmModal from '@/components/molecules/ConfirmModal';

interface ChatSession {
  _id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatSessionsProps {
  onClose: () => void;
  onLoadSession: (sessionId: string) => void;
}

export default function ChatSessions({ onClose, onLoadSession }: ChatSessionsProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch('/api/chatbot/sessions', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSession = (sessionId: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessionToDelete({ id: sessionId, title });
    setShowDeleteConfirm(true);
  };

  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch(`/api/chatbot/sessions/${sessionToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setSessions(sessions.filter(s => s._id !== sessionToDelete.id));
      }
    } catch (error) {
      console.error('Error deleting session:', error);
    } finally {
      setSessionToDelete(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[500px] max-w-[90vw] max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Saved Chat Sessions</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Loading sessions...
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              <p>No saved sessions yet</p>
              <p className="text-sm mt-2">Save your chats to access them later</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <div
                  key={session._id}
                  onClick={() => onLoadSession(session._id)}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white">{session.title}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {new Date(session.updatedAt).toLocaleDateString()} at {new Date(session.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteSession(session._id, session.title, e)}
                      className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-opacity"
                      title="Delete session"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setSessionToDelete(null);
        }}
        onConfirm={confirmDeleteSession}
        title="Delete Session"
        message={`Are you sure you want to delete "${sessionToDelete?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        isDangerous={true}
      />
    </div>
  );
}
