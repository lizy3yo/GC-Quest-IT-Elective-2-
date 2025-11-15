import {
  IQuestion,
  IAssessment,
  IClass,
  ApiResponse,
  PaginatedResponse,
} from '@/interfaces';
import api from '@/lib/api';
import { TEACHER_API_BASE } from '@/constants/api';

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