import { StudentAssessment } from "@/interfaces";
import { useRouter } from "next/navigation";

interface AssessmentsProps {
  assessments: StudentAssessment[];
  classId: string;
}

export default function Assessments({ assessments, classId }: AssessmentsProps) {
  const router = useRouter();

  const navigateToActivity = (activityId: string) => {
    router.push(`/student_page/student_class/${classId}/assessment/${activityId}`);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Assessments</h2>
      {assessments.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-8 text-center">
          <div className="text-slate-500 dark:text-slate-400">No assessments available</div>
        </div>
      ) : (
        <div className="space-y-3">
          {assessments.map((assessment) => (
            <div
              key={assessment.id}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:shadow-sm transition-shadow cursor-pointer"
              onClick={() => navigateToActivity(assessment.id)}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-1">
                    {assessment.title}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                    <div>Due Date: {new Date(assessment.dueDate).toLocaleString()}</div>
                    <div className={`font-medium ${assessment.type === 'Quiz' ? 'text-blue-600' : 'text-red-600'}`}>
                      {assessment.type}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
