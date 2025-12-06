"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useMemo } from "react";

// Map specific route segments to user-friendly labels
const LABEL_MAP: Record<string, string> = {
  teacher_page: "Dashboard",
  dashboard: "Dashboard",
  classes: "Classes",
  class: "Classes",
  analytics: "Analytics",
  assessment: "Assessment",
  flashcard: "Library",
  library: "Library",
  assessments: "Assessments",
  activity: "Activity",
  quiz: "Quiz",
  exam: "Exam",
  task: "Task",
  student: "Student",
  students: "Students",
  settings: "Settings",
  create: "Create",
  edit: "Edit",
  results: "Results",
  submissions: "Submissions",
  "ai-studio": "AI Assessments",
  "ai-studio-resources": "AI Resources",
};

// Inline SVG icons matching those used in the sidebar
const ICON_MAP: Record<string, React.ReactNode> = {
  dashboard: (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 15v-4a2 2 0 012-2h4a2 2 0 012 2v4" />
    </svg>
  ),
  class: (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  analytics: (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3v18M20 12v6M2 7v12" />
    </svg>
  ),
  assessment: (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  quiz: (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  results: (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  flashcard: (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  library: (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  settings: (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

function humanize(segment: string, previousSegment?: string): string {
  if (LABEL_MAP[segment]) return LABEL_MAP[segment];
  
  // Context-aware labels for MongoDB ObjectIDs
  if (/^[a-f0-9]{24}$/i.test(segment)) {
    if (previousSegment === 'classes') return "Class Details";
    if (previousSegment === 'class') return "Class Details";
    if (previousSegment === 'assessments') return "Assessment Details";
    if (previousSegment === 'assessment') return "Assessment Details";
    if (previousSegment === 'quiz') return "Quiz Details";
    if (previousSegment === 'exam') return "Exam Details";
    if (previousSegment === 'student') return "Student Details";
    if (previousSegment === 'activity') return "Activity Details";
    return "Details"; // Fallback for other IDs
  }
  
  if (/^[0-9a-f-]{8,}$/i.test(segment)) return segment.slice(0, 8) + "…"; // UUID/truncate
  
  return segment
    .replace(/[-_]+/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function TeacherBreadcrumbs() {
  const pathname = usePathname();
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const crumbs = useMemo(() => {
    if (!pathname || pathname.startsWith("/auth")) return null;
    const segments = pathname.split("/").filter(Boolean);
    const teacherIdx = segments.indexOf("teacher_page");
    if (teacherIdx === -1) return null; // Only show for teacher area

    let tail = segments.slice(teacherIdx + 1);
    if (tail[0] === "dashboard") tail = tail.slice(1); // treat dashboard as home

    // Build breadcrumb trail with smart filtering
    const filtered: string[] = [];
    const fullPath: string[] = []; // Keep track of full path for href construction
    
    for (let i = 0; i < tail.length; i++) {
      const segment = tail[i];
      const isMongoId = /^[a-f0-9]{24}$/i.test(segment);
      
      // Skip standalone MongoDB ObjectId segments but keep them in path
      if (isMongoId) {
        fullPath.push(segment);
        
        // Keep the ID if it's part of important paths (assessment, class, etc.)
        if (i > 0 && ['assessments', 'assessment', 'classes', 'class', 'quiz', 'exam', 'student', 'activity'].includes(tail[i - 1])) {
          filtered.push(segment);
        }
        continue;
      }
      
      fullPath.push(segment);
      filtered.push(segment);
    }

    const list: { label: string; href?: string; icon?: React.ReactNode }[] = [
      { label: "Home", href: "/teacher_page/dashboard", icon: ICON_MAP["dashboard"] },
    ];

    let accPath = "/teacher_page";
    let fullPathIdx = 0;
    
    filtered.forEach((seg, i) => {
      // Reconstruct the actual path including any skipped IDs
      while (fullPathIdx < fullPath.length && fullPath[fullPathIdx] !== seg) {
        accPath += `/${fullPath[fullPathIdx]}`;
        fullPathIdx++;
      }
      accPath += `/${seg}`;
      fullPathIdx++;
      
      const isLast = i === filtered.length - 1;
      const isMongoId = /^[a-f0-9]{24}$/i.test(seg);
      const nextSegmentIsId = fullPathIdx < fullPath.length && /^[a-f0-9]{24}$/i.test(fullPath[fullPathIdx]);
      const previousSegment = i > 0 ? filtered[i - 1] : undefined;
      
      // Special handling for certain breadcrumb segments
      let href: string | undefined = undefined;
      if (!isLast) {
        const savedTab = isClient ? sessionStorage.getItem('breadcrumb_tab') : null;
        
        if (seg === 'assessments' && previousSegment && /^[a-f0-9]{24}$/i.test(previousSegment)) {
          // assessments segment after class ID - link back to class with saved tab
          const classPathMatch = accPath.match(/^(\/teacher_page\/classes\/[a-f0-9]{24})/);
          const tabParam = savedTab || 'resourcesassessments';
          href = classPathMatch ? `${classPathMatch[1]}?tab=${tabParam}` : undefined;
        } else if (seg === 'assessment') {
          // Link back to the class page with assessments tab
          const classPathMatch = accPath.match(/^(\/teacher_page\/classes\/[a-f0-9]{24})/);
          const tabParam = savedTab || 'resourcesassessments';
          href = classPathMatch ? `${classPathMatch[1]}?tab=${tabParam}` : undefined;
        } else if (seg === 'activity' && nextSegmentIsId) {
          // activity segment followed by ID - link back to class with saved tab
          const classPathMatch = accPath.match(/^(\/teacher_page\/classes\/[a-f0-9]{24})/);
          const tabParam = savedTab || 'resourcesassessments';
          href = classPathMatch ? `${classPathMatch[1]}?tab=${tabParam}` : undefined;
        } else if (seg === 'results' || seg === 'submissions') {
          // Link back to the assessment/quiz page
          href = accPath.replace(/\/(results|submissions)$/, '');
        } else if (seg === 'edit' || seg === 'create') {
          // Edit and create pages shouldn't be linked
          href = undefined;
        } else if ((seg === 'classes' || seg === 'class') && nextSegmentIsId) {
          // If we're on a class detail page (classes followed by an ID),
          // make "Classes" clickable to go back to the classes list
          href = '/teacher_page/classes';
        } else if (isMongoId && (previousSegment === 'classes' || previousSegment === 'class')) {
          // Class Details ID - check if we're in an assessment context
          const nextSegment = i + 1 < filtered.length ? filtered[i + 1] : undefined;
          if (nextSegment === 'assessments' || nextSegment === 'assessment') {
            // Link to saved tab when in assessment context
            const tabParam = savedTab || 'resourcesassessments';
            href = `${accPath}?tab=${tabParam}`;
          }
          // Otherwise no link (current page)
        } else if (isMongoId && previousSegment === 'activity') {
          // Activity Details ID - link back to class with saved tab
          const classPathMatch = accPath.match(/^(\/teacher_page\/classes\/[a-f0-9]{24})/);
          if (classPathMatch) {
            const tabParam = savedTab || 'resourcesassessments';
            href = `${classPathMatch[1]}?tab=${tabParam}`;
          }
        } else if (!isMongoId) {
          // Regular segments get their full path
          href = accPath;
        }
        // MongoDB IDs don't get links (href stays undefined)
      }
      
      list.push({ 
        label: humanize(seg, previousSegment), 
        href: href, 
        icon: ICON_MAP[seg] 
      });
    });
    
    return list;
  }, [pathname, isClient]);

  if (!crumbs) return null;

  return (
    <nav aria-label="Breadcrumb" className="hidden lg:block text-sm">
      <ol className="flex flex-wrap items-center gap-1 text-slate-500 dark:text-slate-400">
        {crumbs.map((c, idx) => {
          const isLast = idx === crumbs.length - 1;
          const common = "inline-flex items-center gap-1 max-w-[220px] truncate";
          return (
            <li key={idx} className="flex items-center group">
              {isLast || !c.href ? (
                <span
                  className={`${common} font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md`}
                  aria-current="page"
                >
                  {c.icon}
                  <span className="truncate">{c.label}</span>
                </span>
              ) : (
                <Link
                  href={c.href}
                  className={`${common} px-2 py-1 rounded-md hover:bg-[#1C2B1C]/10 hover:text-[#1C2B1C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C2B1C] transition-colors`}
                >
                  {c.icon}
                  <span className="truncate">{c.label}</span>
                </Link>
              )}
              {!isLast && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="mx-1 text-slate-300 dark:text-slate-600 group-last:hidden"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
