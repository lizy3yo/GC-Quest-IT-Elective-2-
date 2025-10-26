"use client";

import { useParams } from "next/navigation";

export default function PublicFlashcardDetailPage() {
  const params = useParams();
  const flashcardId = params.flashcardId as string;

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-4">Public Flashcard Details</h1>
      <p>Flashcard ID: {flashcardId}</p>
      <p className="text-gray-600 mt-4">This page is under development.</p>
    </div>
  );
}
