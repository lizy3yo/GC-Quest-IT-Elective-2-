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

import api from '@/lib/api';

// Student-specific interfaces
export interface StudentInfo {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface TeacherInfo {
  name: string;
  email: string;
  department?: string;
}

export interface StudentAssessment {
  id: string;
  title: string;
  type: "Quiz" | "Exam";
  format?: "online" | "file_submission";
  dueDate: string;
  points?: number;
  description?: string;
  instructions?: string;
  published: boolean;
  isLocked?: boolean;
  scheduledOpen?: string;
  scheduledClose?: string;
  category: "Quiz" | "Exam" | "Activity";
}

export interface StudentActivity {
  id: string;
  title: string;
  dueDate: string;
  points: number;
  submittedAt?: string;
  status: "submitted" | "late" | "missing";
  description?: string;
}

export interface AttachmentMeta {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
}

export interface CommentMeta {
  id: string;
  author: string | null | undefined;
  timestamp: string | null | undefined;
  text: string | null | undefined;
}

export interface FeedPost {
  id: string;
  author: string;
  timestamp: string;
  content: string;
  link?: string;
  attachments?: AttachmentMeta[];
  comments?: CommentMeta[];
}

export interface ResourceItem {
  id: string;
  title: string;
  type: string;
  description?: string;
  url: string;
  mimeType?: string;
  sizeKB?: number;
}

export interface StudentClassDetails {
  _id: string;
  name: string;
  classCode: string;
  schedule: string;
  subject: string;
  courseYear: string;
  description?: string;
  instructor: TeacherInfo;
  students: StudentInfo[];
  studentCount: number;
  createdAt: string;
  activities?: StudentActivity[];
  feed?: FeedPost[];
  resources?: ResourceItem[];
  assessments?: StudentAssessment[];
}

// API response interfaces
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
}

export interface ClassListResponse {
  classes: StudentClassDetails[];
  pagination: {
    current: number;
    total: number;
    count: number;
    totalItems: number;
  };
}

export interface ClassDetailResponse {
  class: StudentClassDetails;
}

// Student API client
export const studentApi = {
  // Get all classes for the student
  async getClasses(params?: {
    active?: boolean;
    limit?: number;
    page?: number;
  }): Promise<ApiResponse<ClassListResponse>> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.active !== undefined) searchParams.append('active', params.active.toString());
      if (params?.limit) searchParams.append('limit', params.limit.toString());
      if (params?.page) searchParams.append('page', params.page.toString());

      const url = `/student/class${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
      const response = await api.get(url);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch classes',
        details: error.body?.details
      };
    }
  },

  // Get class details
  async getClassDetails(classId: string, includeDetails = true): Promise<ApiResponse<ClassDetailResponse>> {
    try {
      const url = `/student/class/${classId}${includeDetails ? '?details=true' : ''}`;
      const response = await api.get(url);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to fetch class details',
        details: error.body?.details
      };
    }
  },

  // Join a class using class code
  async joinClass(classCode: string): Promise<ApiResponse<{ class: StudentClassDetails }>> {
    try {
      const response = await api.post('/student/class', { classCode });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to join class',
        details: error.body?.details
      };
    }
  },

  // Create a post in class feed
  async createPost(classId: string, content: string, attachments: AttachmentMeta[] = []): Promise<ApiResponse<{ post: FeedPost }>> {
    try {
      const response = await api.post(`/student_page/class/${classId}/posts`, {
        content,
        attachments
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to create post',
        details: error.body?.details
      };
    }
  },

  // Submit an activity
  async submitActivity(classId: string, activityId: string, files: any[], comment?: string): Promise<ApiResponse<{ submission: any }>> {
    try {
      const response = await api.post(`/student_page/class/${classId}/activity/${activityId}/submit`, {
        files,
        comment
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to submit activity',
        details: error.body?.details
      };
    }
  },

  // Get student's submission for an activity
  async getSubmission(classId: string, activityId: string): Promise<ApiResponse<{ submission: any }>> {
    try {
      const response = await api.get(`/student_page/class/${classId}/activity/${activityId}/submit`);
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to get submission',
        details: error.body?.details
      };
    }
  }
};