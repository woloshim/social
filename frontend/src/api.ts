import { getInitData } from "./telegram";

// В проде фронт и бэк раздаются с одного домена через nginx/caddy proxy (см. README),
// поэтому относительный путь /api работает и в деве (vite proxy) и в проде.
const API_BASE = "/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "X-Telegram-Init-Data": getInitData(),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    let message = `Ошибка ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* noop */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

export interface UserProfile {
  id: number;
  telegram_id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  role: "child" | "counselor" | "admin";
  squad: string | null;
  bio: string | null;
  created_at: string;
}

export interface Post {
  id: number;
  author: {
    id: number;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    photo_url: string | null;
    role: string;
  };
  media_path: string;
  media_type: "photo" | "video";
  caption: string | null;
  visibility: "public" | "hide_from_counselors";
  created_at: string;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
}

export interface Comment {
  id: number;
  text: string;
  created_at: string;
  author: { id: number; username: string | null; first_name: string | null; last_name: string | null; photo_url: string | null };
}

export interface StoryGroup {
  author: { id: number; username: string | null; first_name: string | null; last_name: string | null; photo_url: string | null };
  has_unseen: boolean;
  stories: { id: number; media_path: string; media_type: "photo" | "video"; created_at: string; expires_at: string; seen_by_me: boolean }[];
}

export const api = {
  me: () => request<UserProfile>("/users/me"),
  updateMe: (data: { bio?: string; squad?: string }) =>
    request<UserProfile>("/users/me", { method: "PATCH", body: JSON.stringify(data), headers: { "Content-Type": "application/json" } }),
  user: (id: number) => request<UserProfile>(`/users/${id}`),
  searchUsers: (q: string) => request<UserProfile[]>(`/users?q=${encodeURIComponent(q)}`),

  feed: (before?: number) => request<Post[]>(`/posts${before ? `?before=${before}` : ""}`),
  userPosts: (userId: number) => request<Post[]>(`/posts/user/${userId}`),
  createPost: (form: FormData) => request<Post>("/posts", { method: "POST", body: form }),
  deletePost: (id: number) => request<{ ok: true }>(`/posts/${id}`, { method: "DELETE" }),
  toggleLike: (id: number) => request<{ liked: boolean; like_count: number }>(`/posts/${id}/like`, { method: "POST" }),
  comments: (id: number) => request<Comment[]>(`/posts/${id}/comments`),
  addComment: (id: number, text: string) =>
    request<Comment>(`/posts/${id}/comments`, { method: "POST", body: JSON.stringify({ text }), headers: { "Content-Type": "application/json" } }),

  stories: () => request<StoryGroup[]>("/stories"),
  createStory: (form: FormData) => request<{ id: number; media_path: string; media_type: string; expires_at: string }>("/stories", { method: "POST", body: form }),
  viewStory: (id: number) => request<{ ok: true }>(`/stories/${id}/view`, { method: "POST" }),

  adminUsers: () => request<UserProfile[]>("/admin/users"),
  adminSetRole: (id: number, role: string) =>
    request<UserProfile>(`/admin/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }), headers: { "Content-Type": "application/json" } }),
  adminSetSquad: (id: number, squad: string) =>
    request<UserProfile>(`/admin/users/${id}/squad`, { method: "PATCH", body: JSON.stringify({ squad }), headers: { "Content-Type": "application/json" } }),
  adminStats: () => request<{ users: number; posts: number; active_stories: number; by_role: { role: string; c: number }[] }>("/admin/stats"),
};
