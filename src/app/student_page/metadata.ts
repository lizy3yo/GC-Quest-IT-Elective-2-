import type { Metadata } from 'next';

// Student section metadata - can be imported in server components
export const studentMetadata: Metadata = {
  title: {
    default: 'Student Dashboard',
    template: '%s | Student - GC Quest',
  },
  description: 'Access your classes, flashcards, practice tests, and study materials on GC Quest.',
};

// Page-specific metadata generators
export const getStudentPageMetadata = (page: string): Metadata => {
  const pages: Record<string, Metadata> = {
    dashboard: {
      title: 'Dashboard',
      description: 'View your learning progress, upcoming assignments, and recent activity.',
    },
    'private_library': {
      title: 'Private Library',
      description: 'Manage your personal flashcards, summaries, and practice tests.',
    },
    'public_library': {
      title: 'Public Library',
      description: 'Discover and study shared flashcards from the community.',
    },
    'practice_tests': {
      title: 'Practice Tests',
      description: 'Take practice tests to prepare for your exams.',
    },
    'study_rooms': {
      title: 'Study Rooms',
      description: 'Collaborate with classmates in virtual study rooms.',
    },
    'study_mode': {
      title: 'Study Mode',
      description: 'Focus on your studies with distraction-free learning.',
    },
    leaderboards: {
      title: 'Leaderboards',
      description: 'See how you rank among your peers.',
    },
    resources: {
      title: 'Resources',
      description: 'Access educational resources and learning materials.',
    },
    profile: {
      title: 'Profile',
      description: 'Manage your account settings and preferences.',
    },
    history: {
      title: 'Activity History',
      description: 'View your learning activity and progress over time.',
    },
    achievements: {
      title: 'Achievements',
      description: 'View your earned badges and accomplishments.',
    },
  };

  return pages[page] || { title: page.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) };
};
