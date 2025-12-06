import mongoose, { Schema, Document } from 'mongoose';

export interface ISummary extends Document {
  _id: string;
  userId: string;
  title: string;
  content: string;
  keyPoints: string[];
  mainTopics: string[];
  wordCount: number;
  readingTime: number;
  difficulty: 'easy' | 'medium' | 'hard';
  subject: string;
  summaryType: 'brief' | 'detailed' | 'bullet-points' | 'outline';
  tags: string[];
  confidence: number;
  originalWordCount: number;
  compressionRatio: number;
  sourceType: 'text' | 'file' | 'class-file';
  sourceFileName?: string;
  folder?: string; // folder ID if organized in a folder
  isFavorite?: boolean;
  favoritedAt?: Date; // Timestamp when marked as favorite
  isRead?: boolean; // Whether the summary has been viewed
  isCompleted?: boolean; // Whether the summary has been marked as completed
  lastReadAt?: Date; // Timestamp when last read
  isPublic: boolean;
  metadata?: {
    classId?: string;
    className?: string;
    resourceId?: string;
    resourceName?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const SummarySchema = new Schema<ISummary>({
  userId: {
    type: String,
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    maxlength: 10000
  },
  keyPoints: [{
    type: String,
    maxlength: 500
  }],
  mainTopics: [{
    type: String,
    maxlength: 100
  }],
  wordCount: {
    type: Number,
    required: true,
    min: 0
  },
  readingTime: {
    type: Number,
    required: true,
    min: 1
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  subject: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  summaryType: {
    type: String,
    enum: ['brief', 'detailed', 'bullet-points', 'outline'],
    default: 'detailed'
  },
  tags: [{
    type: String,
    maxlength: 50
  }],
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.8
  },
  originalWordCount: {
    type: Number,
    required: true,
    min: 0
  },
  compressionRatio: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  sourceType: {
    type: String,
    enum: ['text', 'file', 'class-file'],
    required: true
  },
  sourceFileName: {
    type: String,
    maxlength: 255
  },
  folder: {
    type: String,
    ref: 'Folder'
  },
  isFavorite: {
    type: Boolean,
    default: false
  },
  favoritedAt: {
    type: Date
  },
  isRead: {
    type: Boolean,
    default: false
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  lastReadAt: {
    type: Date
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  metadata: {
    type: {
      classId: String,
      className: String,
      resourceId: String,
      resourceName: String
    },
    required: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
SummarySchema.index({ userId: 1, createdAt: -1 }); // User's summaries sorted
SummarySchema.index({ userId: 1, subject: 1 }); // Filter by subject
SummarySchema.index({ userId: 1, isPublic: 1 }); // Public/private filtering
SummarySchema.index({ userId: 1, isFavorite: 1 }); // Favorite summaries
SummarySchema.index({ tags: 1 }); // Tag-based search
SummarySchema.index({ subject: 1, isPublic: 1 }); // Public summaries by subject
SummarySchema.index({ folder: 1, userId: 1 }); // Folder organization
SummarySchema.index({ difficulty: 1, subject: 1 }); // Filter by difficulty

// Virtual for formatted creation date
SummarySchema.virtual('formattedCreatedAt').get(function() {
  return this.createdAt.toLocaleDateString();
});

// Virtual for status
SummarySchema.virtual('status').get(function() {
  return 'completed';
});

export const Summary = mongoose.models.Summary || mongoose.model<ISummary>('Summary', SummarySchema);