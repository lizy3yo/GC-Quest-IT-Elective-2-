import api from '@/lib/api';
import {
  StudentInfo,
  TeacherInfo,
  StudentAssessment,
  StudentActivity,
  AttachmentMeta,
  CommentMeta,
  FeedPost,
  ResourceItem,
  StudentClassDetails,
  ApiResponse,
  ClassListResponse,
  ClassDetailResponse,
} from '@/interfaces';

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

  async updatePost(classId: string, postId: string, content: string): Promise<ApiResponse<{ post: FeedPost }>> {
    try {
      const response = await api.put(`/student_page/class/${classId}/posts/${postId}`, {
        content
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to update post',
        details: error.body?.details
      };
    }
  },

  async deletePost(classId: string, postId: string): Promise<ApiResponse<void>> {
    try {
      await api.delete(`/student_page/class/${classId}/posts/${postId}`);
      
      return {
        success: true,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to delete post',
        details: error.body?.details
      };
    }
  },

  async createComment(classId: string, postId: string, text: string): Promise<ApiResponse<{ comment: CommentMeta }>> {
    try {
      const response = await api.post(`/student_page/class/${classId}/posts/${postId}/comments`, {
        text
      });
      
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to create comment',
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
  },

  // Get flashcards for a user
  async getFlashcards(params: { userId: string }): Promise<ApiResponse<{ flashcards: any[] }>> {
    try {
      // Mock data for now
      const mockFlashcards = [
        { _id: '1', title: 'React Basics', cards: [{}, {}, {}], updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
        { _id: '2', title: 'JavaScript Fundamentals', cards: [{}, {}, {}, {}], updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
      ];
      return {
        success: true,
        data: {
          flashcards: mockFlashcards
        }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to get flashcards',
        details: error.body?.details
      };
    }
  }
};