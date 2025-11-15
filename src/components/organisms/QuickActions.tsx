"use client";

import Link from "next/link";

interface QuickActionsProps {
  resumeAssignmentLink: string | null;
}

export default function QuickActions({ resumeAssignmentLink }: QuickActionsProps) {
  return (
    <section aria-labelledby="quick-actions-title" className="col-span-4">
      <div className="panel panel-padded qa-panel">
        <h2 id="quick-actions-title" className="section-title">
          Quick Actions
        </h2>
        <div className="qa-group">
          <Link href="/student_page/study_mode" className="qa-link">
            <span className="qa-icon">▶</span>
            <span className="qa-text">Start Review</span>
          </Link>

          {resumeAssignmentLink ? (
            <Link href={resumeAssignmentLink} className="qa-link">
              <span className="qa-icon">▤</span>
              <span className="qa-text">Resume Assignment</span>
            </Link>
          ) : (
            <div aria-disabled className="qa-link">
              <span className="qa-icon">▤</span>
              <span className="qa-text">Resume Assignment</span>
            </div>
          )}

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
  );
}
