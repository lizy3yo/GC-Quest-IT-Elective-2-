import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requestService } from '@/services/request.service';
import { API_ENDPOINTS, QUERY_KEYS, STALE_TIME, CACHE_TIME } from '@/constants/api.constants';
import type {
  Flashcard,
  CreateFlashcardData,
  UpdateFlashcardData,
  FlashcardFilters,
  FlashcardListResponse,
} from '@/interfaces/flashcard.interface';
import type {
  Summary,
  CreateSummaryData,
  UpdateSummaryData,
  SummaryFilters,
  SummaryListResponse,
  GenerateSummaryFromTextData,
  ResummarizeData,
} from '@/interfaces/summary.interface';
import { createComponentProps, transformMutationResult } from './useQueryHook';
import type {
  PracticeTest,
  CreatePracticeTestData,
  UpdatePracticeTestData,
  PracticeTestFilters,
  PracticeTestListResponse,
  GeneratePracticeTestData,
  SubmitPracticeTestData,
  PracticeTestResult,
} from '@/interfaces/practice-test.interface';
import type {
  Folder,
  CreateFolderData,
  UpdateFolderData,
  FolderFilters,
  FolderListResponse,
} from '@/interfaces/folder.interface';
import type {
  Resource,
  CreateResourceData,
  UpdateResourceData,
  ResourceFilters,
  ResourceListResponse,
  DiscoverResourcesData,
} from '@/interfaces/resource.interface';
import type {
  StudyRoom,
  CreateStudyRoomData,
  UpdateStudyRoomData,
  StudyRoomFilters,
  StudyRoomListResponse,
  StudyRoomInvite,
  SendInviteData,
  RespondToInviteData,
} from '@/interfaces/study-room.interface';
import type { Class, ClassFilters, ClassListResponse } from '@/interfaces/class.interface';

// ============ CLASSES ============
export const useStudentClasses = (filters?: ClassFilters) => {
  const result = useQuery({
    queryKey: QUERY_KEYS.STUDENT.CLASSES.LIST(filters),
    queryFn: async () => {
      const response = await requestService.get<ClassListResponse>(
        API_ENDPOINTS.STUDENT.CLASSES,
        { params: filters }
      );
      return response.data;
    },
    staleTime: STALE_TIME.MEDIUM,
  });

  return createComponentProps(result);
};

export const useStudentClass = (id: string, enabled = true) => {
  const result = useQuery({
    queryKey: QUERY_KEYS.STUDENT.CLASSES.DETAIL(id),
    queryFn: async () => {
      const response = await requestService.get<Class>(
        API_ENDPOINTS.STUDENT.CLASS_DETAIL(id)
      );
      return response.data;
    },
    enabled: enabled && !!id,
    staleTime: STALE_TIME.LONG,
  });

  return createComponentProps(result);
};

// ============ FLASHCARDS ============
export const useStudentFlashcards = (filters?: FlashcardFilters) => {
  const result = useQuery({
    queryKey: QUERY_KEYS.STUDENT.FLASHCARDS.LIST(filters),
    queryFn: async () => {
      const response = await requestService.get<FlashcardListResponse>(
        API_ENDPOINTS.STUDENT.FLASHCARDS,
        { params: filters }
      );
      return response.data;
    },
    staleTime: STALE_TIME.MEDIUM,
  });

  return createComponentProps(result);
};

export const useStudentFlashcard = (id: string, enabled = true) => {
  const result = useQuery({
    queryKey: QUERY_KEYS.STUDENT.FLASHCARDS.DETAIL(id),
    queryFn: async () => {
      const response = await requestService.get<Flashcard>(
        API_ENDPOINTS.STUDENT.FLASHCARD_DETAIL(id)
      );
      return response.data;
    },
    enabled: enabled && !!id,
    staleTime: STALE_TIME.LONG,
  });

  return createComponentProps(result);
};

export const useCreateStudentFlashcard = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (data: CreateFlashcardData) => {
      const response = await requestService.post<Flashcard>(
        API_ENDPOINTS.STUDENT.FLASHCARDS,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STUDENT.FLASHCARDS.ALL });
    },
  });

  return transformMutationResult(mutation);
};

export const useUpdateStudentFlashcard = (id: string) => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (data: UpdateFlashcardData) => {
      const response = await requestService.put<Flashcard>(
        API_ENDPOINTS.STUDENT.FLASHCARD_DETAIL(id),
        data
      );
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEYS.STUDENT.FLASHCARDS.DETAIL(id), data);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STUDENT.FLASHCARDS.ALL });
    },
  });

  return transformMutationResult(mutation);
};

