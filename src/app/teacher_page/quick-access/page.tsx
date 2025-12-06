"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { classApi, type IClass } from "@/lib/api/teacher";
import { useToast } from "@/contexts/ToastContext";

interface QuickAccessCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  action: (classId?: string) => void;
  requiresClass: boolean;
}

export default function QuickAccessPage() {
  const router = useRouter();
  const { showInfo } = useToast();
  const [classes, setClasses] = useState<IClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [showClassSelector, setShowClassSelector] = useState(false);
  const [pendingAction, setPendingAction] = useState<((classId: string) => void) | null>(null);

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const response = await classApi.getClasses({ active: true });
      if (response.success && response.data?.classes) {
        setClasses(response.data.classes);
      }
    } catch (error) {
      console.error("Error fetching classes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleActionWithClass = (action: (classId: string) => void) => {
    if (classes.length === 0) {
      showInfo("You need to create a class first before creating assessments.");
      router.push("/teacher_page/class");
      return;
    }
    
    setPendingAction(() => action);
    setShowClassSelector(true);
  };

  const executeAction = () => {
    if (selectedClass && pendingAction) {
      pendingAction(selectedClass);
      setShowClassSelector(false);
      setPendingAction(null);
      setSelectedClass("");
    }
  };

  const quickAccessCards: QuickAccessCard[] = [
    {
      title: "Create Quiz",
      description: "Create a new quiz for your students",
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      action: (classId) => {
        router.push(`/teacher_page/assessment/create/interactive?classId=${classId}&category=Quiz`);
      },
      requiresClass: true,
    },
    {
      title: "Create Exam",
      description: "Create a comprehensive exam",
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
      action: (classId) => {
        router.push(`/teacher_page/assessment/create/interactive?classId=${classId}&category=Exam`);
      },
      requiresClass: true,
    },
    {
      title: "Create Activity",
      description: "Create a class activity or assignment",
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      action: (classId) => {
        router.push(`/teacher_page/assessment/create/interactive?classId=${classId}&category=Activity`);
      },
      requiresClass: true,
    },
    {
      title: "Create Library Item",
      description: "Add flashcards or summaries to the Library",
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
      ),
      action: (classId) => {
        router.push(`/teacher_page/library/create?classId=${classId}`);
      },
      requiresClass: true,
    },
    {
      title: "Create Summary",
      description: "Generate AI-powered summaries",
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      action: (classId) => {
        router.push(`/teacher_page/library/create?classId=${classId}&type=summary`);
      },
      requiresClass: true,
    },
    {
      title: "Start Live Quiz",
      description: "Start a live quiz session",
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
      action: (classId) => {
        router.push(`/teacher_page/assessment/create/interactive?classId=${classId}&category=Quiz&live=true`);
      },
      requiresClass: true,
    },
    {
      title: "Start Live Exam",
      description: "Start a live exam session",
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      action: (classId) => {
        router.push(`/teacher_page/assessment/create/interactive?classId=${classId}&category=Exam&live=true`);
      },
      requiresClass: true,
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8 transition-colors duration-300">
        <div className="text-center text-lg text-slate-600 dark:text-slate-300">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Quick Access
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Quickly create assessments, library items, and start live sessions
          </p>
        </div>

        {/* No Classes Warning */}
        {classes.length === 0 && (
          <div className="mb-8 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
                  No Classes Yet
                </h3>
                <p className="text-yellow-800 dark:text-yellow-200 mb-3">
                  You need to create at least one class before you can create assessments or start live sessions.
                </p>
                <button
                  onClick={() => router.push("/teacher_page/class")}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors duration-200"
                >
                  Create Your First Class
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Access Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {quickAccessCards.map((card, index) => (
            <button
              key={index}
              onClick={() => {
                if (card.requiresClass) {
                  handleActionWithClass(card.action);
                } else {
                  card.action();
                }
              }}
              className="group relative bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-200 dark:border-slate-700 hover:border-green-500 dark:hover:border-green-500 hover:-translate-y-1 text-left"
            >
              {/* Icon */}
              <div className="mb-4 text-green-500 group-hover:text-green-600 transition-colors duration-300">
                {card.icon}
              </div>

              {/* Title */}
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors duration-300">
                {card.title}
              </h3>

              {/* Description */}
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {card.description}
              </p>

              {/* Hover Arrow */}
              <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
            </button>
          ))}
        </div>

        {/* Class Selector Modal */}
        {showClassSelector && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                Select a Class
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Choose which class this is for:
              </p>

              {/* Class List */}
              <div className="space-y-2 mb-6 max-h-96 overflow-y-auto">
                {classes.map((cls) => (
                  <button
                    key={cls._id}
                    onClick={() => setSelectedClass(cls._id || "")}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                      selectedClass === cls._id
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                        : "border-slate-200 dark:border-slate-700 hover:border-green-300 dark:hover:border-green-700"
                    }`}
                  >
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {cls.name}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      {cls.courseYear} • {cls.subject}
                    </div>
                  </button>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowClassSelector(false);
                    setPendingAction(null);
                    setSelectedClass("");
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={executeAction}
                  disabled={!selectedClass}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-br from-green-500 to-green-600 text-white font-medium hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
