"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { classApi, IClass } from "@/lib/api/teacher";
import { useToast } from "@/contexts/ToastContext";

type ClassItem = {
  id: string;
  title: string;
  code: string;
  professor: string;
  program: string;
  year: string;
  block: string;
  schedule?: string;
  room?: string;
  avatarColor?: string;
};

type CurrentUser = {
  firstName: string;
  lastName: string;
  email: string;
};

export default function TeacherClassPage() {
  const [query, setQuery] = useState("");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const router = useRouter();
  const { showError, showWarning } = useToast();

  // Convert IClass from API to ClassItem for UI
  const convertToClassItem = (apiClass: IClass, teacher: CurrentUser | null): ClassItem => {
    console.log('Converting class:', apiClass, 'with teacher:', teacher);
    
    // Parse courseYear like "BSIT - 3rd Year" to extract program and year
    const courseYearParts = apiClass.courseYear?.split(' - ') || [];
    const program = courseYearParts[0] || apiClass.subject || '';
    const yearLevel = courseYearParts[1] || '';
    
    // Extract year and block from year level (e.g., "3rd Year" -> "3", "A")
    const yearMatch = yearLevel.match(/(\d+)/);
    const year = yearMatch ? yearMatch[1] : '';
    const block = 'A'; // Default block, could be extracted differently if available
    
    // Use teacher info if available, otherwise extract from the class or use defaults
    const teacherName = teacher 
      ? `${teacher.firstName} ${teacher.lastName}`.trim() 
      : 'Teacher';
    
    const teacherEmail = teacher?.email || '';
    
    // Format schedule information
    const schedule = apiClass.day && Array.isArray(apiClass.day) && apiClass.day.length > 0 
      ? `${apiClass.day.join(', ')} ${apiClass.time || ''}`.trim() 
      : apiClass.day && typeof apiClass.day === 'string'
      ? `${apiClass.day} ${apiClass.time || ''}`.trim()
      : apiClass.time || undefined;
    
    return {
      id: apiClass._id || '',
      title: apiClass.name,
      code: apiClass.classCode || '',
      professor: teacherName,
      program: program ? `Bachelor of Science in Information Technology (${program})` : 'Bachelor of Science in Information Technology',
      year,
      block,
      schedule, // Now includes formatted day(s) and time
      room: apiClass.room, // Room information from database
      avatarColor: "bg-green-500",
    };
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setAuthError(null);

      try {
        // Check if user has access token
        const accessToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        
        // Fetch current user info (uses Bearer token auth)
        
        if (!accessToken) {
          setAuthError('Not authenticated. Please log in to access your classes.');
          showError('Please log in to access your classes', 'Authentication Required');
          return;
        }

        const userResponse = await fetch("/api/v1/users/current", { 
          cache: "no-store", 
          credentials: "include",
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        let user: CurrentUser | null = null;
        if (userResponse.ok) {
          const userJson = await userResponse.json();
          
          if (userJson?.user) {
            user = {
              firstName: userJson.user.firstName || "",
              lastName: userJson.user.lastName || "",
              email: userJson.user.email || "",
            };
            setCurrentUser(user);
          }
        } else {
          // If user authentication fails, redirect to login
          if (userResponse.status === 401) {
            setAuthError('Your session has expired. Please log in again.');
            showError('Your session has expired. Please log in again.', 'Session Expired');
            return;
          }
        }

        // Only try to fetch classes if we have an access token
        if (!accessToken) {
          setAuthError('Not authenticated. Please log in to access your classes.');
          showError('Please log in to access your classes', 'Authentication Required');
          return;
        }

        // Fetch teacher's classes (uses Bearer token auth)
        const classResponse = await classApi.getClasses({ active: true });
        
        if (classResponse.success && classResponse.data?.classes) {
          const convertedClasses = classResponse.data.classes.map(apiClass => {
            const converted = convertToClassItem(apiClass, user);
            return converted;
          });
          setClasses(convertedClasses);
        } else {
          // Handle specific authentication errors
          if (classResponse.error?.includes('No valid token') || classResponse.error?.includes('Token has expired')) {
            setAuthError('Your session has expired. Please log in again.');
            showError('Your session has expired. Please log in again.', 'Session Expired');
          } else {
            throw new Error(classResponse.error || 'Failed to fetch classes');
          }
        }

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load classes';
        setAuthError(errorMsg);
        showError(errorMsg, 'Load Error');
        setClasses([]); // Reset to empty array on error
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [showError]);

  const filteredClasses = useMemo(
    () =>
      classes.filter(
        (c) =>
          c.title.toLowerCase().includes(query.toLowerCase()) ||
          c.code.toLowerCase().includes(query.toLowerCase()) ||
          c.professor.toLowerCase().includes(query.toLowerCase())
      ),
    [query, classes]
  );

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (filteredClasses.length > 0) {
        // navigate to the first matched class (use class id as classId)
        router.push(`/teacher_page/classes/${filteredClasses[0].id}`);
      }
    }
  };

  const getFullName = (u: CurrentUser | null) =>
    u ? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() : "";

  const getInitials = (name: string) =>
    name
      .split(" ")
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300" style={{ padding: '1.5rem' }}>
      <div style={{ maxWidth: '80rem', marginLeft: 'auto', marginRight: 'auto' }}>
        {/* Header Card */}
        <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-8 mb-8 overflow-hidden">
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#2E7D32]/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-400/5 rounded-full blur-3xl" />
          
          <div className="relative">
            <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2">
              My Classes
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              Manage your enrolled classes and discover new learning opportunities
            </p>
          </div>
        </div>

        {/* Search Card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border-2 border-slate-200 dark:border-slate-700 p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-md">
              {loading ? (
                <div className="h-11 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse"></div>
              ) : (
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search classes..."
                  className="w-full px-4 py-2.5 border-2 border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#2E7D32]/50 focus:border-[#2E7D32] font-medium transition-colors duration-200"
                />
              )}
            </div>
            {loading ? (
              <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-20 animate-pulse"></div>
            ) : (
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {filteredClasses.length} {filteredClasses.length === 1 ? 'class' : 'classes'}
              </span>
            )}
          </div>
        </div>

        {/* My Classes Content */}
        <div>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm p-6 animate-pulse"
                >
                  {/* Header skeleton */}
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                    <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-full w-24"></div>
                  </div>

                  {/* Schedule section skeleton */}
                  <div className="mb-6">
                    <div className="flex items-center mb-2">
                      <div className="w-4 h-4 bg-slate-200 dark:bg-slate-700 rounded mr-2"></div>
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
                    </div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32 mb-2"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
                  </div>

                  {/* Instructor section skeleton */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full mr-3"></div>
                      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
                    </div>
                    <div className="h-9 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : authError ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 mx-auto mb-6 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                <svg
                  className="w-12 h-12 text-red-500 dark:text-red-400"
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
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                {authError.includes('log in') || authError.includes('authenticated') || authError.includes('session') 
                  ? 'Authentication Required' 
                  : 'Failed to load classes'
                }
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                {authError}
              </p>
              <div className="space-x-4">
                {authError.includes('log in') || authError.includes('authenticated') || authError.includes('session') ? (
                  <Link
                    href="/auth/login"
                    className="bg-green-500 text-white px-6 py-2 rounded-md hover:bg-green-600 transition-colors"
                  >
                    Go to Login
                  </Link>
                ) : (
                  <button
                    onClick={() => window.location.reload()}
                    className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition-colors"
                  >
                    Try Again
                  </button>
                )}
              </div>
            </div>
          ) : filteredClasses.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 mx-auto mb-6 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                <svg
                  className="w-12 h-12 text-slate-400 dark:text-slate-500"
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
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                {query ? 'No matching classes' : 'No classes yet'}
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                {query ? 'Try adjusting your search terms' : 'Create or join a class to start managing sessions'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredClasses.map((cls) => {
                // Use the current user's name and email if available, otherwise fall back to class data
                const teacherName = currentUser 
                  ? `${currentUser.firstName} ${currentUser.lastName}`.trim() 
                  : cls.professor || 'Teacher';
                const initials = getInitials(teacherName);

                return (
                  <div
                    key={cls.id}
                    className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 p-6 flex flex-col justify-between"
                  >
                    {/* Header: title left, code pill right */}
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-0 max-w-[calc(100%-120px)] break-words">
                        {cls.title}
                      </h3>
                      <span className="inline-block px-3 py-1.5 rounded-full text-sm font-medium shrink-0 bg-teal-50 dark:bg-green-500/20 dark:text-green-400 sm:px-2 sm:text-[12px]" style={{ color: '#2e7d32' }}>
                        Code: {cls.code}
                      </span>
                    </div>

                    {/* Schedule Section */}
                    <div className="mb-6 flex-1">
                      <div className="flex items-center text-gray-600 dark:text-gray-300 mb-2">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm font-medium">Schedule</span>
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        {cls.schedule || 'No schedule set'}
                      </div>
                      {cls.room && (
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Room: {cls.room}
                        </div>
                      )}
                    </div>

                    {/* Instructor Section */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                          <span className="text-xs font-medium text-white">
                            {initials}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {teacherName}
                        </span>
                      </div>
                      <Link
                        href={`/teacher_page/classes/${cls.id}`}
                        className="bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] text-white px-4 py-2 rounded-md hover:bg-[#1B5E20] dark:hover:bg-[hsl(142.1,76.2%,30%)] transition-colors duration-200 text-sm font-medium"
                      >
                        Enter
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
