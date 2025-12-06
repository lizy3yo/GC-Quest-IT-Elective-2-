import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requestService } from '@/services/request.service';
import { API_ENDPOINTS, QUERY_KEYS, STALE_TIME, CACHE_TIME } from '@/constants/api.constants';
import type {
  Assessment,
  CreateAssessmentData,
  UpdateAssessmentData,
  AssessmentFilters,
  AssessmentListResponse,
  AssessmentSubmission,
  AssessmentResult,
} from '@/interfaces/assessment.interface';
import { createComponentProps, transformMutationResult } from './useQueryHook';

// Get assessments list with filters
export const useAssessments = (filters?: AssessmentFilters) => {
  const result = useQuery({
    queryKey: QUERY_KEYS.TEACHER.ASSESSMENTS.LIST(filters),
    queryFn: async () => {
      const response = await requestService.get<AssessmentListResponse>(
        API_ENDPOINTS.TEACHER.ASSESSMENTS,
        { params: filters }
      );
      return response.data;
    },
    staleTime: STALE_TIME.MEDIUM,
    gcTime: CACHE_TIME.MEDIUM,
  });

  return createComponentProps(result);
};

// Get single assessment
export const useAssessment = (id: string, enabled = true) => {
  const result = useQuery({
    queryKey: QUERY_KEYS.TEACHER.ASSESSMENTS.DETAIL(id),
    queryFn: async () => {
      const response = await requestService.get<Assessment>(
        API_ENDPOINTS.TEACHER.ASSESSMENT_DETAIL(id)
      );
      return response.data;
    },
    enabled: enabled && !!id,
    staleTime: STALE_TIME.LONG,
    gcTime: CACHE_TIME.LONG,
  });

  return createComponentProps(result);
};

// Create assessment mutation
export const useCreateAssessment = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: CreateAssessmentData) => {
      const response = await requestService.post<Assessment>(
        API_ENDPOINTS.TEACHER.ASSESSMENTS,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TEACHER.ASSESSMENTS.ALL });
    },
  });

  return transformMutationResult(mutation);
};

// Update assessment mutation
export const useUpdateAssessment = (id: string) => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data: UpdateAssessmentData) => {
      const response = await requestService.put<Assessment>(
        API_ENDPOINTS.TEACHER.ASSESSMENT_DETAIL(id),
        data
      );
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEYS.TEACHER.ASSESSMENTS.DETAIL(id), data);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TEACHER.ASSESSMENTS.ALL });
    },
  });

  return transformMutationResult(mutation);
};

// Delete assessment mutation
export const useDeleteAssessment = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (id: string) => {
      await requestService.delete(API_ENDPOINTS.TEACHER.ASSESSMENT_DETAIL(id));
    },
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: QUERY_KEYS.TEACHER.ASSESSMENTS.DETAIL(id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TEACHER.ASSESSMENTS.ALL });
    },
  });

  return transformMutationResult(mutation);
};

// Submit assessment mutation
export const useSubmitAssessment = (assessmentId: string) => {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (submission: AssessmentSubmission) => {
      const response = await requestService.post<AssessmentResult>(
        API_ENDPOINTS.STUDENT.ASSESSMENTS(assessmentId),
        submission
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.STUDENT.ASSESSMENTS.DETAIL(assessmentId) 
      });
    },
  });

  return transformMutationResult(mutation);
};
