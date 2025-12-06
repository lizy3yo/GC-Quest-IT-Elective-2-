/**
 * ORGANISM: ClassList
 * Complete class listing with data fetching
 * Uses custom hooks and molecules
 */

import React from 'react';
import { useClasses } from '@/hooks/useClassRequest';
import { DataContainer } from '@/components/molecules/DataContainer';
import { ClassCard } from '@/components/molecules/ClassCard';
import type { ClassFilters } from '@/interfaces/class.interface';

interface ClassListProps {
  filters?: ClassFilters;
  onClassClick?: (id: string) => void;
  showTeacher?: boolean;
  className?: string;
}

export const ClassList: React.FC<ClassListProps> = ({
  filters,
  onClassClick,
  showTeacher = false,
  className = ''
}) => {
  // Use custom hook with standard interface
  const { data, state, error } = useClasses(filters);

  return (
    <div className={className}>
      <DataContainer
        state={state as any}
        error={error}
        emptyMessage="No classes found."
        loadingMessage="Loading classes..."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.classes?.map((classData) => (
            <ClassCard
              key={classData.id}
              classData={classData}
              onClick={onClassClick}
              showTeacher={showTeacher}
            />
          ))}
        </div>

        {data?.totalPages && data.totalPages > 1 && (
          <div className="mt-6 flex justify-center">
            <p className="text-sm text-gray-600">
              Page {data.page} of {data.totalPages}
            </p>
          </div>
        )}
      </DataContainer>
    </div>
  );
};
