import Link from 'next/link';
import { IClassInfo } from '@/interfaces';

interface ClassCardProps {
  classInfo: IClassInfo;
  getScheduleDisplay: (classInfo: IClassInfo) => string;
}

export default function ClassCard({ classInfo, getScheduleDisplay }: ClassCardProps) {
  return (
    <div
      key={classInfo._id}
      className="relative bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 p-6 flex flex-col justify-between"
    >
      {/* Header: title left, code pill right to avoid overlap */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-0 max-w-[calc(100%-120px)] break-words">
          {classInfo.name}
        </h3>
        <span className={`inline-block px-3 py-1.5 rounded-full text-sm font-medium shrink-0 bg-emerald-100 text-emerald-700 ring-1 ring-emerald-100 sm:px-2 sm:text-[12px]`}>
          Code: {classInfo.classCode}
        </span>
      </div>

      {/* Schedule Section */}
      <div className="mb-6 flex-1">
        <div className="flex items-center text-gray-600 mb-2">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-medium">Schedule</span>
        </div>
        <div className="text-sm text-gray-700">
          {getScheduleDisplay(classInfo)}
        </div>
      </div>

      {/* Instructor Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-3">
            <span className="text-xs font-medium text-white">
              {classInfo.teacher.split(' ').map(n => n[0]).join('').toUpperCase()}
            </span>
          </div>
          <span className="text-sm font-medium text-gray-700">
            {classInfo.teacher}
          </span>
        </div>
        <Link
          href={`/student_page/student_class/${classInfo._id}`}
          className="bg-gray-800 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors duration-200 text-sm font-medium"
        >
          Enter
        </Link>
      </div>
    </div>
  );
}
