"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useParams, useSearchParams } from "next/navigation";

import Alert from '@/components/molecules/alert_template/alert_template/Alert';
import ConfirmModal from "@/components/molecules/ConfirmModal";

//CUSTOM MODULES
import { assessmentApi, classApi, type IAssessment, type IClass } from '@/lib/api/teacher';

// Avatar component for posts
function Avatar({ name }: { name: string | null | undefined }) {
  const safeName = (name && typeof name === 'string' && name.trim()) || "User";
  const initials = safeName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm font-semibold text-slate-700 dark:text-slate-200">
      {initials}
    </div>
  );
}

// File type icon component using public/icons
function FileIcon({ name, type, size = 20 }: { name?: string; type?: string; size?: number }) {
  const rawName = name || '';
  const maybeExt = rawName.includes('.') ? rawName.split('.').pop()?.toLowerCase() : undefined;
  const mime = (type || '').toLowerCase();

  let key = 'file-generic';
  if (maybeExt) {
    if (maybeExt === 'pdf') key = 'file-pdf';
    else if (['doc', 'docx'].includes(maybeExt)) key = 'file-doc';
    else if (['xls', 'xlsx'].includes(maybeExt)) key = 'file-xls';
    else if (['ppt', 'pptx'].includes(maybeExt)) key = 'file-ppt';
    else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(maybeExt)) key = 'file-img';
    else key = 'file-generic';
  } else if (mime.includes('pdf')) key = 'file-pdf';
  else if (mime.includes('word') || mime.includes('msword') || mime.includes('officedocument.wordprocessingml')) key = 'file-doc';
  else if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('officedocument.spreadsheetml')) key = 'file-xls';
  else if (mime.includes('presentation') || mime.includes('powerpoint') || mime.includes('officedocument.presentationml')) key = 'file-ppt';
  else if (mime.startsWith('image/')) key = 'file-img';

  const src = `/icons/${key}.svg`;
  return (
    <img src={src} alt={`${maybeExt ? maybeExt.toUpperCase() : 'file'} icon`} width={size} height={size} />
  );
}

interface Student {
  id: string;
  name: string;
  avatar?: string;
  email?: string;
}

interface Announcement {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}

interface Resource {
  id: string;
  name: string;
  type: string;
  uploadedAt: string;
  url?: string;
  sizeBytes?: number;
  description?: string;
}

interface Flashcard {
  id: string;
  title: string;
  cardsGenerated: number;
  difficulty: string;
  createdAt: string;
  classId?: string;
}

interface Summary {
  id: string;
  title: string;
  summaryType: string;
  createdAt: string;
  classId?: string;
}

interface Assessment {
  id: string;
  title: string;
  type: "MCQ" | "TF" | "Practical" | "Written" | "Mixed";
  category: "Quiz" | "Exam" | "Activity";
  format?: "online" | "file_submission";  // add format field
  questions: number;
  createdAt: string;
  published?: boolean;
  description?: string;
  timeLimitMins?: number;
  dueDate?: string;
}

interface AttachmentMeta {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
}

interface CommentMeta {
  id: string;
  author: string | null | undefined;
  timestamp: string | null | undefined;
  text: string | null | undefined;
}

interface Post {
  id: string;
  authorName: string;
  authorAvatar?: string;
  createdAt: string;
  body: string;
  pinned?: boolean;
  commentsCount?: number;
  attachments?: AttachmentMeta[];
  comments?: CommentMeta[];
}

interface Group {
  id: string;
  name: string;
  members: string[]; // student ids
}

interface TeacherInfo {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  fullName: string;
}

interface TeacherClass {
  _id: string;
  name: string;
  courseYear: string; // e.g. "BSIT - 3A"
  teacher: TeacherInfo | string; // Support both new object format and legacy string format
  subject: string;
  studentCount: number;
  classCode: string;
  description?: string;
  needs?: string[]; // resources / requirements
  announcements?: Announcement[];
  students?: Student[];
  createdAt: string;

  // additional mocks for features
  groups?: Group[];
  resources?: Resource[];
  assessments?: Assessment[];
  // schedules and logs removed as requested
}

