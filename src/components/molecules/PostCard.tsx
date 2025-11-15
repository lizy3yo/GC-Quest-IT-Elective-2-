import { useState } from 'react';
import { FeedPost } from '@/interfaces';
import { useUpdatePost } from '@/hooks/useUpdatePost';
import { useDeletePost } from '@/hooks/useDeletePost';
import { useAuth } from '@/hooks/useAuth';

interface PostCardProps {
  post: FeedPost;
  classId: string;
}

export default function PostCard({ post, classId }: PostCardProps) {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(post.content);
  const { mutate: updatePost, isPending: isUpdating } = useUpdatePost(classId);
  const { mutate: deletePost, isPending: isDeleting } = useDeletePost(classId);

  const isAuthor = user?.name === post.author;

  const handleUpdate = () => {
    if (!editedContent.trim()) return;
    updatePost({ classId, postId: post.id, content: editedContent }, {
      onSuccess: () => setIsEditing(false),
    });
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this post?')) {
      deletePost({ classId, postId: post.id });
    }
  };

  return (
    <article className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-semibold">{post.author}</p>
          <p className="text-xs text-gray-500">{new Date(post.timestamp).toLocaleString()}</p>
        </div>
        {isAuthor && (
          <div className="flex gap-2">
            <button onClick={() => setIsEditing(!isEditing)} disabled={isUpdating || isDeleting}>
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
            <button onClick={handleDelete} disabled={isUpdating || isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        )}
      </div>
      {isEditing ? (
        <div>
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="w-full mt-2 p-2 border rounded"
          />
          <button onClick={handleUpdate} disabled={isUpdating}>
            {isUpdating ? 'Updating...' : 'Update'}
          </button>
        </div>
      ) : (
        <p className="mt-2">{post.content}</p>
      )}
      {/* Add comments section here */}
    </article>
  );
}
