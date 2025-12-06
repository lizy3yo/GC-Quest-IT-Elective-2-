"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { studentApi, type StudentClassDetails, type CommentMeta, type StudentActivity, type StudentAssessment } from '@/lib/api/student';
import { classApi as teacherClassApi } from '@/lib/api/teacher';
import Alert from "@/components/molecules/alert_template/alert_template/Alert";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/contexts/ToastContext";
import { Eye, Download } from "lucide-react";
import Link from "next/link";

/* ----- Types & small helpers ----- */
type Choice = { id: string; text: string };
type Question = {
  id: string;
  prompt: string;
  choices: Choice[];
  correctId: string;
  timeLimitSeconds?: number;
};

interface AssessmentStudyMaterial {
  id: string;
  type: string;
  title: string;
  link?: string;
}

interface Assessment {
  id: string;
  title: string;
  type: "Quiz" | "Exam" | "Activity";
  format?: "online" | "file_submission";
  dueDate: string;
  points?: number;
  reminder?: string;
  studyMaterials?: AssessmentStudyMaterial[];
  questions?: Question[];
  category: "Quiz" | "Exam" | "Activity";
}

interface AttachmentMeta {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
}

interface FeedPost {
  id: string;
  author: string;
  timestamp: string;
  content: string;
  link?: string;
  attachments?: AttachmentMeta[];
  comments?: CommentMeta[];
}

type SubmissionStatus = "submitted" | "late" | "missing";

interface Activity {
  id: string;
  title: string;
  dueDate: string;
  points: number;
  submittedAt?: string;
  status: SubmissionStatus;
  description?: string;
}

