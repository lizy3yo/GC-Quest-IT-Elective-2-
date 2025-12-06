import type { Metadata } from 'next';

// Parent section metadata
export const parentMetadata: Metadata = {
  title: {
    default: 'Parent Dashboard',
    template: '%s | Parent - GC Quest',
  },
  description: 'Monitor your child\'s academic progress, view grades, and stay connected with teachers on GC Quest.',
};

// Page-specific metadata generators
export const getParentPageMetadata = (page: string): Metadata => {
  const pages: Record<string, Metadata> = {
    dashboard: {
      title: 'Dashboard',
      description: 'Overview of your child\'s academic performance and recent activity.',
    },
    progress: {
      title: 'Progress',
      description: 'Track your child\'s learning progress and achievements.',
    },
    grades: {
      title: 'Grades',
      description: 'View your child\'s grades and assessment results.',
    },
    messages: {
      title: 'Messages',
      description: 'Communicate with teachers and school staff.',
    },
    profile: {
      title: 'Profile',
      description: 'Manage your account settings and preferences.',
    },
  };

  return pages[page] || { title: page.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) };
};
