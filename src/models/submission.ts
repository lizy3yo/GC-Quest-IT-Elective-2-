/*
 * Copyright 2025 Kharl Ryan M. De Jesus
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

//NODE MODULES
import { Schema, model, models, Document } from 'mongoose';

// Submission interface
export interface ISubmission extends Document {
  assessmentId: string; // reference to the assessment
  studentId: string; // reference to the student
  classId: string; // reference to the class
  submittedAt: Date;
  status: 'submitted' | 'late' | 'graded' | 'draft';
  type: 'quiz_submission' | 'file_submission'; // distinguish between submission types
  score?: number; // 0-100
  maxScore?: number;
  feedback?: string;

  // For quiz submissions (original answers)
  answers?: {
    questionId: string;
    answer: string | string[] | { [key: string]: string }; // can be single answer, multiple for checkboxes, or object for matching
  }[];

  // Graded answers with scoring information
  gradedAnswers?: {
    questionId: string;
    studentAnswer: string | string[] | { [key: string]: string } | null;
    correctAnswer?: string | string[] | { [key: string]: string };
    isCorrect: boolean;
    points: number;
    maxPoints: number;
    needsManualGrading?: boolean;
    isManuallyGraded?: boolean;
    feedback?: string;
  }[];

  needsManualGrading?: boolean;

  // For file submissions
  files?: {
    name: string;
    url: string;
    type: string;
    size: number;
    cloudinaryPublicId?: string;
  }[];
  comment?: string;

  timeSpent?: number; // in minutes
  attemptNumber: number;
  ipAddress?: string;
  userAgent?: string;
  startedAt?: Date;
  gradedAt?: Date;
  gradedBy?: string; // teacher ID who graded
  tabSwitches?: number; // number of tab switches during assessment
  tabSwitchDurations?: number[]; // durations of tab switches
  totalAwayMs?: number; // total time away in milliseconds
  createdAt: Date;
  updatedAt: Date;
}

// File schema for file submissions
const fileSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true,
    min: 0
  },
  cloudinaryPublicId: {
    type: String
  }
}, { _id: false });

// Answer schema for student answers
const answerSchema = new Schema({
  questionId: {
    type: String,
    required: true
  },
  answer: {
    type: Schema.Types.Mixed, // can be string, array, or object
    required: true
  }
}, { _id: false });

// Graded answer schema with scoring information
const gradedAnswerSchema = new Schema({
  questionId: {
    type: String,
    required: true
  },
  studentAnswer: {
    type: Schema.Types.Mixed // student's answer
  },
  correctAnswer: {
    type: Schema.Types.Mixed // correct answer from assessment
  },
  isCorrect: {
    type: Boolean,
    required: true
  },
  points: {
    type: Number,
    required: true,
    min: 0
  },
  maxPoints: {
    type: Number,
    required: true,
    min: 0
  },
  needsManualGrading: {
    type: Boolean,
    default: false
  },
  isManuallyGraded: {
    type: Boolean,
    default: false
  },
  feedback: {
    type: String,
    maxLength: [500, 'Question feedback must be less than 500 characters']
  }
}, { _id: false });

// Submission schema
const submissionSchema = new Schema<ISubmission>({
  assessmentId: {
    type: String,
    required: [true, 'Assessment ID is required'],
    index: true
  },
  studentId: {
    type: String,
    required: [true, 'Student ID is required'],
    index: true
  },
  classId: {
    type: String,
    required: [true, 'Class ID is required'],
    index: true
  },
  submittedAt: {
    type: Date,
    required: [true, 'Submission date is required'],
    index: true
  },
  status: {
    type: String,
    enum: ['submitted', 'late', 'graded', 'draft'],
    default: 'submitted'
  },
  type: {
    type: String,
    enum: ['quiz_submission', 'file_submission'],
    required: [true, 'Submission type is required']
  },
  score: {
    type: Number,
    min: [0, 'Score cannot be negative']
  },
  maxScore: {
    type: Number,
    min: [0, 'Max score cannot be negative']
  },
  feedback: {
    type: String,
    maxLength: [2000, 'Feedback must be less than 2000 characters']
  },

  // For quiz submissions - original student answers
  answers: {
    type: [answerSchema]
  },

  // Graded answers with scoring information
  gradedAnswers: {
    type: [gradedAnswerSchema]
  },

  needsManualGrading: {
    type: Boolean,
    default: false
  },

  // For file submissions
  files: {
    type: [fileSchema],
    required: function (this: ISubmission) {
      return this.type === 'file_submission';
    }
  },
  comment: {
    type: String,
    maxLength: [1000, 'Comment must be less than 1000 characters']
  },

  timeSpent: {
    type: Number,
    min: [0, 'Time spent cannot be negative']
  },
  tabSwitches: {
    type: Number,
    min: [0, 'tabSwitches cannot be negative'],
    default: 0
  },
  tabSwitchDurations: {
    type: [Number],
    default: []
  },
  totalAwayMs: {
    type: Number,
    min: [0, 'totalAwayMs cannot be negative'],
    default: 0
  },
  attemptNumber: {
    type: Number,
    required: [true, 'Attempt number is required'],
    min: [1, 'Attempt number must be at least 1'],
    default: 1
  },
  ipAddress: {
    type: String,
    maxLength: [45, 'IP address too long'] // IPv6 max length
  },
  userAgent: {
    type: String,
    maxLength: [500, 'User agent too long']
  },
  startedAt: {
    type: Date
  },
  gradedAt: {
    type: Date
  },
  gradedBy: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for better query performance
submissionSchema.index({ assessmentId: 1, studentId: 1, attemptNumber: 1 }); // Unique submission lookup
submissionSchema.index({ assessmentId: 1, submittedAt: -1 }); // Assessment submissions sorted
submissionSchema.index({ studentId: 1, submittedAt: -1 }); // Student submission history
submissionSchema.index({ classId: 1, submittedAt: -1 }); // Class submissions
submissionSchema.index({ status: 1, assessmentId: 1 }); // Filter by status
submissionSchema.index({ type: 1 }); // Filter by submission type
submissionSchema.index({ needsManualGrading: 1, status: 1 }); // Pending grading queue
submissionSchema.index({ gradedBy: 1, gradedAt: -1 }); // Teacher grading history
submissionSchema.index({ studentId: 1, classId: 1, submittedAt: -1 }); // Student class history
submissionSchema.index({ assessmentId: 1, status: 1, submittedAt: -1 }); // Assessment grading view

// Virtual to check if submission is late
submissionSchema.virtual('isLate').get(function () {
  // This would need the assessment's due date to properly calculate
  // For now, we'll rely on the status field
  return this.status === 'late';
});

// Method to calculate score percentage
submissionSchema.methods.getScorePercentage = function () {
  if (!this.score || !this.maxScore) return null;
  return Math.round((this.score / this.maxScore) * 100);
};

// Method to auto-grade simple question types
submissionSchema.methods.autoGrade = function (assessment: any) {
  let totalScore = 0;
  let maxPossibleScore = 0;

  this.responses.forEach((response: any) => {
    const question = assessment.questions.find((q: any) => q.id === response.questionId);
    if (!question) return;

    const questionPoints = question.points || 1;
    maxPossibleScore += questionPoints;

    // Auto-grade MCQ and True/False questions
    if (question.type === 'mcq' && question.answer) {
      if (response.answer === question.answer) {
        response.isCorrect = true;
        response.points = questionPoints;
        totalScore += questionPoints;
      } else {
        response.isCorrect = false;
        response.points = 0;
      }
    }
    // For other question types, manual grading required
  });

  this.score = totalScore;
  this.maxScore = maxPossibleScore;

  return {
    score: totalScore,
    maxScore: maxPossibleScore,
    percentage: maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0
  };
};

// Use models to prevent re-compilation in Next.js
export default models.Submission || model<ISubmission>('Submission', submissionSchema);