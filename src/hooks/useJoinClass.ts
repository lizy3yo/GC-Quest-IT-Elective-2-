import { useMutation, useQueryClient } from '@tanstack/react-query';
import { studentApi } from '@/services';

const joinClass = async (classCode: string) => {
  const response = await studentApi.joinClass(classCode);
  if (!response.success) {
    throw new Error(response.error || 'Failed to join class');
  }
  return response.data;
};

export const useJoinClass = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: joinClass,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studentClasses'] });
    },
  });
};
