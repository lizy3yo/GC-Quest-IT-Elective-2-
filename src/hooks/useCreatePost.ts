import { useMutation, useQueryClient } from '@tanstack/react-query';
import { studentApi } from '@/services';
import { AttachmentMeta, FeedPost } from '@/interfaces';

interface CreatePostVariables {
  classId: string;
  content: string;
  attachments?: AttachmentMeta[];
}

const createPost = async ({ classId, content, attachments }: CreatePostVariables): Promise<FeedPost> => {
  const response = await studentApi.createPost(classId, content, attachments);
  if (response.success && response.data?.post) {
    return response.data.post;
  }
  throw new Error(response.error || 'Failed to create post');
};

export const useCreatePost = (classId: string) => {
  const queryClient = useQueryClient();

  return useMutation<FeedPost, Error, CreatePostVariables>({
    mutationFn: createPost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classDetails', classId] });
    },
  });
};
