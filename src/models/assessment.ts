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

// Question types based on the form component
export interface IQuestion {
  id: string;
  type: 'short' | 'paragraph' | 'mcq' | 'checkboxes' | 'identification' | 'enumeration' | 'match' | 'title' | 'image' | 'section' | 'true-false';
  title: string;
  required?: boolean;
  options?: string[]; // for mcq, checkboxes
  answer?: string; // for identification (legacy), short answers
  correctAnswer?: string | string[]; // for mcq (single), checkboxes (multiple), identification (preferred)
  items?: string[]; // for enumeration
  pairs?: { left: string; right?: string }[]; // for match type
  description?: string; // for title, section types
  src?: string; // for image type
  alt?: string; // for image type
  points?: number; // points value for the question
  timeLimit?: number; // time limit in seconds for this question
  requiresManualGrading?: boolean; // true for short, paragraph, essay questions
}

// Assessment interface
export interface IAssessment extends Document {
  title: string;
  description?: string;
  type: 'MCQ' | 'TF' | 'Practical' | 'Written' | 'Mixed';
  category: 'Quiz' | 'Exam' | 'Activity';
  format: 'online' | 'file_submission'; // new field to distinguish between online and file submission
  questions: IQuestion[];
  classId: string; // reference to the class
  teacherId: string; // reference to the teacher who created it
  timeLimitMins?: number;
  maxAttempts?: number;
  published: boolean;
  isLocked?: boolean; // Manual lock/unlock control by teacher
  scheduledOpen?: Date; // Optional: Auto-unlock at this date/time
  scheduledClose?: Date; // Optional: Auto-lock at this date/time
  dueDate?: Date;
  availableFrom?: Date;
  availableUntil?: Date;
  showResults?: 'immediately' | 'after_due' | 'never';
  passingScore?: number;
  totalPoints?: number;
  instructions?: string;
  attachments?: {
    name: string;
    url: string;
    type: string;
    size?: number;
    cloudinaryPublicId?: string;
    resourceType?: string;
    format?: string;
  }[];
  settings?: {
    lockdown?: boolean; // prevent tab switching
    showProgress?: boolean;
    allowBacktrack?: boolean;
    autoSubmit?: boolean;
    shuffleQuestions?: boolean;
    shuffleOptions?: boolean;
    allowReview?: boolean;
    trackTabSwitching?: boolean;
    hideCorrectAnswers?: boolean;
  };
  liveSession?: {
    isActive: boolean;
    sessionCode?: string;
    startedAt?: Date;
    startedBy?: string; // teacher ID
    currentQuestionIndex?: number;
    studentsJoined?: string[]; // array of student IDs
    studentAnswers?: {
      studentId: string;
      questionId: string;
      answer: any;
      answeredAt: Date;
      isCorrect?: boolean;
      timeSpent?: number;
    }[];
  };
  createdAt: Date;
  updatedAt: Date;
}

// Question schema
const questionSchema = new Schema<IQuestion>({
  id: { 
    type: String, 
    required: true 
  },
  type: { 
    type: String, 
    required: true,
    enum: ['short', 'paragraph', 'mcq', 'checkboxes', 'identification', 'enumeration', 'match', 'title', 'image', 'section', 'true-false']
  },
  title: { 
    type: String, 
    required: true,
    maxLength: [500, 'Question title must be less than 500 characters']
  },
  required: { 
    type: Boolean, 
    default: false 
  },
  options: [{
    id: String,
    text: {
      type: String,
      maxLength: [200, 'Option text must be less than 200 characters']
    },
    isCorrect: Boolean,
    color: String
  }],
  answer: { 
    type: String,
    maxLength: [500, 'Answer must be less than 500 characters']
  },
  correctAnswer: {
    type: Schema.Types.Mixed, // Can be string for MCQ or array for checkboxes
    maxLength: [500, 'Correct answer must be less than 500 characters']
  },
  items: [{ 
    type: String,
    maxLength: [200, 'Item must be less than 200 characters']
  }],
  pairs: [{
    left: { 
      type: String, 
      required: true,
      maxLength: [200, 'Left item must be less than 200 characters']
    },
    right: { 
      type: String,
      maxLength: [200, 'Right item must be less than 200 characters']
    }
  }],
  description: { 
    type: String,
    maxLength: [1000, 'Description must be less than 1000 characters']
  },
  src: { 
    type: String,
    maxLength: [500, 'Image source must be less than 500 characters']
  },
  alt: { 
    type: String,
    maxLength: [200, 'Alt text must be less than 200 characters']
  },
  points: { 
    type: Number, 
    default: 1,
    min: [0, 'Points cannot be negative'],
    max: [100, 'Points cannot exceed 100 per question']
  },
  timeLimit: {
    type: Number,
    min: [0, 'Time limit cannot be negative'],
    max: [3600, 'Time limit cannot exceed 1 hour (3600 seconds)']
  },
  requiresManualGrading: {
    type: Boolean,
    default: false
  }
}, { _id: false });

