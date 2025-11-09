// Central API constants
export const API_V1 = '/api/v1';
export const TEACHER_API_BASE = '/api/teacher_page';
export const STUDENT_API_BASE = '/api/student_page';

// Named endpoints (examples) - extend as needed
export const ENDPOINTS = {
  usersCurrent: `${API_V1}/users/current`,
  authRefresh: `${API_V1}/auth/refresh-token`,
  teacherAssessment: `${TEACHER_API_BASE}/assessment`,
  teacherClass: `${TEACHER_API_BASE}/class`,
};
