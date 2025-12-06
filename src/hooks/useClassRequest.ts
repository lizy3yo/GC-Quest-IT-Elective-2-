import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requestService } from '@/services/request.service';
import { API_ENDPOINTS, QUERY_KEYS, STALE_TIME, CACHE_TIME } from '@/constants/api.constants';
import type {
  Class,
  CreateClassData,
  UpdateClassData,
  ClassFilters,
  ClassListResponse,
} from '@/interfaces/class.interface';
import { createComponentProps, transformMutationResult } from './useQueryHook';

// Get classes list with filters
export const useClasses = (filters?: ClassFilters) => {
  const result = useQuery({
    queryKey: QUERY_KEYS.TEACHER.CLASSES.LIST(filters),
    queryFn: async () => {
      const response = await requestService.get<ClassListResponse>(
        API_ENDPOINTS.TEACHER.CLASSES,
        { params: filters }
      );
      return response.data;
    },
    staleTime: STALE_TIME.MEDIUM,
    gcTime: CACHE_TIME.MEDIUM,
  });

  return createComponentProps(result);
};

// Get single class
export const useClass = (id: string, enabled = true) => {
  const result = useQuery({
    queryKey: QUERY_KEYS.TEACHER.CLASSES.DETAIL(id),
    queryFn: async () => {
      const response = await requestService.get<Class>(
        API_ENDPOINTS.TEACHER.CLASS_DETAIL(id)
      );
      return response.data;
    },
    enabled: enabled && !!id,
    staleTime: STALE_TIME.LONG,
    gcTime: CACHE_TIME.LONG,
  });

  return createComponentProps(result);
};

// Create class mutation
export const useCreateClass = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (data: CreateClassData) => {
      const response = await requestService.post<Class>(
        API_ENDPOINTS.TEACHER.CLASSES,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TEACHER.CLASSES.ALL });
    },
  });

  return transformMutationResult(mutation);
};

// Update class mutation
export const useUpdateClass = (id: string) => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (data: UpdateClassData) => {
      const response = await requestService.put<Class>(
        API_ENDPOINTS.TEACHER.CLASS_DETAIL(id),
        data
      );
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEYS.TEACHER.CLASSES.DETAIL(id), data);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TEACHER.CLASSES.ALL });
    },
  });

  return transformMutationResult(mutation);
};

// Delete class mutation
export const useDeleteClass = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (id: string) => {
      await requestService.delete(API_ENDPOINTS.TEACHER.CLASS_DETAIL(id));
    },
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: QUERY_KEYS.TEACHER.CLASSES.DETAIL(id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TEACHER.CLASSES.ALL });
    },
  });

  return transformMutationResult(mutation);
};
