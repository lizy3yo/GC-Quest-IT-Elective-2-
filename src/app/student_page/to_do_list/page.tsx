"use client";

import "../dashboard/styles.css";
import { useEffect, useState } from "react";
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Clock, ListTodo, NotebookText, Circle, AlertCircle } from "lucide-react";
import { studentApi, StudentClassDetails, StudentAssessment, StudentActivity } from "@/lib/api/student";
import { useToast } from "@/contexts/ToastContext";

type ItemStatus = "on-time" | "late" | "pending";

interface TodoItem {
  id: string;
  title: string;
  dueDate: string; // display-ready
  submittedAt?: string; // display-ready
  status: ItemStatus;
  scoreStatus?: string;
  category?: string; // Quiz | Exam | Activity
  points?: number;
  scheduledOpen?: string | null;
  scheduledClose?: string | null;
  liveSession?: { isActive?: boolean } | null;
}

interface Section {
  id: string;
  course: string;
  items: TodoItem[];
}

// Helper: map backend class details to UI Section/TodoItem
// Reuse the same score/grade derivation used in student_class page for consistency
const formatSubmissionScore = (item: any): string => {
  if (!item) return 'Score Pending';

  const maybeSubmissionCandidates = [
    item.submission,
    item.submissionInfo,
    item.studentSubmission,
    item.latestSubmission,
    (item.submissions && item.submissions[0]) || null,
    item.submission?.latest || null,
    null,
  ];

  let submission: any = null;
  for (const cand of maybeSubmissionCandidates) {
    if (cand && typeof cand === 'object') {
      submission = cand;
      break;
    }
  }

  if (!submission) {
    if (item.score !== undefined || item.grade !== undefined || item.maxScore !== undefined) {
      submission = {
        score: item.score ?? item.grade ?? null,
        maxScore: item.maxScore ?? null,
      };
    }
  }

  let derivedScore: number | null = submission ? (submission.score ?? submission.grade ?? null) : null;
  let derivedMax: number = submission && (submission.maxScore !== undefined && submission.maxScore !== null)
    ? submission.maxScore
    : (item ? (item.totalPoints ?? item.points ?? 100) : 100);

  if (derivedScore !== null && derivedScore !== undefined) {
    const n = Number(derivedScore);
    if (!Number.isNaN(n)) derivedScore = n;
    else derivedScore = null;
  }
  const maxN = Number(derivedMax);
  derivedMax = !Number.isNaN(maxN) && maxN > 0 ? maxN : 100;

  if (derivedScore === null || derivedScore === undefined) return 'Score Pending';

  return `${derivedScore}/${derivedMax}`;
};

// Helper: format date string to match due date format (e.g., "11/17/2025, 11:59:00 AM")
const formatDate = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  } catch (e) {
    return dateStr;
  }
};

