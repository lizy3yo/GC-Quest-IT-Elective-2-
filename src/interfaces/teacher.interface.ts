export interface Teacher {
  id: string;
  name: string;
  email: string;
  role: 'teacher';
  avatar?: string;
  classIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTeacherData {
  name: string;
  email: string;
  password: string;
}

export interface UpdateTeacherData extends Partial<Omit<CreateTeacherData, 'password'>> {}

export interface TeacherFilters {
  search?: string;
  page?: number;
  limit?: number;
}

export interface TeacherListResponse {
  teachers: Teacher[];
  total: number;
  page: number;
  totalPages: number;
}
