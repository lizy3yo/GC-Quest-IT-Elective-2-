/**
 * PAGE: TeacherClassesPage
 * Complete page for teacher class management
 */

import React, { useState } from 'react';
import { ClassList } from '@/components/organisms/ClassList';
import type { ClassFilters } from '@/interfaces/class.interface';

interface TeacherClassesPageProps {
  teacherId: string;
  className?: string;
}

export const TeacherClassesPage: React.FC<TeacherClassesPageProps> = ({
  teacherId,
  className = ''
}) => {
  const [filters, setFilters] = useState<ClassFilters>({
    teacherId,
    isActive: true
  });

  const handleClassClick = (id: string) => {
    // Navigate to class detail page
    console.log('Navigate to class:', id);
  };

  const toggleActiveFilter = () => {
    setFilters(prev => ({
      ...prev,
      isActive: prev.isActive ? undefined : true
    }));
  };

  return (
    <div className={`container mx-auto px-4 py-8 ${className}`}>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">My Classes</h1>
        <button
          onClick={toggleActiveFilter}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {filters.isActive ? 'Show All' : 'Show Active Only'}
        </button>
      </div>

      <ClassList
        filters={filters}
        onClassClick={handleClassClick}
        showTeacher={false}
      />
    </div>
  );
};
