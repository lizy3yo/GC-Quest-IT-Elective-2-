"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SharedTestPage({ params }: { params: Promise<{ shareLink: string }> }) {
  const router = useRouter();
  const [test, setTest] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string>("");

  useEffect(() => {
    const initParams = async () => {
      const resolvedParams = await params;
      setShareLink(resolvedParams.shareLink);
    };
    initParams();
  }, [params]);

  useEffect(() => {
    if (!shareLink) return;
    
    const fetchTest = async () => {
      try {
        const res = await fetch(`/api/student_page/practice-test/share?shareLink=${shareLink}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Test not found');
        }

        setTest(data.test);
      } catch (err: any) {
        setError(err.message || 'Failed to load test');
      } finally {
        setLoading(false);
      }
    };

    fetchTest();
  }, [shareLink]);

  const handleTakeTest = () => {
    if (!test) return;
    sessionStorage.setItem('current_practice_test', JSON.stringify(test));
    router.push('/student_page/practice_tests/take');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent"></div>
      </div>
    );
  }

  if (error || !test) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
            Test Not Found
          </h3>
          <p className="text-red-700 dark:text-red-300 mb-4">
            {error || 'This test link is invalid or has expired.'}
          </p>
          <button
            onClick={() => router.push('/student_page/practice_tests')}
            className="px-6 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
          >
            Back to Practice Tests
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-8 text-white shadow-xl mb-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">📤</span>
          <span className="text-sm font-medium bg-white/20 px-3 py-1 rounded-full">
            Shared Test
          </span>
        </div>
        
        <h1 className="text-3xl font-bold mb-2">{test.title}</h1>
        <p className="text-blue-50 mb-6">{test.description}</p>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/10 rounded-xl p-4">
            <div className="text-2xl font-bold">
              {(test.multipleChoiceQuestions?.length || 0) + (test.writtenQuestions?.length || 0)}
            </div>
            <div className="text-sm">Questions</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <div className="text-2xl font-bold">{test.timeLimit}m</div>
            <div className="text-sm">Time Limit</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <div className="text-2xl font-bold">{test.totalPoints}</div>
            <div className="text-sm">Total Points</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <div className="text-2xl font-bold capitalize">{test.difficulty}</div>
            <div className="text-sm">Difficulty</div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 mb-8">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
          Test Information
        </h2>
        
        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
              Subject
            </div>
            <div className="text-lg text-slate-900 dark:text-slate-100">
              {test.subject}
            </div>
          </div>

          {test.topics && test.topics.length > 0 && (
            <div>
              <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                Topics Covered
              </div>
              <div className="flex flex-wrap gap-2">
                {test.topics.map((topic: string, idx: number) => (
                  <span
                    key={idx}
                    className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full text-sm"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {test.learningObjectives && test.learningObjectives.length > 0 && (
            <div>
              <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">
                Learning Objectives
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300">
                {test.learningObjectives.map((obj: string, idx: number) => (
                  <li key={idx}>{obj}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
              Instructions
            </div>
            <div className="text-slate-700 dark:text-slate-300">
              {test.instructions}
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        <button
          onClick={handleTakeTest}
          className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:from-green-600 hover:to-green-700 shadow-lg hover:shadow-xl transition-all"
        >
          Take This Test
        </button>
        <button
          onClick={() => router.push('/student_page/practice_tests')}
          className="px-8 py-4 rounded-xl border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          Back
        </button>
      </div>
    </div>
  );
}
