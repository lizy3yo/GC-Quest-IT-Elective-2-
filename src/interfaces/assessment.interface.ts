export interface Assessment {
  id: string;
  title: string;
  description?: string;
  questions: AssessmentQuestion[];
  duration?: number; // in minutes
  totalPoints: number;
  classId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  status: 'draft' | 'published' | 'archived';
}

export interface AssessmentQuestion {
  id: string;
  question: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer' | 'essay';
  options?: string[];
  correctAnswer?: string | string[];
  points: number;
  order: number;
}

export interface CreateAssessmentData {
  title: string;
  description?: string;
  questions: Omit<AssessmentQuestion, 'id'>[];
  duration?: number;
  classId?: string;
  dueDate?: string;
  status?: 'draft' | 'published';
}

export interface UpdateAssessmentData extends Partial<CreateAssessmentData> {}

export interface AssessmentSubmission {
  assessmentId: string;
  answers: AssessmentAnswer[];
}

export interface AssessmentAnswer {
  questionId: string;
  answer: string | string[];
}

export interface AssessmentResult {
  id: string;
  assessmentId: string;
  userId: string;
  answers: AssessmentAnswer[];
  score: number;
  totalPoints: number;
  percentage: number;
  submittedAt: string;
  gradedAt?: string;
}

export interface AssessmentFilters {
  classId?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AssessmentListResponse {
  assessments: Assessment[];
  total: number;
  page: number;
  totalPages: number;
}
