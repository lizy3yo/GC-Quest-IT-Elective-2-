"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PrimaryActionButton from "@/components/molecules/buttons/buttons/PrimaryActionButton";

export default function FlashcardsCreateSetPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [userSubjects, setUserSubjects] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(false);

  // Fetch user's enrolled classes on mount
  useEffect(() => {
    const fetchUserSubjects = async () => {
      try {
        // Get token for authentication
        const token = localStorage.getItem('accessToken');
        
        const response = await fetch('/api/student_page/class?active=true', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          credentials: 'include'
        });
        
        const data = await response.json();
        console.log('Fetched classes data:', data);
        
        if (data.success && data.data.classes) {
          const subjects = data.data.classes.map((cls: any) => cls.subject as string);
          const uniqueSubjects = Array.from(new Set(subjects)) as string[];
          console.log('User enrolled subjects:', uniqueSubjects);
          setUserSubjects(uniqueSubjects);
          
          if (uniqueSubjects.length === 0) {
            console.warn('No subjects found. User may not be enrolled in any classes.');
          }
        } else {
          console.error('Failed to fetch classes:', data);
        }
      } catch (error) {
        console.error('Error fetching user subjects:', error);
      }
    };
    
    fetchUserSubjects();
  }, []);

  // Load any saved draft from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("flashcards:create:draft");
      if (raw) {
        const data = JSON.parse(raw);
        setTitle(data.title || "");
        setDescription(data.description || "");
        setSubject(data.subject || "");
        setIsPublic(!!data.isPublic);
      }
    } catch {}
  }, []);

  // Persist as draft while typing
  useEffect(() => {
    const draft = { title, description, subject, isPublic };
    console.log('Saving draft to localStorage:', draft);
    try {
      localStorage.setItem("flashcards:create:draft", JSON.stringify(draft));
    } catch {}
  }, [title, description, subject, isPublic]);

  const handleNext = () => {
    if (!title.trim()) {
      alert('Please enter a title for your flashcard set');
      return;
    }
    if (!subject.trim()) {
      alert('Please select a subject/class for your flashcard set');
      return;
    }
    console.log('Moving to cards page with subject:', subject);
    router.push("/student_page/flashcards/create/cards");
  };

  return (
    <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center mb-2">
            <button
              onClick={() => router.back()}
              className="mr-4 p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Flashcards • Set Information</h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400">Step 1 of 2 · Tell us about your set</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Enter a title for your flashcard set"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Add a description (optional)"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Subject/Class *</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              >
                <option value="">Select a subject/class...</option>
                {userSubjects.length > 0 ? (
                  userSubjects.map((subj) => (
                    <option key={subj} value={subj}>
                      {subj}
                    </option>
                  ))
                ) : (
                  <option value="" disabled>No enrolled classes found</option>
                )}
              </select>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {userSubjects.length > 0 
                  ? 'Choose from your enrolled classes' 
                  : 'You need to join a class first to create flashcards'}
              </p>
            </div>

            <div className="flex items-center justify-center">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="w-5 h-5 text-green-500 border-slate-300 dark:border-slate-600 rounded focus:ring-green-500"
                />
                <div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Make this set public</span>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Others can find and study your set</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <PrimaryActionButton
            onClick={handleNext}
            disabled={!title.trim() || !subject.trim()}
            title="Go to cards"
          >
            Next
          </PrimaryActionButton>
        </div>
    </div>
  );
}