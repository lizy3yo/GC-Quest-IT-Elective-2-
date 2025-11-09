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
  type: 'short' | 'paragraph' | 'mcq' | 'checkboxes' | 'identification' | 'enumeration' | 'match' | 'title' | 'image' | 'section';
  title: string;
  required?: boolean;
  options?: string[]; // for mcq, checkboxes
  answer?: string; // for identification, short answers
  correctAnswer?: string | string[]; // for mcq (single), checkboxes (multiple)
  items?: string[]; // for enumeration
  pairs?: { left: string; right?: string }[]; // for match type
  description?: string; // for title, section types
  src?: string; // for image type
  alt?: string; // for image type
  points?: number; // points value for the question
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
  accessCode?: string;
  dueDate?: Date;
  availableFrom?: Date;
  availableUntil?: Date;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  showResults?: 'immediately' | 'after_due' | 'never';
  allowReview?: boolean;
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
    enum: ['short', 'paragraph', 'mcq', 'checkboxes', 'identification', 'enumeration', 'match', 'title', 'image', 'section']
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
    type: String,
    maxLength: [200, 'Option must be less than 200 characters']
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
    min: [1, 'Time limit must be at least 1 minute'],
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
  accessCode: { 
    type: String,
    unique: true,
    sparse: true, // allows multiple null values
    match: [/^[A-Z0-9]{6,10}$/, 'Access code must be 6-10 uppercase alphanumeric characters']
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
  shuffleQuestions: { 
    type: Boolean, 
    default: false 
  },
  shuffleOptions: { 
    type: Boolean, 
    default: false 
  },
  showResults: { 
    type: String,
    enum: ['immediately', 'after_due', 'never'],
    default: 'immediately'
  },
  allowReview: { 
    type: Boolean, 
    default: true 
  },
  passingScore: { 
    type: Number,
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
    }
  }
}, {
  timestamps: true
});

// Indexes for better query performance
assessmentSchema.index({ classId: 1, published: 1 });
assessmentSchema.index({ teacherId: 1, createdAt: -1 });
assessmentSchema.index({ dueDate: 1 });

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

// Method to generate access code
assessmentSchema.methods.generateAccessCode = function() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  this.accessCode = result;
  return result;
};

// Method to check if assessment is available
assessmentSchema.methods.isAvailable = function() {
  const now = new Date();
  if (!this.published) return false;
  if (this.availableFrom && now < this.availableFrom) return false;
  if (this.availableUntil && now > this.availableUntil) return false;
  return true;
};

// Use models to prevent re-compilation in Next.js
export default models.Assessment || model<IAssessment>('Assessment', assessmentSchema);