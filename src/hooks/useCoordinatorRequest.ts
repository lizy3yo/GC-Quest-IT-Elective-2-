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
  Teacher,
  CreateTeacherData,
  UpdateTeacherData,
  TeacherFilters,
  TeacherListResponse,
} from '@/interfaces/teacher.interface';
import type {
  Student,
  CreateStudentData,
  UpdateStudentData,
  StudentFilters,
  StudentListResponse,
} from '@/interfaces/student.interface';
import type {
  Parent,
  CreateParentData,
  UpdateParentData,
  ParentFilters,
  ParentListResponse,
} from '@/interfaces/parent.interface';
import type { OverviewData } from '@/interfaces/analytics.interface';
import type { ChangePasswordData } from '@/interfaces/auth.interface';
import { createComponentProps, transformMutationResult } from './useQueryHook';

// ============ OVERVIEW ============
export const useCoordinatorOverview = () => {
  const result = useQuery({
    queryKey: QUERY_KEYS.COORDINATOR.OVERVIEW,
    queryFn: async () => {
      const response = await requestService.get<OverviewData>(
        API_ENDPOINTS.COORDINATOR.OVERVIEW
      );
      return response.data;
    },
    staleTime: STALE_TIME.SHORT,
  });

  return createComponentProps(result);
};

// ============ CLASSES ============
export const useCoordinatorClasses = (filters?: ClassFilters) => {
  const result = useQuery({
    queryKey: QUERY_KEYS.COORDINATOR.CLASSES.LIST(filters),
    queryFn: async () => {
      const response = await requestService.get<ClassListResponse>(
        API_ENDPOINTS.COORDINATOR.CLASSES,
        { params: filters }
      );
      return response.data;
    },
    staleTime: STALE_TIME.MEDIUM,
    gcTime: CACHE_TIME.MEDIUM,
  });

  return createComponentProps(result);
};

export const useCoordinatorClass = (id: string, enabled = true) => {
  const result = useQuery({
    queryKey: QUERY_KEYS.COORDINATOR.CLASSES.DETAIL(id),
    queryFn: async () => {
      const response = await requestService.get<Class>(
        API_ENDPOINTS.COORDINATOR.CLASS_DETAIL(id)
      );
      return response.data;
    },
    enabled: enabled && !!id,
    staleTime: STALE_TIME.LONG,
    gcTime: CACHE_TIME.LONG,
  });

  return createComponentProps(result);
};

export const useCreateCoordinatorClass = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (data: CreateClassData) => {
      const response = await requestService.post<Class>(
        API_ENDPOINTS.COORDINATOR.CLASSES,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COORDINATOR.CLASSES.ALL });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COORDINATOR.OVERVIEW });
    },
  });

  return transformMutationResult(mutation);
};

export const useUpdateCoordinatorClass = (id: string) => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (data: UpdateClassData) => {
      const response = await requestService.put<Class>(
        API_ENDPOINTS.COORDINATOR.CLASS_DETAIL(id),
        data
      );
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEYS.COORDINATOR.CLASSES.DETAIL(id), data);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COORDINATOR.CLASSES.ALL });
    },
  });

  return transformMutationResult(mutation);
};

export const useDeleteCoordinatorClass = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (id: string) => {
      await requestService.delete(API_ENDPOINTS.COORDINATOR.CLASS_DETAIL(id));
    },
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: QUERY_KEYS.COORDINATOR.CLASSES.DETAIL(id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COORDINATOR.CLASSES.ALL });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COORDINATOR.OVERVIEW });
    },
  });

  return transformMutationResult(mutation);
};

export const useArchiveClass = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (classId: string) => {
      const response = await requestService.post(
        API_ENDPOINTS.COORDINATOR.ARCHIVE_CLASS,
        { classId }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COORDINATOR.CLASSES.ALL });
    },
  });

  return transformMutationResult(mutation);
};

// ============ TEACHERS ============
export const useCoordinatorTeachers = (filters?: TeacherFilters) => {
  const result = useQuery({
    queryKey: QUERY_KEYS.COORDINATOR.TEACHERS.LIST(filters),
    queryFn: async () => {
      const response = await requestService.get<TeacherListResponse>(
        API_ENDPOINTS.COORDINATOR.TEACHERS,
        { params: filters }
      );
      return response.data;
    },
    staleTime: STALE_TIME.MEDIUM,
    gcTime: CACHE_TIME.MEDIUM,
  });

  return createComponentProps(result);
};

export const useCoordinatorTeacher = (id: string, enabled = true) => {
  const result = useQuery({
    queryKey: QUERY_KEYS.COORDINATOR.TEACHERS.DETAIL(id),
    queryFn: async () => {
      const response = await requestService.get<Teacher>(
        API_ENDPOINTS.COORDINATOR.TEACHER_DETAIL(id)
      );
      return response.data;
    },
    enabled: enabled && !!id,
    staleTime: STALE_TIME.LONG,
  });

  return createComponentProps(result);
};
export const useCreateTeacher = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (data: CreateTeacherData) => {
      const response = await requestService.post<Teacher>(
        API_ENDPOINTS.COORDINATOR.CREATE_TEACHER,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COORDINATOR.TEACHERS.ALL });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COORDINATOR.OVERVIEW });
    },
  });

  return transformMutationResult(mutation);
};

export const useUpdateTeacher = (id: string) => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (data: UpdateTeacherData) => {
      const response = await requestService.put<Teacher>(
        API_ENDPOINTS.COORDINATOR.TEACHER_DETAIL(id),
        data
      );
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEYS.COORDINATOR.TEACHERS.DETAIL(id), data);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COORDINATOR.TEACHERS.ALL });
    },
  });

  return transformMutationResult(mutation);
};

