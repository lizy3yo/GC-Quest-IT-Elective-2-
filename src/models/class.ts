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

// Student interface for class enrollment
export interface IClassStudent {
  studentId: string;
  enrolledAt: Date;
  status: 'active' | 'inactive' | 'dropped';
}

// Group interface for class grouping
export interface IGroup {
  id: string;
  name: string;
  members: string[]; // student IDs
  createdAt: Date;
}

// Announcement interface
export interface IAnnouncement {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Resource interface
export interface IResource {
  id: string;
  name: string;
  type: string;
  url?: string; // Public download URL
  filePath?: string; // Server file path for internal use (legacy)
  cloudinaryPublicId?: string; // Cloudinary public ID for file operations
  resourceType?: string; // Cloudinary resource type (image, video, raw, auto)
  format?: string; // File format from Cloudinary
  description?: string;
  sizeBytes?: number;
  uploadedAt: Date;
  uploadedBy: string; // teacher ID
}

// Comment interface for posts
export interface IComment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

// Attachment interface for posts
export interface IAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  mimeType?: string;
  cloudinaryPublicId?: string;
}

// Post interface for class feed
export interface IPost {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  body: string;
  pinned: boolean;
  attachments: IAttachment[];
  comments: IComment[];
  commentsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Class interface
export interface IClass extends Document {
  name: string;
  courseYear: string; // e.g., "BSIT - 3A"
  subject: string;
  description?: string;
  teacherId: string; // reference to teacher user
  classCode: string;
  isActive: boolean;
  maxStudents?: number;
  
  // Schedule information
  day?: string[]; // Array of days like ["Monday", "Tuesday"]
  time?: string; // Time like "9:00 AM-10:00 AM"
  room?: string; // Room like "GC Main 525"
  
  // Students in the class
  students: IClassStudent[];
  
  // Class organization
  groups: IGroup[];
  
  // Class content
  announcements: IAnnouncement[];
  resources: IResource[];
  posts: IPost[];
  
