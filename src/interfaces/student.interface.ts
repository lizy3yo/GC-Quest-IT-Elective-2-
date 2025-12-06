export interface Student {
  id: string;
  name: string;
  email: string;
  role: 'student';
  avatar?: string;
  classIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateStudentData {
  name: string;
  email: string;
  password: string;
  classIds?: string[];
}

export interface UpdateStudentData extends Partial<Omit<CreateStudentData, 'password'>> {}

export interface StudentFilters {
  classId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface StudentListResponse {
  students: Student[];
  total: number;
  page: number;
  totalPages: number;
}
