"use client";

import "./styles.css";
import { useState, useEffect, useCallback, useRef } from "react";
import { useLoading } from "@/hooks/useLoading";
import useAuth from "@/hooks/useAuth";
import Link from "next/link";
import { studentApi, type StudentClassDetails, type StudentAssessment, type StudentActivity } from "@/lib/api/student";
import { useSession } from "next-auth/react";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, BookOpen, FileText, ClipboardCheck, Clock } from "lucide-react";
import { Chip } from "@/components/atoms";
import { ChartBarDefault } from "@/components/organisms";
import { Card, CardHeader, CardTitle, CardDescription, CardAction, CardFooter } from "@/components/atoms";
import { Badge } from "@/components/atoms";
import { StrengthsImprovement } from "@/components/organisms";
import { Award, AlertCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/atoms";



// Removed local Student type; use authenticated user from useAuth

interface Deck {
  _id: string;
  title: string;
  cardCount: number;
  lastStudied: string;
  progress: number;
  // Estimated number of cards due today for this deck (mocked for now)
  dueCount?: number;
}





type DueType = "Activity" | "Assignment" | "Quiz" | "Exam";

interface DueItem {
  _id: string;
  subject: string; // Subject/Course name
  classCode: string; // Class code
  type: DueType; // Activity | Quiz | Exam
  title: string; // Specific name of the item
  dueAt: string; // ISO timestamp
  link: string; // URL to navigate to the exact matter
  // optional fields for richer UI (from to_do_list mapping)
  classId?: string;
  course?: string; // display course name
  submittedAt?: string;
  status?: "on-time" | "late" | "pending";
  scoreStatus?: string;
  points?: number;
}

export default function UserDashboard() {
  console.log('[Dashboard] Component rendering');
  
  // Keep a simple loading state and use authenticated context if needed later
  const {
    isLoading: isPageLoading,
    startLoading,
    stopLoading,
  } = useLoading(true);
  const { isLoading: authLoading, user } = useAuth();
  const { data: session } = useSession();
  
  console.log('[Dashboard] Component state:', { 
    isPageLoading, 
    authLoading, 
    hasUser: !!user, 
    userId: user?._id 
  });
  const [studyDecks, setStudyDecks] = useState<Deck[]>([]);
  const [subjectPerformance, setSubjectPerformance] = useState<Array<{ subject: string; score: number; completed: number; total: number; trend?: "up" | "down" | "stable"; classId?: string; className?: string }>>([]);
  const [upcomingByDay, setUpcomingByDay] = useState<Array<{ day: string; count: number; completed: number }>>([]);
  const [summary, setSummary] = useState<{ flashcards: number; activities: number; quizzes: number; exams: number; classes: number } | null>(null);
  const [dueItems, setDueItems] = useState<DueItem[]>([]);
  const [deckFilter, setDeckFilter] = useState<
    "All" | "On-Going" | "Completed"
  >("All");

  const fetchDashboardData = useCallback(async () => {
    console.log('[Dashboard] fetchDashboardData called, user:', user?._id);
    try {
      startLoading();
      // Ensure we have an authenticated user before fetching user data
      if (!user?._id) {
        console.log('[Dashboard] No user ID, skipping fetch');
        // No user yet; try again once auth finishes
        return;
      }
      console.log('[Dashboard] Starting data fetch for user:', user._id);

  // local accumulator for totals
  let flashcardsTotal = 0;

  // Fetch user's flashcard sets
      try {
        type Flashcard = {
          _id: string;
          title: string;
          description?: string;
          cards?: Array<{ _id: string; question: string; answer: string }>;
          createdAt?: string;
          updatedAt?: string;
        };
        const res = await fetch(
          `/api/student_page/flashcard?userId=${encodeURIComponent(user._id)}`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          }
        );
        if (!res.ok) {
          console.warn("Failed to load user flashcards:", res.status);
          setStudyDecks([]);
        } else {
          const data = (await res.json()) as { flashcards?: Flashcard[] };
          const decks: Deck[] = (data.flashcards || []).map((f) => ({
            _id: f._id,
            title: f.title,
            cardCount: Array.isArray(f.cards) ? f.cards.length : 0,
            lastStudied: f.updatedAt || f.createdAt || new Date().toISOString(),
            // Real progress can be wired from StudyProgress later
            progress: 0,
          }));
          setStudyDecks(decks);
          // provisional flashcard total (used later when composing full summary)
          flashcardsTotal = decks.reduce((n, d) => n + (d.cardCount || 0), 0);
        }
      } catch (err) {
        console.error("Error fetching user flashcards", err);
        setStudyDecks([]);
      }

      // Fetch due items (activities, assignments, quizzes, exams)
      // Use studentApi (same helper used by To-do page) to fetch classes and their assessments/activities.
      const fetchedDue: DueItem[] = [];
      // initialize counts (declare in outer scope so we can reference later)
      const counts = { flashcards: 0, activities: 0, quizzes: 0, exams: 0, classes: 0 };
      try {
        console.log('[Dashboard] Fetching classes...');
        const classListRes = await studentApi.getClasses({ active: true, limit: 20 });
        const classes = classListRes.success && classListRes.data ? classListRes.data.classes || [] : [];
        console.log('[Dashboard] Classes fetched:', classes.length, 'classes');
        console.log('[Dashboard] Class list response:', { success: classListRes.success, classCount: classes.length });
        counts.classes = classes.length;
        // copy flashcards total if available
        counts.flashcards = flashcardsTotal || 0;

  // Fetch all class details in parallel for better performance
  // Note: The API already includes submission data for each assessment/activity,
  // so we don't need to make additional API calls to check submission status
  const assessSubjMap = new Map<string, number>();
  const performanceMap = new Map<string, { totalScore: number; maxScore: number; completed: number; total: number; classId: string; className: string }>();
  
  const detailPromises = classes.map(async (cls) => {
    try {
      console.log('[Dashboard] Fetching details for class:', cls._id);
      const detailRes = await studentApi.getClassDetails(cls._id);
      console.log('[Dashboard] Class details fetched:', { classId: cls._id, success: detailRes.success, hasData: !!detailRes.data?.class });
      return detailRes.success && detailRes.data?.class ? detailRes.data.class : (cls as StudentClassDetails);
    } catch (err) {
      console.error('[Dashboard] Error fetching class details:', cls._id, err);
      return cls as StudentClassDetails;
    }
  });

  const detailedClasses = await Promise.all(detailPromises);
  console.log('[Dashboard] All class details fetched:', detailedClasses.length, 'classes');

  for (const detail of detailedClasses) {
    // Map assessments and activities similar to `to_do_list` for consistency
    const seen = new Set<string>();
    const subjKey = (detail.subject || 'Uncategorized').toString();
    
    console.log('[Dashboard] Processing class:', { 
      classId: detail._id, 
      subject: subjKey, 
      assessmentCount: Array.isArray(detail.assessments) ? detail.assessments.length : 0,
      activityCount: Array.isArray(detail.activities) ? detail.activities.length : 0
    });
    
    // Initialize performance tracking for this subject
    if (!performanceMap.has(subjKey)) {
      performanceMap.set(subjKey, { 
        totalScore: 0, 
        maxScore: 0, 
        completed: 0, 
        total: 0,
        classId: detail._id,
        className: detail.name || ''
      });
    }
    const perf = performanceMap.get(subjKey)!;

    if (Array.isArray(detail.assessments)) {
      console.log('[Dashboard] Processing', detail.assessments.length, 'assessments for class:', detail._id);
      for (const a of detail.assessments as StudentAssessment[]) {
        const rawId = String(a.id ?? "");
        if (!rawId) {
          console.log('[Dashboard] Skipping assessment with no ID');
          continue;
        }
        
        // Only show published assessments with valid data to students
        // Unpublished assessments will return 403 Forbidden from the API
        if (a.published === false || !a.title) {
          console.log('[Dashboard] Skipping unpublished/untitled assessment:', rawId, 'published:', a.published);
          continue;
        }
        
        console.log('[Dashboard] Processing assessment:', { 
          id: rawId, 
          title: a.title, 
          dueDate: a.dueDate,
          category: a.category || a.type,
          hasSubmission: !!(a as any).submission
        });
        
        // count assessment towards subject
        assessSubjMap.set(subjKey, (assessSubjMap.get(subjKey) || 0) + 1);
        perf.total += 1;
        
        // Check for submission data attached by the API
        const assessmentData = a as any;
        const submission = assessmentData.submission;
        
        // Track completion and scores for performance calculation
        if (submission) {
          // Check if submitted (either has submittedAt, status='submitted', or has files)
          const isSubmitted = submission.submittedAt || 
                             submission.status === 'submitted' || 
                             (submission.files && submission.files.length > 0);
          
          if (isSubmitted) {
            perf.completed += 1;
            
            // Only track scores if graded
            if (typeof submission.score === 'number' && typeof submission.maxScore === 'number') {
              perf.totalScore += submission.score;
              perf.maxScore += submission.maxScore;
            }
          }
        }
        
        seen.add(rawId);
        const catStr = (a.category ?? a.type ?? "").toString().toLowerCase();
        const category = catStr.includes("exam") ? "Exam" : catStr.includes("activity") ? "Activity" : "Quiz";
        const dueAt = a.dueDate ? new Date(a.dueDate).toISOString() : new Date().toISOString();

        // Determine status from submission data
        let itemStatus: "on-time" | "late" | "pending" = "pending";
        let scoreStatus: string | undefined = undefined;
        
        if (submission) {
          // Check if submitted (either has submittedAt, status='submitted', or has files)
          const isSubmitted = submission.submittedAt || 
                             submission.status === 'submitted' || 
                             (submission.files && submission.files.length > 0);
          
          if (isSubmitted) {
            itemStatus = submission.status === 'late' ? 'late' : 'on-time';
          }
          
          if (typeof submission.score === 'number' && typeof submission.maxScore === 'number') {
            scoreStatus = `${submission.score}/${submission.maxScore}`;
          }
        }

        // Generate appropriate link based on category and submission status
        let itemLink: string;
        if (category === "Activity") {
          itemLink = `/student_page/student_class/${detail._id}/activity/${rawId.replace(/^activity-/, "")}`;
        } else if (category === "Quiz" || category === "Exam") {
          // If scored, link to results page; otherwise link to assessment page
          const isScored = typeof scoreStatus === 'string' && scoreStatus.includes('/');
          itemLink = isScored 
            ? `/student_page/student_class/${detail._id}/assessment/${rawId}/results`
            : `/student_page/student_class/${detail._id}/assessment/${rawId}`;
        } else {
          itemLink = `/student_page/student_class/${detail._id}`;
        }

        const dueItem = {
          _id: rawId,
          subject: `${detail.subject ?? "Unknown"} • ${detail.name ?? ""}`,
          classCode: String(detail.classCode ?? detail._id ?? ""),
          type: category as DueType,
          title: String(a.title ?? "Untitled"),
          dueAt,
          link: itemLink,
          classId: detail._id,
          course: `${detail.subject ?? ""} • ${detail.name ?? ""}`,
          status: itemStatus,
          scoreStatus: scoreStatus,
          points: a.points,
          submittedAt: submission?.submittedAt ? new Date(submission.submittedAt).toLocaleString() : undefined,
        };
        
        fetchedDue.push(dueItem);
        console.log('[Dashboard] Added assessment to fetchedDue:', { 
          title: dueItem.title, 
          type: dueItem.type, 
          status: dueItem.status,
          dueAt: dueItem.dueAt
        });
        
        // Only count pending (not submitted) items in the summary cards
        if (itemStatus === 'pending') {
          if (category === 'Exam') counts.exams += 1;
          else if (category === 'Quiz') counts.quizzes += 1;
          else counts.activities += 1;
        }
      }
    }

    if (Array.isArray(detail.activities)) {
      console.log('[Dashboard] Processing', detail.activities.length, 'activities for class:', detail._id);
      for (const act of detail.activities as StudentActivity[]) {
        const rawId = String(act.id ?? "");
        if (!rawId) {
          console.log('[Dashboard] Skipping activity with no ID');
          continue;
        }
        if (seen.has(rawId)) {
          console.log('[Dashboard] Skipping duplicate activity:', rawId);
          continue; // already included in assessments
        }
        
        // Only count activities with valid title (indicating they're actually created)
        if (!act.title) {
          console.log('[Dashboard] Skipping activity with no title:', rawId);
          continue;
        }
        
        console.log('[Dashboard] Processing activity:', { 
          id: rawId, 
          title: act.title, 
          dueDate: act.dueDate,
          status: act.status,
          hasSubmission: !!(act as any).submission
        });

        perf.total += 1;

        const dueAt = act.dueDate ? new Date(act.dueDate).toISOString() : new Date().toISOString();
        
        // Check for submission data attached by the API
        // The API may attach a dynamic `submission` object; cast to `any` for safe access
        const actData = act as any;
        const submission = actData.submission;
        
        // Determine status from submission or activity data
        let itemStatus: "on-time" | "late" | "pending" = "pending";
        let scoreStatus: string | undefined = undefined;
        let submittedAt: string | undefined = act.submittedAt;
        
        if (submission) {
          // Check if submitted (either has submittedAt, status='submitted', or has files)
          const isSubmitted = submission.submittedAt || 
                             submission.status === 'submitted' || 
                             (submission.files && submission.files.length > 0);
          
          if (isSubmitted) {
            itemStatus = submission.status === 'late' ? 'late' : 'on-time';
            if (submission.submittedAt) {
              submittedAt = new Date(submission.submittedAt).toLocaleString();
            }
            
            // Count as completed when submitted
            perf.completed += 1;
          }
          
          // Track scores if graded
          if (typeof submission.score === 'number' && typeof submission.maxScore === 'number') {
            scoreStatus = `${submission.score}/${submission.maxScore}`;
            perf.totalScore += submission.score;
            perf.maxScore += submission.maxScore;
          }
        } else {
          // Fallback to activity status
          if (act.status === "submitted" || act.status === "late") {
            itemStatus = act.status === "late" ? "late" : "on-time";
            perf.completed += 1;
          } else {
            itemStatus = "pending";
          }
        }
        
        const item: DueItem = {
          _id: rawId,
          subject: `${detail.subject ?? "Unknown"} • ${detail.name ?? ""}`,
          classCode: String(detail.classCode ?? detail._id ?? ""),
          type: "Activity",
          title: String(act.title ?? "Untitled"),
          dueAt,
          link: `/student_page/student_class/${detail._id}/activity/${rawId.replace(/^activity-/, "")}`,
          classId: detail._id,
          course: `${detail.subject ?? ""} • ${detail.name ?? ""}`,
          submittedAt: submittedAt,
          status: itemStatus,
          scoreStatus: scoreStatus,
          points: act.points,
        };

        fetchedDue.push(item);
        console.log('[Dashboard] Added activity to fetchedDue:', { 
          title: item.title, 
          type: item.type, 
          status: item.status,
          dueAt: item.dueAt
        });
        
        // Only count pending (not submitted) activities in the summary cards
        if (itemStatus === 'pending') {
          counts.activities += 1;
        }
      }
    }
  }

        // Calculate subject performance data
        const perfArr: Array<{ subject: string; score: number; completed: number; total: number; classId?: string; className?: string }> = [];
        for (const [subject, data] of performanceMap) {
          // Only include subjects that have actual activities/assessments
          if (data.total === 0) continue;
          
          const avgScore = data.maxScore > 0 ? Math.round((data.totalScore / data.maxScore) * 100) : 0;
          perfArr.push({
            subject,
            score: avgScore,
            completed: data.completed,
            total: data.total,
            classId: data.classId,
            className: data.className,
          });
        }
        setSubjectPerformance(perfArr);

      } catch (err) {
        console.warn("Failed to fetch classes for due items", err);
      }

      // set summary with computed class/activity/assessment counts
      setSummary((prev) => ({
        flashcards: prev?.flashcards ?? 0,
        activities: counts.activities || 0,
        quizzes: counts.quizzes || 0,
        exams: counts.exams || 0,
        classes: counts.classes || 0,
      }));

      console.log('[Dashboard] Total fetched due items:', fetchedDue.length);
      
      // Filter out invalid dates, deduplicate by composite key, prefer earliest due date, then sort
      const dedupeMap = new Map<string, DueItem>();
      let invalidDateCount = 0;
      for (const d of fetchedDue) {
        const time = new Date(d.dueAt).getTime();
        if (Number.isNaN(time)) {
          invalidDateCount++;
          console.log('[Dashboard] Skipping item with invalid date:', { title: d.title, dueAt: d.dueAt });
          continue;
        }
        const key = `${d._id}-${d.type}-${d.classCode}`;
        const existing = dedupeMap.get(key);
        if (!existing) {
          dedupeMap.set(key, d);
        } else {
          // keep the one with the earlier due date
          if (new Date(d.dueAt).getTime() < new Date(existing.dueAt).getTime()) {
            dedupeMap.set(key, d);
          }
        }
      }
      
      console.log('[Dashboard] Items filtered:', { 
        total: fetchedDue.length, 
        invalidDates: invalidDateCount,
        afterDedup: dedupeMap.size 
      });

      const deduped = Array.from(dedupeMap.values()).sort(
        (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
      );
      
      console.log('[Dashboard] Deduped and sorted items:', deduped.length);

      // Filter to only show pending items in the to-do list (not submitted)
      const pendingItems = deduped.filter(item => item.status === 'pending');
      console.log('[Dashboard] Pending items for to-do list:', pendingItems.length);
      setDueItems(pendingItems.slice(0, 20));

      // build upcomingByDay for the next 7 days (show all tasks with completed count)
      const days: Array<{ day: string; count: number; completed: number }> = [];
      const today = new Date();
      console.log('[Dashboard] Building upcomingByDay data for next 7 days, starting from:', today.toDateString());
      
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const key = d.toDateString();
        const allTasksForDay = deduped.filter(it => new Date(it.dueAt).toDateString() === key);
        const completedTasksForDay = allTasksForDay.filter(it => it.status === 'on-time' || it.status === 'late');
        
        console.log('[Dashboard] Day', i, ':', { 
          date: key, 
          label: i === 0 ? "Today" : d.toLocaleDateString(undefined, { weekday: 'short' }),
          totalTasks: allTasksForDay.length,
          completedTasks: completedTasksForDay.length,
          pendingTasks: allTasksForDay.length - completedTasksForDay.length
        });
        
        days.push({ 
          day: i === 0 ? "Today" : d.toLocaleDateString(undefined, { weekday: 'short' }), 
          count: allTasksForDay.length,
          completed: completedTasksForDay.length
        });
      }
      
      console.log('[Dashboard] Final upcomingByDay data:', days);
      console.log('[Dashboard] Bar chart will show:', days.some(d => d.count > 0) ? 'Chart with data' : 'Empty state');
      setUpcomingByDay(days);

  // (assessmentsBySubject already set earlier)
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      stopLoading();
    }
  }, [user?._id, startLoading, stopLoading]);

  useEffect(() => {
    console.log('[Dashboard] useEffect triggered, calling fetchDashboardData');
    fetchDashboardData();
    
    // Initialize study tracking
    if (typeof window !== 'undefined') {
      import('@/lib/notifications/study-tracker').then(({ initializeStudyTracking }) => {
        initializeStudyTracking();
      });
    }
  }, [fetchDashboardData]);

  const formatDueAt = (iso: string) => {
    const due = new Date(iso);
    const now = new Date();
    const isToday = due.toDateString() === now.toDateString();
    const time = due.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
    if (isToday) return `Today, ${time}`;
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    if (due.toDateString() === tomorrow.toDateString())
      return `Tomorrow, ${time}`;
    return due.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // Determine urgency for teacher-assigned items to elevate time-sensitive tasks
  const getUrgency = (iso: string) => {
    const due = new Date(iso).getTime();
    const now = Date.now();
    const diffMs = due - now;
    const diffMin = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMin / 60);

    if (diffMin <= 60) {
      return {
        level: "critical" as const,
        label: diffMin <= 0 ? "Due now" : `Due in ${diffMin}m`,
        isUrgent: true,
      };
    }
    if (diffHours <= 3) {
      return {
        level: "soon" as const,
        label: `Due in ${diffHours}h`,
        isUrgent: true,
      };
    }
    if (diffHours <= 24) {
      return {
        level: "normal" as const,
        label: formatDueAt(iso),
        isUrgent: false,
      };
    }
    return {
      level: "normal" as const,
      label: formatDueAt(iso),
      isUrgent: false,
    };
  };

  // Derive sorted list of next due items (soonest first)
  const nextDueItems = [...dueItems].sort(
    (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
  );
  // Only the three required sections are rendered below.

  const resumeAssignment = nextDueItems[0];

  // Study decks horizontal scroller
  const decksScrollerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  const scrollDecks = (dir: "left" | "right") => {
    const el = decksScrollerRef.current;
    if (!el) return;
    const amount = Math.min(
      600,
      Math.max(320, Math.floor(el.clientWidth * 0.9))
    );
    el.scrollBy({
      left: dir === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  // Click and drag scrolling for decks
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = decksScrollerRef.current;
    if (!el) return;
    isDraggingRef.current = true;
    startXRef.current = e.pageX - el.offsetLeft;
    scrollLeftRef.current = el.scrollLeft;
    el.style.cursor = "grabbing";
    el.style.userSelect = "none";
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    const el = decksScrollerRef.current;
    if (!el) return;
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startXRef.current) * 2; // Multiply by 2 for faster scroll
    el.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    const el = decksScrollerRef.current;
    if (!el) return;
    isDraggingRef.current = false;
    el.style.cursor = "grab";
    el.style.userSelect = "";
  };

  // Next Due vertical scroller
  const dueScrollerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingDueRef = useRef(false);
  const startYDueRef = useRef(0);
  const scrollTopDueRef = useRef(0);

  // Note: Previously used up/down arrow controls; replaced by a static "View All" button in the header.

  // Click and drag scrolling for Next Due
  const handleDueMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = dueScrollerRef.current;
    if (!el) return;
    isDraggingDueRef.current = true;
    startYDueRef.current = e.pageY - el.offsetTop;
    scrollTopDueRef.current = el.scrollTop;
    el.style.cursor = "grabbing";
    el.style.userSelect = "none";
  };

  const handleDueMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingDueRef.current) return;
    e.preventDefault();
    const el = dueScrollerRef.current;
    if (!el) return;
    const y = e.pageY - el.offsetTop;
    const walk = (y - startYDueRef.current) * 2;
    el.scrollTop = scrollTopDueRef.current - walk;
  };

  const handleDueMouseUpOrLeave = () => {
    const el = dueScrollerRef.current;
    if (!el) return;
    isDraggingDueRef.current = false;
    el.style.cursor = "grab";
    el.style.userSelect = "";
  };

  // Filter decks based on selected filter
  const filteredDecks = studyDecks.filter((deck) => {
    if (deckFilter === "All") return true;
    if (deckFilter === "On-Going") return deck.progress < 100;
    if (deckFilter === "Completed") return deck.progress === 100;
    return true;
  });

  // Resolve first name from several sources for best reliability
  const getFirstName = () => {
    const fromAuth =
      (user?.firstName?.trim?.() ? user.firstName!.trim() : null) ||
      (user?.name?.trim?.() ? user.name!.trim().split(" ")[0] : null) ||
      (user?.username?.trim?.() ? user.username!.trim() : null);

    const sessionName =
      typeof session?.user?.name === "string"
        ? session.user.name
        : null;
    const fromSession =
      sessionName && sessionName.trim()
        ? sessionName.trim().split(" ")[0]
        : null;

    let fromLocal: string | null = null;
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("user");
        if (raw) {
          const parsed = JSON.parse(raw);
          fromLocal =
            (parsed?.firstName && String(parsed.firstName).trim()) ||
            (parsed?.name &&
              String(parsed.name).trim().split(" ")[0]) ||
            (parsed?.username && String(parsed.username).trim()) ||
            null;
        }
      } catch {
        // ignore
      }
    }

    return fromAuth || fromSession || fromLocal || "Student";
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900" style={{ padding: '1.5rem' }}>
      <div style={{ maxWidth: '80rem', marginLeft: 'auto', marginRight: 'auto' }}>
        {/* Header Card - matching teacher dashboard style */}
        <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-8 mb-8 overflow-hidden">
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#2E7D32]/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-400/5 rounded-full blur-3xl" />
          
          <div className="relative">
            <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2">
              {isPageLoading || authLoading ? 'Loading...' : `Welcome Back, ${getFirstName()}!`}
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-lg">
              Ready to continue your learning journey?
            </p>
          </div>
        </div>

        {/* Overview Metrics */}
        <section aria-label="Overview metrics" style={{ marginBottom: '1rem' }}>
          {isPageLoading || authLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-6 animate-pulse">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24 mb-3"></div>
                  <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-16 mb-3"></div>
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-32"></div>
                </div>
              ))}
            </div>
          ) : (
          <TooltipProvider delayDuration={0}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs">
              <Card className="@container/card">
                <CardHeader>
                  <CardDescription className="pr-20">Active Classes</CardDescription>
                  <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                    {summary?.classes ?? 0}
                  </CardTitle>
                  <CardAction>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="pill">
                        <BookOpen className="size-4" />
                        Enrolled
                      </Badge>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="inline-flex items-center justify-center w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help">
                            <span className="text-xs">?</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Total number of classes you are currently enrolled in</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </CardAction>
                </CardHeader>
                <CardFooter className="flex-col items-start gap-1.5 text-sm">
                  <div className="line-clamp-1 flex gap-2 font-medium text-slate-600 dark:text-[var(--dark-text-secondary)]">
                    Currently enrolled <TrendingUp className="size-4" />
                  </div>
                </CardFooter>
              </Card>

              <Card className="@container/card">
                <CardHeader>
                  <CardDescription className="pr-20">Pending Activities</CardDescription>
                  <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                    {summary?.activities ?? 0}
                  </CardTitle>
                  <CardAction>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="pill">
                        {(summary?.activities ?? 0) > 0 ? (
                          <>
                            <ClipboardCheck className="size-4" />
                            To Do
                          </>
                        ) : (
                          <>
                            <TrendingDown className="size-4" />
                            None
                          </>
                        )}
                      </Badge>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="inline-flex items-center justify-center w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help">
                            <span className="text-xs">?</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Number of activities waiting to be completed across all your classes</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </CardAction>
                </CardHeader>
                <CardFooter className="flex-col items-start gap-1.5 text-sm">
                  <div className="line-clamp-1 flex gap-2 font-medium text-slate-600 dark:text-[var(--dark-text-secondary)]">
                    {(summary?.activities ?? 0) > 0 ? 'Tasks to complete' : 'All caught up'}{' '}
                    {(summary?.activities ?? 0) > 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                  </div>
                </CardFooter>
              </Card>

              <Card className="@container/card">
                <CardHeader>
                  <CardDescription className="pr-24">Upcoming Quizzes</CardDescription>
                  <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                    {summary?.quizzes ?? 0}
                  </CardTitle>
                  <CardAction>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="pill">
                        {(summary?.quizzes ?? 0) > 0 ? (
                          <>
                            <FileText className="size-4" />
                            Due
                          </>
                        ) : (
                          <>
                            <TrendingDown className="size-4" />
                            None
                          </>
                        )}
                      </Badge>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="inline-flex items-center justify-center w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help">
                            <span className="text-xs">?</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Number of quizzes with upcoming due dates that need your attention</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </CardAction>
                </CardHeader>
                <CardFooter className="flex-col items-start gap-1.5 text-sm">
                  <div className="line-clamp-1 flex gap-2 font-medium text-slate-600 dark:text-[var(--dark-text-secondary)]">
                    {(summary?.quizzes ?? 0) > 0 ? 'Upcoming assessments' : 'No quizzes due'}{' '}
                    {(summary?.quizzes ?? 0) > 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                  </div>
                </CardFooter>
              </Card>

              <Card className="@container/card">
                <CardHeader>
                  <CardDescription className="pr-24">Scheduled Exams</CardDescription>
                  <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                    {summary?.exams ?? 0}
                  </CardTitle>
                  <CardAction>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="pill">
                        {(summary?.exams ?? 0) > 0 ? (
                          <>
                            <Clock className="size-4" />
                            Upcoming
                          </>
                        ) : (
                          <>
                            <TrendingDown className="size-4" />
                            None
                          </>
                        )}
                      </Badge>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button className="inline-flex items-center justify-center w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help">
                            <span className="text-xs">?</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Number of major exams scheduled across all your classes</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </CardAction>
                </CardHeader>
                <CardFooter className="flex-col items-start gap-1.5 text-sm">
                  <div className="line-clamp-1 flex gap-2 font-medium text-slate-600 dark:text-[var(--dark-text-secondary)]">
                    {(summary?.exams ?? 0) > 0 ? 'Major assessments' : 'No exams scheduled'}{' '}
                    {(summary?.exams ?? 0) > 0 ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                  </div>
                </CardFooter>
              </Card>
            </div>
          </TooltipProvider>
          )}
        </section>

          {/* 4) Charts & Insights - lightweight SVG charts, no external deps */}
          <section className="w-full charts-insights-spacing">
            {isPageLoading || authLoading ? (
              <div className="charts-grid">
                <div className="chart-main">
                  <div className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-6 animate-pulse">
                    <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-48 mb-2"></div>
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-64 mb-6"></div>
                    <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded"></div>
                  </div>
                </div>
                <div className="chart-sidebar">
                  <div className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-6 animate-pulse mb-4">
                    <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-32 mb-4"></div>
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-8 bg-slate-200 dark:bg-slate-700 rounded"></div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-6 animate-pulse">
                    <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-40 mb-4"></div>
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-8 bg-slate-200 dark:bg-slate-700 rounded"></div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
            <div className="charts-grid">
              <div className="chart-main">
                {upcomingByDay.some(d => d.count > 0) ? (
                  <ChartBarDefault
                    data={upcomingByDay.map(d => ({ month: d.day, desktop: d.count, completed: d.completed }))}
                    title="Upcoming workload (next 7 days)"
                    description="Your scheduled tasks for the week"
                    footerText="Showing all assignments and activities (completed + pending)"
                    trendText="Stay on track with your schedule"
                    showTrend={true}
                    showCompletedInTooltip={true}
                    chartConfig={{
                      desktop: {
                        label: "Tasks",
                        color: "var(--chart-1)",
                      },
                    }}
                  />
                ) : (
                  <Card className="border-[#e2e8f0] dark:border-[#2E2E2E]">
                    <CardHeader>
                      <CardTitle className="text-base font-semibold text-[#0f172a] dark:text-[#FFFFFF]">
                        Upcoming workload (next 7 days)
                      </CardTitle>
                      <CardDescription className="text-[#64748b] dark:text-[#BCBCBC]">
                        Your scheduled tasks for the week
                      </CardDescription>
                    </CardHeader>
                    <div className="flex flex-col items-center justify-center px-4" style={{ minHeight: '280px' }}>
                      <div className="w-16 h-16 mb-4 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                        <TrendingUp className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
                        No Upcoming Tasks
                      </h3>
                      <p className="text-slate-600 dark:text-slate-400 text-center text-sm max-w-sm">
                        You're all caught up! No tasks scheduled for the next 7 days.
                      </p>
                    </div>
                    <CardFooter className="flex-col items-start gap-2 text-sm">
                      <div className="flex gap-2 font-medium leading-none text-[#64748b] dark:text-[#BCBCBC]">
                        Check back later for new assignments
                      </div>
                    </CardFooter>
                  </Card>
                )}
              </div>

              <div className="chart-sidebar">
                <TooltipProvider delayDuration={0}>
                  <div className="panel panel-padded-lg relative">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="absolute top-2 right-2 w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help z-10">
                          <span className="text-xs">?</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Your top-performing subjects based on completed assessments and activities. The percentage shown is your average score across all graded work in that subject. Subjects with scores of 70% or higher are shown here.</p>
                      </TooltipContent>
                    </Tooltip>
                    <div className="flex items-center gap-2 mb-3">
                      <Award className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Your Strengths</h4>
                    </div>
                    <div className="learning-progress-container">
                      <StrengthsImprovement data={subjectPerformance} type="strengths" />
                    </div>
                  </div>

                  <div className="panel panel-padded-lg relative">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="absolute top-2 right-2 w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help z-10">
                          <span className="text-xs">?</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Subjects that need your attention. The percentage shown is your average score across all graded work in that subject. These are areas with lower scores (below 70%) or pending work. Click on a subject to view the class details.</p>
                      </TooltipContent>
                    </Tooltip>
                    <div className="flex items-center gap-2 mb-3">
                      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Focus Areas</h4>
                    </div>
                    <div className="learning-progress-container">
                      <StrengthsImprovement data={subjectPerformance} type="focus" />
                    </div>
                  </div>
                </TooltipProvider>
              </div>
            </div>
            )}
          </section>
      

        {/* Top row: Next Due (left), Quick Actions (right) */}
        <div className="dashboard-grid">
          {/* 1) Next Due Section */}
          <section aria-labelledby="todo-list-title" className="col-span-8">
            <div className="panel panel-padded-lg nd-panel">
              <div className="nd-header">
                <h2 id="todo-list-title" className="section-title">
                  To-do list
                </h2>
                <div className="nd-actions">
                  <Link
                    href="/student_page/to_do_list"
                    className="pill-button nd-view-all"
                    aria-label="View all to-do items"
                  >
                    View All
                  </Link>
                </div>
              </div>

              {nextDueItems.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">✅</div>
                  <p className="empty-title">No due work</p>
                  <p className="empty-desc">
                    You’re all caught up. Check back later.
                  </p>
                </div>
              ) : (
                <div
                  className="due-list-container"
                  ref={dueScrollerRef}
                  onMouseDown={handleDueMouseDown}
                  onMouseMove={handleDueMouseMove}
                  onMouseUp={handleDueMouseUpOrLeave}
                  onMouseLeave={handleDueMouseUpOrLeave}
                >
                  <div className="due-list">
                    {nextDueItems.map((item) => {
                      const urgency = getUrgency(item.dueAt);
                      return (
                        <Link
                          key={`${item._id}-${item.type}-${item.classCode}`}
                          href={item.link}
                          className="due-card due-card-link"
                          aria-label={`Open ${item.type} • ${
                            item.title || item.subject
                          }`}
                          draggable={false}
                          onDragStart={(e) => e.preventDefault()}
                        >
                          <div className="due-card-layout">
                            {/* Left: Title and due time */}
                            <div className="due-card-left">
                              <h3 className="title-truncate">
                                {item.title || item.subject}
                              </h3>
                              <p className={`due-time ${urgency.level}`}>
                                {urgency.label}
                              </p>
                            </div>

                            {/* Center: Category/Type */}
                            <div className="due-card-center">
                              <Chip variant="badge">{item.type}</Chip>
                            </div>

                            {/* Right: Arrow indicator (decorative) */}
                            <div className="due-card-right" aria-hidden="true">
                              <Chip variant="arrow">
                                <ChevronRight size={20} />
                              </Chip>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 2) Quick Actions */}
          <section aria-labelledby="quick-actions-title" className="col-span-4">
            <div className="panel panel-padded qa-panel">
              <h2 id="quick-actions-title" className="section-title">
                Quick Actions
              </h2>
              <div className="qa-group">
                {/* Start Review */}
                <Link href="/student_page/study_mode" className="qa-link">
                  <span className="qa-icon">▶</span>
                  <span className="qa-text">Start Review</span>
                </Link>

                {/* Resume Assignment */}
                {resumeAssignment ? (
                  <Link href={resumeAssignment.link} className="qa-link">
                    <span className="qa-icon">▤</span>
                    <span className="qa-text">Resume Assignment</span>
                  </Link>
                ) : (
                  <div aria-disabled className="qa-link">
                    <span className="qa-icon">▤</span>
                    <span className="qa-text">Resume Assignment</span>
                  </div>
                )}

                {/* Create Flashcards */}
                <Link
                  href="/student_page/flashcards/create/set"
                  className="qa-link"
                >
                  <span className="qa-icon">＋</span>
                  <span className="qa-text">Create Flashcards</span>
                </Link>
              </div>
            </div>
          </section>
        </div>

        {/* 3) My Flashcard Sets */}
        <section aria-labelledby="flashcard-sets-title" className="w-full">
          <div className="sd-header">
            <div className="sd-title-row">
              <h2 id="flashcard-sets-title" className="sd-title">
                My Flashcard Sets
              </h2>
              <div className="sd-tabs">
                <button
                  className={`sd-tab ${
                    deckFilter === "All" ? "sd-tab--active" : ""
                  }`}
                  onClick={() => setDeckFilter("All")}
                >
                  All
                </button>
                <button
                  className={`sd-tab ${
                    deckFilter === "On-Going" ? "sd-tab--active" : ""
                  }`}
                  onClick={() => setDeckFilter("On-Going")}
                >
                  On-Going
                </button>
                <button
                  className={`sd-tab ${
                    deckFilter === "Completed" ? "sd-tab--active" : ""
                  }`}
                  onClick={() => setDeckFilter("Completed")}
                >
                  Completed
                </button>
              </div>
            </div>
            <div className="sd-nav" aria-label="Study deck navigation">
              <button
                aria-label="Previous decks"
                className="sd-nav-btn"
                onClick={() => scrollDecks("left")}
              >
                <ChevronLeft size={20} />
              </button>
              <button
                aria-label="Next decks"
                className="sd-nav-btn"
                onClick={() => scrollDecks("right")}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
          {filteredDecks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📚</div>
              <p className="empty-title">No flashcard sets yet</p>
              <p className="empty-desc">
                Create or upload a flashcard set to get started.
              </p>
              <Link
                href="/student_page/flashcards"
                className="pill-button mt-3"
              >
                Create Flashcard Set
              </Link>
            </div>
          ) : (
            <div
              className="sd-row"
              ref={decksScrollerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
            >
              {filteredDecks.map((deck) => (
                <Link
                  key={deck._id}
                  href={`/student_page/private_library/${deck._id}`}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 cursor-pointer hover:shadow-lg hover:border-[#1C2B1C]/20 dark:hover:border-[#1C2B1C]/40 transition-all duration-200 group relative scroll-snap-align-start"
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-slate-500 dark:bg-slate-400 rounded-full"></div>
                      <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{deck.cardCount} card{deck.cardCount === 1 ? "" : "s"}</span>
                    </div>
                  </div>

                  <div className="mb-3">
                    <h4 className="text-base font-semibold text-gray-900 dark:text-slate-100 mb-1 line-clamp-2">{deck.title}</h4>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-400 dark:text-slate-500">
                    <span>Last studied {deck.lastStudied ? new Date(deck.lastStudied).toLocaleDateString() : 'recently'}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}