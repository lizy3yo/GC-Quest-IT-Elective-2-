export interface Folder {
  id: string;
  name: string;
  description?: string;
  userId: string;
  parentId?: string;
  flashcardIds: string[];
  summaryIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateFolderData {
  name: string;
  description?: string;
  parentId?: string;
}

export interface UpdateFolderData extends Partial<CreateFolderData> {}

export interface FolderFilters {
  parentId?: string;
  search?: string;
}

export interface FolderListResponse {
  folders: Folder[];
  total: number;
}
