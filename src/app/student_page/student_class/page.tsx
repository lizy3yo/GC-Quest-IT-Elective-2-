"use client";

import { useState, useEffect, useMemo } from "react";
import useAuth from "@/hooks/useAuth";
import Link from "next/link";
import { authManager } from "@/utils/auth";
import LoadingTemplate2 from '@/components/ui/loading_template_2/loading2';

interface ClassInfo {
  _id: string;
  name: string;
  teacher: string;
  subject: string;
  studentCount: number;
  classCode: string;
  description?: string;
  createdAt: string;
  courseYear?: string;
  day?: string[];
  time?: string;
  room?: string;
}

export default function StudentClassPage() {
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);

  useEffect(() => {
    // Only fetch classes when user is authenticated and not loading
    if (!authLoading && isAuthenticated) {
      fetchClasses();
    } else if (!authLoading && !isAuthenticated) {
      // User is not authenticated, redirect to login
      window.location.href = '/auth/login';
    }
  }, [authLoading, isAuthenticated]);

  const fetchClasses = async () => {
    try {
      setError(null);

      console.log('🔍 Fetching student classes...');

      // Use authManager to make authenticated request
      const response = await authManager.makeAuthenticatedRequest('/api/student_page/class');

      console.log('📡 API Response status:', response.status);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please log in to view your classes');
        } else if (response.status === 403) {
          throw new Error('You do not have permission to view classes');
        } else {
          const errorText = await response.text();
          console.error('❌ API Error:', errorText);
          throw new Error(`Failed to fetch classes: ${response.statusText}`);
        }
      }

      const data = await response.json();
      console.log('📊 API Response data:', data);

      if (data.success && data.data?.classes) {
        console.log(`✅ Found ${data.data.classes.length} classes for student`);
        // Sort classes by classCode (ascending). Use numeric-aware comparison and
        // fallback to empty string if classCode is missing.
        const sorted = data.data.classes.slice().sort((a: ClassInfo, b: ClassInfo) =>
          (a.classCode || '').localeCompare(b.classCode || '', undefined, { numeric: true, sensitivity: 'base' })
        );
        setClasses(sorted);
      } else {
        console.error("❌ Invalid response format:", data);
        // If success is true but no classes, show empty state instead of error
        if (data.success && data.data && Array.isArray(data.data.classes) && data.data.classes.length === 0) {
          console.log('ℹ️ Student is not enrolled in any classes');
          setClasses([]);
        } else {
          setError("Failed to load classes. Please try again.");
          setClasses([]);
        }
      }
    } catch (error) {
      console.error("❌ Error fetching classes:", error);
      setError(error instanceof Error ? error.message : "Failed to load classes. Please try again.");
      setClasses([]);
    } finally {
      setLoading(false);
    }
  };

  const joinClass = async () => {
    if (!joinCode.trim()) return;

    setJoinLoading(true);
    setError(null);

    try {
      const response = await authManager.makeAuthenticatedRequest('/api/student_page/class', {
        method: 'POST',
        body: JSON.stringify({ classCode: joinCode.trim() })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to join class');
      }

      const data = await response.json();

      if (data.success) {
        setJoinCode("");
        setShowJoinForm(false);
        // Refresh the classes list
        await fetchClasses();
      } else {
        throw new Error(data.error || 'Failed to join class');
      }
    } catch (error) {
      console.error("Error joining class:", error);
      setError(error instanceof Error ? error.message : "Failed to join class");
    } finally {
      setJoinLoading(false);
    }
  };

  const filteredClasses = classes.filter((c) =>
    `${c.name} ${c.teacher} ${c.subject} ${c.classCode}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  // Function to get course code color based on the code
  const getCodeColor = (code: string) => {
    const colors = [
      'bg-green-100 text-green-700',
      'bg-blue-100 text-blue-700',
      'bg-purple-100 text-purple-700',
      'bg-orange-100 text-orange-700',
      'bg-pink-100 text-pink-700'
    ];
    const index = code.charCodeAt(0) % colors.length;
    return colors[index];
  };

  // Function to get default schedule if none exists
  const getScheduleDisplay = (classInfo: ClassInfo) => {
    if (classInfo.day && classInfo.time) {
      return `${classInfo.day.join(" & ")} · ${classInfo.time}`;
    }

    // Default schedules based on class name for demo
    const schedules = [
      'Mon & Wed · 10:00-11:30 AM',
      'Tue & Thu · 1:00-2:30 PM',
      'Fri · 9:00-12:00 NN'
    ];
    const index = classInfo.name.length % schedules.length;
    return schedules[index];
  };

  // Build a weekly schedule (Mon-Sun) aggregated from class day/time data
  const weeklySchedule = useMemo(() => {
    const daysOrder = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    const map: Record<string, Array<{ name: string; time: string }>> = {};
    daysOrder.forEach((d) => (map[d] = []));

    for (const cls of classes) {
      if (!cls.day || !cls.time) continue;

      for (const day of cls.day) {
        const fullDay = daysOrder.find(d => d.toLowerCase().startsWith(day.toLowerCase()));
        if (fullDay) {
          map[fullDay].push({
            name: cls.name,
            time: `${cls.time}${cls.room ? ` · ${cls.room}` : ''}`
          });
        }
      }
    }
    return { daysOrder, map };
  }, [classes]);

  if (authLoading || loading) {
    return (
      <LoadingTemplate2 title={authLoading ? "Authenticating..." : "Loading your classes..."} />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Classes</h1>
          <p className="text-gray-600">
            Manage your enrolled classes and discover new learning opportunities
          </p>
        </div>

        {/* Search and Class Schedule Button */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex-1 max-w-md">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search classes..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setIsScheduleOpen(true)}
            className="ml-4 bg-gray-800 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors duration-200 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Class Schedule
          </button>
        </div>

        {/* Join Class Form */}
        {showJoinForm && (
          <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Join a Class</h3>
            <div className="flex gap-3">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter class code (e.g., ABC123)"
                className="flex-1 px-3 py-2 rounded-md border border-gray-300 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={joinLoading}
              />
              <button
                onClick={joinClass}
                disabled={!joinCode.trim() || joinLoading}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {joinLoading ? 'Joining...' : 'Join'}
              </button>
              <button
                onClick={() => {
                  setShowJoinForm(false);
                  setJoinCode("");
                  setError(null);
                }}
                className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-all duration-200 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 text-red-500 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-red-700">{error}</p>
            </div>
            <button
              onClick={fetchClasses}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* My Classes Content */}
        <div>
          {error ? (
            // Error state is already handled above, show classes if available
            filteredClasses.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-12 h-12 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No classes found
                </h3>
                <p className="text-gray-600 mb-6">
                  {searchTerm ? "No classes match your search term." : "You haven't joined any classes yet. Use a class code from your teacher to join."}
                </p>
                {!searchTerm && null}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredClasses.map((classInfo) => (
                  <div
                    key={classInfo._id}
                    className="relative bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 p-6 flex flex-col justify-between"
                  >
                    {/* Header: title left, code pill right to avoid overlap */}
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-0 max-w-[calc(100%-120px)] break-words">
                        {classInfo.name}
                      </h3>
                      <span className={`inline-block px-3 py-1.5 rounded-full text-sm font-medium shrink-0 bg-emerald-100 text-emerald-700 ring-1 ring-emerald-100 sm:px-2 sm:text-[12px]`}>
                        Code: {classInfo.classCode}
                      </span>
                    </div>

                    {/* Schedule Section */}
                    <div className="mb-6 flex-1">
                      <div className="flex items-center text-gray-600 mb-2">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm font-medium">Schedule</span>
                      </div>
                      <div className="text-sm text-gray-700">
                        {getScheduleDisplay(classInfo)}
                      </div>
                    </div>

                    {/* Instructor Section */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                          <span className="text-xs font-medium text-white">
                            {classInfo.teacher.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-700">
                          {classInfo.teacher}
                        </span>
                      </div>
                      <Link
                        href={`/student_page/student_class/${classInfo._id}`}
                        className="bg-gray-800 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors duration-200 text-sm font-medium"
                      >
                        Enter
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : filteredClasses.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-12 h-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No classes yet
              </h3>
              {/* join prompt and button removed per request */}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredClasses.map((classInfo) => (
                <div
                  key={classInfo._id}
                  className="relative bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 p-6 flex flex-col justify-between"
                >
                  {/* Header: title left, code pill right to avoid overlap */}
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-0 max-w-[calc(100%-120px)] break-words">
                      {classInfo.name}
                    </h3>
                    <span className={`inline-block px-3 py-1.5 rounded-full text-sm font-medium shrink-0 bg-emerald-100 text-emerald-700 ring-1 ring-emerald-100 sm:px-2 sm:text-[12px]`}>
                      Code: {classInfo.classCode}
                    </span>
                  </div>

                  {/* Schedule Section */}
                  <div className="mb-6 flex-1">
                    <div className="flex items-center text-gray-600 mb-2">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm font-medium">Schedule</span>
                    </div>
                    <div className="text-sm text-gray-700">
                      {getScheduleDisplay(classInfo)}
                    </div>
                  </div>

                  {/* Instructor Section */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                        <span className="text-xs font-medium text-white">
                          {classInfo.teacher.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-700">
                        {classInfo.teacher}
                      </span>
                    </div>
                    <Link
                      href={`/student_page/student_class/${classInfo._id}`}
                      className="bg-gray-800 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors duration-200 text-sm font-medium"
                    >
                      Enter
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Schedule Modal */}
        {isScheduleOpen && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
            onClick={() => setIsScheduleOpen(false)}
          >
            <div
              className="bg-white rounded-lg shadow-xl w-full max-w-[1400px] mx-4 p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4 px-2">
                <h2 className="text-2xl font-semibold text-gray-900">Class Schedule</h2>
                <button
                  onClick={() => setIsScheduleOpen(false)}
                  aria-label="Close"
                  className="p-2 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* 7-column schedule: fixed header above scrollable body */}
              {/* horizontal scroll container with fixed column widths so columns don't wrap */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-h-[640px] overflow-y-auto px-2 pb-2">
                {weeklySchedule.daysOrder.map((day, dayIdx) => (
                    <div key={day} className="flex flex-col bg-transparent border border-gray-100 rounded-lg p-3">
                    {/* compact colored header */}
                    <div className={`rounded-t-md text-white text-sm font-semibold text-center py-2 ${[
                      'bg-blue-500',
                      'bg-purple-500',
                      'bg-emerald-500',
                      'bg-orange-500',
                      'bg-pink-500',
                      'bg-lime-500',
                      'bg-indigo-500'
                    ][dayIdx % 7]}`}>{day}</div>

                    {/* body: fixed height and scrollable to align columns */}
                      <div className="flex-1 overflow-y-auto">
                      {weeklySchedule.map[day].length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-6">No classes</p>
                      ) : (
                        <div className="space-y-4">
                          {weeklySchedule.map[day].map((item, idx) => (
                            <div key={idx} className="bg-gray-50 border border-gray-100 rounded-md p-3 shadow-sm">
                              <div className="font-semibold text-sm text-gray-900 leading-snug mb-1">{item.name}</div>
                              <div className="text-xs text-gray-600">{item.time}</div>
                              {item.time.includes('·') && (
                                <div className="text-xs text-gray-500 mt-2">{item.time.split('·').slice(-1)[0].trim()}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}