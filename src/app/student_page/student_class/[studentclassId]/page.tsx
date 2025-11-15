"use client";

import { useParams } from "next/navigation";
import { useClassDetails } from "@/hooks/useClassDetails";
import LoadingTemplate2 from "@/components/atoms/loading_template_2/loading2";
import ClassHeader from "@/components/organisms/ClassHeader";
import ClassTabs from "@/components/molecules/ClassTabs";
import Feed from "@/components/organisms/Feed";
import Resources from "@/components/organisms/Resources";
import Assessments from "@/components/organisms/Assessments";
import StudentList from "@/components/organisms/StudentList";
import { useState } from "react";

export default function StudentClassPage() {
  const params = useParams();
  const studentclassId = params.studentclassId as string;

  const { data: classDetails, isLoading, isError, error } = useClassDetails(studentclassId);
  const [activeTab, setActiveTab] = useState("Overview");

  if (isLoading) {
    return <LoadingTemplate2 title="Loading class details..." />;
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 dark:text-red-400 mb-2">
            Error loading class
          </div>
          <div className="text-slate-600 dark:text-slate-300 text-sm">
            {error?.message || "An unknown error occurred."}
          </div>
        </div>
      </div>
    );
  }

  if (!classDetails) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8 flex items-center justify-center">
        <div className="text-slate-600 dark:text-slate-300">
          No class details found.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6 transition-colors duration-200">
      <div className="max-w-7xl mx-auto">
        <ClassHeader classDetails={classDetails} />
        <ClassTabs activeTab={activeTab} setActiveTab={setActiveTab} />

        <main className="space-y-6">
          {activeTab === "Overview" && (
            <Feed classDetails={classDetails} />
          )}
          {activeTab === "Resources and Assessments" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Resources resources={classDetails.resources || []} />
              <Assessments assessments={classDetails.assessments || []} classId={studentclassId} />
            </div>
          )}
          {activeTab === "Class List" && (
            <StudentList
              students={classDetails.students || []}
              instructor={classDetails.instructor}
            />
          )}
        </main>
      </div>
    </div>
  );
}
