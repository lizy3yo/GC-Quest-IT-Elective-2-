import { StudentClassDetails, FeedPost } from "@/interfaces";
import CreatePostCard from "@/components/molecules/CreatePostCard";
import PostCard from "@/components/molecules/PostCard";

interface FeedProps {
  classDetails: StudentClassDetails;
}

export default function Feed({ classDetails }: FeedProps) {
  return (
    <section className="space-y-4">
      <CreatePostCard classId={classDetails._id} />
      {(classDetails.feed || []).length === 0 ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-8 text-center">
          <div className="text-slate-500 dark:text-slate-400">No announcements yet</div>
          <div className="text-sm text-slate-400 dark:text-slate-500 mt-1">Announcements from your teacher will appear here once posted.</div>
        </div>
      ) : (
        (classDetails.feed || []).map((post) => (
          <PostCard key={post.id} post={post} classId={classDetails._id} />
        ))
      )}
    </section>
  );
}
