"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useLoading } from "@/hooks/useLoading";
import useAuth from "@/hooks/useAuth";
import Link from "next/link";
import api from "@/lib/api";
import { studentApi, type StudentClassDetails, type StudentAssessment, type StudentActivity } from "@/services";
import Image from "next/image";
import LoadingTemplate2 from "@/components/ui/loading_template_2/loading2";
// styles are now included via student.css imported in the layout
import { useSession } from "next-auth/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Chip } from "@/components/ui/chip";

// --- Small, dependency-free chart components ---
function Sparkbar({ data }: { data: Array<{ day: string; count: number }> }) {
  // Render bars that stretch to fill the available width (flex columns)
  if (!data || data.length === 0) return null;
  const max = Math.max(1, ...data.map((d) => d.count));
  const allZero = data.every((d) => d.count === 0);
  // Make the chart area taller and center the pill cards vertically - maximize space
  const containerHeight = 300;
  const cardHeight = 220; // much taller pill card height to maximize vertical space
  const fillMaxHeight = 26; // thicker colored strip for visibility

  // compute a percentage width per item so they evenly fill the available width
  // We'll use flexible columns with reasonable min/max so pills distribute evenly
  const minItemPx = 80;
  const maxItemPx = 220;

  return (
    <div className="sparkbar-container" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, height: containerHeight }} aria-hidden>
      {data.map((d, i) => {
        const v = typeof d.count === 'number' ? d.count : 0;
        const pct = allZero ? 0 : Math.max(0, Math.min(1, v / max));
        const fillHeight = Math.max(2, Math.round(pct * fillMaxHeight));
        const isToday = /today/i.test(d.day);
        return (
          <div key={i} style={{ flex: '1 1 auto', minWidth: `${minItemPx}px`, maxWidth: `${maxItemPx}px`, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', height: cardHeight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="sparkbar-item" title={`${d.day}: ${v}`} style={{ width: '92%', height: '92%', borderRadius: 12, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)' }}>
                <div className={`sparkbar-bar ${isToday ? 'today' : ''}`} style={{ width: '92%', height: fillHeight, borderRadius: 6, transition: 'height 240ms ease' }} />
              </div>
            </div>
            <div className="sparkbar-item" style={{ marginTop: 8, fontSize: 12, textAlign: 'center', width: '100%' }}>{isToday ? 'Today' : d.day}</div>
          </div>
        );
      })}
    </div>
  );
}

