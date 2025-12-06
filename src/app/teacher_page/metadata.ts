import type { Metadata } from 'next';

// Teacher section metadata
export const teacherMetadata: Metadata = {
  title: {
    default: 'Teacher Dashboard',
    template: '%s | Teacher - GC Quest',
  },
  description: 'Manage your classes, create assessments, and track student progress on GC Quest.',
};

// Page-specific metadata generators
export const getTeacherPageMetadata = (page: string): Metadata => {
  const pages: Record<string, Metadata> = {
    dashboard: {
      title: 'Dashboard',
      description: 'Overview of your classes, recent activity, and student performance.',
    },
    classes: {
      title: 'Classes',
      description: 'Manage your classes and enrolled students.',
    },
    assessment: {
      title: 'Assessments',
      description: 'Create and manage quizzes, exams, and activities.',
    },
    'ai-studio': {
      title: 'AI Studio',
      description: 'Generate flashcards, summaries, and assessments using AI.',
    },
    library: {
      title: 'Library',
      description: 'Manage your teaching materials and resources.',
    },
    leaderboards: {
      title: 'Leaderboards',
      description: 'Track student rankings and performance.',
    },
    analytics: {
      title: 'Analytics',
      description: 'View detailed analytics and insights on student performance.',
    },
    'study_rooms': {
      title: 'Study Rooms',
      description: 'Monitor and manage student study rooms.',
    },
    profile: {
      title: 'Profile',
      description: 'Manage your account settings and preferences.',
    },
    history: {
      title: 'Activity History',
      description: 'View your teaching activity and content creation history.',
    },
  };

  return pages[page] || { title: page.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) };
};
