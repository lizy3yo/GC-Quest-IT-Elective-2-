"use client";

import { useEffect, useState } from "react";
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clock, FileText, ListTodo, NotebookText } from "lucide-react";
import { studentApi, StudentClassDetails, StudentAssessment, StudentActivity } from "@/lib/api/student";

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
}

interface Section {
  id: string;
  course: string;
  items: TodoItem[];
}

// Helper: map backend class details to UI Section/TodoItem
// Reuse the same score/grade derivation used in student_class page for consistency
const formatSubmissionScore = (item: any): string => {
  if (!item) return 'Pending';

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

  if (derivedScore === null || derivedScore === undefined) return 'Pending';

  return `${derivedScore}/${derivedMax}`;
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
      seen.add(rawId);

      // Normalize category to Quiz | Exam | Activity
      const cat = (a.category ?? a.type ?? '').toString().toLowerCase();
      const category = cat.includes('exam') ? 'Exam' : cat.includes('activity') ? 'Activity' : 'Quiz';

      items.push({
        id: rawId,
        title: a.title ?? (a as any).name ?? 'Untitled',
        dueDate: a.dueDate ?? (a as any).due ?? '',
        submittedAt: undefined,
        status: a.published ? 'on-time' : 'pending',
        scoreStatus: formatSubmissionScore(a),
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

      items.push({
        id: rawId,
        title: act.title ?? (act as any).name ?? 'Untitled',
        dueDate: act.dueDate ?? (act as any).due ?? '',
        submittedAt: act.submittedAt,
        status: act.status === 'submitted' ? 'on-time' : act.status === 'late' ? 'late' : 'pending',
        scoreStatus: formatSubmissionScore(act),
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

        // fetch details for each class to get activities/assessments
        const detailed: StudentClassDetails[] = [];
        for (const c of classes) {
          try {
            const det = await studentApi.getClassDetails(c._id);
            if (det.success && det.data?.class) detailed.push(det.data.class);
            else detailed.push(c as StudentClassDetails);
          } catch (err) {
            // fallback to summary
            detailed.push(c as StudentClassDetails);
          }
        }

        if (cancelled) return;

        const mapped = detailed.map(mapClassToSection);
        // Attempt to fetch per-item submissions (activities) to show grading info
        for (const secIdx in mapped) {
          const sec = mapped[secIdx];
          // class id is sec.id
          for (let i = 0; i < sec.items.length; i++) {
            const it = sec.items[i];
            // only attempt for activities (id starting with activity-)
            if (it.id.startsWith('activity-')) {
              const activityId = it.id.replace('activity-', '');
              try {
                const subRes = await studentApi.getSubmission(sec.id, activityId);
                if (subRes.success && subRes.data?.submission) {
                  const submission = subRes.data.submission as any;
                  // Expect submission to have score and totalScore or graded flag
                  if (submission.graded || typeof submission.score === 'number') {
                    const score = typeof submission.score === 'number' ? submission.score : submission.score?.value;
                    const total = typeof it.points === 'number' ? it.points : submission.totalScore;
                    sec.items[i].scoreStatus = typeof score === 'number' && typeof total === 'number' ? `${score}/${total}` : `${score ?? 'Score'} pts`;
                    sec.items[i].status = submission.late ? 'late' : 'on-time';
                  } else {
                    sec.items[i].scoreStatus = 'Score Pending';
                  }
                }
              } catch (e) {
                // ignore per-item fetch errors
              }
            }
          }
        }

        setSections(mapped);
        setOpen(Object.fromEntries(mapped.map((m) => [m.id, true])));
      } catch (err: any) {
        setError(err?.message || 'Unable to load to-do list');
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

    const handleOpen = () => {
      const rawId = item.id.includes('-') ? item.id.split('-').slice(1).join('-') : item.id;

      if (item.category === 'Activity') {
        router.push(`/student_page/student_class/${classId}/activity/${rawId}`);
        return;
      }

      if (item.category === 'Quiz' || item.category === 'Exam') {
        // If scored (format score/total) open results page, otherwise open assessment page
        const isScored = typeof item.scoreStatus === 'string' && item.scoreStatus.includes('/');
        if (isScored) {
          router.push(`/student_page/student_class/${classId}/assessment/${rawId}/results`);
        } else {
          router.push(`/student_page/student_class/${classId}/assessment/${rawId}`);
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
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8F5E9] text-[#2E7D32] dark:bg-[#132a13] dark:text-emerald-400">
          <ListTodo className="h-5 w-5" />
        </div>
        <div>
          <h1 className="m-0 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">To-do List</h1>
          <p className="m-0 text-sm text-slate-500 dark:text-slate-400">List of complete and pending activities</p>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-6">
        {loading && (
          <div className="p-4 text-sm text-slate-600">Loading to-do items…</div>
        )}
        {error && (
          <div className="p-4 text-sm text-red-600">{error}</div>
        )}
        {!loading && sections.length === 0 && (
          <div className="p-4 text-sm text-slate-600">No activities or assessments found.</div>
        )}

        {sections.map((section) => (
          <section key={section.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            {/* Section header */}
            <button
              onClick={() => toggle(section.id)}
              className="flex w-full items-center justify-between bg-gradient-to-r from-green-600 to-emerald-600 px-5 py-3 text-left text-white hover:opacity-95"
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
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {section.items.map((item) => (
                  <div key={item.id} className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                    {/* Left */}
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
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
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      {/* Legend / note */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-4">
          <div className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Completed</div>
          <div className="inline-flex items-center gap-2"><Clock className="h-4 w-4 text-amber-500" /> Pending Score</div>
          <div className="inline-flex items-center gap-2"><FileText className="h-4 w-4 text-slate-500" /> Activity details open per item</div>
        </div>
      </div>
    </div>
  );
}