const mapClassToSection = (c: StudentClassDetails): Section => {
  const items: TodoItem[] = [];

  // Prefer the canonical `assessments` array when available (it contains quizzes, exams and assessment-based activities)
  // Normalize category strings to the expected labels and use plain ids so routing matches the student_class page.
  const seen = new Set<string>();
  if (Array.isArray(c.assessments) && c.assessments.length > 0) {
    for (const a of c.assessments as StudentAssessment[]) {
      const rawId = String(a.id ?? (a as any)._id ?? (a as any).assessmentId ?? ((a as any)._doc && (a as any)._doc._id) ?? '');
      if (!rawId) continue;
      
      // Only include published assessments
      if (!a.published) continue;
      
      seen.add(rawId);

      // Normalize category to Quiz | Exam | Activity
      const cat = (a.category ?? a.type ?? '').toString().toLowerCase();
      const category = cat.includes('exam') ? 'Exam' : cat.includes('activity') ? 'Activity' : 'Quiz';

      // Check for submission data attached by the API
      const assessmentData = a as any;
      const submission = assessmentData.submission;
      
      // Determine status based on submission data
      let status: ItemStatus = 'pending';
      let scoreStatus = 'Score Pending';
      let submittedAt = null;
      
      if (submission) {
        submittedAt = submission.submittedAt;
        
        // Check if submitted (either has submittedAt, status='submitted', or has files)
        const isSubmitted = submission.submittedAt || 
                           submission.status === 'submitted' || 
                           (submission.files && submission.files.length > 0);
        
        if (isSubmitted) {
          status = submission.status === 'late' ? 'late' : 'on-time';
        }
        
        if (typeof submission.score === 'number' && typeof submission.maxScore === 'number') {
          scoreStatus = `${submission.score}/${submission.maxScore}`;
        }
      } else {
        // Fallback to old method if no submission object
        scoreStatus = formatSubmissionScore(a);
        const hasScore = scoreStatus !== 'Score Pending' && scoreStatus.includes('/');
        submittedAt = assessmentData.submittedAt;
        const isLate = assessmentData.late ?? false;
        if (hasScore || submittedAt) {
          status = isLate ? 'late' : 'on-time';
        }
      }

      items.push({
        id: rawId,
        title: a.title ?? (a as any).name ?? 'Untitled',
        dueDate: a.dueDate ?? (a as any).due ?? '',
        submittedAt: formatDate(submittedAt),
        status,
        scoreStatus,
        scheduledOpen: (a as any).scheduledOpen ?? null,
        scheduledClose: (a as any).scheduledClose ?? null,
        liveSession: (a as any).liveSession ?? null,
        category,
        points: (a.points ?? (a as any).totalPoints) as number | undefined,
      });
    }
  }

  // Also include activities only when assessments didn't include them (avoid duplicates)
  if (Array.isArray(c.activities)) {
    for (const act of c.activities as StudentActivity[]) {
      const rawId = String(act.id ?? (act as any)._id ?? '');
      if (!rawId) continue;
      if (seen.has(rawId)) continue; // already covered by assessments

      // Check for submission data attached by the API
      const actData = act as any;
      const submission = actData.submission;
      
      let status: ItemStatus = 'pending';
      let scoreStatus = 'Score Pending';
      let submittedAt = act.submittedAt;
      
      if (submission) {
        // Check if submitted (either has submittedAt, status='submitted', or has files)
        const isSubmitted = submission.submittedAt || 
                           submission.status === 'submitted' || 
                           (submission.files && submission.files.length > 0);
        
        if (isSubmitted) {
          status = submission.status === 'late' ? 'late' : 'on-time';
          if (submission.submittedAt) {
            submittedAt = submission.submittedAt;
          }
        }
        
        if (typeof submission.score === 'number' && typeof submission.maxScore === 'number') {
          scoreStatus = `${submission.score}/${submission.maxScore}`;
        }
      } else {
        // Fallback to activity status
        status = act.status === 'submitted' ? 'on-time' : act.status === 'late' ? 'late' : 'pending';
        scoreStatus = formatSubmissionScore(act);
      }

      items.push({
        id: rawId,
        title: act.title ?? (act as any).name ?? 'Untitled',
        dueDate: act.dueDate ?? (act as any).due ?? '',
        submittedAt: formatDate(submittedAt),
        status,
        scoreStatus,
        category: 'Activity',
        points: (act.points ?? (act as any).totalPoints) as number | undefined,
      });
    }
  }

  return {
    id: c._id,
    course: `${c.subject} • ${c.name}`,
    items,
  };
};

