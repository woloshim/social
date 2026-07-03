import { useEffect, useState } from "react";
import { api, Post, StoryGroup, UserProfile } from "../api";
import StoriesBar from "../components/StoriesBar";
import StoryViewer from "../components/StoryViewer";
import PostCard from "../components/PostCard";
import CreatePostModal from "../components/CreatePostModal";

interface Props {
  me: UserProfile;
}

export default function Feed({ me }: Props) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadFeed() {
    try {
      const [p, s] = await Promise.all([api.feed(), api.stories()]);
      setPosts(p);
      setStoryGroups(s);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    loadFeed();
  }, []);

  async function handleAddStory(file: File) {
    const form = new FormData();
    form.append("media", file);
    await api.createStory(form);
    const s = await api.stories();
    setStoryGroups(s);
  }

  return (
    <div className="pb-20">
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-100 px-4 py-3 flex items-center">
        <h1 className="text-[15px] font-semibold tracking-[0.18em] text-gray-900">
          SPARTA <span className="text-brand-600">SOCIAL</span>
        </h1>
        <button
          onClick={() => setShowCreate(true)}
          className="ml-auto text-brand-600 border border-brand-200 rounded-full w-8 h-8 flex items-center justify-center text-lg leading-none"
        >
          +
        </button>
      </div>

      <StoriesBar groups={storyGroups} myUserId={me.id} onOpenGroup={setViewerIndex} onAddStory={handleAddStory} />

      {error && <div className="p-4 text-red-500 text-sm">{error}</div>}

      {posts === null ? (
        <div className="p-8 text-center text-gray-400">Загрузка ленты…</div>
      ) : posts.length === 0 ? (
        <div className="p-8 text-center text-gray-400">Пока нет постов — будь первым!</div>
      ) : (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            myUserId={me.id}
            myRole={me.role}
            onDeleted={(id) => setPosts((prev) => prev?.filter((p) => p.id !== id) || null)}
          />
        ))
      )}

      {viewerIndex !== null && (
        <StoryViewer groups={storyGroups} startIndex={viewerIndex} onClose={() => setViewerIndex(null)} />
      )}

      {showCreate && (
        <CreatePostModal onClose={() => setShowCreate(false)} onCreated={(post) => setPosts((prev) => [post, ...(prev || [])])} />
      )}
    </div>
  );
}
