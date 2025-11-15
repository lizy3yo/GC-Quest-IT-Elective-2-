"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Chip } from "@/components/atoms/Chip";

type DueType = "Activity" | "Assignment" | "Quiz" | "Exam";

interface DueItem {
  _id: string;
  subject: string;
  classCode: string;
  type: DueType;
  title: string;
  dueAt: string;
  link: string;
  classId?: string;
  course?: string;
  submittedAt?: string;
  status?: "on-time" | "late" | "pending";
  scoreStatus?: string;
  points?: number;
}

interface NextDueProps {
  nextDueItems: DueItem[];
  getUrgency: (iso: string) => {
    level: "critical" | "soon" | "normal";
    label: string;
    isUrgent: boolean;
  };
}

export default function NextDue({ nextDueItems, getUrgency }: NextDueProps) {
  return (
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
                      <div className="due-card-left">
                        <h3 className="title-truncate">
                          {item.title || item.subject}
                        </h3>
                        <p className={`due-time ${urgency.level}`}>
                          {urgency.label}
                        </p>
                      </div>

                      <div className="due-card-center">
                        <Chip variant="badge">{item.type}</Chip>
                      </div>

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
  );
}