// Assessment schema
const assessmentSchema = new Schema<IAssessment>({
  title: { 
    type: String, 
    required: [true, 'Assessment title is required'],
    maxLength: [200, 'Title must be less than 200 characters'],
    trim: true
  },
  description: { 
    type: String,
    maxLength: [1000, 'Description must be less than 1000 characters'],
    trim: true
  },
  type: { 
    type: String, 
    required: [true, 'Assessment type is required'],
    enum: {
      values: ['MCQ', 'TF', 'Practical', 'Written', 'Mixed'],
      message: '{VALUE} is not a valid assessment type'
    }
  },
  category: { 
    type: String, 
    required: [true, 'Assessment category is required'],
    enum: {
      values: ['Quiz', 'Exam', 'Activity'],
      message: '{VALUE} is not a valid assessment category'
    }
  },
  format: { 
    type: String, 
    required: [true, 'Assessment format is required'],
    enum: {
      values: ['online', 'file_submission'],
      message: '{VALUE} is not a valid assessment format'
    },
    default: 'online'
  },
  questions: [questionSchema],
  classId: { 
    type: String, 
    required: [true, 'Class ID is required']
  },
  teacherId: { 
    type: String, 
    required: [true, 'Teacher ID is required']
  },
  timeLimitMins: { 
    type: Number,
    min: [0, 'Time limit cannot be negative'],
    max: [480, 'Time limit cannot exceed 8 hours (480 minutes)']
  },
  maxAttempts: { 
    type: Number,
    default: 1,
    min: [1, 'Must allow at least 1 attempt'],
    max: [10, 'Cannot exceed 10 attempts']
  },
  published: { 
    type: Boolean, 
    default: false 
  },
  isLocked: { 
    type: Boolean, 
    default: true // Locked by default when published
  },
  scheduledOpen: { 
    type: Date // Optional: Auto-unlock at this date/time
  },
  scheduledClose: { 
    type: Date // Optional: Auto-lock at this date/time
  },
  dueDate: { 
    type: Date 
  },
  availableFrom: { 
    type: Date,
    default: Date.now
  },
  availableUntil: { 
    type: Date 
  },
  showResults: { 
    type: String,
    enum: ['immediately', 'after_due', 'never'],
    default: 'immediately'
  },
  passingScore: { 
    type: Number,
    default: 70,
    min: [0, 'Passing score cannot be negative'],
    max: [100, 'Passing score cannot exceed 100%']
  },
  totalPoints: { 
    type: Number,
    default: 0,
    min: [0, 'Total points cannot be negative']
  },
  instructions: { 
    type: String,
    maxLength: [2000, 'Instructions must be less than 2000 characters']
  },
  attachments: [{
    name: { 
      type: String, 
      required: true,
      maxLength: [255, 'Filename must be less than 255 characters']
    },
    url: { 
      type: String, 
      required: true,
      maxLength: [500, 'File URL must be less than 500 characters']
    },
    type: { 
      type: String, 
      required: true,
      maxLength: [50, 'File type must be less than 50 characters']
    },
    size: { 
      type: Number,
      min: [0, 'File size cannot be negative']
    },
    cloudinaryPublicId: {
      type: String,
      maxLength: [200, 'Cloudinary public ID must be less than 200 characters']
    },
    resourceType: {
      type: String,
      maxLength: [20, 'Resource type must be less than 20 characters']
    },
    format: {
      type: String,
      maxLength: [10, 'Format must be less than 10 characters']
    }
  }],
  settings: {
    lockdown: { 
      type: Boolean, 
      default: false 
    },
    showProgress: { 
      type: Boolean, 
      default: true 
    },
    allowBacktrack: { 
      type: Boolean, 
      default: true 
    },
    autoSubmit: { 
      type: Boolean, 
      default: false 
    },
    shuffleQuestions: { 
      type: Boolean, 
      default: false 
    },
    shuffleOptions: { 
      type: Boolean, 
      default: false 
    },
    allowReview: { 
      type: Boolean, 
      default: true 
    },
    trackTabSwitching: { 
      type: Boolean, 
      default: false 
    },
    hideCorrectAnswers: { 
      type: Boolean, 
      default: false 
    }
  },
  liveSession: {
    isActive: {
      type: Boolean,
      default: false
    },
    sessionCode: {
      type: String
    },
    startedAt: {
      type: Date
    },
    startedBy: {
      type: String
    },
    currentQuestionIndex: {
      type: Number,
      default: 0
    },
    studentsJoined: [{
      type: String
    }],
    studentAnswers: [{
      studentId: { type: String, required: true },
      questionId: { type: String, required: true },
      answer: { type: Schema.Types.Mixed },
      answeredAt: { type: Date, default: Date.now },
      isCorrect: { type: Boolean },
      timeSpent: { type: Number }
    }],
    studentStatus: {
      type: Schema.Types.Mixed,
      default: {}
    }
  }
}, {
  timestamps: true,
  minimize: false  // This ensures empty/false fields are saved
});

