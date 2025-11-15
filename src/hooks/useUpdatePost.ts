import { useMutation, useQueryClient } from '@tanstack/react-query';
import { studentApi } from '@/services';
import { FeedPost } from '@/interfaces';

interface UpdatePostVariables {
  classId: string;
  postId: string;
  content: string;
}

const updatePost = async ({ classId, postId, content }: UpdatePostVariables): Promise<FeedPost> => {
  const response = await studentApi.updatePost(classId, postId, content);
  if (response.success && response.data?.post) {
    return response.data.post;
  }
  throw new Error(response.error || 'Failed to update post');
};

export const useUpdatePost = (classId: string) => {
  const queryClient = useQueryClient();

  return useMutation<FeedPost, Error, UpdatePostVariables>({
    mutationFn: updatePost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classDetails', classId] });
    },
  });
};
