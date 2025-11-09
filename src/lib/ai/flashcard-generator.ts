// Re-export the internal flashcard generator as the main one
export { 
  InternalFlashcardGenerator as FlashcardGenerator,
  type InternalFlashcardOptions as FlashcardGenerationOptions,
  type GeneratedFlashcard,
  type FlashcardGenerationResult,
  type FlashcardAnalysis,
  type QualityMetrics
} from './internal-flashcard-generator';

// Legacy compatibility functions for existing code
export function analyzeDifficulty(content: string): 'easy' | 'medium' | 'hard' {
  const wordCount = content.split(/\s+/).length;
  const avgWordLength = content.replace(/\s+/g, '').length / wordCount;
  const sentenceCount = content.split(/[.!?]+/).length;
  const avgSentenceLength = wordCount / sentenceCount;

  // Technical terms and complexity indicators
  const complexTerms = content.match(/\b[a-z]{8,}\b/gi)?.length || 0;
  const technicalPatterns = content.match(/\b(algorithm|methodology|implementation|architecture|paradigm)\b/gi)?.length || 0;

  if (avgWordLength > 6 || avgSentenceLength > 25 || complexTerms > 10 || technicalPatterns > 3) {
    return 'hard';
  } else if (avgWordLength > 4.5 || avgSentenceLength > 18 || complexTerms > 5) {
    return 'medium';
  } else {
    return 'easy';
  }
}

export function extractSubject(content: string): string[] {
  const subjects = [
    'mathematics', 'science', 'history', 'literature', 'geography',
    'biology', 'chemistry', 'physics', 'computer science', 'programming',
    'psychology', 'sociology', 'economics', 'philosophy', 'art',
    'music', 'language', 'medicine', 'engineering', 'business'
  ];

  const contentLower = content.toLowerCase();
  return subjects.filter(subject =>
    contentLower.includes(subject) ||
    contentLower.includes(subject.replace(' ', ''))
  );
}

// Content validation utility
export function validateContent(content: string): { isValid: boolean; error?: string } {
  if (!content || typeof content !== 'string') {
    return { isValid: false, error: 'Content is required and must be a string' };
  }

  const trimmedContent = content.trim();
  
  if (trimmedContent.length < 50) {
    return { isValid: false, error: 'Content must be at least 50 characters long' };
  }

  if (trimmedContent.length > 50000) {
    return { isValid: false, error: 'Content too long. Please limit to 50,000 characters' };
  }

  return { isValid: true };
}