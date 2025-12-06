import React, { useState } from 'react';
import type { Flashcard } from '@/interfaces/flashcard.interface';

interface FlashcardCardProps {
  flashcard: Flashcard;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

export const FlashcardCard: React.FC<FlashcardCardProps> = ({
  flashcard,
  onEdit,
  onDelete,
  className = ''
}) => {
  const [isFlipped, setIsFlipped] = useState(false);

  const difficultyColors = {
    easy: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    hard: 'bg-red-100 text-red-800'
  };

  return (
    <div className={`bg-white rounded-lg shadow hover:shadow-md transition-shadow ${className}`}>
      <div
        className="p-6 cursor-pointer min-h-[200px] flex flex-col justify-center"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-2">{isFlipped ? 'Answer' : 'Question'}</p>
          <p className="text-lg">{isFlipped ? flashcard.answer : flashcard.question}</p>
        </div>
      </div>

      <div className="border-t px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {flashcard.difficulty && (
            <span className={`px-2 py-1 text-xs font-medium rounded ${difficultyColors[flashcard.difficulty]}`}>
              {flashcard.difficulty}
            </span>
          )}
          {flashcard.category && (
            <span className="text-xs text-gray-600">{flashcard.category}</span>
          )}
        </div>

        <div className="flex gap-2">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(flashcard.id);
              }}
              className="text-xs text-blue-600 hover:underline"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(flashcard.id);
              }}
              className="text-xs text-red-600 hover:underline"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
