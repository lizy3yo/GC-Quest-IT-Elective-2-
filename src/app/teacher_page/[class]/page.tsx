"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { classApi, IClass } from "@/services";

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
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

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
      setError(null);

      try {
        console.log('Fetching user and class data...');
        
        // Check if user has access token
        const accessToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        console.log('Access token available:', accessToken ? 'Yes' : 'No');
        
        // Fetch current user info (uses Bearer token auth)
        
        if (!accessToken) {
          setError('Not authenticated. Please log in to access your classes.');
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
        
        console.log('User response status:', userResponse.status);
        
        let user: CurrentUser | null = null;
        if (userResponse.ok) {
          const userJson = await userResponse.json();
          console.log('User response data:', userJson);
          
          if (userJson?.user) {
            user = {
              firstName: userJson.user.firstName || "",
              lastName: userJson.user.lastName || "",
              email: userJson.user.email || "",
            };
            console.log('Parsed user:', user);
            setCurrentUser(user);
          } else {
            console.warn('No user data in response:', userJson);
          }
        } else {
          const errorText = await userResponse.text();
          console.error('User fetch failed:', userResponse.status, errorText);
          
          // If user authentication fails, redirect to login
          if (userResponse.status === 401) {
            setError('Your session has expired. Please log in again.');
            return;
          }
        }

        // Only try to fetch classes if we have an access token
        if (!accessToken) {
          setError('Not authenticated. Please log in to access your classes.');
          return;
        }

        // Fetch teacher's classes (uses Bearer token auth)
        console.log('Fetching classes...');
        const classResponse = await classApi.getClasses({ active: true });
        console.log('Class response:', classResponse);
        
        if (classResponse.success && classResponse.data?.classes) {
          const convertedClasses = classResponse.data.classes.map(apiClass => {
            const converted = convertToClassItem(apiClass, user);
            console.log('Converted class:', converted);
            return converted;
          });
          setClasses(convertedClasses);
        } else {
          console.error('Failed to fetch classes:', classResponse.error);
          
          // Handle specific authentication errors
          if (classResponse.error?.includes('No valid token') || classResponse.error?.includes('Token has expired')) {
            setError('Your session has expired. Please log in again.');
          } else {
            throw new Error(classResponse.error || 'Failed to fetch classes');
          }
        }

      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load classes');
        setClasses([]); // Reset to empty array on error
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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
        // navigate to the first matched class (use class id as classId since no backend)
        router.push(`/teacher_page/${filteredClasses[0].id}/${filteredClasses[0].id}`);
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="w-full px-8 py-8">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            My Classes
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-lg">
            Manage your classes — teacher view
          </p>
        </div>

        <div className="flex items-center justify-start gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-md">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M3 21h18M5 21V7a2 2 0 012-2h10a2 2 0 012 2v14M9 10h.01M9 14h.01M15 10h.01M15 14h.01M12 6v2"
                />
              </svg>
            </div>
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
              My Classes
            </span>
            <span className="ml-2 inline-flex items-center justify-center text-xs font-semibold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white rounded-full px-2 py-0.5">
              {loading ? '...' : filteredClasses.length}
            </span>
          </div>
          <div className="ml-auto">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search classes..."
              className="w-64 px-3 py-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-green-400"
              disabled={loading}
            />
          </div>
        </div>

        <div className="border-b border-slate-700/30 mb-6" />

        {/* My Classes Content */}
        <div>
          {loading ? (
            <div className="text-center py-16">
              <div className="w-24 h-24 mx-auto mb-6 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                <svg
                  className="w-12 h-12 text-slate-400 dark:text-slate-500 animate-spin"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Loading classes...
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Please wait while we fetch your classes
              </p>
            </div>
          ) : error ? (
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
                {error.includes('log in') || error.includes('authenticated') || error.includes('session') 
                  ? 'Authentication Required' 
                  : 'Failed to load classes'
                }
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                {error}
              </p>
              <div className="space-x-4">
                {error.includes('log in') || error.includes('authenticated') || error.includes('session') ? (
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch">
              {filteredClasses.map((cls) => {
                // Use the current user's name and email if available, otherwise fall back to class data
                const teacherName = currentUser 
                  ? `${currentUser.firstName} ${currentUser.lastName}`.trim() 
                  : cls.professor || 'Teacher';
                const teacherEmail = currentUser?.email || "";
                const initials = getInitials(teacherName);

                console.log('Rendering class card:', {
                  className: cls.title,
                  teacherName,
                  teacherEmail,
                  currentUser
                });

                return (
                  <div
                    key={cls.id}
                    className="overflow-hidden rounded-lg shadow-md hover:shadow-lg transition-all duration-300 flex flex-col h-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  >
                    {/* Header now white in light mode, dark slate in dark mode */}
                    <div className="p-6 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 flex-1 relative">
                      <div className="text-xs opacity-90 mb-2 text-slate-500 dark:text-slate-300">
                        Classcode: {cls.code}
                      </div>
                      <h3 className="text-xl font-semibold leading-tight break-words">
                        {cls.title}
                      </h3>

                      {/* year/block pill top-right */}
                      <div className="absolute top-4 right-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-sm text-slate-700 dark:text-slate-100">
                          {cls.year} &middot; {cls.block}
                        </span>
                      </div>

                      <div className="mt-8 text-sm text-slate-700 dark:text-slate-300 break-words">
                        {cls.program && <div>{cls.program}</div>}

                        {cls.schedule && (
                          <div className="mt-2">
                            <span>{cls.schedule}</span>
                          </div>
                        )}
                        {cls.room && (
                          <div>
                            <span className="font-medium">Room:</span>{" "}
                            <span>{cls.room}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer with avatar + action (avatar & button green) */}
                    <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <div className="flex items-center">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-white mr-3 ${cls.avatarColor ?? "bg-green-500"}`}
                          aria-hidden
                        >
                          {initials}
                        </div>
                        <div className="text-sm text-slate-700 dark:text-slate-300">
                          <div className="font-medium">{teacherName}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {teacherEmail ? teacherEmail : "Professor"}
                          </div>
                        </div>
                      </div>

                      <Link
                        href={`/teacher_page/${cls.id}/${cls.id}`}
                        className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 dark:hover:bg-green-500 transition-all duration-200"
                        aria-label={`Enter ${cls.title}`}
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