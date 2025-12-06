export interface Parent {
  id: string;
  name: string;
  email: string;
  role: 'parent';
  avatar?: string;
  childrenIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateParentData {
  name: string;
  email: string;
  password: string;
  childrenIds?: string[];
}

export interface UpdateParentData extends Partial<Omit<CreateParentData, 'password'>> {}

export interface ParentFilters {
  search?: string;
  page?: number;
  limit?: number;
}

export interface ParentListResponse {
  parents: Parent[];
  total: number;
  page: number;
  totalPages: number;
}
