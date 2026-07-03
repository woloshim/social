import { useState } from "react";
import { Post, Comment, api, mediaUrl } from "../api";
import { hapticImpact } from "../telegram";

interface Props {
  post: Post;
  myUserId: number;
  myRole: string;
  onDeleted: (id: number) => void;
}

function displayName(u: { first_name: string | null; username: string | null }) {
  return u.first_name || u.username || "Без имени";
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso + "Z").getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч назад`;
  return `${Math.floor(hours / 24)} дн назад`;
}

export default function PostCard({ post, myUserId, myRole, onDeleted }: Props) {
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [commentText, setCommentText] = useState("");

  async function toggleLike() {
    hapticImpact("light");
    setLiked(!liked);
    setLikeCount((c) => c + (liked ? -1 : 1));
    try {
      const res = await api.toggleLike(post.id);
      setLiked(res.liked);
      setLikeCount(res.like_count);
    } catch {
      // revert on error
      setLiked(liked);
      setLikeCount(post.like_count);
    }
  }

  async function loadComments() {
    setShowComments(true);
    if (comments === null) {
      const c = await api.comments(post.id);
      setComments(c);
    }
  }

  async function submitComment() {
    const text = commentText.trim();
    if (!text) return;
    const c = await api.addComment(post.id, text);
    setComments((prev) => [...(prev || []), c]);
    setCommentText("");
  }

  async function handleDelete() {
    if (!confirm("Удалить пост?")) return;
    await api.deletePost(post.id);
    onDeleted(post.id);
  }

  const canDelete = post.author.id === myUserId || myRole === "admin";

  return (
    <div className="bg-white border-b border-gray-100">
      <div className="flex items-center gap-2 px-3 py-2">
        {post.author.photo_url ? (
          <img src={post.author.photo_url} className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm">{displayName(post.author)[0]}</div>
        )}
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{displayName(post.author)}</span>
          <span className="text-[11px] text-gray-400">{timeAgo(post.created_at)}</span>
        </div>
        {post.visibility === "hide_from_counselors" && (
          <span className="ml-2 text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">🙈 скрыт от вожатых</span>
        )}
        {canDelete && (
          <button onClick={handleDelete} className="ml-auto text-gray-300 text-lg px-2">
            🗑
          </button>
        )}
      </div>

      <div className="bg-black flex items-center justify-center">
        {post.media_type === "photo" ? (
          <img src={mediaUrl(post.media_path)} loading="lazy" className="w-full max-h-[480px] object-contain" />
        ) : (
          <video src={mediaUrl(post.media_path)} preload="metadata" className="w-full max-h-[480px] object-contain" controls playsInline />
        )}
      </div>

      <div className="flex items-center gap-4 px-3 py-2">
        <button onClick={toggleLike} className="text-2xl leading-none">
          {liked ? "❤️" : "🤍"}
        </button>
        <button onClick={loadComments} className="text-2xl leading-none">
          💬
        </button>
        <span className="text-sm text-gray-500 ml-auto">
          {likeCount} лайков · {post.comment_count + (comments ? comments.length - post.comment_count : 0)} коммент.
        </span>
      </div>

      {post.caption && (
        <div className="px-3 pb-2 text-sm">
          <span className="font-semibold mr-1">{displayName(post.author)}</span>
          {post.caption}
        </div>
      )}

      {showComments && (
        <div className="px-3 pb-3 border-t border-gray-100 pt-2">
          {comments === null ? (
            <div className="text-xs text-gray-400">Загрузка…</div>
          ) : comments.length === 0 ? (
            <div className="text-xs text-gray-400">Комментариев пока нет</div>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto">
              {comments.map((c) => (
                <div key={c.id} className="text-sm">
                  <span className="font-semibold mr-1">{displayName(c.author)}</span>
                  {c.text}
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 mt-2">
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitComment()}
              placeholder="Написать комментарий…"
              className="flex-1 border border-gray-200 rounded-full px-3 py-1.5 text-sm outline-none focus:border-brand-400"
            />
            <button onClick={submitComment} className="text-brand-600 text-sm font-semibold px-2">
              Отпр.
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
