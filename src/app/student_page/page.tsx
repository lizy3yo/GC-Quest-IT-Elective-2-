'use client';

import Link from 'next/link';

export default function StudentPage() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-slate-800 dark:text-slate-100 mb-4">Welcome to GCQuest</h1>
        <p className="text-lg text-slate-600 dark:text-slate-400">Your personalized learning dashboard</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
          <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3">Continue Learning</h3>
          <p className="text-slate-600 dark:text-slate-400 mb-4">Pick up where you left off</p>
          <Link 
            href="/student_page/dashboard" 
            className="inline-block bg-[#1C2B1C] hover:brightness-110 text-white font-medium px-6 py-3 rounded-xl transition-all duration-200 hover:scale-105 shadow-md hover:shadow-lg"
          >
            Go to Dashboard
          </Link>
        </div>
        
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
          <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3">Study Now</h3>
          <p className="text-slate-600 dark:text-slate-400 mb-4">Start a new study session</p>
          <Link 
            href="/student_page/study_mode" 
            className="inline-block bg-blue-500 hover:bg-blue-600 text-white font-medium px-6 py-3 rounded-xl transition-all duration-200 hover:scale-105 shadow-md hover:shadow-lg"
          >
            Start Studying
          </Link>
        </div>
        
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
          <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-3">Practice Test</h3>
          <p className="text-slate-600 dark:text-slate-400 mb-4">Test your knowledge</p>
          <Link 
            href="/student_page/practice_tests" 
            className="inline-block bg-purple-500 hover:bg-purple-600 text-white font-medium px-6 py-3 rounded-xl transition-all duration-200 hover:scale-105 shadow-md hover:shadow-lg"
          >
            Take Test
          </Link>
        </div>
      </div>
    </div>
  );
}