/**
 * ORGANISM: StudentDashboardStats
 * Dashboard statistics display for students
 * Composes multiple hooks
 */

import React from 'react';
import { 
  useStudentFlashcards, 
  useStudentClasses,
  useDueItems 
} from '@/hooks/useStudentRequest';
import { LoadingSpinner } from '@/components/atoms/LoadingSpinner';
import { ErrorMessage } from '@/components/atoms/ErrorMessage';
import { isAnyLoading, hasAnyError, getFirstError } from '@/hooks/useQueryHook';

interface StudentDashboardStatsProps {
  className?: string;
}

export const StudentDashboardStats: React.FC<StudentDashboardStatsProps> = ({
  className = ''
}) => {
  // Fetch multiple data sources
  const flashcards = useStudentFlashcards();
  const classes = useStudentClasses();
  const dueItems = useDueItems();

  // Compose states from multiple hooks
  const isLoading = isAnyLoading(
    flashcards as any,
    classes as any,
    dueItems as any
  );

  const hasError = hasAnyError(
    flashcards as any,
    classes as any,
    dueItems as any
  );

  const error = getFirstError(
    flashcards as any,
    classes as any,
    dueItems as any
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (hasError) {
    return <ErrorMessage error={error} />;
  }

  const stats = [
    {
      label: 'Total Flashcards',
      value: flashcards.data?.total || 0,
      color: 'bg-blue-500'
    },
    {
      label: 'Active Classes',
      value: classes.data?.total || 0,
      color: 'bg-green-500'
    },
    {
      label: 'Due Items',
      value: dueItems.data?.length || 0,
      color: 'bg-orange-500'
    }
  ];

  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${className}`}>
      {stats.map((stat) => (
        <div key={stat.label} className="bg-white rounded-lg shadow p-6">
          <div className={`w-12 h-12 ${stat.color} rounded-lg mb-4`} />
          <h3 className="text-2xl font-bold text-gray-900">{stat.value}</h3>
          <p className="text-sm text-gray-600">{stat.label}</p>
        </div>
      ))}
    </div>
  );
};
