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
import type {
  Assessment,
  CreateAssessmentData,
  UpdateAssessmentData,
  AssessmentFilters,
  AssessmentListResponse,
} from '@/interfaces/assessment.interface';
import type {
  DashboardMetrics,
  ClassPerformance,
  StudentPerformance,
  ActivityItem,
} from '@/interfaces/analytics.interface';
import { createComponentProps, transformMutationResult } from './useQueryHook';

// ============ CLASSES ============
export const useTeacherClasses = (filters?: ClassFilters) => {
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

export const useTeacherClass = (id: string, enabled = true) => {
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

export const useCreateTeacherClass = () => {
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

export const useUpdateTeacherClass = (id: string) => {
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

export const useDeleteTeacherClass = () => {
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

// ============ ASSESSMENTS ============
export const useTeacherAssessments = (filters?: AssessmentFilters) => {
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

export const useTeacherAssessment = (id: string, enabled = true) => {
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

export const useCreateTeacherAssessment = () => {
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

export const useUpdateTeacherAssessment = (id: string) => {
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

export const useDeleteTeacherAssessment = () => {
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

export const useGenerateAssessmentFromText = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (data: { text: string; title?: string; questionCount?: number }) => {
      const response = await requestService.post<Assessment>(
        API_ENDPOINTS.TEACHER.GENERATE_ASSESSMENT_TEXT,
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

export const useGenerateAssessmentFromFile = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await requestService.upload<Assessment>(
        API_ENDPOINTS.TEACHER.GENERATE_ASSESSMENT_FILE,
        formData
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TEACHER.ASSESSMENTS.ALL });
    },
  });

  return transformMutationResult(mutation);
};

// ============ ANALYTICS ============
export const useTeacherDashboardMetrics = () => {
  const result = useQuery({
    queryKey: QUERY_KEYS.TEACHER.ANALYTICS.DASHBOARD,
    queryFn: async () => {
      const response = await requestService.get<DashboardMetrics>(
        API_ENDPOINTS.TEACHER.ANALYTICS_DASHBOARD
      );
      return response.data;
    },
    staleTime: STALE_TIME.SHORT,
  });

  return createComponentProps(result);
};

export const useTeacherClassPerformance = (classId: string, enabled = true) => {
  const result = useQuery({
    queryKey: QUERY_KEYS.TEACHER.ANALYTICS.CLASS(classId),
    queryFn: async () => {
      const response = await requestService.get<ClassPerformance>(
        API_ENDPOINTS.TEACHER.ANALYTICS_CLASS,
        { params: { classId } }
      );
      return response.data;
    },
    enabled: enabled && !!classId,
    staleTime: STALE_TIME.MEDIUM,
  });

  return createComponentProps(result);
};

export const useTeacherStudentPerformance = (studentId: string, enabled = true) => {
  const result = useQuery({
    queryKey: QUERY_KEYS.TEACHER.STUDENTS.DETAIL(studentId),
    queryFn: async () => {
      const response = await requestService.get<StudentPerformance>(
        API_ENDPOINTS.TEACHER.STUDENT_DETAIL(studentId)
      );
      return response.data;
    },
    enabled: enabled && !!studentId,
    staleTime: STALE_TIME.MEDIUM,
  });

  return createComponentProps(result);
};

// ============ SUBMISSIONS ============
export const usePendingSubmissions = () => {
  const result = useQuery({
    queryKey: QUERY_KEYS.TEACHER.SUBMISSIONS.PENDING,
    queryFn: async () => {
      const response = await requestService.get(
        API_ENDPOINTS.TEACHER.SUBMISSIONS_PENDING
      );
      return response.data;
    },
    staleTime: STALE_TIME.SHORT,
  });

  return createComponentProps(result);
};

// ============ ACTIVITY & HISTORY ============
export const useTeacherRecentActivity = () => {
  const result = useQuery({
    queryKey: QUERY_KEYS.TEACHER.ACTIVITY.RECENT,
    queryFn: async () => {
      const response = await requestService.get<ActivityItem[]>(
        API_ENDPOINTS.TEACHER.RECENT_ACTIVITY
      );
      return response.data;
    },
    staleTime: STALE_TIME.SHORT,
  });

  return createComponentProps(result);
};

export const useTeacherHistory = () => {
  const result = useQuery({
    queryKey: QUERY_KEYS.TEACHER.HISTORY,
    queryFn: async () => {
      const response = await requestService.get(API_ENDPOINTS.TEACHER.HISTORY);
      return response.data;
    },
    staleTime: STALE_TIME.SHORT,
  });

  return createComponentProps(result);
};

// ============ LEADERBOARDS ============
export const useTeacherLeaderboards = () => {
  const result = useQuery({
    queryKey: QUERY_KEYS.TEACHER.LEADERBOARDS,
    queryFn: async () => {
      const response = await requestService.get(API_ENDPOINTS.TEACHER.LEADERBOARDS);
      return response.data;
    },
    staleTime: STALE_TIME.MEDIUM,
  });

  return createComponentProps(result);
};