interface ResourceItem {
  id: string;
  title: string;
  type: string;
  description?: string;
  url: string;
  mimeType?: string;
  sizeKB?: number;
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

// Remove local ClassDetails interface - using StudentClassDetails from API instead

interface Student {
  id: string;
  name: string;
  avatar?: string;
  email?: string;
}

function Avatar({ name }: { name: string | null | undefined }) {
  const safeName = name || "User";
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

function formatTime(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
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

function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="w-full rounded-lg border border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 py-10 text-center">
      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</div>
      {description && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
    </div>
  );
}

// QuestionPlayer component removed - assessments now handled by dedicated assessment pages

// LiveHost component removed - assessments now handled by dedicated assessment pages

/* -------------------- Main Page -------------------- */

export default function StudentClassPage({ params }: { params: Promise<{ studentclassId: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth(); // Get current user info
  const { showSuccess, showError, showWarning, showInfo } = useToast(); // Toast notifications
  const [classDetails, setClassDetails] = useState<StudentClassDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize activeTab based on URL parameter
  const tabParam = searchParams.get('tab');
  const initialTab = tabParam === 'resources' ? 'Resources and Assessments' : 'Overview';
  const [activeTab, setActiveTab] = useState(initialTab);
  // Unwrap promise-based params using React.use (Next.js 15/React 19)
  // Fallback to null if not available (keeps type safety and avoids warnings)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unwrappedParams = (React as any).use ? (React as any).use(params) : null;
  const studentclassId: string | null = unwrappedParams?.studentclassId ?? null;


  // Alert state for user feedback
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

  // New state: creating posts & comments
  const [newPostText, setNewPostText] = useState("");
  const [newPostFiles, setNewPostFiles] = useState<File[]>([]);
  const [submittingPost, setSubmittingPost] = useState(false);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [commentsModalPost, setCommentsModalPost] = useState<FeedPost | null>(null);
  // Get current user's full name for author comparison
  const currentUserName = user ? `${user.firstName} ${user.lastName}` : null;

  // Edit post state
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editPostText, setEditPostText] = useState("");
  const [savingPostId, setSavingPostId] = useState<string | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);

  // Real-time sync state
  const [isTabActive, setIsTabActive] = useState(true);
  const [lastActivity, setLastActivity] = useState<Date>(new Date());
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  // Avoid awaiting or setting state from params to prevent render loops; use React.use above.

  // Define fetchPosts first before using it in useEffect
  const fetchPosts = useCallback(async (classData?: any, silent = false) => {
    if (!studentclassId) return;
    
    try {
      const postsResponse = await fetch(`/api/student_page/class/${studentclassId}/posts`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      const postsResult = await postsResponse.json();

      if (postsResult.success && postsResult.data) {
        // Update class details with posts, but only if data actually changed
        setClassDetails((cd) => {
          if (!cd) return cd;

          const newPosts = postsResult.data.posts || [];
          const currentPosts = cd.feed || [];

          // Simple comparison to avoid unnecessary re-renders
          if (!silent && JSON.stringify(newPosts) === JSON.stringify(currentPosts)) {
            return cd; // No changes, don't update
          }

          // Update last sync time when data actually changes
          if (silent) {
            setLastSyncTime(new Date());
          }

          return {
            ...cd,
            feed: newPosts
          };
        });
      }
    } catch (error) {
      if (!silent) {
        console.error('Error fetching posts:', error);
      }
      // Don't set error state for posts - just log it
    }
  }, [studentclassId]);

  const fetchClassDetails = useCallback(async () => {
    if (!studentclassId) return;

    setLoading(true);
    setError(null);

    try {
      console.log('[Student Class Page] Fetching class details for classId:', studentclassId);
      const response = await studentApi.getClassDetails(studentclassId, true);

      console.log('[Student Class Page] API Response:', {
        success: response.success,
        hasData: !!response.data,
        assessmentsCount: response.data?.class?.assessments?.length || 0
      });

      if (response.success && response.data) {
        console.log('[Student Class Page] Assessments received:', response.data.class.assessments);
        setClassDetails(response.data.class);

        // Also fetch posts separately
        await fetchPosts(response.data.class);
      } else {
        setError(response.error || 'Failed to load class details');
      }
    } catch (err) {
      console.error('Error fetching class details:', err);
      setError('Failed to load class details');
    } finally {
      setLoading(false);
    }
  }, [studentclassId, fetchPosts]);

  const fetchFlashcards = useCallback(async () => {
    if (!studentclassId) return;

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/student_page/class/${studentclassId}/flashcards`, {
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
  }, [studentclassId]);

  const fetchSummaries = useCallback(async () => {
    if (!studentclassId) return;

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`/api/student_page/class/${studentclassId}/summaries`, {
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
  }, [studentclassId]);

  useEffect(() => {
    if (!studentclassId) return;
    fetchClassDetails();
    fetchFlashcards();
    fetchSummaries();
  }, [studentclassId, fetchClassDetails, fetchFlashcards, fetchSummaries]);

  // Tab visibility and real-time sync setup
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabActive(!document.hidden);
      if (!document.hidden) {
        // Tab became active - fetch fresh data immediately
        setLastActivity(new Date());
        if (studentclassId) {
          fetchPosts();
        }
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
  }, [fetchPosts, studentclassId]);

  // Real-time polling system
  useEffect(() => {
    if (!studentclassId || !isTabActive) {
      return;
    }

    // Determine polling frequency based on recent activity
    const timeSinceActivity = Date.now() - lastActivity.getTime();
    const isRecentActivity = timeSinceActivity < 2 * 60 * 1000; // 2 minutes
    const pollFrequency = isRecentActivity ? 3000 : 10000; // 3s if recent activity, 10s otherwise

    const interval = setInterval(async () => {
      if (!document.hidden && studentclassId) {
        try {
          // Silently fetch fresh data without showing loading states
          await fetchPosts(undefined, true);
        } catch (error) {
          console.log('Background polling error:', error);
          // Don't show error alerts for background polling
        }
      }
    }, pollFrequency);

    setPollingInterval(interval);

    return () => {
      clearInterval(interval);
      setPollingInterval(null);
    };
  }, [studentclassId, isTabActive, lastActivity, fetchPosts]);

  // Helper functions for post editing and deletion
  const startEditPost = (post: FeedPost) => {
    setEditingPostId(post.id);
    setEditPostText(post.content);
  };

  const saveEditPost = async (id: string) => {
    if (!classDetails) return;
    if (savingPostId) return; // Prevent multiple clicks
    if (!editPostText.trim()) {
      showAlert({ type: 'warning', message: 'Post content cannot be empty.' });
      return;
    }

    setSavingPostId(id);
    try {
      const response = await fetch(`/api/student_page/class/${classDetails._id}/posts/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          content: editPostText.trim()
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to update post');
      }

      // Update local state only after successful server response
      setClassDetails((cd) => {
        if (!cd) return cd;
        return {
          ...cd,
          feed: (cd.feed || []).map((post) =>
            post.id === id ? { ...post, content: editPostText.trim() } : post
          )
        };
      });

      setEditingPostId(null);
      setEditPostText("");

      showAlert({ type: 'success', message: 'Post updated successfully!' });

      // Mark recent activity for increased polling frequency
      setLastActivity(new Date());

      // Also refresh posts to ensure feed is completely up to date
      await fetchPosts();

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
    setEditPostText("");
  };

  const deletePost = async (id: string) => {
    if (!classDetails) return;
    if (deletingPostId) return; // Prevent multiple clicks
    if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) return;

    setDeletingPostId(id);
    try {
      const response = await fetch(`/api/student_page/class/${classDetails._id}/posts/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete post');
      }

      // Update local state only after successful server response
      setClassDetails((cd) => {
        if (!cd) return cd;
        return {
          ...cd,
          feed: (cd.feed || []).filter((post) => post.id !== id)
        };
      });

      if (editingPostId === id) {
        setEditingPostId(null);
        setEditPostText("");
      }

      showAlert({ type: 'success', message: 'Post deleted successfully!' });

      // Mark recent activity for increased polling frequency
      setLastActivity(new Date());

      // Also refresh posts to ensure feed is completely up to date
      await fetchPosts();

    } catch (error) {
      console.error('Error deleting post:', error);
      showAlert({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete post. Please try again.'
      });
    } finally {
      setDeletingPostId(null);
    }
  };





  // Removed selectedAssessment and assessmentMode state as we now navigate directly to assessment pages

  // State to store assessment submissions
  const [assessmentSubmissions, setAssessmentSubmissions] = useState<Record<string, unknown>>({});

  // Filter assessments to ensure they are proper assessments and not activities
  const assessments = useMemo(() => {
    const allAssessments = classDetails?.assessments || [];

    // Filter to only include items that look like genuine assessments
    const filtered = allAssessments.filter((item: any) => {
      // Must have category field (assessments have this, activities don't)
      if (!('category' in item)) return false;

      // Must be one of the valid assessment categories
      if (!['Quiz', 'Exam', 'Activity'].includes(item.category)) return false;

      // Should NOT have activity-specific status field
      if ('status' in item) return false;

      // Should have required assessment fields (dueDate is optional)
      if (!item.id || !item.title) return false;

      return true;
    });

    // Enrich assessments with submission data
    return filtered.map((assessment: any) => {
      const submission = assessmentSubmissions[assessment.id];
      if (submission) {
        return { ...assessment, submission };
      }
      return assessment;
    });
  }, [classDetails?.assessments, assessmentSubmissions]);

  // Fetch submission status for all assessments
  useEffect(() => {
    const fetchSubmissions = async () => {
      if (!studentclassId || !classDetails?.assessments) return;

      try {
        const submissions: Record<string, unknown> = {};
        
        for (const assessment of classDetails.assessments) {
          if (!assessment.id) continue;

          try {
            // Fetch submission for this assessment
            const response = await fetch(`/api/student_page/class/${studentclassId}/assessment/${assessment.id}/submission`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
              }
            });

            if (response.ok) {
              const data = await response.json();
              if (data.success && data.data?.submission) {
                submissions[assessment.id] = data.data.submission;
              }
            }
          } catch (error) {
            console.log(`Failed to fetch submission for assessment ${assessment.id}:`, error);
          }
        }

        setAssessmentSubmissions(submissions);
      } catch (error) {
        console.error('Error fetching assessment submissions:', error);
      }
    };

    fetchSubmissions();
  }, [studentclassId, classDetails?.assessments]);
  // students state (populated from classDetails when fetched)
  const [students, setStudents] = useState<Student[]>([]);
  const instructor = useMemo(() => classDetails?.instructor, [classDetails?.instructor]);

  // Normalized instructor display helpers (tolerant to different shapes)
  const getInstructorName = (instr: any) => {
    if (!instr) return '';
    if (instr.name) return instr.name;
    if (instr.fullName) return instr.fullName;
    if (instr.firstName || instr.lastName) return `${instr.firstName || ''} ${instr.lastName || ''}`.trim();
    if (instr._id && typeof instr === 'string') return instr;
    return '';
  };

  const getInstructorEmail = (instr: any) => {
    if (!instr) return '';
    return instr.email || instr.emailAddress || instr.contact || '';
  };

  // -------------------- Work & Resources state & derived data --------------------
  const [workFilter, setWorkFilter] = useState<
    | "all"
    | "submitted"
    | "late"
    | "missing"
    | "pending"
    | "resources"
  >("all");
  const [sortKey, setSortKey] = useState<"due" | "points">("due");
  const [resourcePreview, setResourcePreview] = useState<ResourceItem | null>(null);
  const [workResourcesTab, setWorkResourcesTab] = useState<"activities" | "quiz" | "exam">("activities");
  // Resource tab state for Files, Flashcards, and Summaries
  const [resourceTab, setResourceTab] = useState<"files" | "flashcards" | "summaries">("files");
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  // -------------------- Class List pagination state --------------------
  const [studentPage, setStudentPage] = useState(1);
  const [pageSize, setPageSize] = useState(16);
  const [studentSearchQuery, setStudentSearchQuery] = useState("");

  // When we receive class details, normalize and populate students list to show in Class List tab
  useEffect(() => {
    if (!classDetails) return;

    try {
      const apiStudents = classDetails.students || [];
      const mapped = apiStudents.map((s: any) => ({
        id: s.id || s._id || s.studentId || s.userId || s.uid || String(Date.now()) + Math.random(),
        name: s.name || formatStudentName(s) || s.fullName || `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Unknown',
        email: s.email || s.emailAddress || s.studentEmail || undefined,
        avatar: s.avatar || '/gc-logo.png'
      } as Student));

      const sorted = sortStudentsAlpha(mapped);

      // Apply current studentSearchQuery filter
      const filtered = sorted.filter((student) =>
        student.name.toLowerCase().includes(studentSearchQuery.toLowerCase()) ||
        (student.email ?? '').toLowerCase().includes(studentSearchQuery.toLowerCase())
      );

      setStudents(filtered);

      // NOTE: we intentionally do not call the teacher-only endpoint from student UI
      // because it requires a teacher token and will return 403. Server-side student
      // endpoint (/api/student_page/class/[id]) should return student names/emails
      // for enrolled students; we'll enrich that endpoint server-side if necessary.
    } catch (e) {
      console.warn('Failed to normalize students from classDetails', e);
    }
  }, [classDetails, studentSearchQuery]);

  // Filter students based on search query
  const filteredStudents = useMemo(() => {
    if (!studentSearchQuery.trim()) return students;
    const query = studentSearchQuery.toLowerCase();
    return students.filter(student =>
      student.name.toLowerCase().includes(query) ||
      student.email?.toLowerCase().includes(query)
    );
  }, [students, studentSearchQuery]);

  const totalStudentPages = useMemo(() => Math.max(1, Math.ceil(filteredStudents.length / pageSize)), [filteredStudents, pageSize]);
  const paginatedStudents = useMemo(() => {
    const start = (studentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, studentPage, pageSize]);
  const studentRangeStart = (studentPage - 1) * pageSize + 1;
  const studentRangeEnd = Math.min(studentPage * pageSize, filteredStudents.length);

  function statusMeta(status: SubmissionStatus) {
    switch (status) {
      case "submitted":
        return { label: "Submitted", color: "bg-[#1C2B1C]/10 text-[#1C2B1C] dark:bg-[#1C2B1C]/30 dark:text-[#1C2B1C]", icon: "✅" };
      case "late":
        return { label: "Late", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", icon: "⏰" };
      case "missing":
      default:
        return { label: "No Submission", color: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300", icon: "❌" };
    }
  }

  const downloadResource = async (r: ResourceItem) => {
    if (!classDetails) return;

    console.log('Downloading resource:', {
      resourceId: r.id,
      fileName: r.title,
      classId: classDetails._id,
      resourceUrl: r.url
    });

    try {
      // Use the secure download endpoint
      const downloadUrl = `/api/student_page/class/${classDetails._id}/resources/${r.id}/download`;
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
            a.download = r.title;
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

      // Ensure proper filename with extension
      let filename = r.title;
      if (!filename.includes('.') && r.mimeType) {
        // If no extension, try to add one based on MIME type
        const mimeToExt: Record<string, string> = {
          'application/pdf': '.pdf',
          'application/msword': '.doc',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
          'application/vnd.ms-excel': '.xls',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
          'application/vnd.ms-powerpoint': '.ppt',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
          'text/plain': '.txt',
          'text/csv': '.csv',
          'image/jpeg': '.jpg',
          'image/png': '.png',
          'image/gif': '.gif',
        };

        const extension = mimeToExt[r.mimeType];
        if (extension) {
          filename += extension;
        }
      }

      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      console.log('Download completed successfully');
      showAlert({ type: 'success', message: 'File downloaded successfully', autoClose: true, autoCloseDelay: 3000 });
    } catch (error) {
      console.error('Download error:', error);
      showAlert({ type: 'error', message: `Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  };

  // Navigate to the appropriate page based on assessment format
  const navigateToActivity = (activityId: string) => {
    if (!studentclassId) {
      showAlert({ type: 'error', message: 'Class ID not available' });
      return;
    }

    // Clear breadcrumb context when navigating from class page (not from to-do list)
    // But store the active tab so we can return to it
    sessionStorage.removeItem('breadcrumb_context');
    sessionStorage.setItem('breadcrumb_tab', activeTab);

    // Find the assessment to determine its format
    const assessment = assessments.find((a: any) => a.id === activityId);

    try {
      if (assessment) {
        // Check submission status to determine routing
        const submission = assessment.submission || assessment.submissionInfo || assessment.studentSubmission || assessment.latestSubmission || null;
        const isSubmitted = submission && (
          submission.submittedAt || 
          submission.submitted === true || 
          submission.status === 'submitted' ||
          submission.status === 'graded'
        );
        const isGraded = submission && (
          submission.score !== undefined && submission.score !== null ||
          submission.grade !== undefined && submission.grade !== null
        );

        // If submitted and graded, route to results page
        if (isSubmitted && isGraded) {
          router.push(`/student_page/student_class/${studentclassId}/assessment/${activityId}/results`);
          return;
        }

        // If only submitted (not graded), route to assessment details page
        if (isSubmitted && !isGraded) {
          router.push(`/student_page/student_class/${studentclassId}/assessment/${activityId}`);
          return;
        }

        // Check if it's a Quiz or Exam with live/deadline routing
        if (assessment.category === 'Quiz' || assessment.category === 'Exam') {
          const now = new Date();
          
          // Check if it's a live session based on liveSession.isActive
          if (assessment.liveSession?.isActive) {
            // LIVE SESSION
            const liveDate = assessment.scheduledOpen ? new Date(assessment.scheduledOpen) : null;
            const deadline = assessment.scheduledClose ? new Date(assessment.scheduledClose) : null;
            
            // Check if not yet live
            if (liveDate && now < liveDate) {
              showAlert({ 
                type: 'warning', 
                message: `This ${assessment.category.toLowerCase()} is not yet available. It will open on ${liveDate.toLocaleString()}.`,
                title: 'Not Yet Available'
              });
              return;
            }

            // Check if past deadline
            if (deadline && now > deadline) {
              showAlert({ 
                type: 'warning', 
                message: `This ${assessment.category.toLowerCase()} has closed. The deadline was ${deadline.toLocaleString()}.`,
                title: 'Closed'
              });
              return;
            }

            // Route to live page
            if (assessment.category === 'Quiz') {
              router.push(`/student_page/student_class/${studentclassId}/quiz/live/${activityId}`);
            } else {
              router.push(`/student_page/student_class/${studentclassId}/exam/live/${activityId}`);
            }
          } else {
            // DEADLINE-BASED
            const deadline = assessment.scheduledClose ? new Date(assessment.scheduledClose) : null;
            
            // Check if past deadline
            if (deadline && now > deadline) {
              showAlert({ 
                type: 'warning', 
                message: `This ${assessment.category.toLowerCase()} has closed. The deadline was ${deadline.toLocaleString()}.`,
                title: 'Closed'
              });
              return;
            }

            // Route to regular assessment page
            if (assessment.category === 'Quiz') {
              router.push(`/student_page/student_class/${studentclassId}/quiz/${activityId}`);
            } else {
              router.push(`/student_page/student_class/${studentclassId}/exam/${activityId}`);
            }
          }
        } else if (assessment.format === 'online') {
          // Navigate to online assessment page for other types
          router.push(`/student_page/student_class/${studentclassId}/assessment/${activityId}`);
        } else {
          // Navigate to file submission activity page
          router.push(`/student_page/student_class/${studentclassId}/activity/${activityId}`);
        }
      } else {
        // Fallback to activity page if assessment not found
        router.push(`/student_page/student_class/${studentclassId}/activity/${activityId}`);
      }
    } catch (e) {
      // Fallback to full navigation
      if (assessment) {
        // Check submission status for fallback routing
        const submission = assessment.submission || assessment.submissionInfo || assessment.studentSubmission || assessment.latestSubmission || null;
        const isSubmitted = submission && (
          submission.submittedAt || 
          submission.submitted === true || 
          submission.status === 'submitted' ||
          submission.status === 'graded'
        );
        const isGraded = submission && (
          submission.score !== undefined && submission.score !== null ||
          submission.grade !== undefined && submission.grade !== null
        );

        // If submitted and graded, route to results page
        if (isSubmitted && isGraded) {
          window.location.href = `/student_page/student_class/${studentclassId}/assessment/${activityId}/results`;
          return;
        }

        // If only submitted (not graded), route to assessment details page
        if (isSubmitted && !isGraded) {
          window.location.href = `/student_page/student_class/${studentclassId}/assessment/${activityId}`;
          return;
        }

        if (assessment.category === 'Quiz' || assessment.category === 'Exam') {
          const now = new Date();
          
          // Check if it's a live session based on liveSession.isActive
          if (assessment.liveSession?.isActive) {
            // LIVE SESSION
            const liveDate = assessment.scheduledOpen ? new Date(assessment.scheduledOpen) : null;
            const deadline = assessment.scheduledClose ? new Date(assessment.scheduledClose) : null;
            
            // Check if not yet live or past deadline
            if ((liveDate && now < liveDate) || (deadline && now > deadline)) {
              return; // Don't navigate
            }

            // Route to live page
            if (assessment.category === 'Quiz') {
              window.location.href = `/student_page/student_class/${studentclassId}/quiz/live/${activityId}`;
            } else {
              window.location.href = `/student_page/student_class/${studentclassId}/exam/live/${activityId}`;
            }
          } else {
            // DEADLINE-BASED
            const deadline = assessment.scheduledClose ? new Date(assessment.scheduledClose) : null;
            
            // Check if past deadline
            if (deadline && now > deadline) {
              return; // Don't navigate
            }

            // Route to regular assessment page
            if (assessment.category === 'Quiz') {
              window.location.href = `/student_page/student_class/${studentclassId}/quiz/${activityId}`;
            } else {
              window.location.href = `/student_page/student_class/${studentclassId}/exam/${activityId}`;
            }
          }
        } else if (assessment.format === 'online') {
          window.location.href = `/student_page/student_class/${studentclassId}/assessment/${activityId}`;
        } else {
          window.location.href = `/student_page/student_class/${studentclassId}/activity/${activityId}`;
        }
      } else {
        window.location.href = `/student_page/student_class/${studentclassId}/activity/${activityId}`;
      }
    }
  };

  // Try to open a resource as an activity if it maps to an assessment/activity id or title;
  // otherwise open the preview modal.
  const openResourceOrNavigate = (res: ResourceItem) => {
    if (!res) return;

    // Try to find a matching assessment by id or title
    const byId = assessments.find((a: any) => a.id === res.id) || (classDetails?.activities || []).find((a: any) => a.id === res.id);
    if (byId) {
      navigateToActivity(byId.id);
      return;
    }

    const byTitle = assessments.find((a: any) => a.title === res.title) || (classDetails?.activities || []).find((a: any) => a.title === res.title);
    if (byTitle) {
      navigateToActivity(byTitle.id);
      return;
    }

    // No matching activity found - fallback to previewing the resource
    setResourcePreview(res);
  };

  // Following the same pattern as teacher side - all activities, quizzes, and exams come from assessments array
  const activitiesSorted = useMemo(() => {
    // Filter assessments that have category "Activity" (same as teacher side)
    const activityAssessments = assessments.filter((item: any) => item.category === "Activity");

    // Sort the filtered activities
    activityAssessments.sort((a, b) => {
      if (sortKey === "due") return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      return (b.points || 0) - (a.points || 0);
    });

    return activityAssessments;
  }, [assessments, sortKey]);

  // Filter for actual activities only (not assessments) - simplified for assessment-based activities
  const filteredActivities = activitiesSorted.filter((a) => {
    if (workFilter === "all") return true;
    if (workFilter === "resources") return false;
    // For now, disable status-based filtering since assessments don't have status
    // TODO: Add submission status lookup for assessment-based activities
    if (workFilter === "pending") return true; // Show all for now
    return true; // Show all for now
  });

  // Show resources regardless of the current workFilter so resources are always available
  // in the Work & Resources tab and across all filters (all, pending, submitted, late, missing, resources).
  const filteredResources = classDetails?.resources || [];

  // Helper to render submission status with proper differentiation
  const getSubmissionStatus = (item: any) => {
    if (!item) return { type: 'not-submitted', label: 'Not Submitted', color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' };

    // Possible submission locations used across the app/server
    const maybeSubmissionCandidates = [
      item.submission,
      item.submissionInfo,
      item.studentSubmission,
      item.latestSubmission,
      (item.submissions && item.submissions[0]) || null,
      item.submission?.latest || null,
      null
    ];

    let submission: any = null;
    for (const cand of maybeSubmissionCandidates) {
      if (cand && typeof cand === 'object') {
        submission = cand;
        break;
      }
    }

    // If no explicit submission object, try to detect shallow fields on the item itself
    if (!submission) {
      if (item.score !== undefined || item.grade !== undefined || item.maxScore !== undefined) {
        submission = {
          score: item.score ?? item.grade ?? null,
          maxScore: item.maxScore ?? null,
          submittedAt: item.submittedAt || null
        };
      }
    }

    // Check if submitted
    const isSubmitted = submission && (
      submission.submittedAt || 
      submission.submitted === true || 
      submission.status === 'submitted' ||
      submission.status === 'graded'
    );

    // Derive score and max, preferring explicit submission values
    let derivedScore: number | null = submission ? (submission.score ?? submission.grade ?? null) : null;
    let derivedMax: number = submission && (submission.maxScore !== undefined && submission.maxScore !== null)
      ? submission.maxScore
      : (item ? (item.totalPoints ?? item.points ?? 100) : 100);

    // Coerce to numbers, allow zero
    if (derivedScore !== null && derivedScore !== undefined) {
      const n = Number(derivedScore);
      if (!Number.isNaN(n)) derivedScore = n;
      else derivedScore = null;
    }
    const maxN = Number(derivedMax);
    derivedMax = !Number.isNaN(maxN) && maxN > 0 ? maxN : 100;

    // Return status based on submission state
    if (derivedScore !== null && derivedScore !== undefined) {
      // Has a score - graded
      return { 
        type: 'graded', 
        label: `${derivedScore}/${derivedMax}`, 
        color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
      };
    } else if (isSubmitted) {
      // Submitted but not graded yet
      return { 
        type: 'score-pending', 
        label: 'Score Pending', 
        color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' 
      };
    } else {
      // Not submitted
      return { 
        type: 'not-submitted', 
        label: 'Not Submitted', 
        color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' 
      };
    }
  };

  // modeLabel previously computed but unused; removed to keep lint clean

  // Skeleton loading component
  const SkeletonLoading = () => (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900" style={{ padding: '1.5rem' }}>
      <div style={{ maxWidth: '80rem', marginLeft: 'auto', marginRight: 'auto' }}>
        {/* Header Card Skeleton */}
        <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-8 mb-8 overflow-hidden animate-pulse">
          <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded w-64 mb-3"></div>
          <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-96"></div>
        </div>
        
        {/* Tabs Skeleton */}
        <div className="mb-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex gap-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-24 py-3 animate-pulse"></div>
            ))}
          </div>
        </div>
        
        {/* Content Skeleton */}
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-6 animate-pulse">
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32 mb-3"></div>
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-full mb-2"></div>
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (loading) return <SkeletonLoading />;

  if (error)
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900" style={{ padding: '1.5rem' }}>
        <div style={{ maxWidth: '80rem', marginLeft: 'auto', marginRight: 'auto' }}>
          <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-8 overflow-hidden">
            <div className="text-center py-8">
              <div className="text-red-600 dark:text-red-400 text-lg font-semibold mb-2">Error loading class</div>
              <div className="text-slate-600 dark:text-slate-300 text-sm mb-4">{error}</div>
              <button
                onClick={fetchClassDetails}
                className="px-6 py-2 bg-[#2E7D32] text-white rounded-lg hover:brightness-110 transition"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );

  if (!classDetails)
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900" style={{ padding: '1.5rem' }}>
        <div style={{ maxWidth: '80rem', marginLeft: 'auto', marginRight: 'auto' }}>
          <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-8 overflow-hidden">
            <div className="text-center py-8">
              <div className="text-slate-600 dark:text-slate-300">No class details found.</div>
            </div>
          </div>
        </div>
      </div>
    );

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
          {/* Header Card - matching teacher class page style */}
          <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-8 mb-8 overflow-hidden">
            {/* Decorative Background Elements */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#2E7D32]/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-400/5 rounded-full blur-3xl" />
            
            <div className="relative">
              <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2">
                {classDetails.name}
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-lg flex flex-wrap items-center gap-3">
                <span>{classDetails.classCode ?? '—'}</span>
                <span>•</span>
                <span>{classDetails.schedule ?? '—'}</span>
                {classDetails.instructor?.name && (
                  <>
                    <span>•</span>
                    <span>Instructor: {classDetails.instructor.name}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Tabs - matching teacher class page style */}
          <div className="mb-6 border-b border-slate-200 dark:border-slate-700">
            <div className="flex gap-8">
              {["Overview", "Resources and Assessments", "Class List"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    if (tab === "Class List") setStudentPage(1);
                  }}
                  className={`py-3 text-sm font-medium transition-colors relative ${
                    activeTab === tab
                      ? 'text-[#2E7D32] dark:text-[#4CAF50]'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  {tab}
                  {activeTab === tab && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#2E7D32] dark:bg-[#4CAF50] rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <main className="space-y-6">
            {activeTab === "Overview" && (
              <section className="space-y-4">
                {/* Create Post Card */}
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                  <div className="p-4">
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium text-sm">
                        SP
                      </div>
                      <div className="flex-1">
                        <textarea
                          value={newPostText}
                          onChange={(e) => setNewPostText(e.target.value)}
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
                                showError(`File "${file.name}" is too large. Maximum size is 10MB.`);
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
                        disabled={!newPostText.trim() && newPostFiles.length === 0 || submittingPost}
                        onClick={async () => {
                          if (!classDetails) return;
                          setSubmittingPost(true);

                          try {
                            // Upload files to Cloudinary first
                            const attachments: AttachmentMeta[] = [];

                            for (const file of newPostFiles) {
                              // Validate file size (10MB limit)
                              if (file.size > 10 * 1024 * 1024) {
                                throw new Error(`File "${file.name}" is too large. Maximum size is 10MB.`);
                              }

                              const formData = new FormData();
                              formData.append('file', file);

                              const uploadResponse = await fetch('/api/upload-file', {
                                method: 'POST',
                                body: formData
                              });

                              const uploadResult = await uploadResponse.json();

                              if (!uploadResult.success) {
                                throw new Error(`Failed to upload ${file.name}: ${uploadResult.error}`);
                              }

                              attachments.push({
                                id: `a-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                name: file.name,
                                size: file.size,
                                type: file.type || "application/octet-stream",
                                url: uploadResult.data.url,
                              });
                            }

                            // Call API to create post
                            const postResponse = await fetch(`/api/student_page/class/${studentclassId}/posts`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                              },
                              body: JSON.stringify({
                                content: newPostText.trim(),
                                attachments: attachments
                              })
                            });

                            const postResult = await postResponse.json();

                            if (!postResult.success) {
                              throw new Error(postResult.error || 'Failed to create post');
                            }

                            // Use the actual post data from the API response
                            const newPost: FeedPost = {
                              id: postResult.data.post.id,
                              author: postResult.data.post.author,
                              timestamp: postResult.data.post.timestamp,
                              content: postResult.data.post.content,
                              attachments: postResult.data.post.attachments,
                              comments: postResult.data.post.comments,
                            };

                            setClassDetails((cd) => (cd ? { ...cd, feed: [newPost, ...(cd.feed || [])] } : cd));
                            setNewPostText("");
                            setNewPostFiles([]);
                            showAlert({ type: 'success', message: 'Post created successfully!' });

                          } catch (error) {
                            console.error('Error creating post:', error);
                            showError(error instanceof Error ? error.message : 'Failed to create post. Please try again.');
                          } finally {
                            setSubmittingPost(false);
                          }
                        }}
                        className="px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white text-sm rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {submittingPost ? "Posting…" : "Post"}
                      </button>
                    </div>
                  </div>
                </div>

                {(classDetails.feed || []).length === 0 ? (
                  <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-8 text-center">
                    <div className="text-slate-500 dark:text-slate-400">No announcements yet</div>
                    <div className="text-sm text-slate-400 dark:text-slate-500 mt-1">Announcements from your teacher will appear here once posted.</div>
                  </div>
                ) : (
                  (classDetails.feed || []).map((post) => {
                    const isAuthor = currentUserName && post.author === currentUserName;

                    return (
                      <article key={post.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                        <div className="p-4">
                          <div className="flex gap-3">
                            <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-medium text-sm">
                              AM
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-3">
                                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{post.author}</div>
                                <div className="flex items-center gap-2">
                                  <div className="text-xs text-slate-500 dark:text-slate-400">{post.timestamp}</div>
                                  {isAuthor && (
                                    <div className="flex items-center gap-1">
                                      <button
                                        title="Edit post"
                                        onClick={() => startEditPost(post)}
                                        disabled={editingPostId !== null || savingPostId !== null || deletingPostId !== null}
                                        className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        ✏️
                                      </button>
                                      <button
                                        title="Delete post"
                                        onClick={() => deletePost(post.id)}
                                        disabled={editingPostId !== null || savingPostId !== null || deletingPostId !== null}
                                        className="text-xs px-2 py-1 rounded bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        {deletingPostId === post.id ? '⏳' : '🗑️'}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {editingPostId === post.id ? (
                                <div className="mb-4">
                                  <textarea
                                    value={editPostText}
                                    onChange={(e) => setEditPostText(e.target.value)}
                                    disabled={savingPostId === post.id}
                                    className="w-full min-h-[80px] p-3 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm resize-none disabled:opacity-50"
                                    placeholder="Edit your post..."
                                  />
                                  <div className="flex gap-2 mt-3">
                                    <button
                                      onClick={() => saveEditPost(post.id)}
                                      disabled={savingPostId === post.id}
                                      className="px-3 py-1 rounded bg-green-600 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {savingPostId === post.id ? 'Saving...' : 'Save'}
                                    </button>
                                    <button
                                      onClick={cancelEditPost}
                                      disabled={savingPostId === post.id}
                                      className="px-3 py-1 rounded bg-slate-200 dark:bg-slate-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap mb-4">
                                  {post.content}
                                </div>
                              )}

                              {post.link && (
                                <div className="mb-4">
                                  <button className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                                    Open link
                                  </button>
                                </div>
                              )}

                              {post.attachments && post.attachments.length > 0 && (
                                <div className="mb-4">
                                  <div className="space-y-2">
                                    {post.attachments.map((att) => (
                                      <div key={att.id} className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-900">
                                        <div className="w-8 h-8 flex items-center justify-center">
                                          <FileIcon name={att.name} type={att.type} size={20} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate" title={att.name}>
                                            {att.name}
                                          </div>
                                          <div className="text-xs text-slate-500 dark:text-slate-400">{Math.round(att.size / 1024)} KB</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={() => window.open(att.url, '_blank')}
                                            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                                            title="Preview"
                                          >
                                            <span className="text-sm">👁️</span>
                                          </button>
                                          <a
                                            href={att.url}
                                            download={att.name}
                                            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-blue-600"
                                            title="Download"
                                          >
                                            <span className="text-sm">⬇️</span>
                                          </a>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                                <button
                                  onClick={() => setCommentsModalPost(post)}
                                  className="hover:text-slate-800 dark:hover:text-slate-200"
                                >
                                  View comments ({post.comments?.length ?? 0})
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
              </section>
            )}

            {activeTab === "Resources and Assessments" && (
              <section className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Resources Column with Tabs */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <h2 className="text-lg font-medium">Resources</h2>
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
                          {filteredResources.length === 0 ? (
                            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-8 text-center">
                              <div className="text-slate-500 dark:text-slate-400">No files available</div>
                              <div className="text-sm text-slate-400 dark:text-slate-500 mt-1">Files will appear here when uploaded by your teacher.</div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {filteredResources.map((res) => (
                                <div
                                  key={res.id}
                                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-sm transition-shadow"
                                >
                                  <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
                                      <FileIcon name={res.title} type={res.mimeType} size={40} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <button
                                        onClick={() => openResourceOrNavigate(res)}
                                        className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1 truncate text-left w-full"
                                        title={res.title}
                                      >
                                        {res.title}
                                      </button>
                                      <div className="text-xs text-slate-500 dark:text-slate-400">
                                        Date Posted: {new Date().toLocaleDateString('en-US', {
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
                                        onClick={() => openResourceOrNavigate(res)}
                                        className="p-2 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center justify-center"
                                        title="Preview"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => downloadResource(res)}
                                        className="p-2 rounded-md bg-[#2E7D32] dark:bg-[hsl(142.1,76.2%,36.3%)] text-white hover:bg-[#1B5E20] dark:hover:bg-[hsl(142.1,76.2%,30%)] transition-colors flex items-center justify-center"
                                        title="Download"
                                      >
                                        <Download className="w-4 h-4" />
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
                              <div className="text-sm text-slate-400 dark:text-slate-500 mt-1">Flashcards will appear here when published by your teacher.</div>
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
                                        href={`/student_page/student_class/${studentclassId}/shared-flashcard/${fc.id}`}
                                        className="text-sm px-3 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600"
                                      >
                                        Study
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
                              <div className="text-sm text-slate-400 dark:text-slate-500 mt-1">Summaries will appear here when published by your teacher.</div>
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
                                        href={`/student_page/student_class/${studentclassId}/shared-summary/${sm.id}`}
                                        className="text-sm px-3 py-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600"
                                      >
                                        Read
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

                  {/* Activities Column with Tabs */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <h2 className="text-lg font-medium">Assessments</h2>
                    </div>

                    {/* Activity Tabs */}
                    <div className="border-b border-slate-200 dark:border-slate-700">
                      <div className="flex gap-6">
                        {["activities", "quiz", "exam"].map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setWorkResourcesTab(tab as "activities" | "quiz" | "exam")}
                            className={`py-3 text-sm font-medium transition-colors capitalize ${workResourcesTab === tab
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
                      {workResourcesTab === "activities" && (
                        <>
                          {filteredActivities.length === 0 ? (
                            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-8 text-center">
                              <div className="text-slate-500 dark:text-slate-400">No activities available</div>
                              <div className="text-sm text-slate-400 dark:text-slate-500 mt-1">Activities will appear here when assigned by your teacher.</div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {filteredActivities.map((act) => {
                                // For assessment-based activities, we don't have status yet
                                // TODO: Add submission status lookup
                                const isOverdue = new Date(act.dueDate) < new Date();

                                return (
                                  <div
                                    key={act.id}
                                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-sm transition-shadow cursor-pointer"
                                    onClick={() => {
                                      // Handle different activity formats like the quiz/exam tabs
                                      // Prefer client-side navigation to the activity detail page
                                      navigateToActivity(act.id);
                                    }}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${isOverdue ? 'bg-red-100 dark:bg-red-900/30' : 'bg-purple-100 dark:bg-purple-900/30'
                                        }`}>
                                        <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                        </svg>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
                                          {act.title}
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                          Due Date: {act.dueDate}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${getSubmissionStatus(act).color}`}>
                                          {getSubmissionStatus(act).label}
                                        </span>
                                        <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                          </svg>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}

                      {workResourcesTab === "quiz" && (
                        <>
                          {assessments.filter(a => a.category === "Quiz").length === 0 ? (
                            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-8 text-center">
                              <div className="text-slate-500 dark:text-slate-400">No quizzes available</div>
                              <div className="text-sm text-slate-400 dark:text-slate-500 mt-1">Quizzes created by your teacher will appear here.</div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {assessments.filter(a => a.category === "Quiz").map((quiz: any) => {
                                const liveDate = quiz.scheduledOpen ? new Date(quiz.scheduledOpen) : null;
                                const deadline = quiz.scheduledClose ? new Date(quiz.scheduledClose) : null;
                                const now = new Date();
                                const isLive = liveDate ? now >= liveDate : (deadline ? false : true);
                                const isPastDeadline = deadline ? now > deadline : false;
                                
                                // Get submission info
                                const submission = quiz.submission || quiz.submissionInfo || quiz.studentSubmission || quiz.latestSubmission || null;
                                const submittedAt = submission?.submittedAt || submission?.timestamp || null;
                                
                                return (
                                  <div
                                    key={quiz.id}
                                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-sm transition-shadow cursor-pointer"
                                    onClick={() => navigateToActivity(quiz.id)}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 bg-blue-100 dark:bg-blue-900/30">
                                        <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
                                          {quiz.title}
                                        </div>
                                        <div className="space-y-0.5">
                                          {liveDate && (
                                            <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                                              <span>🔓</span>
                                              <span>Live: {liveDate.toLocaleString()}</span>
                                            </div>
                                          )}
                                          {deadline && (
                                            <div className={`text-xs flex items-center gap-1 ${isPastDeadline ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`}>
                                              <span>🔒</span>
                                              <span>Deadline: {deadline.toLocaleString()}</span>
                                            </div>
                                          )}
                                          {!liveDate && !deadline && quiz.dueDate && (
                                            <div className="text-xs text-slate-600 dark:text-slate-300">
                                              <span className="font-semibold">Due Date:</span> {quiz.dueDate}
                                            </div>
                                          )}
                                          {submittedAt && (
                                            <div className="text-xs text-slate-600 dark:text-slate-300">
                                              <span className="font-semibold">Date Submitted:</span> {new Date(submittedAt).toLocaleString()}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        {!isLive && (
                                          <span className="text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                                            Not Yet Live
                                          </span>
                                        )}
                                        {isPastDeadline && (
                                          <span className="text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                                            Closed
                                          </span>
                                        )}
                                        {isLive && !isPastDeadline && (
                                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${getSubmissionStatus(quiz).color}`}>
                                            {getSubmissionStatus(quiz).label}
                                          </span>
                                        )}
                                        <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                          </svg>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}

                      {workResourcesTab === "exam" && (
                        <>
                          {assessments.filter(a => a.category === "Exam").length === 0 ? (
                            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-8 text-center">
                              <div className="text-slate-500 dark:text-slate-400">No exams available</div>
                              <div className="text-sm text-slate-400 dark:text-slate-500 mt-1">Exams created by your teacher will appear here.</div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {assessments.filter(a => a.category === "Exam").map((exam: any) => {
                                const liveDate = exam.scheduledOpen ? new Date(exam.scheduledOpen) : null;
                                const deadline = exam.scheduledClose ? new Date(exam.scheduledClose) : null;
                                const now = new Date();
                                const isLive = liveDate ? now >= liveDate : (deadline ? false : true);
                                const isPastDeadline = deadline ? now > deadline : false;
                                
                                // Get submission info
                                const submission = exam.submission || exam.submissionInfo || exam.studentSubmission || exam.latestSubmission || null;
                                const submittedAt = submission?.submittedAt || submission?.timestamp || null;
                                
                                return (
                                  <div
                                    key={exam.id}
                                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-sm transition-shadow cursor-pointer"
                                    onClick={() => navigateToActivity(exam.id)}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 bg-red-100 dark:bg-red-900/30">
                                        <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
                                          {exam.title}
                                        </div>
                                        <div className="space-y-0.5">
                                          {liveDate && (
                                            <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                                              <span>🔓</span>
                                              <span>Live: {liveDate.toLocaleString()}</span>
                                            </div>
                                          )}
                                          {deadline && (
                                            <div className={`text-xs flex items-center gap-1 ${isPastDeadline ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`}>
                                              <span>🔒</span>
                                              <span>Deadline: {deadline.toLocaleString()}</span>
                                            </div>
                                          )}
                                          {!liveDate && !deadline && exam.dueDate && (
                                            <div className="text-xs text-slate-600 dark:text-slate-300">
                                              <span className="font-semibold">Due Date:</span> {exam.dueDate}
                                            </div>
                                          )}
                                          {submittedAt && (
                                            <div className="text-xs text-slate-600 dark:text-slate-300">
                                              <span className="font-semibold">Date Submitted:</span> {new Date(submittedAt).toLocaleString()}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        {!isLive && (
                                          <span className="text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                                            Not Yet Live
                                          </span>
                                        )}
                                        {isPastDeadline && (
                                          <span className="text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                                            Closed
                                          </span>
                                        )}
                                        {isLive && !isPastDeadline && (
                                          <span className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${getSubmissionStatus(exam).color}`}>
                                            {getSubmissionStatus(exam).label}
                                          </span>
                                        )}
                                        <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                          </svg>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}


            {activeTab === "Class List" && (
              <section className="space-y-6">
                {/* Header with Instructor Card */}
                <div className="flex flex-col lg:flex-row gap-6">
                  <div className="lg:w-80 flex-shrink-0">
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 text-center">
                      {instructor ? (
                        <>
                          <div className="w-24 h-24 mx-auto mb-4">
                            <img
                              src="/gc-logo.png"
                              alt="Instructor"
                              className="w-full h-full rounded-full object-cover border-2 border-slate-200 dark:border-slate-600"
                            />
                          </div>
                          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
                            {getInstructorName(instructor)}
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                            {instructor?.department || 'CCS Department'}
                          </div>
                          <div className="text-sm text-slate-500 dark:text-slate-300 break-all">
                            {getInstructorEmail(instructor)}
                          </div>
                        </>
                      ) : (
                        <EmptyState title="No instructor data" />
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
                      {filteredStudents.length === 0 ? (
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
                        <>
                          <div className="overflow-x-auto">
                            <div className="flex gap-4 items-start">
                              {paginatedStudents.map((student) => (
                                <div
                                  key={student.id}
                                  className="flex items-center gap-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 min-w-[260px]"
                                >
                                  <div className="w-12 h-12 flex-shrink-0">
                                    <img
                                      src="/gc-logo.png"
                                      alt={student.name}
                                      className="w-12 h-12 rounded-full object-cover border-2 border-slate-200 dark:border-slate-600"
                                    />
                                  </div>
                                  <div className="flex-1 text-left">
                                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                      {student.name}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 break-all">
                                      {student.email}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Pagination */}
                          {totalStudentPages > 1 && (
                            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-600">
                              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                <span>Items per page:</span>
                                <select
                                  value={pageSize}
                                  onChange={(e) => { setPageSize(Number(e.target.value)); setStudentPage(1); }}
                                  className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  {[16, 24, 32].map(ps => <option key={ps} value={ps}>{ps}</option>)}
                                </select>
                              </div>
                              <div className="text-sm text-slate-600 dark:text-slate-400">
                                {studentRangeStart} - {studentRangeEnd} of {filteredStudents.length}
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setStudentPage(p => Math.max(1, p - 1))}
                                  disabled={studentPage === 1}
                                  className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 dark:border-slate-600 disabled:opacity-40 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 text-sm transition-colors"
                                >
                                  ‹
                                </button>
                                <button
                                  onClick={() => setStudentPage(p => Math.min(totalStudentPages, p + 1))}
                                  disabled={studentPage === totalStudentPages}
                                  className="w-8 h-8 flex items-center justify-center rounded border border-slate-200 dark:border-slate-600 disabled:opacity-40 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 text-sm transition-colors"
                                >
                                  ›
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}
          </main>
        </div>
      </div>
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
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Comments</div>
              <button
                onClick={() => setCommentsModalPost(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm"
                aria-label="Close comments"
              >
                ✕
              </button>
            </div>
            <div className="px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="text-xs text-slate-500 dark:text-slate-400">Post by {commentsModalPost?.author}</div>
              <div className="mt-1 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                {commentsModalPost?.content}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {(commentsModalPost?.comments ?? []).length === 0 && (
                <div className="text-xs text-slate-500 dark:text-slate-400">No comments yet. Be first to comment.</div>
              )}
              <ul className="space-y-3">
                {(commentsModalPost?.comments ?? []).map((c) => (
                  <li key={c.id} className="flex gap-3 items-start">
                    <Avatar name={c.author || 'Unknown'} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{c.author || 'Unknown'}</span>
                        <span className="text-xxs text-slate-400">{c.timestamp ? new Date(c.timestamp).toLocaleString() : ''}</span>
                      </div>
                      <div className="text-xs mt-1 text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{c.text || ''}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700">
              <div className="flex gap-3 items-start">
                <Avatar name={currentUserName || "User"} />
                <div className="flex-1">
                  <textarea
                    value={commentsModalPost ? commentInputs[commentsModalPost.id] || "" : ""}
                    onChange={(e) => {
                      if (!commentsModalPost) return;
                      setCommentInputs((ci) => ({ ...ci, [commentsModalPost.id]: e.target.value }));
                    }}
                    rows={2}
                    placeholder="Write a comment…"
                    className="w-full text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-400/40 resize-y"
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      onClick={() => setCommentsModalPost(null)}
                      className="text-xxs px-3 py-1 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200"
                    >
                      Close
                    </button>
                    <button
                      disabled={!commentsModalPost || !commentInputs[commentsModalPost.id]?.trim()}
                      onClick={async () => {
                        if (!commentsModalPost) {
                          showAlert({ type: 'error', message: 'No post selected for comment' });
                          return;
                        }

                        if (!studentclassId) {
                          showAlert({ type: 'error', message: 'Class ID not available' });
                          return;
                        }

                        const text = commentInputs[commentsModalPost.id]?.trim();
                        if (!text) {
                          showAlert({ type: 'warning', message: 'Please enter a comment' });
                          return;
                        }

                        const token = localStorage.getItem('accessToken');
                        if (!token) {
                          showAlert({ type: 'error', message: 'Please log in to comment' });
                          return;
                        }

                        try {
                          // Call API to create comment
                          const commentResponse = await fetch(`/api/student_page/class/${studentclassId}/posts/${commentsModalPost.id}/comments`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                            },
                            body: JSON.stringify({ text })
                          });

                          if (!commentResponse.ok) {
                            const errorText = await commentResponse.text();
                            let errorMessage = `HTTP ${commentResponse.status}: ${commentResponse.statusText}`;

                            try {
                              const errorData = JSON.parse(errorText);
                              errorMessage = errorData.error || errorMessage;
                            } catch (e) {
                              // If not JSON, use the raw text
                              errorMessage = errorText || errorMessage;
                            }

                            throw new Error(errorMessage);
                          }

                          const commentResult = await commentResponse.json();

                          if (!commentResult.success) {
                            throw new Error(commentResult.error || 'Failed to add comment');
                          }

                          // Validate response data
                          if (!commentResult.data || !commentResult.data.comment) {
                            throw new Error('Invalid response format from server');
                          }

                          // Use the actual comment data from API response
                          const newComment = {
                            id: commentResult.data.comment.id || `comment_${Date.now()}_${Math.random()}`,
                            author: commentResult.data.comment.author || currentUserName || 'Student',
                            timestamp: commentResult.data.comment.timestamp || new Date().toISOString(),
                            text: commentResult.data.comment.text || text,
                          };

                          setClassDetails((cd) => {
                            if (!cd) return cd;
                            return {
                              ...cd,
                              feed: (cd.feed || []).map((fp) =>
                                fp.id === commentsModalPost.id
                                  ? {
                                    ...fp,
                                    comments: [
                                      ...(fp.comments ?? []),
                                      newComment,
                                    ],
                                  }
                                  : fp
                              ),
                            };
                          });

                          // Clear input
                          setCommentInputs((ci) => ({ ...ci, [commentsModalPost.id]: "" }));

                          // refresh modal post reference with new comments for immediate UI update
                          setCommentsModalPost((prev) => {
                            if (!prev) return prev;
                            return {
                              ...prev,
                              comments: [
                                ...(prev.comments ?? []),
                                newComment,
                              ],
                            } as FeedPost;
                          });

                          showAlert({ type: 'success', message: 'Comment added successfully!', autoClose: true, autoCloseDelay: 3000 });

                          // Mark recent activity for increased polling frequency
                          setLastActivity(new Date());

                          // Also refresh posts to ensure main feed is completely up to date
                          await fetchPosts();
                        } catch (error) {
                          console.error('Error adding comment:', error);
                          showAlert({ type: 'error', message: error instanceof Error ? error.message : 'Failed to add comment. Please try again.' });
                        }
                      }}
                      className="text-xxs px-3 py-1 rounded-md bg-teal-500 text-white disabled:opacity-40"
                    >
                      Comment
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {resourcePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={() => setResourcePreview(null)} />
          <div className="relative w-full max-w-6xl max-h-[90vh] overflow-hidden bg-white dark:bg-slate-800 rounded-lg shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate pr-4">{resourcePreview.title}</div>
              <button
                onClick={() => setResourcePreview(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm"
                aria-label="Close preview"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900">
              {(() => {
                const mimeType = resourcePreview.mimeType?.toLowerCase() || '';
                const fileName = resourcePreview.title?.toLowerCase() || '';
                const fileUrl = resourcePreview.url;

                // For images, try direct display first
                if (mimeType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(fileName)) {
                  return (
                    <div className="h-full flex items-center justify-center p-4">
                      <img
                        src={fileUrl}
                        alt={resourcePreview.title}
                        className="max-w-full max-h-[70vh] object-contain rounded-md shadow-lg"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.innerHTML = '<div class="text-center text-slate-500 dark:text-slate-400"><p>Unable to load image preview</p><p class="text-sm mt-2">This file may require download to view</p></div>';
                          }
                        }}
                      />
                    </div>
                  );
                }

                // For PDFs, try multiple approaches
                if (mimeType.includes('pdf') || fileName.endsWith('.pdf')) {
                  return (
                    <div className="h-full p-4">
                      <div className="bg-white dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 h-[70vh] flex flex-col">
                        <div className="flex-1 relative">
                          {/* Try PDF.js viewer first */}
                          <iframe
                            title={resourcePreview.title}
                            src={`https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(fileUrl)}`}
                            className="w-full h-full border-none rounded-md"
                            onError={() => {
                              // Fallback to Google Docs viewer
                              const iframe = document.querySelector(`iframe[title="${resourcePreview.title}"]`) as HTMLIFrameElement;
                              if (iframe) {
                                iframe.src = `https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`;
                              }
                            }}
                          />
                        </div>
                        <div className="p-2 text-xs text-slate-500 dark:text-slate-400 text-center border-t border-slate-200 dark:border-slate-700">
                          If preview doesn't load, try downloading the file
                        </div>
                      </div>
                    </div>
                  );
                }

                // For Office documents, use Google Docs viewer
                if (mimeType.includes('word') || mimeType.includes('officedocument.wordprocessingml') || /\.(doc|docx)$/i.test(fileName) ||
                  mimeType.includes('presentation') || mimeType.includes('officedocument.presentationml') || /\.(ppt|pptx)$/i.test(fileName) ||
                  mimeType.includes('spreadsheet') || mimeType.includes('officedocument.spreadsheetml') || /\.(xls|xlsx)$/i.test(fileName)) {

                  return (
                    <div className="h-full p-4">
                      <div className="bg-white dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 h-[70vh] flex flex-col">
                        <div className="flex-1 relative">
                          <iframe
                            title={resourcePreview.title}
                            src={`https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`}
                            className="w-full h-full border-none rounded-md"
                            onLoad={(e) => {
                              // Check if the iframe loaded successfully
                              const iframe = e.target as HTMLIFrameElement;
                              setTimeout(() => {
                                try {
                                  // This will throw an error if CORS blocks access
                                  const doc = iframe.contentDocument;
                                  if (!doc || doc.body.innerHTML.includes('error') || doc.body.innerHTML.trim() === '') {
                                    throw new Error('Failed to load');
                                  }
                                } catch (error) {
                                  // Show fallback message
                                  const parent = iframe.parentElement;
                                  if (parent) {
                                    parent.innerHTML = `
                                      <div class="flex items-center justify-center h-full">
                                        <div class="text-center">
                                          <div class="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                                            <svg class="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                          </div>
                                          <p class="text-slate-600 dark:text-slate-400 mb-2">Preview not available</p>
                                          <p class="text-sm text-slate-500 dark:text-slate-500">This file needs to be downloaded to view</p>
                                        </div>
                                      </div>
                                    `;
                                  }
                                }
                              }, 3000);
                            }}
                          />
                        </div>
                        <div className="p-2 text-xs text-slate-500 dark:text-slate-400 text-center border-t border-slate-200 dark:border-slate-700">
                          Loading document preview...
                        </div>
                      </div>
                    </div>
                  );
                }

                // For text files, try to fetch and display content
                if (mimeType.startsWith('text/') || /\.(txt|csv|json|xml|html|css|js|ts|md)$/i.test(fileName)) {
                  return (
                    <div className="h-full p-4">
                      <div className="bg-white dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 h-[70vh] overflow-auto">
                        <div className="p-4">
                          <div className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                            Loading text content...
                          </div>
                          <pre
                            className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-mono leading-relaxed"
                            ref={(el) => {
                              if (el && !el.dataset.loaded) {
                                el.dataset.loaded = 'true';
                                fetch(fileUrl)
                                  .then(response => {
                                    if (!response.ok) throw new Error('Failed to fetch');
                                    return response.text();
                                  })
                                  .then(text => {
                                    el.textContent = text;
                                    const parent = el.parentElement;
                                    if (parent) {
                                      const loadingDiv = parent.querySelector('div');
                                      if (loadingDiv) loadingDiv.remove();
                                    }
                                  })
                                  .catch(() => {
                                    el.textContent = 'Unable to load file content. Please download to view.';
                                    const parent = el.parentElement;
                                    if (parent) {
                                      const loadingDiv = parent.querySelector('div');
                                      if (loadingDiv) loadingDiv.remove();
                                    }
                                  });
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                }

                // For video files
                if (mimeType.startsWith('video/') || /\.(mp4|webm|ogg)$/i.test(fileName)) {
                  return (
                    <div className="h-full flex items-center justify-center p-4">
                      <video
                        controls
                        className="max-w-full max-h-[70vh] rounded-md border border-slate-200 dark:border-slate-700 bg-black"
                        onError={(e) => {
                          const target = e.target as HTMLVideoElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.innerHTML = '<div class="text-center text-slate-500 dark:text-slate-400"><p>Unable to load video preview</p><p class="text-sm mt-2">Please download to view the file</p></div>';
                          }
                        }}
                      >
                        <source src={fileUrl} />
                        Your browser does not support the video tag.
                      </video>
                    </div>
                  );
                }

                // For audio files
                if (mimeType.startsWith('audio/') || /\.(mp3|wav|ogg|aac)$/i.test(fileName)) {
                  return (
                    <div className="h-full flex items-center justify-center p-4">
                      <div className="text-center">
                        <div className="w-24 h-24 mx-auto mb-4 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center">
                          <svg className="w-12 h-12 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                          </svg>
                        </div>
                        <audio
                          controls
                          className="w-full max-w-md"
                          onError={(e) => {
                            const target = e.target as HTMLAudioElement;
                            target.style.display = 'none';
                            const parent = target.parentElement?.parentElement;
                            if (parent) {
                              const errorDiv = document.createElement('div');
                              errorDiv.className = 'text-center text-slate-500 dark:text-slate-400';
                              errorDiv.innerHTML = '<p>Unable to load audio preview</p><p class="text-sm mt-2">Please download to play the file</p>';
                              parent.appendChild(errorDiv);
                            }
                          }}
                        >
                          <source src={fileUrl} />
                          Your browser does not support the audio tag.
                        </audio>
                      </div>
                    </div>
                  );
                }

                // Fallback for all other file types
                return (
                  <div className="h-full flex items-center justify-center p-8">
                    <div className="text-center max-w-md">
                      <div className="w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                        <FileIcon name={resourcePreview.title} type={resourcePreview.mimeType} size={60} />
                      </div>
                      <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
                        {resourcePreview.title}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                        Preview not available for this file type
                      </p>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                        {resourcePreview.type} {resourcePreview.sizeKB ? `• ${Math.round(resourcePreview.sizeKB / 1024)} MB` : ""}
                      </div>
                      <button
                        onClick={() => downloadResource(resourcePreview)}
                        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                      >
                        Download to View
                      </button>
                    </div>
                  </div>
                );
              })()}

              {resourcePreview.description && (
                <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    <span className="font-medium">Description:</span> {resourcePreview.description}
                  </p>
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
              <div className="text-xxs text-slate-500 dark:text-slate-400">
                {resourcePreview.type} {resourcePreview.sizeKB ? `• ${resourcePreview.sizeKB} KB` : ""}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadResource(resourcePreview)}
                  className="text-xxs px-3 py-1 rounded-md bg-teal-500 text-white hover:bg-teal-600"
                >
                  Download
                </button>
                <button
                  onClick={() => setResourcePreview(null)}
                  className="text-xxs px-3 py-1 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Helper to format student names as "Surname, Firstname" (tolerant to several shapes)
const formatStudentName = (student: any): string => {
  const first = student?.firstName?.trim?.() ?? '';
  const last = student?.lastName?.trim?.() ?? '';

  if (last && first) return `${last}, ${first}`;
  if (last) return last;
  if (first) return first;
  if (student?.name) return student.name;
  if (student?.fullName) return student.fullName;
  return '';
};

// Sort students by display name (stable and tolerant to different shapes)
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