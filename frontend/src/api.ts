import { getInitData } from "./telegram";

// Если фронт и бэк раздаются с одного домена (см. README, вариант с nginx/caddy proxy),
// оставьте VITE_API_BASE пустым — относительный путь /api будет работать сам.
// Если фронт и бэк — это два разных сервиса на разных доменах (например, два Web
// Service на Render), укажите в переменной окружения сборки VITE_API_BASE полный
// адрес бэкенда, например VITE_API_BASE=https://social-uzgn.onrender.com
export const API_ORIGIN = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
const API_BASE = `${API_ORIGIN}/api`;

// Файлы (фото/видео) отдаются бэкендом по относительному пути /uploads/...,
// поэтому их тоже нужно приводить к абсолютному адресу бэкенда.
export function mediaUrl(path: string): string {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_ORIGIN}${path}`;
}

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
  avatar_url: string | null;
  avatar_source: "telegram" | "custom";
  role: "child" | "counselor" | "admin";
  squad: string | null;
  bio: string | null;
  created_at: string;
  follower_count: number;
  following_count: number;
  is_following?: boolean;
}

export interface PostAuthor {
  id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  avatar_url: string | null;
  role: string;
}

export interface Post {
  id: number;
  author: PostAuthor;
  media_path: string;
  thumb_path: string | null;
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
  media_path: string | null;
  created_at: string;
  author: { id: number; username: string | null; first_name: string | null; last_name: string | null; photo_url: string | null; avatar_url: string | null };
}

export interface StoryGroup {
  author: { id: number; username: string | null; first_name: string | null; last_name: string | null; photo_url: string | null; avatar_url: string | null };
  has_unseen: boolean;
  stories: { id: number; media_path: string; media_type: "photo" | "video"; created_at: string; expires_at: string; seen_by_me: boolean }[];
}

export const api = {
  me: () => request<UserProfile>("/users/me"),
  updateMe: (data: { bio?: string; squad?: string; avatar_source?: "telegram" | "custom" }) =>
    request<UserProfile>("/users/me", { method: "PATCH", body: JSON.stringify(data), headers: { "Content-Type": "application/json" } }),
  uploadAvatar: (form: FormData) => request<UserProfile>("/users/me/avatar", { method: "POST", body: form }),
  user: (id: number) => request<UserProfile>(`/users/${id}`),
  searchUsers: (q: string) => request<UserProfile[]>(`/users?q=${encodeURIComponent(q)}`),
  toggleFollow: (id: number) => request<{ following: boolean; follower_count: number; following_count: number }>(`/users/${id}/follow`, { method: "POST" }),

  feed: (before?: number) => request<Post[]>(`/posts${before ? `?before=${before}` : ""}`),
  userPosts: (userId: number) => request<Post[]>(`/posts/user/${userId}`),
  createPost: (form: FormData) => request<Post>("/posts", { method: "POST", body: form }),
  deletePost: (id: number) => request<{ ok: true }>(`/posts/${id}`, { method: "DELETE" }),
  toggleLike: (id: number) => request<{ liked: boolean; like_count: number }>(`/posts/${id}/like`, { method: "POST" }),
  comments: (id: number) => request<Comment[]>(`/posts/${id}/comments`),
  addComment: (id: number, form: FormData) => request<Comment>(`/posts/${id}/comments`, { method: "POST", body: form }),

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
