import { useState } from 'react';
import { FeedPost, CommentMeta } from '@/interfaces';
import { useCreateComment } from '@/hooks/useCreateComment';
import { useAuth } from '@/hooks/useAuth';

interface CommentsModalProps {
  post: FeedPost;
  classId: string;
  onClose: () => void;
}

function Avatar({ name }: { name: string | null | undefined }) {
  const safeName = name || "User";
  const initials = safeName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm font-semibold text-slate-700 dark:text-slate-200">
      {initials}
    </div>
  );
}

export default function CommentsModal({ post, classId, onClose }: CommentsModalProps) {
  const { user } = useAuth();
  const [commentText, setCommentText] = useState('');
  const { mutate: createComment, isPending: isCreating } = useCreateComment(classId);

  const handleCreateComment = () => {
    if (!commentText.trim()) return;
    createComment({ classId, postId: post.id, text: commentText }, {
      onSuccess: () => setCommentText(''),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      aria-modal="true"
      role="dialog"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-lg max-h-[80vh] sm:rounded-lg rounded-t-lg bg-white dark:bg-slate-800 shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Comments</div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm"
            aria-label="Close comments"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {(post.comments ?? []).length === 0 && (
            <div className="text-xs text-slate-500 dark:text-slate-400">No comments yet. Be first to comment.</div>
          )}
          <ul className="space-y-3">
            {(post.comments ?? []).map((c) => (
              <li key={c.id} className="flex gap-3 items-start">
                <Avatar name={c.author || 'Unknown'} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{c.author || 'Unknown'}</span>
                    <span className="text-xxs text-slate-400">{c.timestamp ? new Date(c.timestamp).toLocaleString() : ''}</span>
                  </div>
                  <div className="text-xs mt-1 text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{c.text || ''}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700">
          <div className="flex gap-3 items-start">
            <Avatar name={user?.name || "User"} />
            <div className="flex-1">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={2}
                placeholder="Write a comment…"
                className="w-full text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-400/40 resize-y"
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  onClick={onClose}
                  className="text-xxs px-3 py-1 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200"
                >
                  Close
                </button>
                <button
                  disabled={!commentText.trim() || isCreating}
                  onClick={handleCreateComment}
                  className="text-xxs px-3 py-1 rounded-md bg-teal-500 text-white disabled:opacity-40"
                >
                  {isCreating ? 'Commenting...' : 'Comment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
