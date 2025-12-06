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
import { createComponentProps, transformMutationResult } from './useQueryHook';

// Get flashcards list with filters
export const useFlashcards = (filters?: FlashcardFilters) => {
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
    gcTime: CACHE_TIME.MEDIUM,
  });

  return createComponentProps(result);
};

// Get single flashcard
export const useFlashcard = (id: string, enabled = true) => {
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
    gcTime: CACHE_TIME.LONG,
  });

  return createComponentProps(result);
};

// Create flashcard mutation
export const useCreateFlashcard = () => {
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
      // Invalidate flashcards list
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STUDENT.FLASHCARDS.ALL });
    },
  });

  return transformMutationResult(mutation);
};

// Update flashcard mutation
export const useUpdateFlashcard = (id: string) => {
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
      // Update cache for this specific flashcard
      queryClient.setQueryData(QUERY_KEYS.STUDENT.FLASHCARDS.DETAIL(id), data);
      // Invalidate list to refetch
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STUDENT.FLASHCARDS.ALL });
    },
  });

  return transformMutationResult(mutation);
};

// Delete flashcard mutation
export const useDeleteFlashcard = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (id: string) => {
      await requestService.delete(API_ENDPOINTS.STUDENT.FLASHCARD_DETAIL(id));
    },
    onSuccess: (_, id) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: QUERY_KEYS.STUDENT.FLASHCARDS.DETAIL(id) });
      // Invalidate list
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STUDENT.FLASHCARDS.ALL });
    },
  });

  return transformMutationResult(mutation);
};
