export interface PracticeTest {
  id: string;
  title: string;
  description?: string;
  questions: PracticeTestQuestion[];
  duration?: number;
  userId: string;
  classId?: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PracticeTestQuestion {
  id: string;
  question: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer';
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  points: number;
}

export interface CreatePracticeTestData {
  title: string;
  description?: string;
  questions?: PracticeTestQuestion[];
  duration?: number;
  classId?: string;
  isPublic?: boolean;
}

export interface UpdatePracticeTestData extends Partial<CreatePracticeTestData> {}

export interface PracticeTestFilters {
  classId?: string;
  isPublic?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PracticeTestListResponse {
  tests: PracticeTest[];
  total: number;
  page: number;
  totalPages: number;
}

export interface GeneratePracticeTestData {
  text?: string;
  file?: File;
  title?: string;
  questionCount?: number;
}

export interface SubmitPracticeTestData {
  testId: string;
  answers: { questionId: string; answer: string }[];
}

export interface PracticeTestResult {
  id: string;
  testId: string;
  userId: string;
  score: number;
  totalPoints: number;
  percentage: number;
  answers: { questionId: string; answer: string; isCorrect: boolean }[];
  submittedAt: string;
}
