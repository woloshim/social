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
      <h1 className="text-lg font-semibold text-gray-900 py-4">Панель администратора</h1>

      {stats && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="border border-gray-100 rounded-xl p-3 text-center">
            <div className="text-lg font-semibold text-gray-900">{stats.users}</div>
            <div className="text-xs text-gray-400">участников</div>
          </div>
          <div className="border border-gray-100 rounded-xl p-3 text-center">
            <div className="text-lg font-semibold text-gray-900">{stats.posts}</div>
            <div className="text-xs text-gray-400">постов</div>
          </div>
          <div className="border border-gray-100 rounded-xl p-3 text-center">
            <div className="text-lg font-semibold text-gray-900">{stats.active_stories}</div>
            <div className="text-xs text-gray-400">историй сейчас</div>
          </div>
        </div>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Поиск по имени, юзернейму, telegram id…"
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3"
      />

      <div className="flex flex-col gap-2">
        {filtered.map((u) => (
          <div key={u.id} className="border border-gray-100 rounded-xl p-3 flex items-center gap-3">
            {u.photo_url ? (
              <img src={u.photo_url} className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">{(u.first_name || u.username || "?")[0]}</div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">
                {u.first_name} {u.last_name} {u.username && <span className="text-gray-400 font-normal">@{u.username}</span>}
              </div>
              <div className="text-xs text-gray-400">tg id: {u.telegram_id}</div>
            </div>
            <select
              value={u.role}
              onChange={(e) => setRole(u.id, e.target.value)}
              className="border border-gray-200 rounded-lg text-xs px-2 py-1.5"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <input
              defaultValue={u.squad || ""}
              onBlur={(e) => e.target.value !== (u.squad || "") && setSquad(u.id, e.target.value)}
              placeholder="Отряд"
              className="w-16 border border-gray-200 rounded-lg text-xs px-2 py-1.5"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
