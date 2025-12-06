"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useMemo } from "react";

// Map specific route segments to user‑friendly labels
const LABEL_MAP: Record<string, string> = {
  student_page: "Dashboard", // base handled separately
  dashboard: "Dashboard",
  
  flashcards: "Library",
  create: "Create",
  upload: "Upload",
  practice_tests: "Practice Tests",
  study_mode: "Study Mode",
  private_library: "Private Library",
  public_library: "Public Library",
  student_class: "Classes",
  to_do_list: "To-do List",
  student_profile: "Profile",
  achievements: "Achievements",
  analytics: "Analytics",
  help: "Help",
  privacy_policy: "Privacy Policy",
  settings: "Settings",
  folder: "Folder",
  flashcard: "Flashcard",
  learn: "Learn",
  match: "Match",
  test: "Test",
  analyze: "Analyze",
  assessment: "Assessment",
  resources: "Resources",
  quiz: "Quiz",
  exam: "Exam",
  activity: "Activity",
  results: "Results",
  summaries: "Summaries",
};

// Inline SVG icons matching those used in the sidebar (scaled to 16px for breadcrumbs)
const ICON_MAP: Record<string, React.ReactNode> = {
  dashboard: (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 15v-4a2 2 0 012-2h4a2 2 0 012 2v4" />
    </svg>
  ),
  student_class: (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  private_library: (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
  public_library: (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2M15 7a3 3 0 11-6 0 3 3 0 016 0zM21 10a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  flashcards: (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  library: (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  practice_tests: (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  assessment: (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  resources: (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  results: (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  study_mode: (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  achievements: (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
  ),
  settings: (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  help: (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  privacy_policy: (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5-6v6a7 7 0 11-14 0V6a7 7 0 1114 0z" />
    </svg>
  ),
};

function humanize(segment: string, previousSegment?: string): string {
  if (LABEL_MAP[segment]) return LABEL_MAP[segment];
  
  // Context-aware labels for MongoDB ObjectIDs
  if (/^[a-f0-9]{24}$/i.test(segment)) {
    if (previousSegment === 'student_class') return "Class Details";
    if (previousSegment === 'assessment') return "Assessment Details";
    if (previousSegment === 'flashcard') return "Flashcard Details";
    if (previousSegment === 'folder') return "Folder Details";
    return "Details"; // Fallback for other IDs
  }
  
  if (/^[0-9a-f-]{8,}$/i.test(segment)) return segment.slice(0, 8) + "…"; // UUID/truncate
  
  return segment
    .replace(/[-_]+/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function Breadcrumbs() {
  const pathname = usePathname();
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const crumbs = useMemo(() => {
    if (!pathname || pathname.startsWith("/auth")) return null;
    const segments = pathname.split("/").filter(Boolean);
    const studentIdx = segments.indexOf("student_page");
    if (studentIdx === -1) return null; // Only show for student area

    // Check navigation context (only on client)
    const breadcrumbContext = isClient ? sessionStorage.getItem('breadcrumb_context') : null;
    const isAssessmentPage = segments.includes("assessment");
    const isPracticeTestPage = segments.includes("practice_tests");
    const isSummariesPage = segments.includes("summaries");
    
    // Handle assessment from to-do list
    if (isAssessmentPage && breadcrumbContext === 'to_do_list') {
      const assessmentIdx = segments.indexOf("assessment");
      const hasResults = segments.includes("results");
      
      const list: { label: string; href?: string; icon?: React.ReactNode }[] = [
        { label: "Home", href: "/student_page/dashboard", icon: ICON_MAP["dashboard"] },
        { label: "To-do List", href: "/student_page/to_do_list", icon: ICON_MAP["dashboard"] },
      ];
      
      // Add Assessment Details
      if (assessmentIdx >= 0 && assessmentIdx + 1 < segments.length) {
        list.push({ 
          label: "Assessment Details", 
          href: undefined, 
          icon: ICON_MAP["assessment"] 
        });
      }
      
      // Add Results if present
      if (hasResults) {
        const assessmentPath = segments.slice(0, segments.indexOf("results")).join("/");
        list.push({ 
          label: "Results", 
          href: `/${assessmentPath}`,
          icon: ICON_MAP["results"] 
        });
      }
      
      return list;
    }
    
    // Handle practice tests from library
    if (isPracticeTestPage && (breadcrumbContext === 'private_library' || breadcrumbContext === 'public_library')) {
      const libraryLabel = breadcrumbContext === 'private_library' ? 'Private Library' : 'Public Library';
      const libraryPath = `/student_page/${breadcrumbContext}`;
      const hasTake = segments.includes("take");
      const hasResults = segments.includes("results");
      const hasGenerate = segments.includes("generate");
      const savedTab = isClient ? sessionStorage.getItem('breadcrumb_tab') : null;
      const tabParam = savedTab || 'practice_tests';
      
      const list: { label: string; href?: string; icon?: React.ReactNode }[] = [
        { label: "Home", href: "/student_page/dashboard", icon: ICON_MAP["dashboard"] },
        { label: libraryLabel, href: `${libraryPath}?tab=${tabParam}`, icon: ICON_MAP["library"] },
      ];
      
      // Add Practice Test Details if viewing a specific test
      const practiceTestIdx = segments.indexOf("practice_tests");
      if (practiceTestIdx >= 0 && practiceTestIdx + 1 < segments.length && !hasGenerate) {
        const testId = segments[practiceTestIdx + 1];
        if (testId && testId !== 'generate' && testId !== 'results' && testId !== 'shared') {
          list.push({ 
            label: "Practice Test", 
            href: hasTake ? `/student_page/practice_tests/${testId}` : undefined,
            icon: ICON_MAP["practice_tests"] 
          });
        }
      }
      
      // Add Take Test if present
      if (hasTake) {
        list.push({ 
          label: "Take Test", 
          href: undefined,
          icon: ICON_MAP["test"] 
        });
      }
      
      // Add Results if present
      if (hasResults) {
        list.push({ 
          label: "Results", 
          href: undefined,
          icon: ICON_MAP["results"] 
        });
      }
      
      return list;
    }
    
    // Handle summaries from library
    if (isSummariesPage && breadcrumbContext === 'private_library') {
      const summariesIdx = segments.indexOf("summaries");
      const hasSummaryId = summariesIdx >= 0 && summariesIdx + 1 < segments.length;
      const savedTab = isClient ? sessionStorage.getItem('breadcrumb_tab') : null;
      const tabParam = savedTab || 'summaries';
      
      const list: { label: string; href?: string; icon?: React.ReactNode }[] = [
        { label: "Home", href: "/student_page/dashboard", icon: ICON_MAP["dashboard"] },
        { label: "Private Library", href: `/student_page/private_library?tab=${tabParam}`, icon: ICON_MAP["library"] },
      ];
      
      // Add Summary Details if viewing a specific summary
      if (hasSummaryId) {
        list.push({ 
          label: "Summary", 
          href: undefined,
          icon: ICON_MAP["resources"] 
        });
      }
      
      return list;
    }

    let tail = segments.slice(studentIdx + 1);
    if (tail[0] === "dashboard") tail = tail.slice(1); // treat dashboard as home

    // Build breadcrumb trail with smart filtering
    const filtered: string[] = [];
    const fullPath: string[] = []; // Keep track of full path for href construction
    
    for (let i = 0; i < tail.length; i++) {
      const segment = tail[i];
      const isMongoId = /^[a-f0-9]{24}$/i.test(segment);
      
      // Keep MongoDB IDs in breadcrumb for important contexts
      if (isMongoId) {
        fullPath.push(segment);
        
        // Keep IDs that follow these segments: student_class, assessment
        if (i > 0 && ['student_class', 'assessment'].includes(tail[i - 1])) {
          filtered.push(segment);
        }
        // Otherwise skip the ID from breadcrumb display
        continue;
      }
      
      fullPath.push(segment);
      filtered.push(segment);
    }

    const list: { label: string; href?: string; icon?: React.ReactNode }[] = [
      { label: "Home", href: "/student_page/dashboard", icon: ICON_MAP["dashboard"] },
    ];

    let accPath = "/student_page";
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
      
      // Special handling for different breadcrumb segments
      let href: string | undefined = undefined;
      if (!isLast) {
        const savedTab = isClient ? sessionStorage.getItem('breadcrumb_tab') : null;
        
        if (seg === 'assessment') {
          // Link back to the class page with the saved tab or default to resources
          const classPathMatch = accPath.match(/^(\/student_page\/student_class\/[a-f0-9]{24})/);
          const tabParam = savedTab || 'Resources and Assessments';
          const tabQuery = tabParam === 'Resources and Assessments' ? 'resources' : tabParam.toLowerCase();
          href = classPathMatch ? `${classPathMatch[1]}?tab=${tabQuery}` : undefined;
        } else if (seg === 'results') {
          // Results should link back to the assessment page (remove /results from path)
          href = accPath.replace(/\/results$/, '');
        } else if (seg === 'student_class' && nextSegmentIsId) {
          // If we're on a class detail page (student_class followed by an ID),
          // make "Classes" clickable to go back to the classes list
          href = accPath;
        } else if (isMongoId && previousSegment === 'student_class') {
          // Class Details ID - check if we're in an assessment context
          const nextSegment = i + 1 < filtered.length ? filtered[i + 1] : undefined;
          if (nextSegment === 'assessment') {
            // Link to saved tab or default to resources tab when in assessment context
            const tabParam = savedTab || 'Resources and Assessments';
            const tabQuery = tabParam === 'Resources and Assessments' ? 'resources' : tabParam.toLowerCase();
            href = `${accPath}?tab=${tabQuery}`;
          }
          // Otherwise no link (current page)
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
