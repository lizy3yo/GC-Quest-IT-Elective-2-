export interface Class {
  id: string;
  name: string;
  description?: string;
  teacherId: string;
  students: string[];
  createdAt: string;
  updatedAt: string;
  code?: string;
  isActive: boolean;
}

export interface CreateClassData {
  name: string;
  description?: string;
  students?: string[];
}

export interface UpdateClassData extends Partial<CreateClassData> {}

export interface ClassFilters {
  teacherId?: string;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ClassListResponse {
  classes: Class[];
  total: number;
  page: number;
  totalPages: number;
}
