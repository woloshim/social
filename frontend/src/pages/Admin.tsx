import { useEffect, useState } from "react";
import { api, UserProfile } from "../api";

const ROLES: { value: UserProfile["role"]; label: string }[] = [
  { value: "child", label: "Ребёнок" },
  { value: "counselor", label: "Вожатый" },
  { value: "admin", label: "Администрация" },
];

export default function Admin() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [stats, setStats] = useState<{ users: number; posts: number; active_stories: number } | null>(null);
  const [query, setQuery] = useState("");

  async function load() {
    const [u, s] = await Promise.all([api.adminUsers(), api.adminStats()]);
    setUsers(u);
    setStats(s);
  }

  useEffect(() => {
    load();
  }, []);

  async function setRole(id: number, role: string) {
    const updated = await api.adminSetRole(id, role);
    setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
  }

  async function setSquad(id: number, squad: string) {
    const updated = await api.adminSetSquad(id, squad);
    setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
  }

  const filtered = users.filter((u) => {
    const q = query.toLowerCase();
    return (
      !q ||
      u.first_name?.toLowerCase().includes(q) ||
      u.last_name?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.telegram_id.includes(q)
    );
  });

  return (
    <div className="pb-24 px-3">
      <h1 className="text-lg font-semibold text-white py-4">Панель администратора</h1>

      {stats && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="border border-white/5 bg-ink-900/60 rounded-xl p-3 text-center">
            <div className="text-lg font-semibold text-white">{stats.users}</div>
            <div className="text-xs text-ink-500">участников</div>
          </div>
          <div className="border border-white/5 bg-ink-900/60 rounded-xl p-3 text-center">
            <div className="text-lg font-semibold text-white">{stats.posts}</div>
            <div className="text-xs text-ink-500">постов</div>
          </div>
          <div className="border border-white/5 bg-ink-900/60 rounded-xl p-3 text-center">
            <div className="text-lg font-semibold text-white">{stats.active_stories}</div>
            <div className="text-xs text-ink-500">историй сейчас</div>
          </div>
        </div>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Поиск по имени, юзернейму, telegram id…"
        className="w-full bg-ink-800 border border-white/10 rounded-lg px-3 py-2 text-sm mb-3 text-white placeholder:text-ink-500"
      />

      <div className="flex flex-col gap-2">
        {filtered.map((u) => (
          <div key={u.id} className="border border-white/5 bg-ink-900/60 rounded-xl p-3 flex items-center gap-3">
            {u.avatar_url ? (
              <img src={u.avatar_url} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-ink-700 flex items-center justify-center text-white">{(u.first_name || u.username || "?")[0]}</div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate text-white">
                {u.first_name} {u.last_name} {u.username && <span className="text-ink-500 font-normal">@{u.username}</span>}
              </div>
              <div className="text-xs text-ink-500">tg id: {u.telegram_id}</div>
            </div>
            <select
              value={u.role}
              onChange={(e) => setRole(u.id, e.target.value)}
              className="bg-ink-800 border border-white/10 rounded-lg text-xs px-2 py-1.5 text-white"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <select
              value={u.squad || ""}
              onChange={(e) => setSquad(u.id, e.target.value)}
              className="w-20 bg-ink-800 border border-white/10 rounded-lg text-xs px-2 py-1.5 text-white"
            >
              <option value="">Отряд —</option>
              {["1", "2", "3", "4", "5"].map((s) => (
                <option key={s} value={s}>
                  Отряд {s}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