export default function TeacherClassPage() {
  // Alert state using the project's Alert component
  const [alertState, setAlertState] = useState<{
    isVisible: boolean;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    title?: string;
    autoClose?: boolean;
    autoCloseDelay?: number;
  }>({ isVisible: false, type: 'info', message: '', title: undefined, autoClose: true, autoCloseDelay: 5000 });

  const showAlert = (opts: { type?: 'success' | 'error' | 'warning' | 'info'; message: string; title?: string; autoClose?: boolean; autoCloseDelay?: number; }) => {
    setAlertState({
      isVisible: true,
      type: opts.type ?? 'info',
      message: opts.message,
      title: opts.title,
      autoClose: opts.autoClose ?? true,
      autoCloseDelay: opts.autoCloseDelay ?? 5000,
    });
  };
  // Helper function to safely parse and validate dates
  const safeParseDateToISO = (dateInput: string | null): string | undefined => {
    if (!dateInput || dateInput.trim() === '') {
      return undefined;
    }

    try {
      const date = new Date(dateInput);
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date input:', dateInput);
        return undefined;
      }
      return date.toISOString();
    } catch (error) {
      console.warn('Error parsing date:', dateInput, error);
      return undefined;
    }
  };

  const [clazz, setClazz] = useState<TeacherClass | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<
    "overview" | "resourcesassessments" | "classlist"
  >("overview");

  // Student list filtering (pagination removed)
  const [students, setStudents] = useState<Student[]>([]);
  const [studentSearchQuery, setStudentSearchQuery] = useState("");

  // UI state for management (now class list)
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [editingSettings, setEditingSettings] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState<{ name: string; subject: string } | null>(null);

  // resources UI
  const [newResourceFile, setNewResourceFile] = useState<File | null>(null);
  const [uploadingResource, setUploadingResource] = useState(false);

  // assessments UI
  const [showCreateAssessment, setShowCreateAssessment] = useState(false);
  // modal to choose create type (Quiz/Exam -> /assessment, Activity -> /task)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalStep, setModalStep] = useState<'format' | 'details'>('format'); // Track modal step
  const [assessmentDraft, setAssessmentDraft] = useState<{ title: string; type: Assessment["type"]; questions: number; description?: string; timeLimitMins?: number; category?: Assessment["category"]; totalPoints?: number }>(
    {
      title: "",
      type: "MCQ",
      questions: 5,
      description: "",
      timeLimitMins: 60, // Set to 1 hour (60 minutes) as a more reasonable default
      totalPoints: 100,
      category: "Quiz",
    }
  );

  // posts (create post + announcements as posts)
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPostBody, setNewPostBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [newPostFiles, setNewPostFiles] = useState<File[]>([]);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [commentsModalPost, setCommentsModalPost] = useState<Post | null>(null);

  // inline post edit/delete UI state
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editBodyDraft, setEditBodyDraft] = useState<string>("");
  const [savingPostId, setSavingPostId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    isDangerous?: boolean;
    onConfirm: (() => void) | null;
  }>({ open: false, title: "", message: "", isDangerous: false, onConfirm: null });
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

  // Real-time sync state
  const [isTabActive, setIsTabActive] = useState(true);
  const [lastActivity, setLastActivity] = useState<Date>(new Date());
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  // new states for assessments/resources details
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  // sub-tab for resources assessments: quiz / exam / activity
  // Resource tab state for Files, Flashcards, and Summaries
  const [resourceTab, setResourceTab] = useState<"files" | "flashcards" | "summaries">("files");
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [assessmentTab, setAssessmentTab] = useState<"quizzes" | "exams" | "activities">("quizzes");
  // picker state for create modal (kept at top to preserve Hooks order)
  const [createType, setCreateType] = useState<'quiz' | 'exam' | 'activity'>('quiz');
  // assessment format: 'online' for quiz-style, 'file_submission' for file upload
  const [assessmentFormat, setAssessmentFormat] = useState<'online' | 'file_submission'>('online');
  // modal inputs
  const [dueDate, setDueDate] = useState<string | null>(null);
  // split date/time for separate inputs in modal
  const [dueDateDate, setDueDateDate] = useState<string | null>(null); // YYYY-MM-DD
  const [dueDateTime, setDueDateTime] = useState<string | null>(null); // HH:MM
  const [newAttachmentFile, setNewAttachmentFile] = useState<File | null>(null);
  // validation error states for the create modal
  const [titleError, setTitleError] = useState<string | null>(null);
  const [dueDateError, setDueDateError] = useState<string | null>(null);
  const [dueTimeError, setDueTimeError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  // points input for modal
  const [pointsInput, setPointsInput] = useState<number | null>(100);

  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const classId = params?.classId as string;

  // Helper functions to safely access teacher information
  const getTeacherName = (teacher: TeacherInfo | string): string => {
    if (typeof teacher === 'string') {
      return teacher;
    }
    return teacher?.fullName || `${teacher?.firstName} ${teacher?.lastName}`.trim() || 'Unknown Teacher';
  };

  const getTeacherEmail = (teacher: TeacherInfo | string): string | undefined => {
    if (typeof teacher === 'string') {
      return undefined;
    }
    return teacher?.email;
  };

  // Helper to format student names as "Surname, Firstname"
  const formatStudentName = (student: any): string => {
    const first = student.firstName?.trim?.() ?? '';
    const last = student.lastName?.trim?.() ?? '';

    if (last && first) return `${last}, ${first}`;
    if (last) return last;
    if (first) return first;
    if (student.name) return student.name;
    if (student.fullName) return student.fullName;
    return '';
  };

  // Sort students by display name (Surname, Firstname) - stable and tolerant to different shapes
  const sortStudentsAlpha = (list: Student[] | undefined | null): Student[] => {
    if (!list) return [];
    return [...list].sort((a, b) => {
      const nameA = (a.name || formatStudentName(a) || '').toLowerCase();
      const nameB = (b.name || formatStudentName(b) || '').toLowerCase();
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return 0;
    });
  };

  const pathname = usePathname();
  // compute absolute class base path (e.g. /teacher_page/<class>/<classId>) from current pathname
  const [pathBase, setPathBase] = useState<string>(`/teacher_page`);
  useEffect(() => {
    try {
      const parts = (pathname || "").split('/').filter(Boolean);
      const idx = parts.indexOf('teacher_page');
      if (idx >= 0) {
        const first = parts[idx + 1] ?? '';
        const second = parts[idx + 2] ?? '';
        if (first && second) setPathBase(`/teacher_page/${first}/${second}`);
        else if (first) setPathBase(`/teacher_page/${first}`);
        else if (clazz?._id) setPathBase(`/teacher_page/${clazz._id}`);
      } else if (clazz?._id) {
        setPathBase(`/teacher_page/${clazz._id}`);
      }
    } catch (e) {
      // noop
    }
  }, [pathname, clazz]);

  useEffect(() => {
    fetchClass();
  }, []);

  // Restore tabs from URL params when returning from quiz/exam detail
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const assessmentTabParam = searchParams.get('assessmentTab');
    
    if (tabParam === 'overview' || tabParam === 'resourcesassessments' || tabParam === 'classlist') {
      setActiveTab(tabParam);
    }
    if (assessmentTabParam === 'quizzes' || assessmentTabParam === 'exams' || assessmentTabParam === 'activities') {
      setAssessmentTab(assessmentTabParam);
    }
    
    // Clear URL params after reading them (optional - keeps URL clean)
    if (tabParam || assessmentTabParam) {
      router.replace(`/teacher_page/classes/${classId}`, { scroll: false });
    }
    
    // Also clear any leftover sessionStorage values
    sessionStorage.removeItem('breadcrumb_tab');
    sessionStorage.removeItem('class_assessment_tab');
    sessionStorage.removeItem('class_origin_id');
  }, [classId, searchParams, router]);

  // Fetch students when classlist tab is active
  useEffect(() => {
    if (activeTab === "classlist" && clazz?._id) {
      fetchStudents();
    }
  }, [activeTab, clazz?._id, studentSearchQuery]);

  // Fetch assessments when resources and assessments tab is active or when class is loaded
  useEffect(() => {
    if (clazz?._id && (activeTab === "resourcesassessments" || activeTab === "overview")) {
      fetchAssessments();
    }
  }, [activeTab, clazz?._id]);

  // Fetch resources when resources and assessments tab is active
  useEffect(() => {
    if (clazz?._id && activeTab === "resourcesassessments") {
      fetchResources();
      fetchFlashcards();
      fetchSummaries();
    }
  }, [activeTab, clazz?._id]);

  // Fetch posts when overview tab is active
  useEffect(() => {
    if (activeTab === "overview" && clazz?._id) {
      // Posts are managed through setPosts state directly
      // No separate fetch function needed
    }
  }, [activeTab, clazz?._id]);

  // Tab visibility and real-time sync setup
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabActive(!document.hidden);
      if (!document.hidden && activeTab === "overview" && clazz?._id) {
        // Tab became active - fetch fresh data immediately
        setLastActivity(new Date());

        // Fetch fresh posts
        fetch(`/api/teacher_page/class/${clazz._id}/posts`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          }
        })
          .then(response => response.json())
          .then(result => {
            if (result.success && result.data) {
              // Transform posts to match the local Post interface (same as fetchPosts)
              const transformedPosts = result.data.posts.map((post: any) => ({
                id: post.id,
                authorName: post.author || 'Unknown Author',
                authorAvatar: post.authorAvatar,
                createdAt: post.timestamp || new Date().toISOString(),
                body: post.content || '',
                pinned: post.pinned || false,
                commentsCount: (post.comments || []).length,
                attachments: post.attachments || [],
                comments: post.comments || []
              }));
              setPosts(transformedPosts);
            }
          })
          .catch(error => console.log('Tab focus refresh error:', error));
      }
    };

    const handleUserActivity = () => {
      setLastActivity(new Date());
    };

    // Listen for tab visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Listen for user activity to detect when to poll more frequently
    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('click', handleUserActivity);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
    };
  }, [activeTab, clazz?._id]);

  // Real-time polling system for posts
  useEffect(() => {
    if (!clazz?._id || !isTabActive || activeTab !== "overview") {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
      return;
    }

    // Determine polling frequency based on recent activity
    const timeSinceActivity = Date.now() - lastActivity.getTime();
    const isRecentActivity = timeSinceActivity < 2 * 60 * 1000; // 2 minutes
    const pollFrequency = isRecentActivity ? 3000 : 10000; // 3s if recent activity, 10s otherwise

    const interval = setInterval(async () => {
      if (!document.hidden && clazz?._id && activeTab === "overview") {
        try {
          // Silently fetch fresh posts data
          const response = await fetch(`/api/teacher_page/class/${clazz._id}/posts`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
            }
          });

          const result = await response.json();

          if (result.success && result.data) {
            // Transform posts to match the local Post interface (same as fetchPosts)
            const transformedPosts = result.data.posts.map((post: any) => ({
              id: post.id,
              authorName: post.author || 'Unknown Author',
              authorAvatar: post.authorAvatar,
              createdAt: post.timestamp || new Date().toISOString(),
              body: post.content || '',
              pinned: post.pinned || false,
              commentsCount: (post.comments || []).length,
              attachments: post.attachments || [],
              comments: post.comments || []
            }));

            // Only update if data actually changed (to avoid unnecessary re-renders)
            setPosts((currentPosts) => {
              if (JSON.stringify(transformedPosts) === JSON.stringify(currentPosts)) {
                return currentPosts; // No changes, don't update
              }
              // Update last sync time when data actually changes
              setLastSyncTime(new Date());
              return transformedPosts;
            });
          }
        } catch (error) {
          console.log('Background polling error:', error);
          // Don't show error alerts for background polling
        }
      }
    }, pollFrequency);

    setPollingInterval(interval);

    return () => {
      clearInterval(interval);
    };
  }, [clazz?._id, isTabActive, activeTab, lastActivity]);

  const fetchStudents = async () => {
    if (!clazz?._id) return;

    try {
      const response = await classApi.getClassStudents(clazz._id);
      if (response.success && response.data) {
        // Map incoming API students to local shape
        const studentsData = response.data.students.map((student: any) => ({
          id: student.studentId || student._id,
          name: formatStudentName(student),
          email: student.email,
          avatar: student.avatar || "/gc-logo.png" // Use default GC logo instead of non-existent avatar files
        }));

        // Sort alphabetically first
        const sortedStudents = sortStudentsAlpha(studentsData);

        // Apply search filter
        const filteredStudents = sortedStudents.filter((student: Student) =>
          student.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
          student.email?.toLowerCase().includes(studentSearchQuery.toLowerCase())
        );

        // No pagination: show full filtered list
        setStudents(filteredStudents);
      }
    } catch (error) {
      console.error("Error fetching students:", error);
    }
  };

  const fetchAssessments = async () => {
    if (!clazz?._id) return;

    try {
      const response = await assessmentApi.getAssessments({ classId: clazz._id });
      if (response.success && response.data) {
        // Map API assessments to local Assessment interface
        const assessments = response.data.assessments || [];
        const assessmentsData = assessments.map((assessment: any) => ({
          id: assessment._id || assessment.id,
          title: assessment.title,
          type: assessment.type,
          questions: assessment.questions?.length || 0,
          createdAt: assessment.createdAt || new Date().toISOString(),
          published: assessment.published || false,
          description: assessment.description,
          timeLimitMins: assessment.timeLimitMins,
          category: assessment.category || 'Activity', // Default to Activity if not specified
          dueDate: assessment.dueDate,
        }));

        // Update the class state with real assessments
        setClazz((prevClazz) => {
          if (!prevClazz) return prevClazz;
          const updated = { ...prevClazz, assessments: assessmentsData };
          persistClass(updated);
          return updated;
        });
      }
    } catch (error) {
      console.error("Error fetching assessments:", error);
      // On error, ensure assessments is empty array rather than showing mock data
      setClazz((prevClazz) => {
        if (!prevClazz) return prevClazz;
        const updated = { ...prevClazz, assessments: [] };
        persistClass(updated);
        return updated;
      });
    }
  };

  const fetchResources = async () => {
    if (!clazz?._id) return;

    try {
      const response = await classApi.getResources(clazz._id);
      if (response.success && response.data) {
        // Map API resources to local Resource interface
        const resources = response.data.resources || [];
        const resourcesData = resources.map((resource: any) => ({
          id: resource.id,
          name: resource.name,
          type: resource.type,
          uploadedAt: resource.uploadedAt,
          url: resource.url,
          sizeBytes: resource.sizeBytes,
          description: resource.description || "",
        }));

        // Update the class state with real resources
        setClazz((prevClazz) => {
          if (!prevClazz) return prevClazz;
          const updated = { ...prevClazz, resources: resourcesData };
          persistClass(updated);
          return updated;
        });
      }
    } catch (error) {
      console.error("Error fetching resources:", error);
      // On error, ensure resources is empty array rather than showing mock data
      setClazz((prevClazz) => {
        if (!prevClazz) return prevClazz;
        const updated = { ...prevClazz, resources: [] };
        persistClass(updated);
        return updated;
      });
    }
  };

  const fetchFlashcards = async () => {
    if (!clazz?._id) return;

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/teacher_page/class/${clazz._id}/flashcards`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      if (result.success && result.data) {
        const flashcardsData = (result.data.flashcards || []).map((fc: any) => ({
          id: fc._id || fc.id,
          title: fc.title,
          cardsGenerated: fc.cardsGenerated || fc.cards?.length || 0,
          difficulty: fc.difficulty || 'medium',
          createdAt: fc.createdAt || new Date().toISOString(),
          classId: fc.classId
        }));
        setFlashcards(flashcardsData);
      }
    } catch (error) {
      console.error("Error fetching flashcards:", error);
      setFlashcards([]);
    }
  };

  const fetchSummaries = async () => {
    if (!clazz?._id) return;

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/teacher_page/class/${clazz._id}/summaries`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      if (result.success && result.data) {
        const summariesData = (result.data.summaries || []).map((sm: any) => ({
          id: sm._id || sm.id,
          title: sm.title,
          summaryType: sm.summaryType || 'outline',
          createdAt: sm.createdAt || new Date().toISOString(),
          classId: sm.classId
        }));
        setSummaries(summariesData);
      }
    } catch (error) {
      console.error("Error fetching summaries:", error);
      setSummaries([]);
    }
  };

  const fetchPosts = async () => {
    if (!clazz?._id) return;

    try {
      const response = await fetch(`/api/teacher_page/class/${clazz._id}/posts`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      const result = await response.json();

      if (result.success && result.data) {
        // Transform posts to match the local Post interface
        const postsData = result.data.posts.map((post: any) => ({
          id: post.id,
          authorName: post.author || 'Unknown Author',
          authorAvatar: post.authorAvatar,
          createdAt: post.timestamp || new Date().toISOString(),
          body: post.content || '',
          pinned: post.pinned || false,
          commentsCount: (post.comments || []).length,
          attachments: post.attachments || [],
          comments: post.comments || []
        }));

        setPosts(postsData);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      // Don't show error for posts - just log it
    }
  };

  // When clazz has students (e.g., mock or initial load), set a sorted students list for display
  useEffect(() => {
    if (!clazz) return;
    const s = sortStudentsAlpha(clazz.students || []);
    // No pagination: keep full list when using mock/class-provided students
    setStudents(s);
  }, [clazz]);

  const fetchClass = async () => {
    if (!classId) {
      setLoading(false);
      return;
    }

    try {
      // Fetch class data from real API
      const response = await classApi.getClass(classId, true);

      if (response.success && response.data) {
        const apiClass = response.data.class;

        // Convert API response to TeacherClass interface
        const teacherClass: TeacherClass = {
          _id: apiClass._id || classId,
          name: apiClass.name,
          courseYear: apiClass.courseYear,
          teacher: apiClass.teacher || `${apiClass.teacherId}`, // Use teacher object if available, fallback to teacherId
          subject: apiClass.subject,
          studentCount: apiClass.studentCount || 0,
          classCode: apiClass.classCode || '',
          description: apiClass.description,
          needs: [], // This may not be in the API yet
          announcements: [], // This may not be in the API yet
          students: [], // Will be fetched separately when classlist tab is accessed
          createdAt: apiClass.createdAt?.toString() || new Date().toISOString(),
          groups: [], // This may not be in the API yet
          resources: [], // This may not be in the API yet
          assessments: [], // Will be fetched separately via fetchAssessments()
        };

        setClazz(teacherClass);
        setSettingsDraft({ name: teacherClass.name, subject: teacherClass.subject });
      } else {
        console.error("Failed to fetch class:", response.error);
        // On failure, clear class so UI shows not found / error state
        setClazz(null);
        setSettingsDraft(null);
      }
    } catch (error) {
      console.error("Error fetching class:", error);
      // On error, clear class so UI shows not found / error state
      setClazz(null);
      setSettingsDraft(null);
    } finally {
      setLoading(false);
    }
  };

  // persistClass: noop (mock persistence removed)
  const persistClass = (_c: TeacherClass) => {
    // intentionally left blank; removed localStorage-based mock persistence
  };

  // Loading and not found states are now handled inline in the main return

  // --- Management helpers --- (these still support "Class List" features)
  const addGroup = () => {
    if (!newGroupName.trim()) return;
    const group: Group = { id: `g${Date.now()}`, name: newGroupName.trim(), members: [] };
    setClazz((c) => {
      if (!c) return c;
      const updated = { ...c, groups: [...(c.groups || []), group] };
      persistClass(updated);
      return updated;
    });
    setNewGroupName("");
  };

  const removeGroup = (groupId: string) => {
    setClazz((c) => {
      if (!c) return c;
      const updated = { ...c, groups: (c.groups || []).filter((g) => g.id !== groupId) };
      persistClass(updated);
      return updated;
    });
  };

  // --- Resources helpers ---
  // Helper to show a native file picker and add the selected file to resources
  const pickResourceFile = async () => {
    // Check if we have the required dependencies
    if (!clazz) {
      console.error('No class available');
      showAlert({
        type: 'error',
        message: 'Class information not available. Please refresh the page.',
        autoClose: true,
        autoCloseDelay: 5000
      });
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = false;
    input.accept = '*/*';

    // Store references to avoid closure issues
    const currentClazz = clazz;
    const currentShowAlert = showAlert;
    const currentSetUploadingResource = setUploadingResource;
    const currentSetClazz = setClazz;
    const currentPersistClass = persistClass;
    const currentFetchResources = fetchResources;

    input.onchange = async (e) => {
      try {
        const target = e.target as HTMLInputElement;
        const file = target.files?.[0];

        if (!file) {
          console.log('No file selected');
          return;
        }

        if (!currentClazz || !currentClazz._id) {
          console.error('Class information not available in file handler');
          currentShowAlert({
            type: 'error',
            message: 'Class information not available. Please refresh the page.',
            autoClose: true,
            autoCloseDelay: 5000
          });
          return;
        }

        // Pre-validate file size to give immediate feedback
        const maxFileSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxFileSize) {
          const fileSizeMB = (file.size / 1024 / 1024).toFixed(1);
          currentShowAlert({
            type: 'error',
            message: `File size is ${fileSizeMB}MB. Maximum allowed size is 10MB. Please compress your file or choose a smaller one.`,
            autoClose: true,
            autoCloseDelay: 8000
          });
          return;
        }

        currentSetUploadingResource(true);
        currentShowAlert({ type: 'info', message: 'Uploading resource...', autoClose: false });

        console.log('Starting file upload:', { fileName: file.name, fileSize: file.size, classId: currentClazz._id });

        const response = await classApi.uploadResource(currentClazz._id, file);

        console.log('Upload response:', response);

        if (response.success && response.data) {
          // Add the uploaded resource to the local state
          const resource: Resource = {
            id: response.data.resource.id,
            name: response.data.resource.name,
            type: response.data.resource.type,
            uploadedAt: response.data.resource.uploadedAt,
            url: response.data.resource.url,
            sizeBytes: response.data.resource.sizeBytes,
            description: response.data.resource.description || "",
          };

          const updated = { ...currentClazz, resources: [...(currentClazz.resources || []), resource] };
          currentSetClazz(updated);
          currentPersistClass(updated);

          // Also refresh resources from server to ensure we have the latest data
          await currentFetchResources();

          currentShowAlert({ type: 'success', message: `Resource "${resource.name}" uploaded successfully!` });
        } else {
          const errorMessage = response.error || 'Failed to upload resource';
          const details = response.details ? ` ${response.details}` : '';
          throw new Error(errorMessage + details);
        }
      } catch (error) {
        console.error('Error uploading resource:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to upload resource. Please try again.';
        currentShowAlert({
          type: 'error',
          message: `Resource upload failed: ${errorMessage}`,
          autoClose: true,
          autoCloseDelay: 8000
        });
      } finally {
        currentSetUploadingResource(false);
      }
    };

    input.click();
  };

  const uploadResource = async () => {
    // If user selected a file via the controlled file input, use it.
    if (newResourceFile && clazz) {
      setUploadingResource(true);
      try {
        const response = await classApi.uploadResource(clazz._id, newResourceFile);

        if (response.success && response.data) {
          // Add the uploaded resource to the local state
          const resource: Resource = {
            id: response.data.resource.id,
            name: response.data.resource.name,
            type: response.data.resource.type,
            uploadedAt: response.data.resource.uploadedAt,
            url: response.data.resource.url,
            sizeBytes: response.data.resource.sizeBytes,
            description: response.data.resource.description || "",
          };

          const updated = { ...clazz, resources: [...(clazz.resources || []), resource] };
          setClazz(updated);
          persistClass(updated);
          setNewResourceFile(null);

          showAlert({ type: 'success', message: `Resource "${resource.name}" uploaded successfully!` });
        } else {
          const errorMessage = response.error || 'Failed to upload resource';
          const details = response.details ? ` Details: ${response.details}` : '';
          throw new Error(errorMessage + details);
        }
      } catch (error) {
        console.error('Error uploading resource:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to upload resource. Please try again.';
        showAlert({ type: 'error', message: `Upload failed: ${errorMessage}` });
      } finally {
        setUploadingResource(false);
      }
      return;
    }

    // otherwise, no-op (picker flow covers the path)
  };

  const removeResource = async (id: string) => {
    if (!clazz) return;

    setConfirmState({
      open: true,
      title: 'Delete resource',
      message: 'Are you sure you want to delete this resource? This action cannot be undone.',
      isDangerous: true,
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/teacher_page/class/${clazz._id}/resources/${id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
            }
          });

          if (!response.ok) {
            throw new Error(`Delete failed: ${response.statusText}`);
          }

          setClazz((c) => {
            if (!c) return c;
            const updated = { ...c, resources: (c.resources || []).filter((r) => r.id !== id) };
            persistClass(updated);
            return updated;
          });

          if (selectedResource?.id === id) setSelectedResource(null);
          showAlert({ type: 'success', message: 'Resource deleted successfully.' });
        } catch (error) {
          console.error('Delete error:', error);
          showAlert({ type: 'error', message: `Failed to delete resource: ${error instanceof Error ? (error as Error).message : 'Unknown error'}` });
        } finally {
          setConfirmState((prev) => ({ ...prev, open: false, onConfirm: null }));
        }
      }
    });
  };

  const previewResource = (r: Resource) => {
    if (r.url) {
      // For files stored in public directory, we can open them directly
      window.open(r.url, "_blank");
    } else {
      setSelectedResource(r);
    }
  };

  const downloadResource = async (r: Resource) => {
    if (!clazz) return;

    console.log('Downloading resource:', {
      resourceId: r.id,
      fileName: r.name,
      classId: clazz._id,
      resourceUrl: r.url
    });

    try {
      // Use the secure download endpoint
      const downloadUrl = `/api/teacher_page/class/${clazz._id}/resources/${r.id}/download`;
      console.log('Download URL:', downloadUrl);

      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      console.log('Download response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Download error response:', errorText);

        try {
          const errorData = JSON.parse(errorText);
          if (errorData.needsReupload) {
            showAlert({ type: 'error', message: `${errorData.error}\n\n${errorData.details}` });
            return;
          }

          // If server-side download failed but we have a cloudinaryUrl, try direct download
          if (errorData.cloudinaryUrl && r.url) {
            console.log('Server download failed, trying direct Cloudinary download:', errorData.cloudinaryUrl);
            showAlert({ type: 'info', message: 'Attempting direct download from cloud storage...', autoClose: true, autoCloseDelay: 3000 });

            // Create a temporary link for direct download
            const a = document.createElement("a");
            a.href = r.url; // Use the original Cloudinary URL
            a.download = r.name;
            a.target = "_blank"; // Open in new tab as fallback
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            return;
          }
        } catch (e) {
          // Not JSON, continue with generic error
        }

        throw new Error(`Download failed: ${response.statusText} - ${errorText}`);
      }

      // Create blob and download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      console.log('Download completed successfully');
    } catch (error) {
      console.error('Download error:', error);
      showAlert({ type: 'error', message: `Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  };

  // --- Assessments helpers ---
  const createAssessment = () => {
    if (!clazz) return;
    if (!assessmentDraft.title.trim()) {
      showAlert({ type: 'warning', message: "Please provide a title for the assessment." });
      return;
    }
    const a: Assessment = {
      id: `assess${Date.now()}`,
      title: assessmentDraft.title || "Untitled",
      type: assessmentDraft.type,
      questions: assessmentDraft.questions,
      createdAt: new Date().toISOString(),
      description: assessmentDraft.description || "",
      timeLimitMins: assessmentDraft.timeLimitMins || 30,
      published: false,
      category: assessmentDraft.category || "Activity",
    };
    const updated = { ...clazz, assessments: [...(clazz.assessments || []), a] };
    setClazz(updated);
    persistClass(updated);
    setShowCreateAssessment(false);
    setAssessmentDraft({ title: "", type: "MCQ", questions: 5, description: "", timeLimitMins: 30, category: "Quiz" });
    showAlert({ type: 'success', message: "Assessment created (mock). You can publish it to generate an access code." });
  };




  const deleteAssessment = async (id: string) => {
    if (!clazz) return;

    setConfirmState({
      open: true,
      title: 'Delete assessment',
      message: 'Delete this assessment? This action cannot be undone.',
      isDangerous: true,
      onConfirm: async () => {
        try {
          const response = await assessmentApi.deleteAssessment(id);

          if (!response.success) {
            throw new Error(response.error || 'Failed to delete assessment');
          }

          await fetchAssessments();

          if (selectedAssessment?.id === id) setSelectedAssessment(null);

          showAlert({ type: 'success', message: 'Assessment deleted successfully.' });
        } catch (error) {
          console.error('Error deleting assessment:', error);
          showAlert({ type: 'error', message: 'Failed to delete assessment. Please try again.' });
        } finally {
          setConfirmState((prev) => ({ ...prev, open: false, onConfirm: null }));
        }
      }
    });
  };

  const openAssessment = (a: Assessment) => {
    setSelectedAssessment(a);
  };

  const closeAssessment = () => {
    setSelectedAssessment(null);
  };

  // start an inline create flow for a specific category (Quiz/Exam/Activity)
  const startCreate = (category: Assessment["category"]) => {
    if (category === "Quiz") setAssessmentTab("quizzes");
    else if (category === "Exam") setAssessmentTab("exams");
    else setAssessmentTab("activities");

    setAssessmentDraft((d) => ({ ...d, category }));
    setShowCreateModal(false);
    setShowCreateAssessment(true);
  };

  // map UI tab/section to route segment used in URLs
  const routeSegmentFor = (tabOrCategory: string) => {
    const t = tabOrCategory.toLowerCase();
    if (t === "quizzes" || t === "quiz") return "quiz";
    if (t === "exams" || t === "exam") return "exam";
    return "activity";
  };

  // Create an assessment from modal inputs (real API integration)
  const createFromModal = async () => {
    try {
      if (!clazz) return;

      // Reset errors
      setTitleError(null);
      setDueDateError(null);
      setDueTimeError(null);
      setAttachmentError(null);

      // Title validation
      const title = assessmentDraft.title?.trim() ?? '';
      const titleValidation = validateTitle(title);
      if (titleValidation) {
        setTitleError(titleValidation);
        return;
      }

      console.log('Creating assessment with:', {
        title: assessmentDraft.title,
        dueDateDate,
        dueDateTime,
        dueDate,
        classId: clazz._id,
        classIdType: typeof clazz._id
      });

      // Enhanced date and time validation
      const dateToValidate = dueDate || dueDateDate;
      const timeToValidate = dueDateTime;

      const { dateError, timeError } = validateDateTime(dateToValidate, timeToValidate);

      if (dateError) {
        setDueDateError(dateError);
        return;
      }

      if (timeError) {
        setDueTimeError(timeError);
        return;
      }

      // Construct combined due date
      const combinedDueInput = (() => {
        if (dueDate) return dueDate;
        if (dueDateDate) {
          const t = dueDateTime ?? '23:59';
          return `${dueDateDate}T${t}`;
        }
        return null;
      })();

      if (!combinedDueInput) {
        setDueDateError('Please select a valid due date and time.');
        return;
      }

      const validDueDateISO = safeParseDateToISO(combinedDueInput);
      if (!validDueDateISO) {
        setDueDateError('Please select a valid due date and time.');
        return;
      }

      // compute timeLimitMins from dueDate if present
      let computedTimeLimit = Math.min(assessmentDraft.timeLimitMins || 60, 480); // Cap initial value to 480 minutes
      console.log('Valid due date ISO:', validDueDateISO);

      try {
        const due = new Date(validDueDateISO);
        const now = Date.now();

        // Additional safety check (should already be validated above)
        if (due.getTime() < now - 1000) {
          setDueDateError('Please select a valid due date in the future.');
          return;
        }

        const diffMins = Math.max(0, Math.ceil((due.getTime() - now) / 60000));
        if (diffMins > 0) {
          computedTimeLimit = Math.min(diffMins, 480);
        }
      } catch (e) {
        console.warn('Error calculating time limit:', e);
        setDueDateError('Please select a valid due date and time.');
        return;
      }

      // Validate time limit before proceeding
      if (computedTimeLimit > 480) {
        showAlert({ type: 'warning', message: 'Time limit cannot exceed 8 hours (480 minutes). Please adjust your due date or time limit.' });
        return;
      }      // Determine category based on createType selection
      let resolvedCategory: Assessment["category"];
      if (createType === 'quiz') {
        resolvedCategory = 'Quiz';
      } else if (createType === 'exam') {
        resolvedCategory = 'Exam';
      } else if (createType === 'activity') {
        resolvedCategory = 'Activity';
      } else {
        // fallback to assessmentTab or draft
        if (assessmentTab === 'quizzes') {
          resolvedCategory = 'Quiz';
        } else if (assessmentTab === 'exams') {
          resolvedCategory = 'Exam';
        } else if (assessmentTab === 'activities') {
          resolvedCategory = 'Activity';
        } else {
          resolvedCategory = assessmentDraft.category || 'Quiz';
        }
      }

      // Prepare attachments array from uploaded file
      const attachments: Array<{ name: string, url: string, type: string, size?: number }> = [];
      if (newAttachmentFile) {
        const attachmentValidation = validateAttachment(newAttachmentFile);
        if (attachmentValidation) {
          setAttachmentError(attachmentValidation);
          return;
        }

        // Upload attachment to Cloudinary first (consistent with resources tab pattern)
        try {
          showAlert({ type: 'info', message: 'Uploading attachment...', autoClose: false });

          const formData = new FormData();
          formData.append('file', newAttachmentFile);

          const uploadResponse = await fetch('/api/upload-file', {
            method: 'POST',
            body: formData
          });

          const uploadResult = await uploadResponse.json();

          if (!uploadResult.success) {
            const errorMessage = uploadResult.error || 'Failed to upload attachment';
            const errorDetails = uploadResult.details ? ` ${uploadResult.details}` : '';
            throw new Error(errorMessage + errorDetails);
          }

          // sanitize the MIME type: remove any charset or params and cap length to 50 chars
          const rawType = (newAttachmentFile.type || '').toString();
          const mimeOnly = rawType.split(';')[0].trim();
          const safeType = (mimeOnly && mimeOnly.length > 0) ? mimeOnly.slice(0, 50) : 'application/octet-stream';

          attachments.push({
            name: uploadResult.data.display_name || newAttachmentFile.name,
            url: uploadResult.data.url,
            type: safeType,
            size: uploadResult.data.bytes || newAttachmentFile.size
          });

          // Clear the info alert since upload was successful
          setAlertState(s => ({ ...s, isVisible: false }));

        } catch (uploadError) {
          console.error('Error uploading attachment:', uploadError);

          // Clear the uploading alert
          setAlertState(s => ({ ...s, isVisible: false }));

          // Enhanced error handling consistent with resources tab
          let errorMessage = 'Failed to upload attachment';
          let errorDetails = '';

          if (uploadError instanceof Error) {
            console.error('Upload error details:', {
              name: uploadError.name,
              message: uploadError.message
            });

            if (uploadError.message.includes('File size') || uploadError.message.includes('size too large')) {
              errorMessage = 'File size too large';
              errorDetails = 'Maximum allowed size is 10MB. Please compress your file or choose a smaller one.';
            } else if (uploadError.message.includes('File name') || uploadError.message.includes('name too long')) {
              errorMessage = 'File name too long';
              errorDetails = 'Please rename your file to be less than 255 characters.';
            } else if (uploadError.message.includes('file type') || uploadError.message.includes('Invalid file type')) {
              errorMessage = 'Invalid file type';
              errorDetails = 'Please use PDF, Word, Excel, PowerPoint, image, text, or CSV files.';
            } else {
              errorMessage = uploadError.message;
            }
          }

          // Set specific error message for the attachment field
          setAttachmentError(`${errorMessage}${errorDetails ? ` ${errorDetails}` : ''}`);

          // Also show a general alert (consistent with resources tab)
          showAlert({
            type: 'error',
            message: `Attachment upload failed: ${errorMessage}${errorDetails ? ` ${errorDetails}` : ''}`,
            autoClose: true,
            autoCloseDelay: 8000
          });

          return;
        }
      }

      // Create assessment using real API
      const newAssessment: Omit<IAssessment, '_id' | 'teacherId' | 'createdAt' | 'updatedAt'> = {
        title: assessmentDraft.title || 'Untitled',
        type: assessmentDraft.type,
        category: resolvedCategory,
        format: assessmentFormat, // Include the new format field
        questions: [], // Start with empty questions - will be filled in form editor
        classId: clazz._id,
        description: assessmentDraft.description || '',
        // totalPoints: allow teacher to supply custom total points; fallback to sum-of-questions later on backend
        totalPoints: (pointsInput ?? assessmentDraft.totalPoints) || 0,
        timeLimitMins: computedTimeLimit,
        maxAttempts: 1,
        dueDate: validDueDateISO,
        shuffleQuestions: false,
        shuffleOptions: false,
        showResults: 'immediately',
        allowReview: true,
        instructions: '',
        attachments: attachments,
        settings: {
          lockdown: false,
          showProgress: true,
          allowBacktrack: true,
          autoSubmit: false
        }
      };

      console.log('Sending assessment data:', newAssessment);

      const response = await assessmentApi.createAssessment(newAssessment);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create assessment');
      }

      const createdAssessment = response.data.assessment;

      // Refresh assessments from API to get the most up-to-date list
      await fetchAssessments();

      // close modal and reset modal fields
      setShowCreateModal(false);
      setAssessmentDraft({ title: '', type: 'MCQ', questions: 5, description: '', timeLimitMins: 60, category: 'Quiz' });
      setCreateType('quiz'); // Reset to default
      setAssessmentFormat('online'); // Reset to default
      setDueDate(null);
      setDueDateDate(null);
      setDueDateTime(null);
      setNewAttachmentFile(null);

      // redirect rules per user request:
      // - For online Quiz/Exam -> go to form editor (assessment creation)
      // - For file submission or online Activity -> go to the specific assessment page
      try {
        // if online Quiz or Exam creation is requested, navigate to form editor
        if (assessmentFormat === 'online' && (createType === 'quiz' || createType === 'exam')) {
          router.push(`/teacher_page/assessment/create/form?assessmentId=${createdAssessment._id}&classId=${clazz._id}`);
          return;
        }

        // for file submission (any type) or online Activity: navigate to the specific assessment page
        const base = pathBase || `/teacher_page/${clazz._id}`;
        const assessmentTypeRoute = routeSegmentFor(createType);
        router.push(`${base}/assessments/${assessmentTypeRoute}/${createdAssessment._id}`);
        return;
      } catch (e) {
        console.error('Redirect failed', e);
      }

      // fallback notification
      const assessmentTypeText = assessmentFormat === 'file_submission' ? 'File submission assignment' : 'Online assessment';
      showAlert({ type: 'success', message: `${assessmentTypeText} created successfully! You can now ${assessmentFormat === 'file_submission' ? 'review submissions' : 'add questions and publish it'}.` });

    } catch (error) {
      console.error('Error creating assessment:', error);

      // Provide specific error messages for common validation issues
      let errorMessage = 'Failed to create assessment: ';
      if (error instanceof Error) {
        if (error.message.includes('Time limit cannot exceed 8 hours')) {
          errorMessage += 'Time limit cannot exceed 8 hours (480 minutes). Please adjust your due date or time settings.';
        } else if (error.message.includes('timeLimitMins')) {
          errorMessage += 'Invalid time limit. Please ensure the time limit is between 1 and 480 minutes.';
        } else {
          errorMessage += error.message;
        }
      } else {
        errorMessage += 'Unknown error occurred.';
      }

      showAlert({ type: 'error', message: errorMessage });
    }
  };

  // ----------------- Validation helpers -----------------
  const sanitizeInput = (s: string) => {
    if (!s) return '';
    // Basic sanitization: strip HTML tags and script occurrences
    let cleaned = s.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
    cleaned = cleaned.replace(/<[^>]*>/g, '');
    // Trim and collapse multiple spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
  };

  const validateTitle = (t: string): string | null => {
    if (!t || t.length < 3 || t.length > 100) return 'Please enter a title between 3 and 100 characters.';
    // Allow letters, numbers, spaces and basic punctuation (. , ! ? - _)
    const regex = /^[A-Za-z0-9 \.,!\?\-_()"'\:;]+$/;
    if (!regex.test(t)) return 'Title contains invalid characters.';
    return null;
  };

  const isToday = (d: Date) => {
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  };

  const validateDate = (dateInput: string | null): string | null => {
    if (!dateInput || dateInput.trim() === '') {
      return 'Please select a due date.';
    }

    // Check if date format is valid (YYYY-MM-DD)
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(dateInput.trim())) {
      return 'Please enter a valid date format (YYYY-MM-DD).';
    }

    try {
      const inputDate = new Date(dateInput);
      const now = new Date();

      // Check if date is valid
      if (isNaN(inputDate.getTime())) {
        return 'Please enter a valid date.';
      }

      // Check if date is in the past (considering today as valid)
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const selectedDate = new Date(inputDate.getFullYear(), inputDate.getMonth(), inputDate.getDate());

      if (selectedDate < today) {
        return 'Due date cannot be in the past. Please select today or a future date.';
      }

      // Check if date is too far in the future (optional: 1 year limit)
      const oneYearFromNow = new Date(now);
      oneYearFromNow.setFullYear(now.getFullYear() + 1);

      if (inputDate > oneYearFromNow) {
        return 'Due date cannot be more than one year in the future.';
      }

      return null; // Valid date
    } catch (error) {
      return 'Please enter a valid date.';
    }
  };

  const validateTime = (timeInput: string | null, dateInput: string | null): string | null => {
    if (!timeInput || timeInput.trim() === '') {
      return 'Please select a due time.';
    }

    // Check if time format is valid (HH:MM)
    const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timePattern.test(timeInput.trim())) {
      return 'Please enter a valid time format (HH:MM).';
    }

    // If we have both date and time, check if the combined datetime is in the future
    if (dateInput) {
      try {
        const combinedDateTime = new Date(`${dateInput}T${timeInput}`);
        const now = new Date();

        if (isNaN(combinedDateTime.getTime())) {
          return 'Please enter a valid time.';
        }

        // If the date is today, ensure the time is in the future
        if (isToday(combinedDateTime)) {
          const currentTime = now.getTime();
          const selectedTime = combinedDateTime.getTime();

          if (selectedTime <= currentTime) {
            const futureTime = new Date(now.getTime() + (5 * 60 * 1000)); // 5 minutes from now
            const hours = futureTime.getHours().toString().padStart(2, '0');
            const minutes = futureTime.getMinutes().toString().padStart(2, '0');
            return `Time must be in the future.`;
          }
        }

        return null; // Valid time
      } catch (error) {
        return 'Please enter a valid time.';
      }
    }

    return null; // Valid time format (date validation will handle combined validation)
  };

  const validateDateTime = (dateInput: string | null, timeInput: string | null): { dateError: string | null; timeError: string | null } => {
    const dateError = validateDate(dateInput);
    const timeError = validateTime(timeInput, dateInput);

    // Additional combined validation
    if (!dateError && !timeError && dateInput && timeInput) {
      try {
        const combinedDateTime = new Date(`${dateInput}T${timeInput}`);
        const now = new Date();

        if (!isNaN(combinedDateTime.getTime())) {
          // Check if the combined datetime is too close to current time (less than 5 minutes)
          const timeDifference = combinedDateTime.getTime() - now.getTime();
          const fiveMinutes = 5 * 60 * 1000;

          if (timeDifference > 0 && timeDifference < fiveMinutes) {
            return {
              dateError: null,
              timeError: 'Please allow at least 5 minutes from the current time for assignment creation and student access.'
            };
          }

          // Check if the time difference is reasonable for the time limit
          const maxReasonableTime = 30 * 24 * 60 * 60 * 1000; // 30 days
          if (timeDifference > maxReasonableTime) {
            return {
              dateError: 'Due date is too far in the future. Please select a date within 30 days.',
              timeError: null
            };
          }
        }
      } catch (error) {
        // Error already handled by individual validations
      }
    }

    return { dateError, timeError };
  };

  const validateAttachment = (file: File): string | null => {
    if (!file) return null;

    // Check file size (10MB limit to match Cloudinary free plan and be consistent with resources)
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxFileSize) {
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(1);
      return `File size is ${fileSizeMB}MB. Maximum allowed size is 10MB. Please compress your file or choose a smaller one.`;
    }

    // Check file name length (consistent with resources tab)
    if (file.name.length > 255) {
      return 'File name is too long. Please rename your file to be less than 255 characters.';
    }

    // Enhanced file type validation (consistent with resources validation)
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'text/plain',
      'text/csv'
    ];

    // Also check file extensions as fallback
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.txt', '.csv'];
    const fileName = file.name.toLowerCase();
    const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));

    if (!allowedTypes.includes(file.type) && !hasValidExtension) {
      return 'Only PDF, Word, Excel, PowerPoint, image, text, or CSV files are allowed.';
    }

    return null;
  };

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAttachmentError(null);
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setNewAttachmentFile(null);
      return;
    }

    // Pre-validate file size to give immediate feedback (consistent with resources tab)
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxFileSize) {
      const fileSizeMB = (file.size / 1024 / 1024).toFixed(1);
      setAttachmentError(`File size is ${fileSizeMB}MB. Maximum allowed size is 10MB. Please compress your file or choose a smaller one.`);
      setNewAttachmentFile(null);
      return;
    }

    const err = validateAttachment(file);
    if (err) {
      setNewAttachmentFile(null);
      setAttachmentError(err);
      return;
    }
    setNewAttachmentFile(file);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setDueDateDate(newDate);
    setDueDateError(null); // Clear previous error

    // Immediate validation feedback
    const dateError = validateDate(newDate);
    if (dateError) {
      setDueDateError(dateError);
    } else if (dueDateTime) {
      // Re-validate time in context of new date
      const timeError = validateTime(dueDateTime, newDate);
      if (timeError) {
        setDueTimeError(timeError);
      } else {
        setDueTimeError(null);
      }
    }
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    setDueDateTime(newTime);
    setDueTimeError(null); // Clear previous error

    // Immediate validation feedback
    const timeError = validateTime(newTime, dueDateDate);
    if (timeError) {
      setDueTimeError(timeError);
    }
  };



  // post helpers
  const createPost = async () => {
    if (!newPostBody.trim() && newPostFiles.length === 0) return;
    if (!clazz) return;

    setPosting(true);

    try {
      // Upload files to Cloudinary first
      const attachments: AttachmentMeta[] = [];

      // Allowed non-image extensions for posts
      const allowedFileExt = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.csv'];
      const maxBytes = 10 * 1024 * 1024; // 10MB

      for (const file of newPostFiles) {
        // Validate file size
        if (file.size > maxBytes) {
          throw new Error(`File "${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 10MB.`);
        }

        const lowerName = file.name.toLowerCase();
        const isImage = (file.type && file.type.startsWith('image/')) || ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].some(ext => lowerName.endsWith(ext));

        if (isImage) {
          // Upload images using the image endpoint
          const formData = new FormData();
          formData.append('file', file);

          const uploadResponse = await fetch('/api/upload-image', {
            method: 'POST',
            body: formData
          });

          const uploadResult = await uploadResponse.json();

          if (!uploadResult.success) {
            throw new Error(`Failed to upload image ${file.name}: ${uploadResult.error || 'unknown error'}`);
          }

          attachments.push({
            id: `a-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: file.name,
            size: file.size,
            type: file.type || 'image',
            url: uploadResult.data.url,
          });
        } else {
          // Non-image: validate extension before uploading to file endpoint
          const hasAllowed = allowedFileExt.some(ext => lowerName.endsWith(ext));
          if (!hasAllowed) {
            throw new Error(`File "${file.name}" is not an allowed file type. Allowed: PDF, Word, Excel, PowerPoint, TXT, CSV.`);
          }

          const formData = new FormData();
          formData.append('file', file);

          const uploadResponse = await fetch('/api/upload-file', {
            method: 'POST',
            body: formData
          });

          const uploadResult = await uploadResponse.json();

          if (!uploadResult.success) {
            throw new Error(`Failed to upload file ${file.name}: ${uploadResult.error || 'unknown error'}`);
          }

          attachments.push({
            id: `a-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: file.name,
            size: file.size,
            type: file.type || 'application/octet-stream',
            url: uploadResult.data.url,
          });
        }
      }

      // Call API to create post
      const postResponse = await fetch(`/api/teacher_page/class/${clazz._id}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          content: newPostBody.trim(),
          attachments: attachments
        })
      });

      const postResult = await postResponse.json();

      if (!postResult.success) {
        throw new Error(postResult.error || 'Failed to create post');
      }

      // Use the actual post data from the API response
      const newPost: Post = {
        id: postResult.data.post.id,
        authorName: postResult.data.post.author || 'Unknown Author',
        authorAvatar: postResult.data.post.authorAvatar,
        createdAt: postResult.data.post.timestamp || new Date().toISOString(),
        body: postResult.data.post.content || '',
        pinned: false,
        commentsCount: 0,
        attachments: postResult.data.post.attachments || [],
        comments: postResult.data.post.comments || [],
      };

      setPosts((prev) => [newPost, ...prev]);
      setNewPostBody("");
      setNewPostFiles([]);
      showAlert({ type: 'success', message: 'Post created successfully!' });

      // Mark recent activity for increased polling frequency
      setLastActivity(new Date());

    } catch (error) {
      console.error('Error creating post:', error);
      showAlert({ type: 'error', message: error instanceof Error ? error.message : 'Failed to create post. Please try again.' });
    } finally {
      setPosting(false);
    }
  };

  // delete a post
  const deletePost = async (id: string) => {
    if (!clazz) return;
    if (deletingPostId) return;

    setConfirmState({
      open: true,
      title: 'Delete post',
      message: 'Are you sure you want to delete this post? This action cannot be undone.',
      isDangerous: true,
      onConfirm: async () => {
        setDeletingPostId(id);
        try {
          const response = await fetch(`/api/teacher_page/class/${clazz._id}/posts/${id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
            }
          });

          const result = await response.json();

          if (!result.success) {
            throw new Error(result.error || 'Failed to delete post');
          }

          setPosts((prev) => prev.filter((p) => p.id !== id));
          if (editingPostId === id) {
            setEditingPostId(null);
            setEditBodyDraft("");
          }

          showAlert({ type: 'success', message: 'Post deleted successfully!' });
          setLastActivity(new Date());
        } catch (error) {
          console.error('Error deleting post:', error);
          showAlert({
            type: 'error',
            message: error instanceof Error ? error.message : 'Failed to delete post. Please try again.'
          });
        } finally {
          setDeletingPostId(null);
          setConfirmState((prev) => ({ ...prev, open: false, onConfirm: null }));
        }
      }
    });
  };

  // start editing a post
  const startEditPost = (p: Post) => {
    setEditingPostId(p.id);
    setEditBodyDraft(p.body);
  };

  // save edited post
  const saveEditPost = async (id: string) => {
    if (!clazz) return;
    if (savingPostId) return; // Prevent multiple clicks
    if (!editBodyDraft.trim()) {
      showAlert({ type: 'warning', message: 'Post content cannot be empty.' });
      return;
    }

    setSavingPostId(id);
    try {
      const response = await fetch(`/api/teacher_page/class/${clazz._id}/posts/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          content: editBodyDraft.trim()
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to update post');
      }

      // Update local state only after successful server response
      setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, body: editBodyDraft.trim() } : p)));
      setEditingPostId(null);
      setEditBodyDraft("");

      showAlert({ type: 'success', message: 'Post updated successfully!' });

      // Mark recent activity for increased polling frequency
      setLastActivity(new Date());

    } catch (error) {
      console.error('Error updating post:', error);
      showAlert({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to update post. Please try again.'
      });
    } finally {
      setSavingPostId(null);
    }
  };

  const cancelEditPost = () => {
    setEditingPostId(null);
    setEditBodyDraft("");
  };

  // added missing helpers to avoid runtime errors
  const removeStudent = (studentId: string) => {
    setClazz((c) => {
      if (!c) return c;
      const students = (c.students || []).filter((s) => s.id !== studentId);
      const updated = { ...c, students, studentCount: students.length };
      persistClass(updated);
      return updated;
    });
  };

  const saveSettings = () => {
    if (!clazz || !settingsDraft) return;
    const updated = { ...clazz, name: settingsDraft.name, subject: settingsDraft.subject };
    setClazz(updated);
    persistClass(updated);
    setEditingSettings(false);
  };

  // render tab content
  const renderTabContent = () => {
    // Guard against null clazz
    if (!clazz) return null;
    
    // group assessments by category so UI can show clear distinction
    // Only show published assessments in the class page (drafts go to Assessment page)
    const quizzes = (clazz.assessments || []).filter((a) => a.category === "Quiz" && a.published);
    const exams = (clazz.assessments || []).filter((a) => a.category === "Exam" && a.published);
    const activities = (clazz.assessments || []).filter((a) => a.category === "Activity" && a.published);

    switch (activeTab) {
      case "overview":
        return (
          <section className="space-y-4">
            {/* Create Post Card */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
              <div className="p-4">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium text-sm">
                    {getTeacherName(clazz.teacher).split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div className="flex-1">
                    <textarea
                      value={newPostBody}
                      onChange={(e) => setNewPostBody(e.target.value)}
                      placeholder="Share something with your class..."
                      rows={3}
                      className="w-full text-sm text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none placeholder-slate-400 dark:placeholder-slate-400 bg-white dark:bg-slate-800"
                    />

                    {newPostFiles.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {newPostFiles.map((f) => (
                          <div key={f.name + f.size} className="flex items-center gap-3 text-sm px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-700">
                            <span className="truncate flex-1" title={f.name}>{f.name}</span>
                            <span className="text-slate-500 text-xs">{Math.round(f.size / 1024)} KB</span>
                            <button
                              onClick={() => setNewPostFiles((files) => files.filter((x) => x !== f))}
                              className="text-slate-400 hover:text-red-500 text-xs"
                              type="button"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3 bg-slate-50 dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt,.csv"
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        const validFiles: File[] = [];

                        for (const file of files) {
                          // Validate file size (10MB limit)
                          if (file.size > 10 * 1024 * 1024) {
                            alert(`File "${file.name}" is too large. Maximum size is 10MB.`);
                            continue;
                          }
                          validFiles.push(file);
                        }

                        setNewPostFiles((prev) => [...prev, ...validFiles]);
                      }}
                    />
                    Attach Files
                  </label>
                  <button
                    disabled={!newPostBody.trim() && newPostFiles.length === 0 || posting}
                    onClick={createPost}
                    className="px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white text-sm rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {posting ? "Posting…" : "Post"}
                  </button>
                </div>
              </div>
            </div>

            {/* Posts Feed */}
            {(posts.length === 0) ? (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-8 text-center">
                <div className="text-slate-500 dark:text-slate-400">No announcements yet</div>
                <div className="text-sm text-slate-400 dark:text-slate-500 mt-1">Posts you create will appear here.</div>
              </div>
            ) : (
              (posts || []).map((p) => {
                const currentTeacherName = getTeacherName(clazz.teacher);
                const isAuthor = p.authorName === currentTeacherName;

                return (
                  <div key={p.id} className="border rounded-lg bg-white dark:bg-slate-900 p-4 shadow-sm border-slate-200 dark:border-slate-700">
                    <div className="flex items-start gap-3">
                      <Avatar name={p.authorName} />
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium text-slate-900 dark:text-slate-100">{p.authorName || 'Unknown Author'}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {(() => {
                                try {
                                  const date = new Date(p.createdAt);
                                  return isNaN(date.getTime()) ? 'Just now' : date.toLocaleString();
                                } catch {
                                  return 'Just now';
                                }
                              })()}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {p.pinned && <div className="text-xs text-rose-600">📌</div>}
                            {isAuthor && (
                              <>
                                <button
                                  title="Edit post"
                                  onClick={() => startEditPost(p)}
                                  disabled={editingPostId !== null || savingPostId !== null || deletingPostId !== null}
                                  className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  ✏️
                                </button>
                                <button
                                  title="Delete post"
                                  onClick={() => deletePost(p.id)}
                                  disabled={editingPostId !== null || savingPostId !== null || deletingPostId !== null}
                                  className="text-xs px-2 py-1 rounded bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {deletingPostId === p.id ? '⏳' : '🗑️'}
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {editingPostId === p.id ? (
                          <div className="mt-3">
                            <textarea
                              value={editBodyDraft}
                              onChange={(e) => setEditBodyDraft(e.target.value)}
                              disabled={savingPostId === p.id}
                              className="w-full p-2 rounded border dark:border-slate-700 bg-white dark:bg-slate-900 text-sm min-h-[80px] disabled:opacity-50"
                            />
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => saveEditPost(p.id)}
                                disabled={savingPostId === p.id}
                                className="px-3 py-1 rounded bg-green-600 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {savingPostId === p.id ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={cancelEditPost}
                                disabled={savingPostId === p.id}
                                className="px-3 py-1 rounded bg-slate-200 dark:bg-slate-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3">
                            <div className="text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                              {(p.body || '').split(/\n/).map((line, i) => (
                                <div key={i} className="mb-1">
                                  {line.match(/https?:\/\/\S+/) ? (
                                    <a href={line.match(/https?:\/\/\S+/)![0]} className="text-blue-600 underline" target="_blank" rel="noreferrer">{line}</a>
                                  ) : (
                                    line
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* Attachments */}
                            {p.attachments && p.attachments.length > 0 && (
                              <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                                <div className="text-xs text-slate-600 dark:text-slate-400 mb-2">Attachments:</div>
                                <div className="space-y-1">
                                  {p.attachments.map((attachment) => (
                                    <div key={attachment.id} className="flex items-center gap-2 p-2 bg-white dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-600">
                                      <div className="w-4 h-4 text-slate-500">📎</div>
                                      <span className="text-sm flex-1 truncate">{attachment.name}</span>
                                      <span className="text-xs text-slate-500">
                                        {(attachment.size / 1024 / 1024).toFixed(1)}MB
                                      </span>
                                      <a
                                        href={attachment.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs px-2 py-1 bg-teal-100 dark:bg-teal-800 text-teal-700 dark:text-teal-200 rounded hover:bg-teal-200 dark:hover:bg-teal-700"
                                      >
                                        View
                                      </a>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="mt-3 border-t pt-3 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3">
                          <button
                            onClick={() => setCommentsModalPost(p)}
                            className="flex items-center gap-2 hover:text-slate-700 dark:hover:text-slate-300"
                          >
                            <span>💬 {p.commentsCount ?? 0}</span>
                            <span>Comments</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </section>
        );

      case "classlist":
        return (
          <section className="space-y-6">
            {/* Header with Teacher Card */}
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="lg:w-80 flex-shrink-0">
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 text-center">
                  <div className="w-24 h-24 mx-auto mb-4">
                    <img
                      src="/gc-logo.png"
                      alt="Teacher"
                      className="w-full h-full rounded-full object-cover border-2 border-slate-200 dark:border-slate-600"
                    />
                  </div>
                  <div className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
                    {clazz?.teacher ? getTeacherName(clazz.teacher) : "Teacher"}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                    CCS Department
                  </div>
                  {clazz?.teacher && getTeacherEmail(clazz.teacher) && (
                    <div className="text-sm text-slate-500 dark:text-slate-300 break-all">
                      {getTeacherEmail(clazz.teacher)}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1">
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">
                    Class List ({students.length} students)
                  </h2>

                  {/* Search Bar */}
                  <div className="mb-6">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search students..."
                        value={studentSearchQuery}
                        onChange={(e) => setStudentSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Students Grid */}
                  {students.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                        </svg>
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 font-medium">
                        {studentSearchQuery ? 'No students found' : 'No students enrolled'}
                      </div>
                      <div className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                        {studentSearchQuery ? 'Try adjusting your search terms' : 'Students will appear here once they join the class'}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {students.map((student) => (
                        <div
                          key={student.id}
                          className="flex items-center gap-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4"
                        >
                          <div className="w-12 h-12 flex-shrink-0">
                            <img
                              src="/gc-logo.png"
                              alt={student.name}
                              className="w-12 h-12 rounded-full object-cover border-2 border-slate-200 dark:border-slate-600"
                            />
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {student.name}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                              {student.email}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        );

      case "resourcesassessments":
        return (
          <section className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Resources Column with Tabs */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h2 className="text-lg font-medium">Resources</h2>
                  </div>
                  {resourceTab === "files" && (
                    <button
                      onClick={pickResourceFile}
                      disabled={uploadingResource}
                      className="px-3 py-1 rounded bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] text-white text-sm disabled:opacity-50 hover:bg-[#1B5E20] dark:hover:bg-[hsl(142.1,76.2%,30%)]"
                    >
                      {uploadingResource ? 'Uploading...' : 'Add File'}
                    </button>
                  )}
                  {resourceTab === "flashcards" && (
                    <button
                      onClick={() => router.push(`/teacher_page/ai-studio-resources?type=flashcards&classId=${clazz._id}`)}
                      className="px-3 py-1 rounded bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] text-white text-sm hover:bg-[#1B5E20] dark:hover:bg-[hsl(142.1,76.2%,30%)]"
                    >
                      Create
                    </button>
                  )}
                  {resourceTab === "summaries" && (
                    <button
                      onClick={() => router.push(`/teacher_page/ai-studio-resources?type=summary&classId=${clazz._id}`)}
                      className="px-3 py-1 rounded bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] text-white text-sm hover:bg-[#1B5E20] dark:hover:bg-[hsl(142.1,76.2%,30%)]"
                    >
                      Create
                    </button>
                  )}
                </div>

                {/* Resource Tabs */}
                <div className="border-b border-slate-200 dark:border-slate-700">
                  <div className="flex gap-6">
                    {["files", "flashcards", "summaries"].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setResourceTab(tab as "files" | "flashcards" | "summaries")}
                        className={`py-3 text-sm font-medium transition-colors capitalize ${resourceTab === tab
                          ? "text-slate-900 dark:!text-[hsl(142.1,76.2%,36.3%)] border-b-2 border-slate-900 dark:!border-[hsl(142.1,76.2%,36.3%)] -mb-[2px]"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                          }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tab Content */}
                <div className="space-y-3">
                  {resourceTab === "files" && (
                    <>
                      {(clazz.resources || []).length === 0 ? (
                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-8 text-center">
                          <div className="text-slate-500 dark:text-slate-400">No files available</div>
                          <div className="text-sm text-slate-400 dark:text-slate-500 mt-1">Upload files to share with your students.</div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {(clazz.resources || []).map((r) => (
                            <div
                              key={r.id}
                              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-sm transition-shadow"
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
                                  <FileIcon name={r.name} type={r.type} size={40} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1 truncate" title={r.name}>
                                    {r.name}
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {new Date(r.uploadedAt).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <button
                                    onClick={() => downloadResource(r)}
                                    className="p-2 rounded-md bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] text-white hover:bg-[#1B5E20] dark:hover:bg-[hsl(142.1,76.2%,30%)] transition-colors"
                                    title="Download"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                  </button>
                                  <button
                              onClick={() => removeResource(r.id)}
                              className="p-2 rounded-md bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-700 transition-colors"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {resourceTab === "flashcards" && (
              <>
                {flashcards.length === 0 ? (
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-8 text-center">
                    <div className="text-slate-500 dark:text-slate-400">No flashcards available</div>
                    <div className="text-sm text-slate-400 dark:text-slate-500 mt-1">Publish flashcards from AI Studio to share with your students.</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {flashcards.map((fc) => (
                      <div
                        key={fc.id}
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 bg-orange-100 dark:bg-orange-900/30">
                            <svg className="w-4 h-4 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
                              {fc.title}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {fc.cardsGenerated} cards • {fc.difficulty}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/teacher_page/library/${fc.id}/flashcard`}
                              className="text-sm px-3 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600"
                            >
                              View
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {resourceTab === "summaries" && (
              <>
                {summaries.length === 0 ? (
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-8 text-center">
                    <div className="text-slate-500 dark:text-slate-400">No summaries available</div>
                    <div className="text-sm text-slate-400 dark:text-slate-500 mt-1">Publish summaries from AI Studio to share with your students.</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {summaries.map((sm) => (
                      <div
                        key={sm.id}
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 bg-green-100 dark:bg-green-900/30">
                            <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
                              {sm.title}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {sm.summaryType}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/teacher_page/summaries/${sm.id}?from=class&classId=${clazz._id}`}
                              className="text-sm px-3 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600"
                            >
                              View
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

              {/* Assessments Column with Tabs */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <h2 className="text-lg font-medium">Assessments</h2>
                  </div>
                  <button
                    onClick={() => {
                      setShowCreateModal(true);
                      setModalStep('format');
                    }}
                    className="px-3 py-1 rounded bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] text-white text-sm hover:bg-[#1B5E20] dark:hover:bg-[hsl(142.1,76.2%,30%)]"
                  >
                    Create
                  </button>
                </div>

                {/* Assessment Tabs */}
                <div className="border-b border-slate-200 dark:border-slate-700">
                  <div className="flex gap-6">
                    {["activities", "quizzes", "exams"].map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setAssessmentTab(tab as "activities" | "quizzes" | "exams")}
                        className={`py-3 text-sm font-medium transition-colors capitalize ${assessmentTab === tab
                          ? "text-slate-900 dark:!text-[hsl(142.1,76.2%,36.3%)] border-b-2 border-slate-900 dark:!border-[hsl(142.1,76.2%,36.3%)] -mb-[2px]"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                          }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tab Content */}
                <div className="space-y-3">
                  {assessmentTab === "activities" && (
                    <>
                      {activities.length === 0 ? (
                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-8 text-center">
                          <div className="text-slate-500 dark:text-slate-400">No activities available</div>
                          <div className="text-sm text-slate-400 dark:text-slate-500 mt-1">Create activities for your students.</div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {activities.map((a) => (
                            <div
                              key={a.id}
                              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-sm transition-shadow"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 bg-purple-100 dark:bg-purple-900/30">
                                  <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                  </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
                                    {a.title}
                                  </div>
                                  {a.dueDate && (
                                    <div className="text-xs text-slate-600 dark:text-slate-300">
                                      <span className="font-semibold">Due Date:</span> {new Date(a.dueDate).toLocaleString('en-US', {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Link
                                    href={`${pathBase}/assessments/activity/${a.id}`}
                                    onClick={() => {
                                      sessionStorage.setItem('breadcrumb_tab', activeTab);
                                    }}
                                    className="p-2 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                    title="View"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                  </Link>
                                  <button
                                    onClick={() => deleteAssessment(a.id)}
                                    className="p-2 rounded-md bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-700 transition-colors"
                                    title="Delete"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {assessmentTab === "quizzes" && (
                    <>
                      {quizzes.length === 0 ? (
                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-8 text-center">
                          <div className="text-slate-500 dark:text-slate-400">No quizzes available</div>
                          <div className="text-sm text-slate-400 dark:text-slate-500 mt-1">Create quizzes for your students.</div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {quizzes.map((a) => (
                            <div
                              key={a.id}
                              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-sm transition-shadow"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 bg-blue-100 dark:bg-blue-900/30">
                                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
                                    {a.title}
                                  </div>
                                  {a.dueDate && (
                                    <div className="text-xs text-slate-600 dark:text-slate-300">
                                      <span className="font-semibold">Due Date:</span> {new Date(a.dueDate).toLocaleString('en-US', {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => {
                                      sessionStorage.setItem('breadcrumb_tab', activeTab);
                                      sessionStorage.setItem('class_assessment_tab', assessmentTab);
                                      sessionStorage.setItem('class_origin_id', clazz._id);
                                      router.push(`/teacher_page/quiz/${a.id}`);
                                    }}
                                    className="p-2 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                    title="View"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => deleteAssessment(a.id)}
                                    className="p-2 rounded-md bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-700 transition-colors"
                                    title="Delete"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {assessmentTab === "exams" && (
                    <>
                      {exams.length === 0 ? (
                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-8 text-center">
                          <div className="text-slate-500 dark:text-slate-400">No exams available</div>
                          <div className="text-sm text-slate-400 dark:text-slate-500 mt-1">Create exams for your students.</div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {exams.map((a) => (
                            <div
                              key={a.id}
                              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-sm transition-shadow"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 bg-red-100 dark:bg-red-900/30">
                                  <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
                                    {a.title}
                                  </div>
                                  {a.dueDate && (
                                    <div className="text-xs text-slate-600 dark:text-slate-300">
                                      <span className="font-semibold">Due Date:</span> {new Date(a.dueDate).toLocaleString('en-US', {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => {
                                      sessionStorage.setItem('breadcrumb_tab', activeTab);
                                      sessionStorage.setItem('class_assessment_tab', assessmentTab);
                                      sessionStorage.setItem('class_origin_id', clazz._id);
                                      router.push(`/teacher_page/exam/${a.id}`);
                                    }}
                                    className="p-2 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                    title="View"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => deleteAssessment(a.id)}
                                    className="text-sm px-2 py-1 rounded bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>
        );

      case "classlist":
        return (
          <section className="space-y-6">
            {/* Header with Teacher Card */}
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="lg:w-80 flex-shrink-0">
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 text-center">
                  <div className="w-24 h-24 mx-auto mb-4">
                    <img
                      src="/gc-logo.png"
                      alt="Teacher"
                      className="w-full h-full rounded-full object-cover border-2 border-slate-200 dark:border-slate-600"
                    />
                  </div>
                  <div className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
                    {clazz?.teacher ? getTeacherName(clazz.teacher) : "Teacher"}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                    CCS Department
                  </div>
                  {clazz?.teacher && getTeacherEmail(clazz.teacher) && (
                    <div className="text-sm text-slate-500 dark:text-slate-300 break-all">
                      {getTeacherEmail(clazz.teacher)}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1">
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">
                    Class List ({students.length} students)
                  </h2>

                  {/* Search Bar */}
                  <div className="mb-6">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search students..."
                        value={studentSearchQuery}
                        onChange={(e) => setStudentSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Students Grid */}
                  {students.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                        <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                        </svg>
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 font-medium">
                        {studentSearchQuery ? 'No students found' : 'No students enrolled'}
                      </div>
                      <div className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                        {studentSearchQuery ? 'Try adjusting your search terms' : 'Students will appear here once they join the class'}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {students.map((student) => (
                        <div
                          key={student.id}
                          className="flex items-center gap-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4"
                        >
                          <div className="w-12 h-12 flex-shrink-0">
                            <img
                              src="/gc-logo.png"
                              alt={student.name}
                              className="w-12 h-12 rounded-full object-cover border-2 border-slate-200 dark:border-slate-600"
                            />
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {student.name}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                              {student.email}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {/* Global alert */}
      <Alert
        type={alertState.type}
        message={alertState.message}
        title={alertState.title}
        isVisible={alertState.isVisible}
        onClose={() => setAlertState((s) => ({ ...s, isVisible: false }))}
        autoClose={alertState.autoClose}
        autoCloseDelay={alertState.autoCloseDelay}
        position="top-right"
      />

      <div className="min-h-screen bg-slate-50 dark:bg-slate-900" style={{ padding: '1.5rem' }}>
        <div style={{ maxWidth: '80rem', marginLeft: 'auto', marginRight: 'auto' }}>
          {/* Header Card - matching library page style */}
          <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-8 mb-8 overflow-hidden">
            {/* Decorative Background Elements */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#2E7D32]/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-400/5 rounded-full blur-3xl" />
            
            <div className="relative">
              {loading ? (
                <div className="animate-pulse">
                  <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-64 mb-4"></div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-20"></div>
                    <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-2"></div>
                    <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
                    <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-2"></div>
                    <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-40"></div>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2">
                    {clazz?.name || 'Class Not Found'}
                  </h1>
                  <p className="text-slate-600 dark:text-slate-400 text-lg flex flex-wrap items-center gap-3">
                    {clazz ? (
                      <>
                        <span>{clazz.classCode ?? '—'}</span>
                        <span>•</span>
                        <span>{clazz.courseYear ?? '—'}</span>
                        <span>•</span>
                        <span>Teacher: {getTeacherName(clazz.teacher)}</span>
                      </>
                    ) : (
                      <span>The class you're looking for doesn't exist or has been removed.</span>
                    )}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Tabs - matching library page style */}
          <div className="mb-6 border-b border-slate-200 dark:border-slate-700">
            <div className="flex gap-8">
              {loading ? (
                <div className="flex gap-8 animate-pulse py-3">
                  <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-20"></div>
                  <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-44"></div>
                  <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-20"></div>
                </div>
              ) : (
                [
                  { key: "overview", label: "Overview" },
                  { key: "resourcesassessments", label: "Resources and Assessments" },
                  { key: "classlist", label: "Class List" }
                ].map((t) => (
                  <button
                    key={t.key}
                    onClick={() => clazz && setActiveTab(t.key as typeof activeTab)}
                    disabled={!clazz}
                    className={`py-3 text-sm font-medium transition-colors relative ${
                      activeTab === t.key
                        ? 'text-[#2E7D32] dark:text-[#4CAF50]'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                    } ${!clazz ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {t.label}
                    {activeTab === t.key && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2E7D32] dark:bg-[#4CAF50] rounded-full" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Main Content */}
          <main className="space-y-6">
            {loading ? (
              <div className="space-y-6">
                {/* Skeleton for Create Post Card */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 animate-pulse">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                    <div className="flex-1">
                      <div className="h-20 bg-slate-200 dark:bg-slate-700 rounded-md"></div>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-between">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
                    <div className="h-9 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
                  </div>
                </div>

                {/* Skeleton for Posts Feed */}
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 animate-pulse">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32 mb-2"></div>
                        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-24 mb-4"></div>
                        <div className="space-y-2">
                          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : !clazz ? (
              <div className="text-center py-12">
                <p className="text-slate-500 dark:text-slate-400">Unable to load class content.</p>
              </div>
            ) : (
              renderTabContent()
            )}
          </main>
        </div>
      </div>

      {/* Comments Modal */}
      {commentsModalPost && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          aria-modal="true"
          role="dialog"
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setCommentsModalPost(null)}
          />
          <div className="relative w-full sm:max-w-lg max-h-[80vh] sm:rounded-lg rounded-t-lg bg-white dark:bg-slate-800 shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Comments</h3>
              <button
                onClick={() => setCommentsModalPost(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>
            <div className="px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex gap-3 items-start">
                <Avatar name={commentsModalPost.authorName || 'Unknown'} />
                <div className="flex-1 text-sm text-slate-700 dark:text-slate-300">{commentsModalPost.body}</div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {(!commentsModalPost.comments || commentsModalPost.comments.length === 0) && (
                <div className="text-center text-slate-500 dark:text-slate-400 text-sm">No comments yet</div>
              )}
              {commentsModalPost.comments?.map((comment) => (
                <div key={comment.id} className="flex gap-3 items-start">
                  <Avatar name={comment.author || 'Unknown'} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-slate-900 dark:text-slate-100">{comment.author || 'Unknown'}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{comment.timestamp ? new Date(comment.timestamp).toLocaleString() : ''}</span>
                    </div>
                    <div className="text-sm text-slate-700 dark:text-slate-300">{comment.text || ''}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700">
              <div className="flex gap-3">
                <Avatar name={clazz ? getTeacherName(clazz.teacher) : ''} />
                <div className="flex-1">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={commentInputs[commentsModalPost.id] || ""}
                      onChange={(e) =>
                        setCommentInputs(prev => ({ ...prev, [commentsModalPost.id]: e.target.value }))
                      }
                      placeholder="Write a comment..."
                      className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                      onKeyDown={async (e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          const commentText = commentInputs[commentsModalPost.id]?.trim();
                          if (!commentText) return;

                          try {
                            const response = await fetch(`/api/teacher_page/class/${clazz?._id}/posts/${commentsModalPost.id}/comments`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                              },
                              body: JSON.stringify({
                                text: commentText
                              })
                            });

                            const result = await response.json();

                            if (result.success) {
                              // Validate and sanitize the comment data
                              const newComment = {
                                id: result.data.comment.id || `comment_${Date.now()}_${Math.random()}`,
                                author: result.data.comment.author || (clazz ? getTeacherName(clazz.teacher) : 'Teacher'),
                                timestamp: result.data.comment.timestamp || new Date().toISOString(),
                                text: result.data.comment.text || commentText,
                              };

                              // Update the posts state with the new comment
                              setPosts(prevPosts =>
                                prevPosts.map(post =>
                                  post.id === commentsModalPost.id
                                    ? {
                                      ...post,
                                      comments: [...(post.comments || []), newComment],
                                      commentsCount: (post.commentsCount || 0) + 1
                                    }
                                    : post
                                )
                              );

                              // Update the modal post
                              setCommentsModalPost(prev => prev ? {
                                ...prev,
                                comments: [...(prev.comments || []), newComment],
                                commentsCount: (prev.commentsCount || 0) + 1
                              } : null);

                              // Clear input
                              setCommentInputs(prev => ({ ...prev, [commentsModalPost.id]: "" }));

                              showAlert({ type: 'success', message: 'Comment posted successfully' });

                              // Mark recent activity for increased polling frequency
                              setLastActivity(new Date());
                            } else {
                              showAlert({ type: 'error', message: result.error || 'Failed to post comment' });
                            }
                          } catch (error) {
                            console.error('Error posting comment:', error);
                            showAlert({ type: 'error', message: 'Failed to post comment' });
                          }
                        }
                      }}
                    />
                    <button
                      onClick={async () => {
                        const commentText = commentInputs[commentsModalPost.id]?.trim();
                        if (!commentText) return;

                        try {
                          const response = await fetch(`/api/teacher_page/class/${clazz?._id}/posts/${commentsModalPost.id}/comments`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                            },
                            body: JSON.stringify({
                              text: commentText
                            })
                          });

                          const result = await response.json();

                          if (result.success) {
                            // Update the posts state with the new comment
                            setPosts(prevPosts =>
                              prevPosts.map(post =>
                                post.id === commentsModalPost.id
                                  ? {
                                    ...post,
                                    comments: [...(post.comments || []), result.data.comment],
                                    commentsCount: (post.commentsCount || 0) + 1
                                  }
                                  : post
                              )
                            );

                            // Update the modal post
                            setCommentsModalPost(prev => prev ? {
                              ...prev,
                              comments: [...(prev.comments || []), result.data.comment],
                              commentsCount: (prev.commentsCount || 0) + 1
                            } : null);

                            // Clear input
                            setCommentInputs(prev => ({ ...prev, [commentsModalPost.id]: "" }));

                            showAlert({ type: 'success', message: 'Comment posted successfully' });

                            // Mark recent activity for increased polling frequency
                            setLastActivity(new Date());
                          } else {
                            showAlert({ type: 'error', message: result.error || 'Failed to post comment' });
                          }
                        } catch (error) {
                          console.error('Error posting comment:', error);
                          showAlert({ type: 'error', message: 'Failed to post comment' });
                        }
                      }}
                      className="px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      Post
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Assessment Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => {
            setShowCreateModal(false);
            setModalStep('format');
          }} />
          <div role="dialog" aria-modal="true" aria-labelledby="create-modal-title" className="relative max-w-lg w-full bg-white dark:bg-slate-900 rounded-lg p-6 z-10 shadow-lg">

            {/* STEP 1: Format Selection */}
            {modalStep === 'format' && (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 id="create-modal-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">Choose Assessment Format</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Select how students will submit their work.</p>
                  </div>
                  <div>
                    <button onClick={() => {
                      setShowCreateModal(false);
                      setModalStep('format');
                    }} aria-label="Close create modal" className="px-3 py-1 rounded bg-slate-100 dark:bg-slate-800 text-sm">Close</button>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="grid grid-cols-1 gap-4">
                    <button
                      onClick={() => {
                        setAssessmentFormat('online');
                        router.push(`/teacher_page/ai-studio?classId=${clazz?._id}`);
                        setShowCreateModal(false);
                        setModalStep('format');
                      }}
                      className="px-6 py-8 rounded-lg border-2 text-center transition-all bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    >
                      <div className="text-4xl mb-3">💻</div>
                      <div className="font-semibold text-lg mb-1">Online Assessment</div>
                      <div className="text-sm opacity-75">Students answer questions online</div>
                      <div className="text-xs text-blue-600 dark:text-blue-400 mt-2">→ Goes to AI Studio</div>
                    </button>
                    <button
                      onClick={() => {
                        setAssessmentFormat('file_submission');
                        // Ensure createType is set to activity so routing and category resolve correctly
                        setCreateType('activity');
                        setAssessmentDraft(d => ({ ...d, category: 'Activity' }));
                        setModalStep('details');
                      }}
                      className="px-6 py-8 rounded-lg border-2 text-center transition-all bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                    >
                      <div className="text-4xl mb-3">📤</div>
                      <div className="font-semibold text-lg mb-1">File Submission</div>
                      <div className="text-sm opacity-75">Students upload files as answers</div>
                      <div className="text-xs text-purple-600 dark:text-purple-400 mt-2">→ Fill in details next</div>
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* STEP 2: Details Form (for File Submission) */}
            {modalStep === 'details' && (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 id="create-modal-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">File Submission Details</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Fill in the assignment information.</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setModalStep('format')} className="px-3 py-1 rounded bg-slate-100 dark:bg-slate-800 text-sm">← Back</button>
                    <button onClick={() => {
                      setShowCreateModal(false);
                      setModalStep('format');
                    }} aria-label="Close create modal" className="px-3 py-1 rounded bg-slate-100 dark:bg-slate-800 text-sm">Close</button>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="space-y-3">
                    <div>
                      <input
                        placeholder="Title"
                        value={assessmentDraft.title}
                        onChange={(e) => setAssessmentDraft((d) => ({ ...d, title: e.target.value }))}
                        onBlur={(e) => {
                          const v = (e.target as HTMLInputElement).value.trim();
                          const err = validateTitle(v);
                          setTitleError(err);
                        }}
                        className="w-full px-3 py-2 rounded border dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                      />
                      {titleError && <div className="text-xs text-red-600 mt-1">{titleError}</div>}
                    </div>

                    <div className="flex gap-2">
                      <label className="flex-1">
                        <div className="text-xs text-slate-500 mb-1">Due date</div>
                        <input
                          type="date"
                          value={dueDateDate ?? ""}
                          onChange={handleDateChange}
                          min={new Date().toISOString().split('T')[0]}
                          className={`w-full px-3 py-2 rounded border text-sm ${dueDateError
                            ? 'border-red-500 bg-red-50 dark:bg-red-900/20 dark:border-red-500'
                            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
                            }`}
                        />
                        {dueDateError && <div className="text-xs text-red-600 mt-1">{dueDateError}</div>}
                      </label>
                      <label className="w-40">
                        <div className="text-xs text-slate-500 mb-1">Due time</div>
                        <input
                          type="time"
                          value={dueDateTime ?? ""}
                          onChange={handleTimeChange}
                          className={`w-full px-3 py-2 rounded border text-sm ${dueTimeError
                            ? 'border-red-500 bg-red-50 dark:bg-red-900/20 dark:border-red-500'
                            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
                            }`}
                        />
                        {dueTimeError && <div className="text-xs text-red-600 mt-1">{dueTimeError}</div>}
                      </label>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500 mb-1">Instruction</div>
                      <textarea value={assessmentDraft.description} onChange={(e) => setAssessmentDraft((d) => ({ ...d, description: e.target.value }))} className="w-full px-3 py-2 rounded border dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" rows={3} />
                    </div>

                    <div className="mt-2">
                      <label className="block text-xs text-slate-500 mb-1">Total points</label>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={pointsInput ?? assessmentDraft.totalPoints ?? 0}
                        onChange={(e) => {
                          const v = parseInt(e.target.value || '0', 10);
                          setPointsInput(isNaN(v) ? null : v);
                          setAssessmentDraft(d => ({ ...d, totalPoints: isNaN(v) ? undefined : v }));
                        }}
                        className="w-40 px-3 py-2 rounded border text-sm border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                      <div className="text-xs text-slate-400 mt-1">Set how many total points this activity is worth.</div>
                    </div>

                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs text-slate-500">Attachments</div>
                        <button
                          type="button"
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.multiple = false;
                            input.accept = '*/*';
                            input.onchange = (e) => {
                              const target = e.target as HTMLInputElement;
                              const file = target.files?.[0] ?? null;
                              setAttachmentError(null);
                              if (!file) {
                                setNewAttachmentFile(null);
                                return;
                              }
                              const err = validateAttachment(file);
                              if (err) {
                                setNewAttachmentFile(null);
                                setAttachmentError(err);
                                return;
                              }
                              setNewAttachmentFile(file);
                            };
                            input.click();
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Add File
                        </button>
                      </div>

                      {/* Display attached file */}
                      {newAttachmentFile && !attachmentError && (
                        <div className="p-3 bg-slate-50 dark:bg-slate-700 rounded-md border border-slate-200 dark:border-slate-600">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">{newAttachmentFile.name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">({Math.round(newAttachmentFile.size / 1024)} KB)</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setNewAttachmentFile(null)}
                              className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-xs font-medium transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Error display */}
                      {attachmentError && <div className="text-xs text-red-600 mt-1">{attachmentError}</div>}

                      {/* Empty state */}
                      {!newAttachmentFile && !attachmentError && (
                        <div className="text-xs text-slate-500 py-2 text-center border border-dashed border-slate-300 dark:border-slate-600 rounded-md">
                          No attachments selected
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => createFromModal()}
                        className="flex-1 px-4 py-2 rounded-lg bg-green-600 text-white text-center font-medium hover:bg-green-700 transition"
                      >
                        Create Activity
                      </button>
                      <button onClick={() => {
                        setShowCreateModal(false);
                        setModalStep('format');
                      }} className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-sm">Cancel</button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
