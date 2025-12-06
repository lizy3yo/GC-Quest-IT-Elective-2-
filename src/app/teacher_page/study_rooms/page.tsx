"use client";

import "../dashboard/styles.css";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Users, Search, Lock, Unlock, User, Eye, BookOpen } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";

interface StudyRoomMember {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
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
  };
  members: string[];
  memberDetails: StudyRoomMember[];
  maxMembers: number;
  createdAt: string;
  activeMembers: number;
}

export default function TeacherStudyRoomsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { showError } = useToast();
  const [rooms, setRooms] = useState<StudyRoom[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSubject, setFilterSubject] = useState("all");
  const [teacherId, setTeacherId] = useState<string | null>(null);

  // Get teacher ID
  useEffect(() => {
    const getTeacherId = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (token) {
          const response = await fetch('/api/v1/users/current', {
            credentials: 'include',
            headers: { 
              Authorization: `Bearer ${token}`, 
              'Content-Type': 'application/json' 
            },
          });
          if (response.ok) {
            const data = await response.json();
            setTeacherId(data?.user?._id);
          }
        }
      } catch (error) {
        console.error('Error getting teacher ID:', error);
      }
    };
    getTeacherId();
  }, []);

  const fetchRooms = useCallback(async () => {
    if (!teacherId) return;
    
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/teacher_page/study-rooms?teacherId=${teacherId}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include'
      });
      
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms || []);
        setSubjects(data.subjects || []);
      } else {
        showError("Failed to load study rooms. Please try again.");
      }
    } catch (error) {
      console.error("Error fetching study rooms:", error);
      showError("Failed to load study rooms. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [teacherId, showError]);

  useEffect(() => {
    if (teacherId) {
      fetchRooms();
    }
  }, [teacherId, fetchRooms]);

  const filteredRooms = rooms.filter((room) => {
    const matchesSearch = room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.createdBy?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.createdBy?.lastName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubject = filterSubject === "all" || room.subject === filterSubject;
    return matchesSearch && matchesSubject;
  });

  // Group rooms by subject
  const roomsBySubject = filteredRooms.reduce((acc, room) => {
    const subject = room.subject || 'Uncategorized';
    if (!acc[subject]) {
      acc[subject] = [];
    }
    acc[subject].push(room);
    return acc;
  }, {} as Record<string, StudyRoom[]>);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
              Study Rooms Monitor
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              Monitor student study rooms for your classes
            </p>
          </div>
        </div>

        {/* Loading State */}
        {(status === "loading" || loading) ? (
          <>
            {/* Stats Overview Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border-2 border-slate-200 dark:border-slate-700 p-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
                    <div>
                      <div className="h-7 bg-slate-200 dark:bg-slate-700 rounded w-12 mb-1"></div>
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Search Bar Skeleton */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border-2 border-slate-200 dark:border-slate-700 p-4 mb-6 animate-pulse">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 h-10 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                <div className="h-10 w-40 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
              </div>
            </div>

            {/* Subject Section Skeleton */}
            <div className="space-y-8">
              {[1, 2].map((section) => (
                <div key={section}>
                  <div className="flex items-center gap-3 mb-4 animate-pulse">
                    <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                    <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-32"></div>
                    <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-full w-16"></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map((card) => (
                      <div key={card} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border-2 border-slate-200 dark:border-slate-700 p-5 animate-pulse">
                        <div className="flex items-start justify-between mb-3">
                          <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                          <div className="w-5 h-5 bg-slate-200 dark:bg-slate-700 rounded"></div>
                        </div>
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full mb-2"></div>
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-2/3 mb-4"></div>
                        <div className="space-y-2 mb-4">
                          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-40"></div>
                          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-28"></div>
                          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-36"></div>
                        </div>
                        <div className="border-t border-slate-200 dark:border-slate-700 pt-3 mt-3">
                          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-16 mb-2"></div>
                          <div className="flex gap-1">
                            <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-full w-20"></div>
                            <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-full w-20"></div>
                            <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded-full w-16"></div>
                          </div>
                        </div>
                        <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-lg w-full mt-4"></div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border-2 border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{subjects.length}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Your Subjects</p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border-2 border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                    <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{rooms.length}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Total Study Rooms</p>
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border-2 border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                    <User className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {rooms.reduce((sum, room) => sum + (room.activeMembers || 0), 0)}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Total Students</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Search and Filter Bar */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border-2 border-slate-200 dark:border-slate-700 p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Search by room name, description, or student..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#1C2B1C] focus:border-transparent"
              />
            </div>
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#1C2B1C] focus:border-transparent"
            >
              <option value="all">All Subjects</option>
              {subjects.map(subject => (
                <option key={subject} value={subject}>{subject}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Study Rooms by Subject */}
        {Object.keys(roomsBySubject).length > 0 ? (
          <div className="space-y-8">
            {Object.entries(roomsBySubject).map(([subject, subjectRooms]) => (
              <div key={subject}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-[#2E7D32] rounded-lg flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-white" />
                  </div>
                  <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
                    {subject}
                  </h2>
                  <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm rounded-full">
                    {subjectRooms.length} {subjectRooms.length === 1 ? 'room' : 'rooms'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {subjectRooms.map((room) => (
                    <div
                      key={room._id}
                      className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border-2 border-slate-200 dark:border-slate-700 p-5 hover:shadow-xl hover:border-[#2E7D32]/30 transition-all duration-300"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 line-clamp-1 flex-1">
                          {room.name}
                        </h3>
                        {room.isPrivate ? (
                          <Lock className="text-slate-500 flex-shrink-0 ml-2" size={18} />
                        ) : (
                          <Unlock className="text-green-500 flex-shrink-0 ml-2" size={18} />
                        )}
                      </div>

                      <p className="text-slate-600 dark:text-slate-400 text-sm mb-4 line-clamp-2">
                        {room.description}
                      </p>

                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <User className="flex-shrink-0" size={14} />
                          <span>Created by: {room.createdBy?.firstName || 'Unknown'} {room.createdBy?.lastName || ''}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                          <Users className="flex-shrink-0" size={14} />
                          <span>{room.activeMembers}/{room.maxMembers} members</span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-500">
                          Created: {formatDate(room.createdAt)}
                        </div>
                      </div>

                      {/* Member Preview */}
                      {room.memberDetails && room.memberDetails.length > 0 && (
                        <div className="border-t border-slate-200 dark:border-slate-700 pt-3 mt-3">
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Members:</p>
                          <div className="flex flex-wrap gap-1">
                            {room.memberDetails.slice(0, 3).map((member) => (
                              <span
                                key={member._id}
                                className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs rounded-full"
                              >
                                {member.firstName} {member.lastName?.charAt(0)}.
                              </span>
                            ))}
                            {room.memberDetails.length > 3 && (
                              <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs rounded-full">
                                +{room.memberDetails.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => router.push(`/teacher_page/study_rooms/${room._id}`)}
                        className="w-full mt-4 py-2 flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium rounded-lg transition-all duration-200"
                      >
                        <Eye size={16} />
                        View Details
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border-2 border-slate-200 dark:border-slate-700">
            <Users className="mx-auto text-slate-300 dark:text-slate-600 mb-4" size={64} />
            <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-2">
              No study rooms found
            </h3>
            <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
              {subjects.length === 0 
                ? "You don't have any classes assigned yet. Study rooms will appear here once students create them for your subjects."
                : "No students have created study rooms for your subjects yet."}
            </p>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}
