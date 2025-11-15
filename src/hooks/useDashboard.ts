"use client";

import { useQuery } from '@tanstack/react-query';
import { studentApi } from '@/services/studentService';
import useAuth from './useAuth';

export function useDashboard() {
  const { user } = useAuth();

  const fetchDashboardData = async () => {
    if (!user?._id) {
      return null;
    }
    
    const [
      flashcardsRes,
      classesRes,
    ] = await Promise.all([
      studentApi.getFlashcards({ userId: user._id }),
      studentApi.getClasses({ active: true, limit: 20 }),
    ]);

    const flashcards = flashcardsRes.success ? flashcardsRes.data?.flashcards || [] : [];
    const classes = classesRes.success ? classesRes.data?.classes || [] : [];

    let dueItems: any[] = [];
    let assessmentsBySubject = new Map<string, number>();
    let assessmentsByType = { Activities: 0, Quizzes: 0, Exams: 0 };

    for (const cls of classes) {
      const detailsRes = await studentApi.getClassDetails(cls._id);
      if (detailsRes.success && detailsRes.data?.class) {
        const details = detailsRes.data.class;
        if (details.assessments) {
          for (const assessment of details.assessments) {
            const subj = details.subject || 'Uncategorized';
            assessmentsBySubject.set(subj, (assessmentsBySubject.get(subj) || 0) + 1);
            if (assessment.category === 'Activity') assessmentsByType.Activities++;
            if (assessment.category === 'Quiz') assessmentsByType.Quizzes++;
            if (assessment.category === 'Exam') assessmentsByType.Exams++;
            // Normalize assessment into a due item shape expected by UI components
            dueItems.push({
              ...assessment,
              classCode: details.classCode,
              subject: details.subject,
              classId: details._id,
              // UI expects `dueAt` (ISO string) and a navigable `link`
              dueAt: assessment.dueDate,
              link: `/student_page/student_class/${details._id}/assessment/${assessment.id}`,
            });
          }
        }
      }
    }

    const upcomingByDay = Array(7).fill(0).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const day = i === 0 ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short' });
      const count = dueItems.filter(item => new Date(item.dueDate).toDateString() === d.toDateString()).length;
      return { day, count };
    });

    return {
      summary: {
        flashcards: flashcards.length,
        classes: classes.length,
        activities: assessmentsByType.Activities,
        quizzes: assessmentsByType.Quizzes,
        exams: assessmentsByType.Exams,
      },
      studyDecks: flashcards.map(f => ({ ...f, cardCount: f.cards?.length || 0, progress: 0, lastStudied: f.updatedAt || f.createdAt || '' })),
      subjectBreakdown: Array.from(assessmentsBySubject.entries()).map(([subject, count]) => ({ subject, count })),
      assessmentsBySubject: Array.from(assessmentsBySubject.entries()).map(([subject, count]) => ({ subject, count })),
      assessmentsByType: Object.entries(assessmentsByType).map(([type, count]) => ({ type, count })),
      upcomingByDay,
      dueItems,
    };
  };

  return useQuery({
    queryKey: ['dashboard', user?._id],
    queryFn: fetchDashboardData,
    enabled: !!user?._id,
  });
}
