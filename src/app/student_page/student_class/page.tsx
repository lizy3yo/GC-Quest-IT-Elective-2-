"use client";

import { useState, useMemo } from "react";
import { useStudentClasses } from "@/hooks/useStudentClasses";
import LoadingTemplate2 from '@/components/atoms/loading_template_2/loading2';
import ClassCard from "@/components/molecules/ClassCard";
import JoinClassForm from "@/components/molecules/JoinClassForm";
import ClassScheduleModal from "@/components/organisms/ClassScheduleModal";
import { IClassInfo } from "@/interfaces";

export default function StudentClassPage() {
  const { data: classes = [], isLoading, isError, error } = useStudentClasses();
  const [searchTerm, setSearchTerm] = useState("");
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);

  const filteredClasses = useMemo(() => classes.filter((c) =>
    `${c.name} ${c.teacher} ${c.subject} ${c.classCode}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  ), [classes, searchTerm]);

  const getScheduleDisplay = (classInfo: IClassInfo) => {
    if (classInfo.day && classInfo.time) {
      return `${classInfo.day.join(" & ")} · ${classInfo.time}`;
    }
    const schedules = [
      'Mon & Wed · 10:00-11:30 AM',
      'Tue & Thu · 1:00-2:30 PM',
      'Fri · 9:00-12:00 NN'
    ];
    const index = classInfo.name.length % schedules.length;
    return schedules[index];
  };

  if (isLoading) {
    return <LoadingTemplate2 title="Loading your classes..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Classes</h1>
          <p className="text-gray-600">
            Manage your enrolled classes and discover new learning opportunities
          </p>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div className="flex-1 max-w-md">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search classes..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setIsScheduleOpen(true)}
            className="ml-4 bg-gray-800 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors duration-200 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Class Schedule
          </button>
        </div>

        {showJoinForm && <JoinClassForm onClose={() => setShowJoinForm(false)} />}

        {isError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">{error?.message || 'Failed to load classes.'}</p>
          </div>
        )}

        <div>
          {filteredClasses.length === 0 ? (
            <div className="text-center py-16">
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No classes found
              </h3>
              <p className="text-gray-600 mb-6">
                {searchTerm ? "No classes match your search term." : "You haven't joined any classes yet."}
              </p>
              <button
                onClick={() => setShowJoinForm(true)}
                className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-all duration-200 text-sm"
              >
                Join a Class
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredClasses.map((classInfo) => (
                <ClassCard key={classInfo._id} classInfo={classInfo} getScheduleDisplay={getScheduleDisplay} />
              ))}
            </div>
          )}
        </div>

        <ClassScheduleModal
          isOpen={isScheduleOpen}
          onClose={() => setIsScheduleOpen(false)}
          classes={classes}
        />
      </div>
    </div>
  );
}