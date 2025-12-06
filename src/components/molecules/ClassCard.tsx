import React from 'react';
import type { Class } from '@/interfaces/class.interface';

interface ClassCardProps {
  classData: Class;
  onClick?: (id: string) => void;
  showTeacher?: boolean;
  className?: string;
}

export const ClassCard: React.FC<ClassCardProps> = ({
  classData,
  onClick,
  showTeacher = false,
  className = ''
}) => {
  const handleClick = () => {
    if (onClick) {
      onClick(classData.id);
    }
  };

  return (
    <div
      className={`bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6 ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
      onClick={handleClick}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-900">{classData.name}</h3>
        {classData.isActive && (
          <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded">
            Active
          </span>
        )}
      </div>

      {classData.description && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{classData.description}</p>
      )}

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>{classData.students.length} students</span>
        {classData.code && (
          <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
            {classData.code}
          </span>
        )}
      </div>
    </div>
  );
};
