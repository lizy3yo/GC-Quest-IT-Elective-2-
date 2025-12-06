"use client";

import "../dashboard/styles.css";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Users, Plus, Search, Lock, Unlock, User, Mail } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";

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
  maxMembers: number;
  createdAt: string;
  activeMembers?: number;
}

interface PendingInvite {
  roomId: string;
  roomName: string;
  roomDescription: string;
  roomSubject: string;
  invitedBy: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  invitedAt: string;
  memberCount: number;
  maxMembers: number;
}

export default function StudyRoomsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { showSuccess, showError } = useToast();
  const [rooms, setRooms] = useState<StudyRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSubject, setFilterSubject] = useState("all");
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoom, setNewRoom] = useState({
    name: "",
    description: "",
    subject: "",
    isPrivate: false,
    maxMembers: 10,
  });
  // Enrolled subjects for searchable dropdown
  const [enrolledSubjects, setEnrolledSubjects] = useState<string[]>([]);
  // Search state for subject selection
  const [subjectSearch, setSubjectSearch] = useState<string>('');
  const [showSubjectDropdown, setShowSubjectDropdown] = useState<boolean>(false);
  const [selectedSubjectIndex, setSelectedSubjectIndex] = useState<number>(-1);
  const subjectInputRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Check both NextAuth session and manual auth tokens
    const hasManualAuth = () => {
      if (typeof window === "undefined") return false;
      const accessToken = localStorage.getItem("accessToken");
      const refreshToken = localStorage.getItem("refreshToken");
      return !!(accessToken || refreshToken);
    };

    // Only redirect if BOTH session is unauthenticated AND no manual auth tokens
    if (status === "unauthenticated" && !hasManualAuth()) {
      router.push("/auth/login");
    }
  }, [status, router]);

  const fetchEnrolledSubjects = async () => {
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
        const subjects = data.data.classes.map((cls: { subject: string }) => cls.subject);
        const uniqueSubjects = Array.from(new Set(subjects)) as string[];
        setEnrolledSubjects(uniqueSubjects);
      }
    } catch (error) {
      console.error('Error fetching enrolled subjects:', error);
    }
  };

  const fetchRooms = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch("/api/student_page/study-rooms", {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms || []);
      } else {
        showError("Failed to load study rooms. Please try again.");
      }
    } catch (error) {
      console.error("Error fetching study rooms:", error);
      showError("Failed to load study rooms. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const fetchPendingInvites = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch("/api/student_page/study-rooms/invites", {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setPendingInvites(data.invites || []);
      }
    } catch (error) {
      console.error("Error fetching invites:", error);
    }
  };

  const handleAcceptInvite = async (roomId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/student_page/study-rooms/${roomId}/invite/accept`, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      });

      if (res.ok) {
        showSuccess("Invite accepted! Joining room...");
        // Remove from pending invites list
        setPendingInvites(pendingInvites.filter(inv => inv.roomId !== roomId));
        // Navigate to the room
        router.push(`/student_page/study_rooms/${roomId}`);
      } else {
        const errorData = await res.json();
        showError(errorData.error || "Failed to accept invite");
      }
    } catch (error) {
      console.error("Error accepting invite:", error);
      showError("Failed to accept invite. Please try again.");
    }
  };

  const handleDeclineInvite = async (roomId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/student_page/study-rooms/${roomId}/invite/decline`, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      });

      if (res.ok) {
        showSuccess("Invite declined");
        setPendingInvites(pendingInvites.filter(inv => inv.roomId !== roomId));
      } else {
        showError("Failed to decline invite");
      }
    } catch (error) {
      console.error("Error declining invite:", error);
      showError("Failed to decline invite. Please try again.");
    }
  };

  useEffect(() => {
    // Check both NextAuth session and manual auth tokens
    const hasManualAuth = () => {
      if (typeof window === "undefined") return false;
      const accessToken = localStorage.getItem("accessToken");
      const refreshToken = localStorage.getItem("refreshToken");
      return !!(accessToken || refreshToken);
    };

    // Fetch data if authenticated via NextAuth OR manual auth
    if (status === "authenticated" || (status !== "loading" && hasManualAuth())) {
      fetchRooms();
      fetchEnrolledSubjects();
      fetchPendingInvites();
    }
  }, [status, fetchRooms]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch("/api/student_page/study-rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(newRoom),
      });

      if (res.ok) {
        const data = await res.json();
        setRooms([data.room, ...rooms]);
        setShowCreateModal(false);
        setNewRoom({
          name: "",
          description: "",
          subject: "",
          isPrivate: false,
          maxMembers: 10,
        });
        setSubjectSearch('');
        setShowSubjectDropdown(false);
        setSelectedSubjectIndex(-1);
        showSuccess("Study room created successfully!", "Success");
      } else {
        const errorData = await res.json().catch(() => ({}));
        showError(errorData.error || "Failed to create study room. Please try again.");
      }
    } catch (error) {
      console.error("Error creating room:", error);
      showError("Failed to create study room. Please try again.");
    }
  };

  const handleJoinRoom = async (roomId: string, isAlreadyMember: boolean) => {
    // If already a member, just navigate to the room
    if (isAlreadyMember) {
      router.push(`/student_page/study_rooms/${roomId}`);
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/student_page/study-rooms/${roomId}/join`, {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      });

      if (res.ok) {
        showSuccess("Joined study room successfully!");
        router.push(`/student_page/study_rooms/${roomId}`);
      } else {
        const errorData = await res.json().catch(() => ({}));
        showError(errorData.error || "Failed to join study room. Please try again.");
      }
    } catch (error) {
      console.error("Error joining room:", error);
      showError("Failed to join study room. Please try again.");
    }
  };

  const filteredRooms = rooms.filter((room) => {
    const matchesSearch = room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      room.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubject = filterSubject === "all" || room.subject === filterSubject;
    return matchesSearch && matchesSubject;
  });

  const subjects = Array.from(new Set(rooms.map(r => r.subject))).filter(Boolean);

  // Filter subjects based on search input
  const filteredSubjects = enrolledSubjects.filter(subj => 
    subj.toLowerCase().includes(subjectSearch.toLowerCase())
  );

  // Handle subject selection from dropdown
  const handleSubjectSelect = (selectedSubject: string) => {
    setNewRoom({ ...newRoom, subject: selectedSubject });
    setSubjectSearch(selectedSubject);
    setShowSubjectDropdown(false);
    setSelectedSubjectIndex(-1);
  };

  // Handle subject search input
  const handleSubjectSearchChange = (value: string) => {
    setSubjectSearch(value);
    setNewRoom({ ...newRoom, subject: value });
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (subjectInputRef.current && !subjectInputRef.current.contains(event.target as Node)) {
        setShowSubjectDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900" style={{ padding: '1.5rem' }}>
        <div style={{ maxWidth: '80rem', marginLeft: 'auto', marginRight: 'auto' }}>
          {/* Header Card Skeleton */}
          <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-8 mb-8 overflow-hidden">
            <div className="animate-pulse">
              <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-48 mb-3"></div>
              <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-80"></div>
            </div>
          </div>
          
          {/* Cards Grid Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-6 animate-pulse">
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-3"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-4"></div>
                <div className="flex items-center justify-between">
                  <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-20"></div>
                  <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900" style={{ padding: '1.5rem' }}>
      <div style={{ maxWidth: '80rem', marginLeft: 'auto', marginRight: 'auto' }}>
        {/* Header Card - matching ai-studio style */}
        <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-8 mb-8 overflow-hidden">
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#2E7D32]/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-400/5 rounded-full blur-3xl" />
          
          <div className="relative">
            <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2">
              Study Rooms
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              Join collaborative study sessions with your peers
            </p>
          </div>
        </div>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl shadow-sm border border-blue-200 dark:border-blue-800 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Mail size={20} className="text-blue-600 dark:text-blue-400" />
            Pending Invites ({pendingInvites.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingInvites.map((invite) => (
              <div
                key={invite.roomId}
                className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-blue-200 dark:border-blue-700"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
                      {invite.roomName}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                      {invite.roomDescription}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-500">
                      <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">
                        {invite.roomSubject}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users size={14} />
                        {invite.memberCount}/{invite.maxMembers}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                  Invited by {invite.invitedBy?.firstName || 'Unknown'} {invite.invitedBy?.lastName || 'User'}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAcceptInvite(invite.roomId)}
                    className="flex-1 py-2 bg-[#2E7D32] hover:brightness-110 text-white font-medium rounded-lg transition-all duration-200 text-sm"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleDeclineInvite(invite.roomId)}
                    className="flex-1 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search and Filter Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Search study rooms..."
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
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-6 py-2 bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] hover:brightness-110 text-white font-medium rounded-lg transition-all duration-200"
          >
            <Plus size={20} /> Create Room
          </button>
        </div>
      </div>

      {/* Study Rooms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRooms.map((room) => (
          <div
            key={room._id}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 hover:shadow-lg transition-all duration-300"
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100 line-clamp-1">
                {room.name}
              </h3>
              {room.isPrivate ? (
                <Lock className="text-slate-500 flex-shrink-0 ml-2" size={20} />
              ) : (
                <Unlock className="text-green-500 flex-shrink-0 ml-2" size={20} />
              )}
            </div>

            <p className="text-slate-600 dark:text-slate-400 text-sm mb-4 line-clamp-2">
              {room.description}
            </p>

            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <User className="flex-shrink-0" size={16} />
                <span>{room.createdBy?.firstName || 'Unknown'} {room.createdBy?.lastName || 'User'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Users className="flex-shrink-0" size={16} />
                <span>{room.members.length}/{room.maxMembers} members</span>
              </div>
              {room.subject && (
                <div className="inline-block px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full">
                  {room.subject}
                </div>
              )}
            </div>

            <button
              onClick={() => handleJoinRoom(room._id, room.members.includes(session?.user?.id || ""))}
              disabled={room.members.length >= room.maxMembers}
              className="w-full py-2 bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] hover:brightness-110 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {room.members.includes(session?.user?.id || "") ? "Enter Room" : "Join Room"}
            </button>
          </div>
        ))}
      </div>

      {filteredRooms.length === 0 && (
        <div className="text-center py-12">
          <Users className="mx-auto text-slate-300 dark:text-slate-600 mb-4" size={64} />
          <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-2">
            No study rooms found
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Create a new room to start collaborating with your peers
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] hover:brightness-110 text-white font-medium rounded-lg transition-all duration-200"
          >
            <Plus size={20} /> Create Your First Room
          </button>
        </div>
      )}

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">
              Create Study Room
            </h2>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Room Name
                </label>
                <input
                  type="text"
                  required
                  value={newRoom.name}
                  onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#1C2B1C] focus:border-transparent"
                  placeholder="e.g., Math Study Group"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  required
                  value={newRoom.description}
                  onChange={(e) => setNewRoom({ ...newRoom, description: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#1C2B1C] focus:border-transparent"
                  rows={3}
                  placeholder="What will you study together?"
                />
              </div>
              <div className="relative" ref={subjectInputRef}>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Subject *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={subjectSearch}
                    onChange={(e) => handleSubjectSearchChange(e.target.value)}
                    onFocus={() => setShowSubjectDropdown(true)}
                    onKeyDown={handleSubjectKeyDown}
                    placeholder="Search or select a subject from your classes"
                    className="w-full px-4 py-2 pr-10 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#2E7D32] focus:border-transparent"
                    required
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
                {showSubjectDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredSubjects.length > 0 ? (
                      filteredSubjects.map((subj, index) => (
                        <button
                          key={subj}
                          type="button"
                          onClick={() => handleSubjectSelect(subj)}
                          className={`w-full text-left px-4 py-2 transition-all duration-150 first:rounded-t-lg last:rounded-b-lg ${
                            index === selectedSubjectIndex
                              ? 'bg-[#2E7D32] dark:bg-[#2E7D32] text-white font-semibold'
                              : 'bg-white dark:bg-slate-800 hover:bg-[#E8F5E9] dark:hover:bg-[#1C2B1C]/50 text-slate-900 dark:text-white hover:text-[#2E7D32] dark:hover:text-[#04C40A]'
                          }`}
                        >
                          {subj}
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                        {enrolledSubjects.length === 0 ? 'No enrolled classes found' : 'No matching classes found'}
                      </div>
                    )}
                  </div>
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Search or choose from your enrolled classes</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Max Members
                </label>
                <input
                  type="number"
                  min="2"
                  max="50"
                  value={newRoom.maxMembers}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    setNewRoom({ ...newRoom, maxMembers: isNaN(value) ? 2 : value });
                  }}
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#1C2B1C] focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPrivate"
                  checked={newRoom.isPrivate}
                  onChange={(e) => setNewRoom({ ...newRoom, isPrivate: e.target.checked })}
                  className="w-4 h-4 text-[#1C2B1C] focus:ring-[#1C2B1C] border-slate-300 rounded"
                />
                <label htmlFor="isPrivate" className="text-sm text-slate-700 dark:text-slate-300">
                  Make this room private (invite only)
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setSubjectSearch('');
                    setShowSubjectDropdown(false);
                    setSelectedSubjectIndex(-1);
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] hover:brightness-110 text-white font-medium rounded-lg transition-all duration-200"
                >
                  Create Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
