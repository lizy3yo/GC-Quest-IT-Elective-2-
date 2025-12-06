"use client";

import "../../dashboard/styles.css";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Users, Lock, Unlock, User, ArrowLeft, Calendar, MessageSquare, FileText, Clock } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";

interface StudyRoomMember {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Message {
  _id: string;
  message: string;
  userId: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  timestamp: string;
  type?: 'message' | 'system';
}

interface Note {
  _id: string;
  title: string;
  content: string;
  userId: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  createdAt: string;
}

interface StudyRoom {
  _id: string;
  name: string;
  description: string;
  subject: string;
  isPrivate: boolean;
  createdBy: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  members: StudyRoomMember[];
  maxMembers: number;
  createdAt: string;
  messages: Message[];
  notes: Note[];
}

export default function TeacherStudyRoomDetailPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId as string;
  const { showError } = useToast();
  
  const [room, setRoom] = useState<StudyRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'members' | 'messages' | 'notes'>('members');

  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch(`/api/teacher_page/study-rooms/${roomId}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          credentials: 'include'
        });
        
        if (res.ok) {
          const data = await res.json();
          setRoom(data.room);
        } else {
          showError("Failed to load study room details.");
          router.push('/teacher_page/study_rooms');
        }
      } catch (error) {
        console.error("Error fetching study room:", error);
        showError("Failed to load study room details.");
      } finally {
        setLoading(false);
      }
    };

    if (roomId) {
      fetchRoom();
    }
  }, [roomId, router, showError]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1C2B1C]"></div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="dashboard-root">
        <div className="dashboard-container">
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-2">
              Study room not found
            </h2>
            <Link
              href="/teacher_page/study_rooms"
              className="text-[#2E7D32] hover:underline"
            >
              Back to Study Rooms
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-root">
      <div className="dashboard-container">
        {/* Back Button */}
        <Link
          href="/teacher_page/study_rooms"
          className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-[#2E7D32] mb-4 transition-colors"
        >
          <ArrowLeft size={20} />
          Back to Study Rooms
        </Link>

        {/* Header */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                  {room.name}
                </h1>
                {room.isPrivate ? (
                  <span className="flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs rounded-full">
                    <Lock size={12} /> Private
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded-full">
                    <Unlock size={12} /> Public
                  </span>
                )}
              </div>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                {room.description}
              </p>
              <div className="flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <User size={14} />
                  Created by: {room.createdBy?.firstName} {room.createdBy?.lastName}
                </span>
                <span className="flex items-center gap-1">
                  <Users size={14} />
                  {room.members?.length || 0}/{room.maxMembers} members
                </span>
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {formatDate(room.createdAt)}
                </span>
              </div>
            </div>
            <div className="px-4 py-2 bg-[#2E7D32]/10 text-[#2E7D32] dark:text-[#04C40A] rounded-lg font-medium">
              {room.subject}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="flex border-b border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab('members')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'members'
                  ? 'text-[#2E7D32] border-b-2 border-[#2E7D32] bg-[#2E7D32]/5'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <Users size={16} />
                Members ({room.members?.length || 0})
              </span>
            </button>
            <button
              onClick={() => setActiveTab('messages')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'messages'
                  ? 'text-[#2E7D32] border-b-2 border-[#2E7D32] bg-[#2E7D32]/5'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <MessageSquare size={16} />
                Messages ({room.messages?.length || 0})
              </span>
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'notes'
                  ? 'text-[#2E7D32] border-b-2 border-[#2E7D32] bg-[#2E7D32]/5'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <FileText size={16} />
                Notes ({room.notes?.length || 0})
              </span>
            </button>
          </div>

          <div className="p-6">
            {/* Members Tab */}
            {activeTab === 'members' && (
              <div>
                {room.members && room.members.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {room.members.map((member) => (
                      <div
                        key={member._id}
                        className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl"
                      >
                        <div className="w-10 h-10 bg-[#2E7D32]/10 rounded-full flex items-center justify-center">
                          <span className="text-[#2E7D32] font-semibold">
                            {member.firstName?.charAt(0)}{member.lastName?.charAt(0)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-800 dark:text-slate-100 truncate">
                            {member.firstName} {member.lastName}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                            {member.email}
                          </p>
                        </div>
                        {member._id === room.createdBy?._id && (
                          <span className="px-2 py-1 bg-[#2E7D32]/10 text-[#2E7D32] text-xs rounded-full">
                            Creator
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    No members in this room yet.
                  </div>
                )}
              </div>
            )}

            {/* Messages Tab */}
            {activeTab === 'messages' && (
              <div>
                {room.messages && room.messages.length > 0 ? (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {room.messages.map((message) => (
                      <div
                        key={message._id}
                        className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium text-slate-800 dark:text-slate-100">
                            {message.userId?.firstName} {message.userId?.lastName}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Clock size={12} />
                            {formatDate(message.timestamp)}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300">
                          {message.message}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    No messages in this room yet.
                  </div>
                )}
              </div>
            )}

            {/* Notes Tab */}
            {activeTab === 'notes' && (
              <div>
                {room.notes && room.notes.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {room.notes.map((note) => (
                      <div
                        key={note._id}
                        className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl"
                      >
                        <h4 className="font-medium text-slate-800 dark:text-slate-100 mb-2">
                          {note.title}
                        </h4>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-3 line-clamp-3">
                          {note.content}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span>By {note.userId?.firstName} {note.userId?.lastName}</span>
                          <span>•</span>
                          <span>{formatDate(note.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    No notes in this room yet.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
