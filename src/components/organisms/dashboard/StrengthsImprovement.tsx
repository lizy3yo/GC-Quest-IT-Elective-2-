"use client";

import { TrendingUp, ExternalLink } from "lucide-react";
import Link from "next/link";

interface SubjectPerformance {
  subject: string;
  score: number; // average score percentage
  completed: number;
  total: number;
  trend?: "up" | "down" | "stable";
  classId?: string;
  className?: string;
}

interface StrengthsImprovementProps {
  data: SubjectPerformance[];
  type: "strengths" | "focus";
}

export function StrengthsImprovement({ data, type }: StrengthsImprovementProps) {
  // Sort by score to identify strengths (top performers) and improvement areas (lower performers)
  const sorted = [...data].sort((a, b) => b.score - a.score);
  
  // Top 3 as strengths, bottom 3 as improvement areas
  // Only show strengths if they have completed work and good scores
  const strengths = sorted.slice(0, 3).filter(s => s.score >= 70 && s.completed > 0);
  
  // Only show improvements if they have work (either low scores or pending items)
  const improvements = sorted.slice(-3).reverse().filter(s => {
    // Must have at least some activities/assessments
    if (s.total === 0) return false;
    // Show if score is low (and they have completed work to base it on)
    if (s.score < 70 && s.completed > 0) return true;
    // Or if they have pending work AND not already a strength (avoid duplicates)
    if (s.completed < s.total && s.score < 70) return true;
    return false;
  });
  
  // Select which data to display based on type
  const displayData = type === "strengths" ? strengths : improvements;

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-600 dark:text-emerald-400";
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 70) return "text-blue-600 dark:text-blue-400";
    if (score >= 60) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const getProgressColor = (score: number) => {
    if (score >= 90) return "bg-emerald-500";
    if (score >= 80) return "bg-green-500";
    if (score >= 70) return "bg-blue-500";
    if (score >= 60) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <div>
      {displayData.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            {type === "strengths" ? "🎯" : "✨"}
          </div>
          <p className="empty-title">
            {type === "strengths" ? "No strengths yet" : "All clear!"}
          </p>
          <p className="empty-desc">
            {type === "strengths" 
              ? "Complete more assessments to see your strengths" 
              : "Great job! No areas need immediate attention"}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {displayData.map((item, idx) => {
            const content = (
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate flex items-center gap-1.5">
                      {item.subject}
                      {type === "focus" && item.classId && (
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </span>
                    <span className={`text-xs font-bold tabular-nums ${getScoreColor(item.score)}`}>
                      {item.score}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${getProgressColor(item.score)} rounded-full transition-all duration-500`}
                      style={{ width: `${item.score}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      {item.completed}/{item.total} completed
                    </span>
                    {type === "strengths" && item.trend === "up" && (
                      <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                        <TrendingUp className="h-3 w-3" />
                        Improving
                      </span>
                    )}
                    {type === "focus" && item.completed < item.total && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400">
                        {item.total - item.completed} pending
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );

            if (type === "focus" && item.classId) {
              return (
                <Link
                  key={idx}
                  href={`/student_page/student_class/${item.classId}`}
                  className="block rounded-lg p-2 -m-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer group"
                >
                  {content}
                </Link>
              );
            }

            return (
              <div key={idx} className="block">
                {content}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