export default function ToDoListPage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => setOpen((p) => ({ ...p, [id]: !p[id] }));

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await studentApi.getClasses({ active: true, limit: 20 });
        if (!res.success || !res.data) {
          throw new Error(res.error || 'Failed to load classes');
        }

        const classes = res.data.classes || [];

        // Fetch all class details in parallel for better performance
        const detailPromises = classes.map(async (c) => {
          try {
            const det = await studentApi.getClassDetails(c._id);
            return det.success && det.data?.class ? det.data.class : (c as StudentClassDetails);
          } catch {
            return c as StudentClassDetails;
          }
        });

        const detailed = await Promise.all(detailPromises);

        if (cancelled) return;

        const mapped = detailed.map(mapClassToSection).filter(sec => sec.items.length > 0);
        
        setSections(mapped);
        setOpen(Object.fromEntries(mapped.map((m) => [m.id, true])));
      } catch (err: unknown) {
        setError((err as Error)?.message || 'Unable to load to-do list');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const StatusBadge = ({ status }: { status: ItemStatus }) => {
    if (status === "on-time")
      return (
        <span className="text-[13px] font-semibold text-emerald-600 dark:text-emerald-400">On Time</span>
      );
    if (status === "late")
      return (
        <span className="text-[13px] font-semibold text-red-600 dark:text-red-400">Late Submission</span>
      );
    return (
        <span className="text-[13px] font-semibold text-amber-600 dark:text-amber-400">Pending</span>
    );
  };

  const ScorePill = ({ text = "Score Pending" }) => (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/60 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300">
      <Clock className="h-3.5 w-3.5" />
      {text}
    </span>
  );

  const ActivityButton = ({ item, classId }: { item: TodoItem; classId: string }) => {
    const router = useRouter();
    const { showWarning } = useToast();

    const handleOpen = () => {
      // Set breadcrumb context to indicate navigation from to-do list
      sessionStorage.setItem('breadcrumb_context', 'to_do_list');
      
      const rawId = item.id.includes('-') ? item.id.split('-').slice(1).join('-') : item.id;

      // Activity category - route to activity page
      if (item.category === 'Activity') {
        router.push(`/student_page/student_class/${classId}/activity/${rawId}`);
        return;
      }

      if (item.category === 'Quiz' || item.category === 'Exam') {
        // Check if scored (format score/total) - route to results page
        const isScored = typeof item.scoreStatus === 'string' && item.scoreStatus.includes('/');
        if (isScored) {
          router.push(`/student_page/student_class/${classId}/assessment/${rawId}/results`);
          return;
        }
        
        // Check if submitted but not graded - route to assessment details
        if (item.status === 'on-time' || item.status === 'late') {
          router.push(`/student_page/student_class/${classId}/assessment/${rawId}`);
          return;
        }

        // Not submitted - check live session vs deadline-based routing
        const now = new Date();
        const liveDate = item.scheduledOpen ? new Date(item.scheduledOpen) : null;
        const deadline = item.scheduledClose ? new Date(item.scheduledClose) : null;

        // Check if it's a live session
        if (item.liveSession?.isActive) {
          // LIVE SESSION
          // Check if not yet live
          if (liveDate && now < liveDate) {
            showWarning(`This ${item.category.toLowerCase()} is not yet available. It will open on ${liveDate.toLocaleString()}.`);
            return;
          }

          // Check if past deadline
          if (deadline && now > deadline) {
            showWarning(`This ${item.category.toLowerCase()} has closed. The deadline was ${deadline.toLocaleString()}.`);
            return;
          }

          // Route to live page
          if (item.category === 'Quiz') {
            router.push(`/student_page/student_class/${classId}/quiz/live/${rawId}`);
          } else {
            router.push(`/student_page/student_class/${classId}/exam/live/${rawId}`);
          }
        } else {
          // DEADLINE-BASED
          // Check if past deadline
          if (deadline && now > deadline) {
            showWarning(`This ${item.category.toLowerCase()} has closed. The deadline was ${deadline.toLocaleString()}.`);
            return;
          }

          // Route to regular quiz/exam page
          if (item.category === 'Quiz') {
            router.push(`/student_page/student_class/${classId}/quiz/${rawId}`);
          } else {
            router.push(`/student_page/student_class/${classId}/exam/${rawId}`);
          }
        }
        return;
      }

      // fallback to class page
      router.push(`/student_page/student_class/${classId}`);
    };

    const isScored = typeof item.scoreStatus === 'string' && item.scoreStatus.includes('/');
    const label = isScored ? 'View Results' : (item.category || 'Open');

    return (
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-2 rounded-lg bg-[#1C2B1C] px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#1C2B1C]"
        aria-label={label}
        title={label}
      >
        <NotebookText className="h-4 w-4" /> {label}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900" style={{ padding: '1.5rem' }}>
      <div style={{ maxWidth: '80rem', marginLeft: 'auto', marginRight: 'auto' }}>
        {/* Header Card - matching dashboard style */}
        <div className="relative bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 p-8 mb-8 overflow-hidden">
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#2E7D32]/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-400/5 rounded-full blur-3xl" />
          
          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2">
                To-do List
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-lg">
                Track your complete and pending activities
              </p>
            </div>
            
            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/80 dark:bg-slate-900/50 px-4 py-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-400">
              <div className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Submitted</div>
              <div className="inline-flex items-center gap-2"><Circle className="h-4 w-4 text-amber-600" /> Not Submitted</div>
              <div className="inline-flex items-center gap-2"><AlertCircle className="h-4 w-4 text-red-600" /> Late Submission</div>
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-6">
        {loading && (
          <div className="space-y-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="overflow-hidden rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 animate-pulse">
                <div className="bg-slate-200 dark:bg-slate-700 px-5 py-3">
                  <div className="h-5 bg-slate-300 dark:bg-slate-600 rounded w-48"></div>
                </div>
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {[1, 2].map(j => (
                    <div key={j} className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="h-5 w-5 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                        <div className="flex-1">
                          <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2"></div>
                          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-1"></div>
                          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
                        </div>
                      </div>
                      <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-full w-28"></div>
                      <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-lg w-32"></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {error && (
          <div className="p-4 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">{error}</div>
        )}
        {!loading && sections.length === 0 && (
          <div className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-8">
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-20 h-20 mb-6 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                <ListTodo className="w-10 h-10 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-2">
                All Caught Up!
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-center max-w-md mb-6">
                You don&apos;t have any pending activities or assessments at the moment. Check back later or explore your classes.
              </p>
              <Link
                href="/student_page/student_class"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#2E7D32] hover:brightness-110 text-white font-medium rounded-lg transition-all duration-200"
              >
                View Your Classes
              </Link>
            </div>
          </div>
        )}

        {!loading && sections.map((section) => (
          <section key={section.id} className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 shadow-sm">
            {/* Section header */}
            <button
              onClick={() => toggle(section.id)}
              className="flex w-full items-center justify-between bg-[#2E7D32] dark:bg-[#04C40A] px-5 py-3 text-left text-white hover:opacity-95"
              aria-expanded={open[section.id]}
            >
              <span className="text-sm font-bold tracking-wide">
                {section.course}
              </span>
              <svg
                className={`h-5 w-5 transition-transform ${open[section.id] ? "rotate-180" : "rotate-0"}`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {/* Items */}
            {open[section.id] && (
              <div className="divide-y divide-slate-200 dark:divide-slate-700">
                {section.items.map((item) => {
                  const rawId = item.id.includes('-') ? item.id.split('-').slice(1).join('-') : item.id;
                  const isScored = typeof item.scoreStatus === 'string' && item.scoreStatus.includes('/');
                  
                  let itemUrl = `/student_page/student_class/${section.id}`;
                  if (item.category === 'Activity') {
                    itemUrl = `/student_page/student_class/${section.id}/activity/${rawId}`;
                  } else if (item.category === 'Quiz' || item.category === 'Exam') {
                    if (isScored) {
                      // Graded - go to results
                      itemUrl = `/student_page/student_class/${section.id}/assessment/${rawId}/results`;
                    } else if (item.status === 'on-time' || item.status === 'late') {
                      // Submitted but not graded - go to assessment details
                      itemUrl = `/student_page/student_class/${section.id}/assessment/${rawId}`;
                    } else if (item.liveSession?.isActive) {
                      // Live session - go to live quiz/exam page
                      itemUrl = item.category === 'Quiz'
                        ? `/student_page/student_class/${section.id}/quiz/live/${rawId}`
                        : `/student_page/student_class/${section.id}/exam/live/${rawId}`;
                    } else {
                      // Deadline-based - go to regular quiz/exam page
                      itemUrl = item.category === 'Quiz'
                        ? `/student_page/student_class/${section.id}/quiz/${rawId}`
                        : `/student_page/student_class/${section.id}/exam/${rawId}`;
                    }
                  }

                  return (
                    <Link 
                      key={item.id} 
                      href={itemUrl}
                      className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-[1fr_auto_auto] sm:items-center hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                    >
                      {/* Left */}
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0">
                          {item.status === 'on-time' && (
                            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                          )}
                          {item.status === 'late' && (
                            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                          )}
                          {item.status === 'pending' && (
                            <Circle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                          )}
                        </div>
                        <div>
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="text-base font-semibold text-slate-800 dark:text-slate-100">
                              {item.title}
                            </span>
                            {item.category && (
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                {item.category}{item.points ? ` • ${item.points} pts` : ''}
                              </span>
                            )}
                          </div>
                          <div className="space-y-0.5 text-sm">
                            <div className="text-slate-600 dark:text-slate-300">
                              <span className="font-semibold">Due Date:</span> {item.dueDate}
                            </div>
                            {item.submittedAt && (
                              <div className="text-slate-600 dark:text-slate-300">
                                <span className="font-semibold">Date Submitted:</span> {item.submittedAt}
                              </div>
                            )}
                            <StatusBadge status={item.status} />
                          </div>
                        </div>
                      </div>

                      {/* Middle: score */}
                      <div className="sm:justify-self-end">
                        <ScorePill text={item.scoreStatus || "Score Pending"} />
                      </div>

                      {/* Right: action */}
                      <div className="sm:justify-self-end">
                        <ActivityButton item={item} classId={section.id} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        ))}
        </div>
      </div>
    </div>
  );
}
