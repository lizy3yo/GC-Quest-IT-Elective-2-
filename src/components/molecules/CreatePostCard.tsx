import { useState } from 'react';
import { useCreatePost } from '@/hooks/useCreatePost';
import { AttachmentMeta } from '@/interfaces';

interface CreatePostCardProps {
  classId: string;
}

export default function CreatePostCard({ classId }: CreatePostCardProps) {
  const [newPostText, setNewPostText] = useState("");
  const [newPostFiles, setNewPostFiles] = useState<File[]>([]);
  const { mutate: createPost, isPending: isCreating } = useCreatePost(classId);

  const handleCreatePost = async () => {
    if (!newPostText.trim() && newPostFiles.length === 0) return;

    const attachments: AttachmentMeta[] = [];
    for (const file of newPostFiles) {
      // This is a placeholder for the file upload logic
      // In a real application, you would upload the file to a service like S3 and get a URL
      attachments.push({
        id: file.name,
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file),
      });
    }

    createPost({ classId, content: newPostText, attachments }, {
      onSuccess: () => {
        setNewPostText("");
        setNewPostFiles([]);
      }
    });
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
      <div className="p-4">
        <textarea
          value={newPostText}
          onChange={(e) => setNewPostText(e.target.value)}
          placeholder="Share something with your class..."
          rows={3}
          className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none placeholder-slate-400 dark:placeholder-slate-500 bg-white dark:bg-slate-800"
        />
        {/* File upload UI can be added here */}
      </div>
      <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3 bg-slate-50 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <label className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400">
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => setNewPostFiles(Array.from(e.target.files || []))}
            />
            Attach Files
          </label>
          <button
            disabled={(!newPostText.trim() && newPostFiles.length === 0) || isCreating}
            onClick={handleCreatePost}
            className="px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white text-sm rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isCreating ? "Posting…" : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}