export const useDeleteTeacher = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (id: string) => {
      await requestService.delete(API_ENDPOINTS.COORDINATOR.TEACHER_DETAIL(id));
    },
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: QUERY_KEYS.COORDINATOR.TEACHERS.DETAIL(id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COORDINATOR.TEACHERS.ALL });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COORDINATOR.OVERVIEW });
    },
  });

  return transformMutationResult(mutation);
};

// ============ STUDENTS ============
export const useCoordinatorStudents = (filters?: StudentFilters) => {
  const result = useQuery({
    queryKey: QUERY_KEYS.COORDINATOR.STUDENTS.LIST(filters),
    queryFn: async () => {
      const response = await requestService.get<StudentListResponse>(
        API_ENDPOINTS.COORDINATOR.STUDENTS,
        { params: filters }
      );
      return response.data;
    },
    staleTime: STALE_TIME.MEDIUM,
    gcTime: CACHE_TIME.MEDIUM,
  });

  return createComponentProps(result);
};

export const useCoordinatorStudent = (id: string, enabled = true) => {
  const result = useQuery({
    queryKey: QUERY_KEYS.COORDINATOR.STUDENTS.DETAIL(id),
    queryFn: async () => {
      const response = await requestService.get<Student>(
        API_ENDPOINTS.COORDINATOR.STUDENT_DETAIL(id)
      );
      return response.data;
    },
    enabled: enabled && !!id,
    staleTime: STALE_TIME.LONG,
  });

  return createComponentProps(result);
};

export const useCreateStudent = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (data: CreateStudentData) => {
      const response = await requestService.post<Student>(
        API_ENDPOINTS.COORDINATOR.CREATE_STUDENT,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COORDINATOR.STUDENTS.ALL });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COORDINATOR.OVERVIEW });
    },
  });

  return transformMutationResult(mutation);
};

export const useUpdateStudent = (id: string) => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (data: UpdateStudentData) => {
      const response = await requestService.put<Student>(
        API_ENDPOINTS.COORDINATOR.STUDENT_DETAIL(id),
        data
      );
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEYS.COORDINATOR.STUDENTS.DETAIL(id), data);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COORDINATOR.STUDENTS.ALL });
    },
  });

  return transformMutationResult(mutation);
};

export const useDeleteStudent = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (id: string) => {
      await requestService.delete(API_ENDPOINTS.COORDINATOR.STUDENT_DETAIL(id));
    },
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: QUERY_KEYS.COORDINATOR.STUDENTS.DETAIL(id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COORDINATOR.STUDENTS.ALL });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COORDINATOR.OVERVIEW });
    },
  });

  return transformMutationResult(mutation);
};

// ============ PARENTS ============
export const useCoordinatorParents = (filters?: ParentFilters) => {
  const result = useQuery({
    queryKey: QUERY_KEYS.COORDINATOR.PARENTS.LIST(filters),
    queryFn: async () => {
      const response = await requestService.get<ParentListResponse>(
        API_ENDPOINTS.COORDINATOR.PARENTS,
        { params: filters }
      );
      return response.data;
    },
    staleTime: STALE_TIME.MEDIUM,
    gcTime: CACHE_TIME.MEDIUM,
  });

  return createComponentProps(result);
};

export const useCoordinatorParent = (id: string, enabled = true) => {
  const result = useQuery({
    queryKey: QUERY_KEYS.COORDINATOR.PARENTS.DETAIL(id),
    queryFn: async () => {
      const response = await requestService.get<Parent>(
        API_ENDPOINTS.COORDINATOR.PARENT_DETAIL(id)
      );
      return response.data;
    },
    enabled: enabled && !!id,
    staleTime: STALE_TIME.LONG,
  });

  return createComponentProps(result);
};

export const useCreateParent = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (data: CreateParentData) => {
      const response = await requestService.post<Parent>(
        API_ENDPOINTS.COORDINATOR.CREATE_PARENT,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COORDINATOR.PARENTS.ALL });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COORDINATOR.OVERVIEW });
    },
  });

  return transformMutationResult(mutation);
};

export const useUpdateParent = (id: string) => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (data: UpdateParentData) => {
      const response = await requestService.put<Parent>(
        API_ENDPOINTS.COORDINATOR.PARENT_DETAIL(id),
        data
      );
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEYS.COORDINATOR.PARENTS.DETAIL(id), data);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COORDINATOR.PARENTS.ALL });
    },
  });

  return transformMutationResult(mutation);
};

export const useDeleteParent = () => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (id: string) => {
      await requestService.delete(API_ENDPOINTS.COORDINATOR.PARENT_DETAIL(id));
    },
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: QUERY_KEYS.COORDINATOR.PARENTS.DETAIL(id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COORDINATOR.PARENTS.ALL });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COORDINATOR.OVERVIEW });
    },
  });

  return transformMutationResult(mutation);
};

// ============ UTILITIES ============
export const useGenerateEmails = () => {
  const mutation = useMutation({
    mutationFn: async (data: { count: number; domain?: string }) => {
      const response = await requestService.post(
        API_ENDPOINTS.COORDINATOR.GENERATE_EMAILS,
        data
      );
      return response.data;
    },
  });

  return transformMutationResult(mutation);
};

export const useCoordinatorChangePassword = () => {
  const mutation = useMutation({
    mutationFn: async (data: ChangePasswordData) => {
      const response = await requestService.post(
        API_ENDPOINTS.COORDINATOR.CHANGE_PASSWORD,
        data
      );
      return response.data;
    },
  });

  return transformMutationResult(mutation);
};
