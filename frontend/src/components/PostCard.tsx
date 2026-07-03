import { useRef, useState } from "react";
import { Post, Comment, api, mediaUrl } from "../api";
import { hapticImpact } from "../telegram";

const DOUBLE_TAP_MS = 300;

interface Props {
  post: Post;
  myUserId: number;
  myRole: string;
  onDeleted: (id: number) => void;
  onViewProfile: (userId: number) => void;
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

export default function PostCard({ post, myUserId, myRole, onDeleted, onViewProfile }: Props) {
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentFile, setCommentFile] = useState<File | null>(null);
  const [commentPreview, setCommentPreview] = useState<string | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const lastTapRef = useRef(0);
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commentFileRef = useRef<HTMLInputElement>(null);

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

  // Ставит лайк (как в Instagram — двойной тап только лайкает, повторный двойной тап не снимает лайк).
  async function likeOnly() {
    if (!liked) {
      setLiked(true);
      setLikeCount((c) => c + 1);
      try {
        const res = await api.toggleLike(post.id);
        setLiked(res.liked);
        setLikeCount(res.like_count);
      } catch {
        setLiked(false);
        setLikeCount(post.like_count);
      }
    }
  }

  function triggerHeartBurst() {
    setShowHeartBurst(true);
    if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
    burstTimerRef.current = setTimeout(() => setShowHeartBurst(false), 700);
  }

  function handleMediaTap() {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      lastTapRef.current = 0;
      hapticImpact("medium");
      triggerHeartBurst();
      likeOnly();
    } else {
      lastTapRef.current = now;
    }
  }

  async function loadComments() {
    setShowComments(true);
    if (comments === null) {
      const c = await api.comments(post.id);
      setComments(c);
    }
  }

  function handleCommentFile(f: File | null) {
    setCommentFile(f);
    setCommentPreview(f ? URL.createObjectURL(f) : null);
  }

  async function submitComment() {
    const text = commentText.trim();
    if (!text && !commentFile) return;
    setSubmittingComment(true);
    try {
      const form = new FormData();
      form.append("text", text);
      if (commentFile) form.append("media", commentFile);
      const c = await api.addComment(post.id, form);
      setComments((prev) => [...(prev || []), c]);
      setCommentText("");
      handleCommentFile(null);
    } finally {
      setSubmittingComment(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Удалить пост?")) return;
    await api.deletePost(post.id);
    onDeleted(post.id);
  }

  const canDelete = post.author.id === myUserId || myRole === "admin";

  return (
    <div className="bg-ink-900/60 border border-white/5 rounded-2xl mx-3 mb-3 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        <button onClick={() => onViewProfile(post.author.id)} className="flex items-center gap-2">
          {post.author.avatar_url ? (
            <img src={post.author.avatar_url} className="w-8 h-8 rounded-full object-cover ring-1 ring-white/10" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-ink-700 flex items-center justify-center text-sm text-white">{displayName(post.author)[0]}</div>
          )}
          <div className="flex flex-col items-start">
            <span className="text-sm font-semibold text-white">{displayName(post.author)}</span>
            <span className="text-[11px] text-ink-500">{timeAgo(post.created_at)}</span>
          </div>
        </button>
        {post.visibility === "hide_from_counselors" && (
          <span className="ml-2 text-[10px] bg-ink-800 text-ink-500 px-2 py-0.5 rounded-full">🙈 скрыт от вожатых</span>
        )}
        {canDelete && (
          <button onClick={handleDelete} className="ml-auto text-ink-500 text-lg px-2">
            🗑
          </button>
        )}
      </div>

      {post.media_type === "text" ? (
        <div className="px-4 py-6 text-[15px] leading-relaxed text-white whitespace-pre-wrap break-words">
          {post.caption}
        </div>
      ) : (
        <div className="relative bg-black flex items-center justify-center" onClick={handleMediaTap}>
          {post.media_type === "photo" ? (
            <img src={mediaUrl(post.media_path)} loading="lazy" className="w-full max-h-[480px] object-contain" draggable={false} />
          ) : (
            <video src={mediaUrl(post.media_path)} preload="metadata" className="w-full max-h-[480px] object-contain" controls playsInline />
          )}
          {showHeartBurst && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-white text-8xl drop-shadow-lg animate-heart-burst">❤️</span>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-4 px-3 py-2">
        <button onClick={toggleLike} className="text-2xl leading-none">
          {liked ? "❤️" : "🤍"}
        </button>
        <button onClick={loadComments} className="text-2xl leading-none">
          💬
        </button>
        <span className="text-sm text-ink-500 ml-auto">
          {likeCount} лайков · {post.comment_count + (comments ? comments.length - post.comment_count : 0)} коммент.
        </span>
      </div>

      {post.media_type !== "text" && post.caption && (
        <div className="px-3 pb-2 text-sm text-ink-300">
          <span className="font-semibold mr-1 text-white">{displayName(post.author)}</span>
          {post.caption}
        </div>
      )}

      {showComments && (
        <div className="px-3 pb-3 border-t border-white/5 pt-2">
          {comments === null ? (
            <div className="text-xs text-ink-500">Загрузка…</div>
          ) : comments.length === 0 ? (
            <div className="text-xs text-ink-500">Комментариев пока нет</div>
          ) : (
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
              {comments.map((c) => (
                <div key={c.id} className="text-sm flex items-start gap-2 text-ink-300">
                  <button onClick={() => onViewProfile(c.author.id)} className="shrink-0">
                    {c.author.avatar_url ? (
                      <img src={c.author.avatar_url} className="w-6 h-6 rounded-full object-cover mt-0.5" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-ink-700 flex items-center justify-center text-[10px] mt-0.5 text-white">
                        {displayName(c.author)[0]}
                      </div>
                    )}
                  </button>
                  <div>
                    <span className="font-semibold mr-1 text-white">{displayName(c.author)}</span>
                    {c.text}
                    {c.media_path && (
                      <img src={mediaUrl(c.media_path)} loading="lazy" className="mt-1 max-h-40 rounded-lg object-cover" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {commentPreview && (
            <div className="relative w-16 h-16 mt-2">
              <img src={commentPreview} className="w-16 h-16 object-cover rounded-lg" />
              <button
                onClick={() => handleCommentFile(null)}
                className="absolute -top-1.5 -right-1.5 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
              >
                ×
              </button>
            </div>
          )}

          <div className="flex gap-2 mt-2 items-center">
            <button onClick={() => commentFileRef.current?.click()} className="text-ink-500 text-lg px-1">
              📷
            </button>
            <input
              ref={commentFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleCommentFile(e.target.files?.[0] || null)}
            />
            <input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitComment()}
              placeholder="Написать комментарий…"
              className="flex-1 bg-ink-800 border border-white/5 rounded-full px-3 py-1.5 text-sm text-white placeholder:text-ink-500 outline-none focus:border-accent-500"
            />
            <button onClick={submitComment} disabled={submittingComment} className="text-accent-400 text-sm font-semibold px-2">
              Отпр.
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