function DonutChart({ data, size = 120 }: { data: Array<{ type: string; count: number }>; size?: number }) {
  const total = data.reduce((s, d) => s + (d.count || 0), 0) || 1;
  let angleAcc = 0;
  const center = size / 2;
  const radius = size / 2 - 8;
  const circumference = 2 * Math.PI * radius;
  
  // Use theme-appropriate colors - green variations for consistency
  const colors = ['#04C40A', '#2E7D32', '#1C2B1C', '#0A8F0F'];

  const legendItems = data.map((d, i) => ({ label: d.type, count: d.count, color: colors[i % colors.length] }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={size} height={size} role="img" aria-label={`Assessments distribution: ${data.map(d => `${d.type} ${d.count}`).join(', ')}`}>
        <g transform={`translate(${center},${center})`}>
          {data.map((d, i) => {
            const portion = d.count / total;
            const dash = portion * circumference;
            const dashOffset = circumference - dash;
            const rotate = (angleAcc / total) * 360;
            angleAcc += d.count;
            return (
              <circle key={i} r={radius} fill="none" stroke={colors[i % colors.length]} strokeWidth={14}
                strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={dashOffset}
                transform={`rotate(${rotate})`} />
            );
          })}
          <circle className="donut-chart-bg" r={radius - 18} />
          <text className="donut-chart-text" x="0" y="4" textAnchor="middle" style={{ fontSize: 12, fontWeight: 700 }}>{total}</text>
        </g>
      </svg>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {legendItems.map((l, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <span style={{ width: 10, height: 10, background: l.color, display: 'inline-block', borderRadius: 2 }} aria-hidden></span>
            <span className="donut-legend-text">{l.label} <small className="donut-legend-text">{l.count}</small></span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SimpleBarChart({ data }: { data: Array<{ subject: string; count: number }> }) {
  const max = Math.max(1, ...data.map(d => d.count));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="simple-bar-bg" style={{ width: 8, height: 36, borderRadius: 6 }} aria-hidden></div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <div className="simple-bar-text" title={d.subject} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.subject}</div>
              <div className="simple-bar-count" style={{ fontWeight: 700 }}>{d.count}</div>
            </div>
            <div className="simple-bar-container" style={{ height: 10, borderRadius: 6, marginTop: 6, overflow: 'hidden' }}>
              <div className="simple-bar-fill" style={{ width: `${Math.round((d.count / max) * 100)}%`, height: '100%', borderRadius: 6 }} />
            </div>
          </div>
        </div>
      ))}
      {data.length === 0 && <div className="simple-bar-text" style={{ fontSize: 13 }}>No items to display</div>}
    </div>
  );
}

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

// Helper function to map deck titles to images
const getDeckImage = (title: string): string => {
  const titleLower = title.toLowerCase();

  if (titleLower.includes("computer") && titleLower.includes("servicing")) {
    return "/flashcards_image/computersystemservicing.jpg";
  }
  if (titleLower.includes("networking")) {
    return "/flashcards_image/networking.png";
  }
  if (
    titleLower.includes("data structure") ||
    titleLower.includes("algorithm")
  ) {
    return "/flashcards_image/datastructure.jpg";
  }
  if (titleLower.includes("web development")) {
    return "/flashcards_image/Web-Development.jpg";
  }
  if (titleLower.includes("database")) {
    return "/flashcards_image/database.jpg";
  }
  if (titleLower.includes("software engineering")) {
    return "/flashcards_image/software_eng.jpeg";
  }

  // Default fallback image
  return "/flashcards_image/datastructure.jpg";
};

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
  // Keep a simple loading state and use authenticated context if needed later
  const {
    isLoading: isPageLoading,
    startLoading,
    stopLoading,
  } = useLoading(true);
  const { isLoading: authLoading, user } = useAuth();
  const { data: session } = useSession();
  const [studyDecks, setStudyDecks] = useState<Deck[]>([]);
  const [subjectBreakdown, setSubjectBreakdown] = useState<Array<{ subject: string; count: number }>>([]);
  const [flashcardsByDeck, setFlashcardsByDeck] = useState<Array<{ title: string; count: number }>>([]);
  const [assessmentsBySubject, setAssessmentsBySubject] = useState<Array<{ subject: string; count: number }>>([]);
  const [assessmentsByType, setAssessmentsByType] = useState<Array<{ type: string; count: number }>>([]);
  const [upcomingByDay, setUpcomingByDay] = useState<Array<{ day: string; count: number }>>([]);
  const [summary, setSummary] = useState<{ flashcards: number; activities: number; quizzes: number; exams: number; classes: number } | null>(null);
  const [dueItems, setDueItems] = useState<DueItem[]>([]);
  const [deckFilter, setDeckFilter] = useState<
    "All" | "On-Going" | "Completed"
  >("All");

  const fetchDashboardData = useCallback(async () => {
    try {
      startLoading();
      // Ensure we have an authenticated user before fetching user data
      if (!user?._id) {
        // No user yet; try again once auth finishes
        return;
      }

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
          setFlashcardsByDeck(decks.map(d => ({ title: d.title, count: d.cardCount })));
          // provisional flashcard total (used later when composing full summary)
          flashcardsTotal = decks.reduce((n, d) => n + (d.cardCount || 0), 0);
        }
      } catch (err) {
        console.error("Error fetching user flashcards", err);
        setStudyDecks([]);
      }

      // Fetch due items (activities, assignments, quizzes, exams)
      // Use studentApi (same helper used by To-do page) to fetch classes and their assessments/activities.
      let fetchedDue: DueItem[] = [];
      // initialize counts (declare in outer scope so we can reference later)
      const counts = { flashcards: 0, activities: 0, quizzes: 0, exams: 0, classes: 0 };
      try {
        const classListRes = await studentApi.getClasses({ active: true, limit: 20 });
        const classes = classListRes.success && classListRes.data ? classListRes.data.classes || [] : [];
        counts.classes = classes.length;
        // copy flashcards total if available
        counts.flashcards = flashcardsTotal || 0;

        // Build subject breakdown from classes
        const subjectMap = new Map<string, number>();
        for (const c of classes) {
          const subj = (c.subject || "Uncategorized").toString();
          subjectMap.set(subj, (subjectMap.get(subj) || 0) + 1);
        }
        setSubjectBreakdown(Array.from(subjectMap.entries()).map(([subject, count]) => ({ subject, count })));

  // Fetch details for each class to collect assessments/activities
  const assessSubjMap = new Map<string, number>();
  for (const cls of classes) {
          try {
            const detailRes = await studentApi.getClassDetails(cls._id);
            const detail: StudentClassDetails = (detailRes.success && detailRes.data && detailRes.data.class) ? detailRes.data.class : (cls as StudentClassDetails);

            // Map assessments and activities similar to `to_do_list` for consistency
            const seen = new Set<string>();

            if (Array.isArray(detail.assessments)) {
              for (const a of detail.assessments as StudentAssessment[]) {
                const rawId = String(a.id ?? "");
                if (!rawId) continue;
                // count assessment towards subject
                const subjKey = (detail.subject || 'Uncategorized').toString();
                assessSubjMap.set(subjKey, (assessSubjMap.get(subjKey) || 0) + 1);
                seen.add(rawId);
                const catStr = (a.category ?? a.type ?? "").toString().toLowerCase();
                const category = catStr.includes("exam") ? "Exam" : catStr.includes("activity") ? "Activity" : "Quiz";
                const dueAt = a.dueDate ? new Date(a.dueDate).toISOString() : new Date().toISOString();

                fetchedDue.push({
                  _id: rawId,
                  subject: `${detail.subject ?? "Unknown"} • ${detail.name ?? ""}`,
                  classCode: String(detail.classCode ?? detail._id ?? ""),
                  type: category as DueType,
                  title: String(a.title ?? "Untitled"),
                  dueAt,
                  link: `/student_page/student_class/${detail._id}${rawId ? `?item=${rawId}` : ""}`,
                  classId: detail._id,
                  course: `${detail.subject ?? ""} • ${detail.name ?? ""}`,
                  status: a.published ? "on-time" : "pending",
                  scoreStatus: undefined,
                  points: a.points,
                });
                // categorize using resolved category
                if (category === 'Exam') counts.exams += 1;
                else if (category === 'Quiz') counts.quizzes += 1;
                else counts.activities += 1;
              }
            }

            if (Array.isArray(detail.activities)) {
              for (const act of detail.activities as StudentActivity[]) {
                const rawId = String(act.id ?? "");
                if (!rawId) continue;
                if (seen.has(rawId)) continue; // already included in assessments

                const dueAt = act.dueDate ? new Date(act.dueDate).toISOString() : new Date().toISOString();
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
                  submittedAt: act.submittedAt,
                  status: act.status === "submitted" ? "on-time" : act.status === "late" ? "late" : "pending",
                  scoreStatus: undefined,
                  points: act.points,
                };

                // fetch student's submission for activities to show score info where available
                try {
                  const subRes = await studentApi.getSubmission(detail._id, rawId.replace(/^activity-/, ""));
                  if (subRes.success && subRes.data?.submission) {
                    const submission = subRes.data.submission as any;
                    if (submission.graded || typeof submission.score === 'number') {
                      const score = typeof submission.score === 'number' ? submission.score : submission.score?.value;
                      const total = typeof item.points === 'number' ? item.points : submission.totalScore;
                      item.scoreStatus = typeof score === 'number' && typeof total === 'number' ? `${score}/${total}` : (score ? `${score} pts` : 'Score Pending');
                      item.status = submission.late ? 'late' : item.status;
                    } else {
                      item.scoreStatus = 'Score Pending';
                    }
                  }
                } catch (e) {
                  // ignore per-item errors
                }

                fetchedDue.push(item);
                counts.activities += 1;
              }
            }
          } catch (err) {
            // ignore per-class errors and continue
            console.warn("Failed to load class details for due-items", cls._id, err);
          }
        }

        // set assessments count per subject (top subjects first)
        const assessArr: { subject: string; count: number }[] = [];
        for (const [subject, count] of assessSubjMap) {
          assessArr.push({ subject, count });
        }
        assessArr.sort((a, b) => b.count - a.count);
        setAssessmentsBySubject(assessArr);

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

      // assessments by type for donut chart (non-duplicative; uses counts object)
      setAssessmentsByType([
        { type: "Activities", count: counts.activities || 0 },
        { type: "Quizzes", count: counts.quizzes || 0 },
        { type: "Exams", count: counts.exams || 0 },
      ]);

      // Filter out invalid dates, deduplicate by composite key, prefer earliest due date, then sort
      const dedupeMap = new Map<string, DueItem>();
      for (const d of fetchedDue) {
        const time = new Date(d.dueAt).getTime();
        if (Number.isNaN(time)) continue;
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

      const deduped = Array.from(dedupeMap.values()).sort(
        (a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
      );

      setDueItems(deduped.slice(0, 20));

      // build upcomingByDay for the next 7 days (counts of due items)
      const days: Array<{ day: string; count: number }> = [];
      const today = new Date();
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const key = d.toDateString();
        const cnt = deduped.filter(it => new Date(it.dueAt).toDateString() === key).length;
        days.push({ day: i === 0 ? "Today" : d.toLocaleDateString(undefined, { weekday: 'short' }), count: cnt });
      }
      setUpcomingByDay(days);

  // (assessmentsBySubject already set earlier)
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      stopLoading();
    }
  }, [user?._id, startLoading, stopLoading]);

  useEffect(() => {
    fetchDashboardData();
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

  if (isPageLoading || authLoading)
    return <LoadingTemplate2 title="Loading your dashboard..." />;

  return (
    <div className="dashboard-root">
      <div className="dashboard-container">

          {/* Greeting under breadcrumbs */}
        <header className="greet-block" aria-label="Welcome">
          {(() => {
            // Resolve first name from several sources for best reliability
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

            const firstName = fromAuth || fromSession || fromLocal || "Student";
            return (
              <>
                <h1 className="greet-title">{`Welcome Back, ${firstName}!`}</h1>
                <p className="greet-sub">
                  Ready to continue your learning journey?
                </p>
              </>
            );
          })()}
        </header>

        {/* Summary metrics */}
        <section aria-label="Summary metrics" className="panel panel-padded-lg" style={{ marginBottom: '1rem' }}>
          <div className="summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem' }}>
            <div className="metric-card panel">
              <div style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 700 }}>Classes</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{summary?.classes ?? 0}</div>
                {/* showing real class count from summary */}
              </div>
            </div>

            <div className="metric-card panel">
              <div style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 700 }}>Activities</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{summary?.activities ?? 0}</div>
                {/* sub-description removed */}
              </div>
            </div>

            <div className="metric-card panel">
              <div style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 700 }}>Quizzes</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{summary?.quizzes ?? 0}</div>
                {/* sub-description removed */}
              </div>
            </div>

            <div className="metric-card panel">
              <div style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 700 }}>Exams</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{summary?.exams ?? 0}</div>
                {/* sub-description removed */}
              </div>
            </div>
          </div>
          {/* Assessments breakdown removed per request */}
        </section>

          {/* 4) Charts & Insights - lightweight SVG charts, no external deps */}
          <section aria-labelledby="charts-insights-title" className="w-full charts-insights-spacing" style={{ marginTop: '1rem' }}>
            <h2 id="charts-insights-title" className="sd-title">Charts & Insights</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginTop: '0.75rem' }}>
              <div className="panel" style={{ padding: '0.5rem 1rem 0.75rem 1rem' }}>
                <h3 style={{ margin: 0, marginBottom: '0.5rem', fontSize: '1rem' }}>Upcoming workload (next 7 days)</h3>
                {/* Sparkline / small bar chart (full width) */}
                  <div aria-hidden style={{ height: 300, width: '100%', paddingTop: '0.25rem', display: 'flex', alignItems: 'center' }}>
                    <Sparkbar data={upcomingByDay} />
                                </div>
              </div>

              <div style={{ display: 'grid', gap: '1rem' }}>
                <div className="panel panel-padded-lg">
                  <h4 style={{ margin: 0, marginBottom: '0.5rem' }}>Assessments</h4>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <DonutChart data={assessmentsByType} size={120} />
                  </div>
                </div>

                <div className="panel panel-padded-lg">
                  <h4 style={{ margin: 0, marginBottom: '0.5rem' }}>Assessments by subject</h4>
                  <div style={{ maxHeight: 160, overflow: 'auto' }}>
                    <SimpleBarChart data={assessmentsBySubject.length ? assessmentsBySubject : subjectBreakdown} />
                  </div>
                </div>
              </div>
            </div>
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
                  className="sd-card"
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                >
                  <div className="sd-cover">
                    <Image
                      src={getDeckImage(deck.title)}
                      alt={deck.title}
                      width={400}
                      height={192}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                      priority={false}
                      draggable={false}
                      onDragStart={(e) => e.preventDefault()}
                    />
                  </div>
                  <div className="sd-body">
                    <h3 className="sd-card-title">{deck.title}</h3>
                    <p className="sd-card-desc">
                      {deck.cardCount} card{deck.cardCount === 1 ? "" : "s"}
                    </p>
                    <div className="sd-meta">
                      <span>{deck.cardCount} Cards</span>
                      <span className="inline-flex items-center gap-1">
                        {deck.progress}%
                      </span>
                    </div>
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
