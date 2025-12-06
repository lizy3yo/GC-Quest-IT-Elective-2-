export interface Resource {
  id: string;
  title: string;
  description?: string;
  type: 'pdf' | 'video' | 'link' | 'document';
  url: string;
  classId?: string;
  subject?: string;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

export interface CreateResourceData {
  title: string;
  description?: string;
  type: 'pdf' | 'video' | 'link' | 'document';
  url?: string;
  file?: File;
  classId?: string;
  subject?: string;
  tags?: string[];
}

export interface UpdateResourceData extends Partial<Omit<CreateResourceData, 'file'>> {}

export interface ResourceFilters {
  classId?: string;
  subject?: string;
  type?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ResourceListResponse {
  resources: Resource[];
  total: number;
  page: number;
  totalPages: number;
}

export interface DiscoverResourcesData {
  subject: string;
  topic?: string;
}
