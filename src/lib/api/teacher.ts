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

// Types from the assessment model
export interface IQuestion {
  id: string;
  type: 'short' | 'paragraph' | 'mcq' | 'checkboxes' | 'identification' | 'enumeration' | 'match' | 'title' | 'image' | 'section';
  title: string;
  required?: boolean;
  options?: string[];
  answer?: string;
  items?: string[];
  pairs?: { left: string; right?: string }[];
  description?: string;
  src?: string;
  alt?: string;
  points?: number;
}

export interface IAssessment {
  _id?: string;
  title: string;
  description?: string;
  type: 'MCQ' | 'TF' | 'Practical' | 'Written' | 'Mixed';
  category: 'Quiz' | 'Exam' | 'Activity';
  format?: 'online' | 'file_submission'; // Add format field
  questions: IQuestion[];
  classId: string;
  teacherId?: string;
  timeLimitMins?: number;
  maxAttempts?: number;
  published?: boolean;
  accessCode?: string;
  dueDate?: Date | string;
  availableFrom?: Date | string;
  availableUntil?: Date | string;
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
  }[];
  settings?: {
    lockdown?: boolean;
    showProgress?: boolean;
    allowBacktrack?: boolean;
    autoSubmit?: boolean;
  };
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface IClass {
  _id?: string;
  name: string;
  courseYear: string;
  subject: string;
  description?: string;
  teacherId?: string;
  teacher?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    fullName: string;
  };
  classCode?: string;
  isActive?: boolean;
  maxStudents?: number;
  studentCount?: number;
  
  // Schedule information
  day?: string[]; // Array of days like ["Monday", "Tuesday"]
  time?: string; // Time like "9:00 AM-10:00 AM"
  room?: string; // Room like "GC Main 525"
  
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

// API response types
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
  message?: string;
}

interface PaginatedResponse<T> {
  success: boolean;
  data?: {
    assessments?: T[];
    classes?: T[];
    pagination: {
      current: number;
      total: number;
      count: number;
      totalItems: number;
    };
  };
  error?: string;
}

import api from '@/lib/api';
import { TEACHER_API_BASE } from '@/constants/api';

// Use central ApiClient to ensure consistent auth/refresh handling.
// TEACHER_API_BASE points to '/api/teacher_page' and ApiClient now accepts paths starting with '/api/'.


// Assessment API functions
export const assessmentApi = {
  // Get all assessments for teacher
  async getAssessments(params?: {
    classId?: string;
    category?: 'Quiz' | 'Exam' | 'Activity';
    published?: boolean;
    limit?: number;
    page?: number;
  }): Promise<PaginatedResponse<IAssessment>> {
    const searchParams = new URLSearchParams();
    if (params?.classId) searchParams.set('classId', params.classId);
    if (params?.category) searchParams.set('category', params.category);
    if (params?.published !== undefined) searchParams.set('published', params.published.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.page) searchParams.set('page', params.page.toString());

    try {
      const result = await api.get(`${TEACHER_API_BASE}/assessment?${searchParams}`);
      return result as PaginatedResponse<IAssessment>;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to fetch assessments', details: err?.body?.details } as PaginatedResponse<IAssessment>;
    }
  },

  // Get specific assessment by ID
  async getAssessment(id: string): Promise<ApiResponse<{ assessment: IAssessment }>> {
    try {
      const result = await api.get(`${TEACHER_API_BASE}/assessment/${id}`);
      return result as ApiResponse<{ assessment: IAssessment }>;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to fetch assessment', details: err?.body?.details } as ApiResponse<{ assessment: IAssessment }>;
    }
  },

  // Create new assessment
  async createAssessment(assessment: Omit<IAssessment, '_id' | 'teacherId' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<{ assessment: IAssessment }>> {
    try {
      console.log('Creating assessment with API:', assessment);
      
      try {
        const result = await api.post(`${TEACHER_API_BASE}/assessment`, assessment);
        return result as ApiResponse<{ assessment: IAssessment }>;
      } catch (err: any) {
        return { success: false, error: err?.message || 'Network error', details: err?.body?.details } as ApiResponse<{ assessment: IAssessment }>;
      }

    } catch (error) {
      console.error('Network error in createAssessment:', error);
      return {
        success: false,
        error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: error instanceof Error ? error.stack : undefined
      };
    }
  },

  // Update assessment
  async updateAssessment(id: string, assessment: Partial<IAssessment>): Promise<ApiResponse<{ assessment: IAssessment }>> {
    try {
      const result = await api.request(`${TEACHER_API_BASE}/assessment/${id}`, { method: 'PUT', body: JSON.stringify(assessment) });
      return result as ApiResponse<{ assessment: IAssessment }>;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update assessment', details: err?.body?.details } as ApiResponse<{ assessment: IAssessment }>;
    }
  },

  // Delete assessment
  async deleteAssessment(id: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const result = await api.del(`${TEACHER_API_BASE}/assessment/${id}`);
      return result as ApiResponse<{ message: string }>;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to delete assessment', details: err?.body?.details } as ApiResponse<{ message: string }>;
    }
  },

  // Publish assessment
  async publishAssessment(id: string): Promise<ApiResponse<{ assessment: IAssessment; accessCode: string; message: string }>> {
    try {
      const result = await api.post(`${TEACHER_API_BASE}/assessment/${id}/publish`);
      return result as ApiResponse<{ assessment: IAssessment; accessCode: string; message: string }>;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to publish assessment', details: err?.body?.details } as ApiResponse<{ assessment: IAssessment; accessCode: string; message: string }>;
    }
  }
};

