import mongoose, { Schema, Document } from 'mongoose';

export interface IAnswer {
  questionIndex: number;
  questionType: 'multiple-choice' | 'written';
  selectedAnswer?: number; // for multiple choice (index)
  writtenAnswer?: string; // for written questions
  isCorrect?: boolean; // calculated for MC, manual for written
  pointsEarned?: number;
  timeSpent?: number; // seconds spent on this question
}

export interface IPracticeTestSubmission extends Document {
  _id: string;
  userId: string;
  practiceTestId: string;
  answers: IAnswer[];
  score: number; // percentage
  pointsEarned: number;
  totalPoints: number;
  timeSpent: number; // total seconds
  completedAt: Date;
  createdAt: Date;
  isPerfectScore: boolean;
  feedback?: string;
}

const AnswerSchema = new Schema<IAnswer>({
  questionIndex: { type: Number, required: true },
  questionType: { type: String, enum: ['multiple-choice', 'written'], required: true },
  selectedAnswer: { type: Number },
  writtenAnswer: { type: String },
  isCorrect: { type: Boolean },
  pointsEarned: { type: Number, default: 0 },
  timeSpent: { type: Number, default: 0 }
}, { _id: false });

const PracticeTestSubmissionSchema = new Schema<IPracticeTestSubmission>(
  {
    userId: { type: String, required: true, index: true },
    practiceTestId: { type: String, required: true, index: true },
    answers: { type: [AnswerSchema], required: true },
    score: { type: Number, required: true, min: 0, max: 100 },
    pointsEarned: { type: Number, required: true, min: 0 },
    totalPoints: { type: Number, required: true },
    timeSpent: { type: Number, required: true },
    completedAt: { type: Date, default: Date.now },
    isPerfectScore: { type: Boolean, default: false },
    feedback: { type: String }
  },
  {
    timestamps: true,
    collection: 'practice_test_submissions'
  }
);

// Indexes for efficient queries
PracticeTestSubmissionSchema.index({ userId: 1, completedAt: -1 });
PracticeTestSubmissionSchema.index({ practiceTestId: 1, score: -1 });
PracticeTestSubmissionSchema.index({ userId: 1, practiceTestId: 1 });

export const PracticeTestSubmission = mongoose.models.PracticeTestSubmission || 
  mongoose.model<IPracticeTestSubmission>('PracticeTestSubmission', PracticeTestSubmissionSchema);
