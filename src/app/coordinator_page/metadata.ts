import type { Metadata } from 'next';

// Coordinator section metadata
export const coordinatorMetadata: Metadata = {
  title: {
    default: 'Coordinator Dashboard',
    template: '%s | Coordinator - GC Quest',
  },
  description: 'Manage users, classes, and system settings as a coordinator on GC Quest.',
};

// Page-specific metadata generators
export const getCoordinatorPageMetadata = (page: string): Metadata => {
  const pages: Record<string, Metadata> = {
    dashboard: {
      title: 'Dashboard',
      description: 'Overview of system statistics, users, and recent activity.',
    },
    students: {
      title: 'Students',
      description: 'Manage student accounts and enrollments.',
    },
    teachers: {
      title: 'Teachers',
      description: 'Manage teacher accounts and class assignments.',
    },
    parents: {
      title: 'Parents',
      description: 'Manage parent accounts and student associations.',
    },
    classes: {
      title: 'Classes',
      description: 'Manage classes, schedules, and enrollments.',
    },
    reports: {
      title: 'Reports',
      description: 'Generate and view system reports and analytics.',
    },
    settings: {
      title: 'Settings',
      description: 'Configure system settings and preferences.',
    },
  };

  return pages[page] || { title: page.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) };
};
