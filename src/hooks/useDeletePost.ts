import { useMutation, useQueryClient } from '@tanstack/react-query';
import { studentApi } from '@/services';

interface DeletePostVariables {
  classId: string;
  postId: string;
}

const deletePost = async ({ classId, postId }: DeletePostVariables): Promise<void> => {
  const response = await studentApi.deletePost(classId, postId);
  if (!response.success) {
    throw new Error(response.error || 'Failed to delete post');
  }
};

export const useDeletePost = (classId: string) => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, DeletePostVariables>({
    mutationFn: deletePost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classDetails', classId] });
    },
  });
};
