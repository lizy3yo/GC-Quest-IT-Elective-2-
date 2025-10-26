import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import FlashcardGenerator from '@/components/flashcard/FlashcardGenerator';

export const metadata: Metadata = {
  title: 'AI Flashcard Generator',
  description: 'Generate flashcards using AI from text, files, or class materials',
};

export default function FlashcardGeneratorPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <FlashcardGenerator userId="demo-user" />
    </div>
  );
}