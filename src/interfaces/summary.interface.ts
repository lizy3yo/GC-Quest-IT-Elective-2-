export interface Summary {
  id: string;
  title: string;
  content: string;
  source?: string;
  userId: string;
  classId?: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  readCount?: number;
}

export interface CreateSummaryData {
  title: string;
  content?: string;
  text?: string;
  file?: File;
  classId?: string;
  isPublic?: boolean;
}

export interface UpdateSummaryData extends Partial<Omit<CreateSummaryData, 'file'>> {}

export interface SummaryFilters {
  classId?: string;
  isPublic?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface SummaryListResponse {
  summaries: Summary[];
  total: number;
  page: number;
  totalPages: number;
}

export interface GenerateSummaryFromTextData {
  text: string;
  title?: string;
}

export interface GenerateSummaryFromFileData {
  file: File;
  title?: string;
}

export interface ResummarizeData {
  summaryId: string;
  instructions?: string;
}
