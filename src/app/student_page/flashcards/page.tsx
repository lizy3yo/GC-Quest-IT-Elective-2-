'use client';

import CreateByHandCard from '@/components/molecules/CreateByHandCard';
import UploadFileCard from '@/components/molecules/UploadFileCard';

export default function FlashcardsPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-6 transition-colors duration-300">
      <div className="max-w-7xl mx-auto flex flex-col">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100 mb-2">
            Create Flashcards
          </h1>
          <p className="text-gray-600 dark:text-slate-400">
            Choose how you&apos;d like to create your flashcard set
          </p>
        </div>

        {/* Creation Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <CreateByHandCard />
          <UploadFileCard />
        </div>
      </div>
    </div>
  );
}