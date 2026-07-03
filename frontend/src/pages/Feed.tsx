import { useEffect, useState } from "react";
import { api, Post, StoryGroup, UserProfile } from "../api";
import StoriesBar from "../components/StoriesBar";
import StoryViewer from "../components/StoryViewer";
import PostCard from "../components/PostCard";
import CreatePostModal from "../components/CreatePostModal";

interface Props {
  me: UserProfile;
  onViewProfile: (userId: number) => void;
}

const AUTO_REFRESH_MS = 20000;

// Объединяет свежие данные с текущими: обновляет счётчики у уже видимых постов
// и добавляет новые сверху, не переставляя и не убирая уже показанные посты —
// чтобы не дёргать скролл у того, кто читает ленту.
function mergeFeed(prev: Post[], fresh: Post[]): Post[] {
  const freshById = new Map(fresh.map((p) => [p.id, p]));
  const existingIds = new Set(prev.map((p) => p.id));
  const merged = prev.map((p) => freshById.get(p.id) || p);
  const newOnes = fresh.filter((p) => !existingIds.has(p.id));
  return [...newOnes, ...merged];
}

export default function Feed({ me, onViewProfile }: Props) {
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

  async function refreshFeed() {
    try {
      const p = await api.feed();
      setPosts((prev) => (prev === null ? p : mergeFeed(prev, p)));
    } catch {
      // тихо игнорируем ошибки фонового автообновления
    }
  }

  useEffect(() => {
    loadFeed();
    const interval = setInterval(refreshFeed, AUTO_REFRESH_MS);
    function onVisible() {
      if (document.visibilityState === "visible") refreshFeed();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
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
            onViewProfile={onViewProfile}
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
