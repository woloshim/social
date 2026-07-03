import { useEffect, useState } from "react";
import { api, Post, UserProfile, mediaUrl } from "../api";

interface Props {
  me: UserProfile;
  onProfileUpdated: (u: UserProfile) => void;
}

const ROLE_LABELS: Record<string, string> = {
  child: "Ребёнок",
  counselor: "Вожатый",
  admin: "Администрация",
};

export default function Profile({ me, onProfileUpdated }: Props) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [bio, setBio] = useState(me.bio || "");
  const [squad, setSquad] = useState(me.squad || "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.userPosts(me.id).then(setPosts).catch(() => {});
  }, [me.id]);

  async function save() {
    setSaving(true);
    try {
      const updated = await api.updateMe({ bio, squad });
      onProfileUpdated(updated);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pb-20">
      <div className="px-4 py-4 flex flex-col items-center gap-2 border-b border-gray-100">
        {me.photo_url ? (
          <img src={me.photo_url} className="w-20 h-20 rounded-full object-cover" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-3xl">
            {(me.first_name || me.username || "?")[0]}
          </div>
        )}
        <div className="text-lg font-semibold">{me.first_name || me.username}</div>
        <div className="flex gap-2 text-xs">
          <span className="bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full">{ROLE_LABELS[me.role]}</span>
          {me.squad && <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Отряд {me.squad}</span>}
        </div>

        {!editing ? (
          <>
            {me.bio && <div className="text-sm text-gray-600 text-center mt-1">{me.bio}</div>}
            <button onClick={() => setEditing(true)} className="text-brand-600 text-sm font-semibold mt-2">
              Редактировать профиль
            </button>
          </>
        ) : (
          <div className="w-full mt-2 flex flex-col gap-2">
            <input
              value={squad}
              onChange={(e) => setSquad(e.target.value)}
              placeholder="Отряд (например, №5)"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="О себе…"
              rows={2}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
            />
            <div className="flex gap-2">
              <button onClick={save} disabled={saving} className="flex-1 bg-brand-500 text-white rounded-lg py-2 text-sm font-semibold">
                Сохранить
              </button>
              <button onClick={() => setEditing(false)} className="flex-1 bg-gray-100 text-gray-600 rounded-lg py-2 text-sm">
                Отмена
              </button>
            </div>
          </div>
        )}

        <div className="text-sm text-gray-400 mt-1">{posts.length} публикаций</div>
      </div>

      <div className="grid grid-cols-3 gap-0.5 mt-0.5">
        {posts.map((p) => (
          <div key={p.id} className="aspect-square bg-black relative">
            {p.media_type === "photo" ? (
              <img src={mediaUrl(p.media_path)} className="w-full h-full object-cover" />
            ) : (
              <video src={mediaUrl(p.media_path)} className="w-full h-full object-cover" muted />
            )}
            {p.visibility === "hide_from_counselors" && (
              <span className="absolute top-1 right-1 text-xs">🙈</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