  // Class settings
  settings: {
    allowStudentPosts: boolean;
    moderateStudentPosts: boolean;
    allowLateSubmissions: boolean;
    notifyOnNewStudent: boolean;
  };
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  addPost(authorId: string, authorName: string, body: string, pinned?: boolean, authorAvatar?: string): IPost;
  addComment(postId: string, authorId: string, authorName: string, text: string, authorAvatar?: string): IComment;
}

// Class Student schema
const classStudentSchema = new Schema<IClassStudent>({
  studentId: { 
    type: String, 
    required: true 
  },
  enrolledAt: { 
    type: Date, 
    default: Date.now 
  },
  status: { 
    type: String,
    enum: ['active', 'inactive', 'dropped'],
    default: 'active'
  }
}, { _id: false });

// Group schema
const groupSchema = new Schema<IGroup>({
  id: { 
    type: String, 
    required: true 
  },
  name: { 
    type: String, 
    required: true,
    maxLength: [100, 'Group name must be less than 100 characters'],
    trim: true
  },
  members: [{ 
    type: String, 
    required: true 
  }],
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
}, { _id: false });

// Announcement schema
const announcementSchema = new Schema<IAnnouncement>({
  id: { 
    type: String, 
    required: true 
  },
  title: { 
    type: String, 
    required: true,
    maxLength: [200, 'Announcement title must be less than 200 characters'],
    trim: true
  },
  body: { 
    type: String, 
    required: true,
    maxLength: [2000, 'Announcement body must be less than 2000 characters'],
    trim: true
  },
  pinned: { 
    type: Boolean, 
    default: false 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, { _id: false });

// Resource schema
const resourceSchema = new Schema<IResource>({
  id: { 
    type: String, 
    required: true 
  },
  name: { 
    type: String, 
    required: true,
    maxLength: [255, 'Resource name must be less than 255 characters'],
    trim: true
  },
  type: { 
    type: String, 
    required: true,
    maxLength: [50, 'Resource type must be less than 50 characters']
  },
  url: { 
    type: String,
    maxLength: [500, 'Resource URL must be less than 500 characters']
  },
  filePath: {
    type: String,
    maxLength: [1000, 'File path must be less than 1000 characters']
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
  },
  description: { 
    type: String,
    maxLength: [500, 'Resource description must be less than 500 characters'],
    trim: true
  },
  sizeBytes: { 
    type: Number,
    min: [0, 'File size cannot be negative']
  },
  uploadedAt: { 
    type: Date, 
    default: Date.now 
  },
  uploadedBy: { 
    type: String, 
    required: true 
  }
}, { _id: false });

// Comment schema
const commentSchema = new Schema<IComment>({
  id: { 
    type: String, 
    required: true 
  },
  authorId: { 
    type: String, 
    required: true 
  },
  authorName: { 
    type: String, 
    required: true,
    maxLength: [100, 'Author name must be less than 100 characters']
  },
  authorAvatar: { 
    type: String,
    maxLength: [500, 'Avatar URL must be less than 500 characters']
  },
  text: { 
    type: String, 
    required: true,
    maxLength: [1000, 'Comment text must be less than 1000 characters'],
    trim: true
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, { _id: false });

// Attachment schema
const attachmentSchema = new Schema<IAttachment>({
  id: { 
    type: String, 
    required: true 
  },
  name: { 
    type: String, 
    required: true,
    maxLength: [255, 'Attachment name must be less than 255 characters'],
    trim: true
  },
  size: { 
    type: Number, 
    required: true,
    min: [0, 'File size cannot be negative']
  },
  type: { 
    type: String, 
    required: true,
    maxLength: [100, 'File type must be less than 100 characters']
  },
  url: { 
    type: String, 
    required: true,
    maxLength: [500, 'URL must be less than 500 characters']
  },
  mimeType: { 
    type: String,
    maxLength: [100, 'MIME type must be less than 100 characters']
  },
  cloudinaryPublicId: {
    type: String,
    maxLength: [200, 'Cloudinary public ID must be less than 200 characters']
  }
}, { _id: false });

// Post schema
const postSchema = new Schema<IPost>({
  id: { 
    type: String, 
    required: true 
  },
  authorId: { 
    type: String, 
    required: true 
  },
  authorName: { 
    type: String, 
    required: true,
    maxLength: [100, 'Author name must be less than 100 characters']
  },
  authorAvatar: { 
    type: String,
    maxLength: [500, 'Avatar URL must be less than 500 characters']
  },
  body: { 
    type: String, 
    required: true,
    maxLength: [2000, 'Post body must be less than 2000 characters'],
    trim: true
  },
  pinned: { 
    type: Boolean, 
    default: false 
  },
  attachments: [attachmentSchema],
  comments: [commentSchema],
  commentsCount: { 
    type: Number, 
    default: 0,
    min: [0, 'Comments count cannot be negative']
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, { _id: false });

// Class schema
const classSchema = new Schema<IClass>({
  name: { 
    type: String, 
    required: [true, 'Class name is required'],
    maxLength: [100, 'Class name must be less than 100 characters'],
    trim: true
  },
  courseYear: { 
    type: String, 
    required: [true, 'Course year is required'],
    maxLength: [50, 'Course year must be less than 50 characters'],
    trim: true
  },
  subject: { 
    type: String, 
    required: [true, 'Subject is required'],
    maxLength: [100, 'Subject must be less than 100 characters'],
    trim: true
  },
  description: { 
    type: String,
    maxLength: [1000, 'Description must be less than 1000 characters'],
    trim: true
  },
  teacherId: { 
    type: String, 
    required: [true, 'Teacher ID is required']
  },
  classCode: { 
    type: String, 
    required: [true, 'Join code is required'],
    unique: true,
    maxLength: [20, 'Join code must be less than 20 characters'],
    match: [/^[A-Z0-9]{6,12}$/, 'Join code must be 6-12 uppercase alphanumeric characters']
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  maxStudents: { 
    type: Number,
    min: [1, 'Max students must be at least 1'],
    max: [500, 'Max students cannot exceed 500']
  },
  
  // Schedule information
  day: [{ 
    type: String,
    trim: true
  }],
  time: { 
    type: String,
    trim: true
  },
  room: { 
    type: String,
    trim: true,
    maxLength: [100, 'Room must be less than 100 characters']
  },
  
  students: [classStudentSchema],
  groups: [groupSchema],
  announcements: [announcementSchema],
  resources: [resourceSchema],
  posts: [postSchema],
  
  settings: {
    allowStudentPosts: { 
      type: Boolean, 
      default: true 
    },
    moderateStudentPosts: { 
      type: Boolean, 
      default: false 
    },
    allowLateSubmissions: { 
      type: Boolean, 
      default: true 
    },
    notifyOnNewStudent: { 
      type: Boolean, 
      default: true 
    }
  }
}, {
  timestamps: true
});

// Indexes for better query performance
classSchema.index({ teacherId: 1, isActive: 1 });
// Note: classCode index is created automatically by unique: true in field definition
classSchema.index({ 'students.studentId': 1 });
classSchema.index({ createdAt: -1 });

// Virtual for student count
classSchema.virtual('studentCount').get(function() {
  return this.students.filter(s => s.status === 'active').length;
});

// Virtual for active students
classSchema.virtual('activeStudents').get(function() {
  return this.students.filter(s => s.status === 'active');
});

// Method to generate join code
classSchema.methods.generateclassCode = function() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  this.classCode = result;
  return result;
};

// Method to add student to class
classSchema.methods.addStudent = function(studentId: string) {
  const existingStudent = this.students.find((s: IClassStudent) => s.studentId === studentId);
  if (existingStudent) {
    if (existingStudent.status !== 'active') {
      existingStudent.status = 'active';
      existingStudent.enrolledAt = new Date();
    }
    return false; // Student already exists
  }
  
  // Check max students limit
  if (this.maxStudents && this.studentCount >= this.maxStudents) {
    throw new Error('Class has reached maximum student capacity');
  }
  
  this.students.push({
    studentId,
    enrolledAt: new Date(),
    status: 'active'
  });
  return true; // Student added successfully
};

// Method to remove student from class
classSchema.methods.removeStudent = function(studentId: string) {
  const studentIndex = this.students.findIndex((s: IClassStudent) => s.studentId === studentId);
  if (studentIndex === -1) {
    return false; // Student not found
  }
  
  this.students[studentIndex].status = 'dropped';
  
  // Remove student from all groups
  this.groups.forEach((group: IGroup) => {
    group.members = group.members.filter((memberId: string) => memberId !== studentId);
  });
  
  return true; // Student removed successfully
};

// Method to check if student is enrolled
classSchema.methods.hasStudent = function(studentId: string) {
  return this.students.some((s: IClassStudent) => s.studentId === studentId && s.status === 'active');
};

// Method to add announcement
classSchema.methods.addAnnouncement = function(title: string, body: string, pinned = false) {
  const announcement: IAnnouncement = {
    id: `ann_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title,
    body,
    pinned,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  this.announcements.unshift(announcement);
  return announcement;
};

// Method to add resource
classSchema.methods.addResource = function(name: string, type: string, uploadedBy: string, options: Partial<IResource> = {}) {
  const resource: IResource = {
    id: `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    type,
    uploadedBy,
    uploadedAt: new Date(),
    ...options
  };
  this.resources.push(resource);
  return resource;
};

// Method to add post
classSchema.methods.addPost = function(authorId: string, authorName: string, body: string, authorAvatar?: string, pinned = false) {
  const post: IPost = {
    id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    authorId,
    authorName,
    authorAvatar,
    body,
    pinned,
    attachments: [],
    comments: [],
    commentsCount: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  this.posts.unshift(post);
  return post;
};

// Method to add comment to post
classSchema.methods.addComment = function(postId: string, authorId: string, authorName: string, text: string, authorAvatar?: string) {
  const post = this.posts.find((p: IPost) => p.id === postId);
  if (!post) {
    throw new Error('Post not found');
  }
  
  const comment: IComment = {
    id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    authorId,
    authorName,
    authorAvatar,
    text,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  post.comments.push(comment);
  post.commentsCount = post.comments.length;
  post.updatedAt = new Date();
  
  return comment;
};

// Use models to prevent re-compilation in Next.js
export default models.Class || model<IClass>('Class', classSchema);