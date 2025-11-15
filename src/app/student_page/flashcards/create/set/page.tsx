"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PrimaryActionButton from "@/components/atoms/buttons/PrimaryActionButton";

export default function FlashcardsCreateSetPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  // Load any saved draft from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("flashcards:create:draft");
      if (raw) {
        const data = JSON.parse(raw);
        setTitle(data.title || "");
        setDescription(data.description || "");
        setCategory(data.category || "");
        setIsPublic(!!data.isPublic);
      }
    } catch {}
  }, []);

  // Persist as draft while typing
  useEffect(() => {
    const draft = { title, description, category, isPublic };
    try {
      localStorage.setItem("flashcards:create:draft", JSON.stringify(draft));
    } catch {}
  }, [title, description, category, isPublic]);

  const handleNext = () => {
    if (!title.trim()) return;
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
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">Select category</option>
                <option value="Mathematics">Mathematics</option>
                <option value="Science">Science</option>
                <option value="History">History</option>
                <option value="Language">Language</option>
                <option value="Computer Science">Computer Science</option>
                <option value="Other">Other</option>
              </select>
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
            disabled={!title.trim()}
            title="Go to cards"
          >
            Next
          </PrimaryActionButton>
        </div>
    </div>
  );
}
