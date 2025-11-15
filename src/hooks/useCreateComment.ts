import { useMutation, useQueryClient } from '@tanstack/react-query';
import { studentApi } from '@/services';
import { CommentMeta } from '@/interfaces';

interface CreateCommentVariables {
  classId: string;
  postId: string;
  text: string;
}

const createComment = async ({ classId, postId, text }: CreateCommentVariables): Promise<CommentMeta> => {
  const response = await studentApi.createComment(classId, postId, text);
  if (response.success && response.data?.comment) {
    return response.data.comment;
  }
  throw new Error(response.error || 'Failed to create comment');
};

export const useCreateComment = (classId: string) => {
  const queryClient = useQueryClient();

  return useMutation<CommentMeta, Error, CreateCommentVariables>({
    mutationFn: createComment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classDetails', classId] });
    },
  });
};
