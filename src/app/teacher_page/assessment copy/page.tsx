"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AssessmentPage() {
  const pathname = usePathname() || "";
  const isActive = (segment: string) =>
    pathname.endsWith(`/${segment}`) || pathname.endsWith(`/assessment`);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Assessment</h1>
      <p className="mb-6">Choose how you'd like to add an assessment:</p>

      <div className="flex gap-4">
        <Link
          href="/teacher_page/assessment/create"
          className={`flex-1 border rounded-lg p-5 hover:shadow-md transition ${
            isActive("create") ? "border-blue-500 bg-blue-50" : "border-gray-200"
          }`}
        >
          <h2 className="text-lg font-semibold">Create assessment</h2>
          <p className="text-sm text-gray-600 mt-2">
            Build an assessment from scratch. Add questions, configure scoring, and publish.
          </p>
        </Link>

        <Link
          href="/teacher_page/assessment/upload"
          className={`flex-1 border rounded-lg p-5 hover:shadow-md transition ${
            isActive("upload") ? "border-blue-500 bg-blue-50" : "border-gray-200"
          }`}
        >
          <h2 className="text-lg font-semibold">Upload assessment</h2>
          <p className="text-sm text-gray-600 mt-2">
            Import an existing assessment file or use a template to upload questions.
          </p>
        </Link>
      </div>

      <div className="mt-6 text-sm text-gray-500">
        Tip: select an option to navigate to its page. You'll see the corresponding UI there.
      </div>
    </div>
  );
}