export const useDeleteStudentFlashcard = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (id: string) => {
      await requestService.delete(API_ENDPOINTS.STUDENT.FLASHCARD_DETAIL(id));
    },
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: QUERY_KEYS.STUDENT.FLASHCARDS.DETAIL(id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STUDENT.FLASHCARDS.ALL });
    },
  });

  return transformMutationResult(mutation);
};

export const useGenerateFlashcardFromText = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (data: { text: string }) => {
      const response = await requestService.post<Flashcard[]>(
        API_ENDPOINTS.STUDENT.GENERATE_FLASHCARD_TEXT,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STUDENT.FLASHCARDS.ALL });
    },
  });

  return transformMutationResult(mutation);
};

export const useGenerateFlashcardFromFile = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await requestService.upload<Flashcard[]>(
        API_ENDPOINTS.STUDENT.GENERATE_FLASHCARD_FILE,
        formData
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STUDENT.FLASHCARDS.ALL });
    },
  });

  return transformMutationResult(mutation);
};

export const usePublicFlashcards = () => {
  const result = useQuery({
    queryKey: QUERY_KEYS.STUDENT.FLASHCARDS.PUBLIC,
    queryFn: async () => {
      const response = await requestService.get<FlashcardListResponse>(
        API_ENDPOINTS.STUDENT.PUBLIC_FLASHCARDS
      );
      return response.data;
    },
    staleTime: STALE_TIME.LONG,
  });

  return createComponentProps(result);
};

// ============ SUMMARIES ============
export const useStudentSummaries = (filters?: SummaryFilters) => {
  const result = useQuery({
    queryKey: QUERY_KEYS.STUDENT.SUMMARIES.LIST(filters),
    queryFn: async () => {
      const response = await requestService.get<SummaryListResponse>(
        API_ENDPOINTS.STUDENT.SUMMARIES,
        { params: filters }
      );
      return response.data;
    },
    staleTime: STALE_TIME.MEDIUM,
  });

  return createComponentProps(result);
};

export const useGenerateSummaryFromText = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (data: GenerateSummaryFromTextData) => {
      const response = await requestService.post<Summary>(
        API_ENDPOINTS.STUDENT.GENERATE_SUMMARY_TEXT,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STUDENT.SUMMARIES.ALL });
    },
  });

  return transformMutationResult(mutation);
};

export const useGenerateSummaryFromFile = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await requestService.upload<Summary>(
        API_ENDPOINTS.STUDENT.GENERATE_SUMMARY_FILE,
        formData
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STUDENT.SUMMARIES.ALL });
    },
  });

  return transformMutationResult(mutation);
};

export const useResummarize = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (data: ResummarizeData) => {
      const response = await requestService.post<Summary>(
        API_ENDPOINTS.STUDENT.RESUMMARIZE,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STUDENT.SUMMARIES.ALL });
    },
  });

  return transformMutationResult(mutation);
};

// ============ PRACTICE TESTS ============
export const useStudentPracticeTests = (filters?: PracticeTestFilters) => {
  const result = useQuery({
    queryKey: QUERY_KEYS.STUDENT.PRACTICE_TESTS.LIST(filters),
    queryFn: async () => {
      const response = await requestService.get<PracticeTestListResponse>(
        API_ENDPOINTS.STUDENT.PRACTICE_TESTS,
        { params: filters }
      );
      return response.data;
    },
    staleTime: STALE_TIME.MEDIUM,
  });

  return createComponentProps(result);
};

export const useStudentPracticeTest = (id: string, enabled = true) => {
  const result = useQuery({
    queryKey: QUERY_KEYS.STUDENT.PRACTICE_TESTS.DETAIL(id),
    queryFn: async () => {
      const response = await requestService.get<PracticeTest>(
        API_ENDPOINTS.STUDENT.PRACTICE_TEST_DETAIL(id)
      );
      return response.data;
    },
    enabled: enabled && !!id,
    staleTime: STALE_TIME.LONG,
  });

  return createComponentProps(result);
};

export const useGeneratePracticeTest = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (data: GeneratePracticeTestData) => {
      if (data.file) {
        const formData = new FormData();
        formData.append('file', data.file);
        if (data.title) formData.append('title', data.title);
        if (data.questionCount) formData.append('questionCount', data.questionCount.toString());
        const response = await requestService.upload<PracticeTest>(
          API_ENDPOINTS.STUDENT.GENERATE_PRACTICE_TEST,
          formData
        );
        return response.data;
      } else {
        const response = await requestService.post<PracticeTest>(
          API_ENDPOINTS.STUDENT.GENERATE_PRACTICE_TEST,
          data
        );
        return response.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STUDENT.PRACTICE_TESTS.ALL });
    },
  });

  return transformMutationResult(mutation);
};

