import mongoose, { Schema, Document } from 'mongoose';

export interface IMultipleChoiceQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string;
  points: number;
}

export interface IWrittenQuestion {
  question: string;
  expectedAnswer: string;
  rubric: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string;
  points: number;
}

export interface ISharedUser {
  userId: string;
  email?: string;
  sharedAt: Date;
}

export interface IPracticeTest extends Document {
  _id: string;
  userId: string;
  title: string;
  description: string;
  subject: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timeLimit: number; // in minutes
  totalPoints: number;
  multipleChoiceQuestions: IMultipleChoiceQuestion[];
  writtenQuestions: IWrittenQuestion[];
  topics: string[];
  learningObjectives: string[];
  instructions: string;
  sourceType: 'flashcards' | 'upload' | 'paste' | 'mixed';
  sourceIds?: string[]; // flashcard set IDs if from flashcards
  createdAt: Date;
  updatedAt: Date;
  isPublic: boolean;
  attempts: number; // how many times taken
  averageScore?: number;
  sharedWith?: ISharedUser[]; // users this test is shared with
  shareLink?: string; // unique shareable link
}

const MultipleChoiceQuestionSchema = new Schema<IMultipleChoiceQuestion>({
  question: { type: String, required: true },
  options: { type: [String], required: true, validate: [(val: string[]) => val.length === 4, 'Must have exactly 4 options'] },
  correctAnswer: { type: Number, required: true, min: 0, max: 3 },
  explanation: { type: String, required: true },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  topic: { type: String, required: true },
  points: { type: Number, required: true, default: 2 }
}, { _id: false });

const WrittenQuestionSchema = new Schema<IWrittenQuestion>({
  question: { type: String, required: true },
  expectedAnswer: { type: String, required: true },
  rubric: { type: [String], required: true },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  topic: { type: String, required: true },
  points: { type: Number, required: true, default: 5 }
}, { _id: false });

const SharedUserSchema = new Schema({
  userId: { type: String, required: true },
  email: { type: String },
  sharedAt: { type: Date, default: Date.now }
}, { _id: false });

const PracticeTestSchema = new Schema<IPracticeTest>(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    subject: { type: String, required: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    timeLimit: { type: Number, required: true, default: 30 },
    totalPoints: { type: Number, required: true },
    multipleChoiceQuestions: { type: [MultipleChoiceQuestionSchema], default: [] },
    writtenQuestions: { type: [WrittenQuestionSchema], default: [] },
    topics: { type: [String], default: [] },
    learningObjectives: { type: [String], default: [] },
    instructions: { type: String, default: 'Answer all questions to the best of your ability.' },
    sourceType: { type: String, enum: ['flashcards', 'upload', 'paste', 'mixed'], required: true },
    sourceIds: { type: [String], default: [] },
    isPublic: { type: Boolean, default: false },
    attempts: { type: Number, default: 0 },
    averageScore: { type: Number, min: 0, max: 100 },
    sharedWith: { type: [SharedUserSchema], default: [] },
    shareLink: { type: String, unique: true, sparse: true }
  },
  {
    timestamps: true,
    collection: 'practice_tests'
  }
);

// Indexes for efficient queries
PracticeTestSchema.index({ userId: 1, createdAt: -1 });
PracticeTestSchema.index({ userId: 1, subject: 1 });
PracticeTestSchema.index({ isPublic: 1, subject: 1 });
PracticeTestSchema.index({ shareLink: 1 });
PracticeTestSchema.index({ 'sharedWith.userId': 1 });

export const PracticeTest = mongoose.models.PracticeTest || mongoose.model<IPracticeTest>('PracticeTest', PracticeTestSchema);