// Class API functions
export const classApi = {
  // Get all classes for teacher
  async getClasses(params?: {
    active?: boolean;
    limit?: number;
    page?: number;
  }): Promise<PaginatedResponse<IClass>> {
    const searchParams = new URLSearchParams();
    if (params?.active !== undefined) searchParams.set('active', params.active.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.page) searchParams.set('page', params.page.toString());

    try {
      const result = await api.get(`${TEACHER_API_BASE}/class?${searchParams}`);
      return result as PaginatedResponse<IClass>;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to fetch classes', details: err?.body?.details } as PaginatedResponse<IClass>;
    }
  },

  // Get specific class by ID
  async getClass(id: string, includeStudents = false): Promise<ApiResponse<{ class: IClass }>> {
    const searchParams = new URLSearchParams();
    if (includeStudents) searchParams.set('includeStudents', 'true');

    try {
      const result = await api.get(`${TEACHER_API_BASE}/class/${id}?${searchParams}`);
      return result as ApiResponse<{ class: IClass }>;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to fetch class', details: err?.body?.details } as ApiResponse<{ class: IClass }>;
    }
  },

  // Create new class
  async createClass(classData: Omit<IClass, '_id' | 'teacherId' | 'classCode' | 'createdAt' | 'updatedAt'>): Promise<ApiResponse<{ class: IClass }>> {
    try {
      const result = await api.post(`${TEACHER_API_BASE}/class`, classData);
      return result as ApiResponse<{ class: IClass }>;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to create class', details: err?.body?.details } as ApiResponse<{ class: IClass }>;
    }
  },

  // Update class
  async updateClass(id: string, classData: Partial<IClass>): Promise<ApiResponse<{ class: IClass }>> {
    try {
      const result = await api.request(`${TEACHER_API_BASE}/class/${id}`, { method: 'PUT', body: JSON.stringify(classData) });
      return result as ApiResponse<{ class: IClass }>;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to update class', details: err?.body?.details } as ApiResponse<{ class: IClass }>;
    }
  },

  // Delete class
  async deleteClass(id: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const result = await api.del(`${TEACHER_API_BASE}/class/${id}`);
      return result as ApiResponse<{ message: string }>;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to delete class', details: err?.body?.details } as ApiResponse<{ message: string }>;
    }
  },

  // Get class students
  async getClassStudents(id: string): Promise<ApiResponse<{ students: any[] }>> {
    try {
      const result = await api.get(`${TEACHER_API_BASE}/class/${id}/students`);
      return result as ApiResponse<{ students: any[] }>;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to fetch students', details: err?.body?.details } as ApiResponse<{ students: any[] }>;
    }
  },

  // Add student to class
  async addStudentToClass(id: string, email: string): Promise<ApiResponse<{ student: any; message: string }>> {
    try {
      const result = await api.post(`${TEACHER_API_BASE}/class/${id}/students`, { email });
      return result as ApiResponse<{ student: any; message: string }>;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to add student', details: err?.body?.details } as ApiResponse<{ student: any; message: string }>;
    }
  },

  // Add announcement to class
  async addAnnouncement(id: string, announcement: { title: string; body: string; pinned?: boolean }): Promise<ApiResponse<{ announcement: any }>> {
    try {
      const result = await api.post(`${TEACHER_API_BASE}/class/${id}/announcements`, announcement);
      return result as ApiResponse<{ announcement: any }>;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to add announcement', details: err?.body?.details } as ApiResponse<{ announcement: any }>;
    }
  },

  // Upload resource to class
  async uploadResource(id: string, file: File, description?: string): Promise<ApiResponse<{ resource: any }>> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (description) formData.append('description', description);

      const result = await api.post(`${TEACHER_API_BASE}/class/${id}/resources`, formData);
      return result as ApiResponse<{ resource: any }>;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to upload resource', details: err?.body?.details } as ApiResponse<{ resource: any }>;
    }
  },

  // Get resources for class
  async getResources(id: string): Promise<ApiResponse<{ resources: any[] }>> {
    try {
      const result = await api.get(`${TEACHER_API_BASE}/class/${id}/resources`);
      return result as ApiResponse<{ resources: any[] }>;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to fetch resources', details: err?.body?.details } as ApiResponse<{ resources: any[] }>;
    }
  }
};

// Assessment attachment API functions
export const attachmentApi = {
  // Upload attachment to assessment
  async uploadAttachment(assessmentId: string, file: File): Promise<ApiResponse<{ attachment: any }>> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await api.post(`${TEACHER_API_BASE}/assessment/${assessmentId}/attachments`, formData);
      return result as ApiResponse<{ attachment: any }>;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to upload attachment', details: err?.body?.details } as ApiResponse<{ attachment: any }>;
    }
  },

  // Get attachments for assessment
  async getAttachments(assessmentId: string): Promise<ApiResponse<{ attachments: any[] }>> {
    try {
      const result = await api.get(`${TEACHER_API_BASE}/assessment/${assessmentId}/attachments`);
      return result as ApiResponse<{ attachments: any[] }>;
    } catch (err: any) {
      return { success: false, error: err?.message || 'Failed to fetch attachments', details: err?.body?.details } as ApiResponse<{ attachments: any[] }>;
    }
  }
};

// Hook for easy React integration
export function useApi() {
  return {
    assessment: assessmentApi,
    class: classApi,
    attachment: attachmentApi
  };
}