// Indexes for better query performance
assessmentSchema.index({ classId: 1, published: 1 }); // For class assessments
assessmentSchema.index({ teacherId: 1, createdAt: -1 }); // For teacher's assessments
assessmentSchema.index({ dueDate: 1 }); // For due date queries
assessmentSchema.index({ classId: 1, published: 1, dueDate: 1 }); // Compound for student view
assessmentSchema.index({ teacherId: 1, category: 1 }); // For filtering by category
assessmentSchema.index({ isLocked: 1, published: 1 }); // For availability checks
assessmentSchema.index({ scheduledOpen: 1, scheduledClose: 1 }); // For scheduled assessments
assessmentSchema.index({ 'liveSession.isActive': 1 }); // For active live sessions
assessmentSchema.index({ 'liveSession.sessionCode': 1 }); // For joining live sessions
assessmentSchema.index({ format: 1, classId: 1 }); // For filtering by format

// Virtual for calculating total points if not set
assessmentSchema.virtual('calculatedTotalPoints').get(function() {
  if (this.totalPoints && this.totalPoints > 0) {
    return this.totalPoints;
  }
  return this.questions.reduce((total, question) => {
    return total + (question.points || 1);
  }, 0);
});

// Pre-save middleware to calculate total points
assessmentSchema.pre('save', function(next) {
  if (!this.totalPoints || this.totalPoints === 0) {
    this.totalPoints = this.questions.reduce((total, question) => {
      return total + (question.points || 1);
    }, 0);
  }
  next();
});

// Method to check if assessment is unlocked
assessmentSchema.methods.isUnlocked = function() {
  const now = new Date();
  
  // Check if manually unlocked by teacher
  if (!this.isLocked) {
    // Even if manually unlocked, check if it should be closed
    if (this.scheduledClose && now >= this.scheduledClose) {
      return false;
    }
    return true;
  }
  
  // Check if scheduled to open and not yet closed
  if (this.scheduledOpen && now >= this.scheduledOpen) {
    // Check if it should be closed
    if (this.scheduledClose && now >= this.scheduledClose) {
      return false;
    }
    return true;
  }
  
  return false;
};

// Method to check if assessment is available
assessmentSchema.methods.isAvailable = function() {
  const now = new Date();
  if (!this.published) return false;
  if (!this.isUnlocked()) return false;
  if (this.availableFrom && now < this.availableFrom) return false;
  if (this.availableUntil && now > this.availableUntil) return false;
  return true;
};

// Use models to prevent re-compilation in Next.js
export default models.Assessment || model<IAssessment>('Assessment', assessmentSchema);