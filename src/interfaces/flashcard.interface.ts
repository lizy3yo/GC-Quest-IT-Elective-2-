export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface CreateFlashcardData {
  question: string;
  answer: string;
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
}

export interface UpdateFlashcardData extends Partial<CreateFlashcardData> {}

export interface FlashcardFilters {
  category?: string;
  difficulty?: string;
  tags?: string[];
  search?: string;
  page?: number;
  limit?: number;
}

export interface FlashcardListResponse {
  flashcards: Flashcard[];
  total: number;
  page: number;
  totalPages: number;
}
