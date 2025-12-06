"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type Props = {
  params: Promise<{
    classId: string;
    assessmentType: string;
    assessmentId: string;
    studentId: string;
  }>;
};

export default function RedirectPage({ params }: Props) {
  const router = useRouter();

  useEffect(() => {
    async function redirect() {
      const resolvedParams = await params;
      const { assessmentType, assessmentId, studentId } = resolvedParams;
      
      // Redirect quiz/exam to the old route structure
      if (assessmentType === 'quiz' || assessmentType === 'exam') {
        router.replace(`/teacher_page/${assessmentType}/${assessmentId}/student/${studentId}`);
      } else {
        // For activities, redirect to activity route
        router.replace(`/teacher_page/classes/${resolvedParams.classId}/assessments/${assessmentType}/${assessmentId}/activity/${studentId}`);
      }
    }
    
    redirect();
  }, [params, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-rose-500 border-t-transparent mx-auto mb-4"></div>
        <p className="text-slate-600">Redirecting...</p>
      </div>
    </div>
  );
}