export const useSubmitPracticeTest = () => {
  const mutation = useMutation({
    mutationFn: async (data: SubmitPracticeTestData) => {
      const response = await requestService.post<PracticeTestResult>(
        API_ENDPOINTS.STUDENT.SUBMIT_PRACTICE_TEST,
        data
      );
      return response.data;
    },
  });

  return transformMutationResult(mutation);
};

// ============ FOLDERS ============
export const useStudentFolders = (filters?: FolderFilters) => {
  const result = useQuery({
    queryKey: QUERY_KEYS.STUDENT.FOLDERS.LIST(filters),
    queryFn: async () => {
      const response = await requestService.get<FolderListResponse>(
        API_ENDPOINTS.STUDENT.FOLDERS,
        { params: filters }
      );
      return response.data;
    },
    staleTime: STALE_TIME.MEDIUM,
  });

  return createComponentProps(result);
};

export const useCreateStudentFolder = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (data: CreateFolderData) => {
      const response = await requestService.post<Folder>(
        API_ENDPOINTS.STUDENT.FOLDERS,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STUDENT.FOLDERS.ALL });
    },
  });

  return transformMutationResult(mutation);
};

// ============ RESOURCES ============
export const useStudentResources = (filters?: ResourceFilters) => {
  const result = useQuery({
    queryKey: QUERY_KEYS.STUDENT.RESOURCES.LIST(filters),
    queryFn: async () => {
      const response = await requestService.get<ResourceListResponse>(
        API_ENDPOINTS.STUDENT.RESOURCES,
        { params: filters }
      );
      return response.data;
    },
    staleTime: STALE_TIME.MEDIUM,
  });

  return createComponentProps(result);
};

export const useDiscoverResources = () => {
  const mutation = useMutation({
    mutationFn: async (data: DiscoverResourcesData) => {
      const response = await requestService.post<Resource[]>(
        API_ENDPOINTS.STUDENT.DISCOVER_RESOURCES,
        data
      );
      return response.data;
    },
  });

  return transformMutationResult(mutation);
};

// ============ STUDY ROOMS ============
export const useStudentStudyRooms = (filters?: StudyRoomFilters) => {
  const result = useQuery({
    queryKey: QUERY_KEYS.STUDENT.STUDY_ROOMS.LIST(filters),
    queryFn: async () => {
      const response = await requestService.get<StudyRoomListResponse>(
        API_ENDPOINTS.STUDENT.STUDY_ROOMS,
        { params: filters }
      );
      return response.data;
    },
    staleTime: STALE_TIME.MEDIUM,
  });

  return createComponentProps(result);
};

export const useCreateStudyRoom = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (data: CreateStudyRoomData) => {
      const response = await requestService.post<StudyRoom>(
        API_ENDPOINTS.STUDENT.STUDY_ROOMS,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STUDENT.STUDY_ROOMS.ALL });
    },
  });

  return transformMutationResult(mutation);
};

export const useStudyRoomInvites = () => {
  const result = useQuery({
    queryKey: QUERY_KEYS.STUDENT.STUDY_ROOMS.INVITES,
    queryFn: async () => {
      const response = await requestService.get<StudyRoomInvite[]>(
        API_ENDPOINTS.STUDENT.STUDY_ROOM_INVITES
      );
      return response.data;
    },
    staleTime: STALE_TIME.SHORT,
  });

  return createComponentProps(result);
};

// ============ HISTORY & ACTIVITY ============
export const useStudentHistory = () => {
  const result = useQuery({
    queryKey: QUERY_KEYS.STUDENT.HISTORY,
    queryFn: async () => {
      const response = await requestService.get(API_ENDPOINTS.STUDENT.HISTORY);
      return response.data;
    },
    staleTime: STALE_TIME.SHORT,
  });

  return createComponentProps(result);
};

export const useLogActivity = () => {
  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await requestService.post(
        API_ENDPOINTS.STUDENT.LOG_ACTIVITY,
        data
      );
      return response.data;
    },
  });

  return transformMutationResult(mutation);
};

export const useDueItems = () => {
  const result = useQuery({
    queryKey: QUERY_KEYS.STUDENT.DUE_ITEMS,
    queryFn: async () => {
      const response = await requestService.get(API_ENDPOINTS.STUDENT.DUE_ITEMS);
      return response.data;
    },
    staleTime: STALE_TIME.SHORT,
  });

  return createComponentProps(result);
};
