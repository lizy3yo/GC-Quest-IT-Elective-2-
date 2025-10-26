"use client";

import Link from "next/link";

export default function TeacherPage() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-slate-800 dark:text-slate-100 mb-4">Welcome to GCQuest (Teacher)</h1>
        <p className="text-lg text-slate-600 dark:text-slate-400">Your teacher dashboard for classes and content</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
          <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3">Manage Classes</h3>
          <p className="text-slate-600 dark:text-slate-400 mb-4">Create and manage your classes</p>
          <Link href="/teacher_page/dashboard" className="inline-block bg-green-500 hover:bg-green-600 text-white font-medium px-6 py-3 rounded-xl transition-all duration-200 hover:scale-105 shadow-md hover:shadow-lg">
            Go to Dashboard
          </Link>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
          <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3">Create Content</h3>
          <p className="text-slate-600 dark:text-slate-400 mb-4">Build flashcards, tests, and lessons</p>
          <Link href="/teacher_page/flashcard" className="inline-block bg-blue-500 hover:bg-blue-600 text-white font-medium px-6 py-3 rounded-xl transition-all duration-200 hover:scale-105 shadow-md hover:shadow-lg">
            Create Flashcards
          </Link>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
          <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3">Assessments</h3>
          <p className="text-slate-600 dark:text-slate-400 mb-4">Create and grade practice tests</p>
          <Link href="/teacher_page/practice_tests" className="inline-block bg-purple-500 hover:bg-purple-600 text-white font-medium px-6 py-3 rounded-xl transition-all duration-200 hover:scale-105 shadow-md hover:shadow-lg">
            Create Test
          </Link>
        </div>
      </div>
    </div>
  );
}