import { useEffect, useRef, useState } from "react";
import { api, Post, UserProfile, mediaUrl } from "../api";

interface Props {
  me: UserProfile;
  onProfileUpdated: (u: UserProfile) => void;
  userId?: number; // если задан и отличается от me.id — просмотр чужого профиля
  onBack?: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  child: "Ребёнок",
  counselor: "Вожатый",
  admin: "Администрация",
};

const SQUADS = ["1", "2", "3", "4", "5"];

export default function Profile({ me, onProfileUpdated, userId, onBack }: Props) {
  const isOwn = userId === undefined || userId === me.id;
  const [other, setOther] = useState<UserProfile | null>(null);
  const [followBusy, setFollowBusy] = useState(false);

  const profile = isOwn ? me : other;

  const [posts, setPosts] = useState<Post[]>([]);
  const [bio, setBio] = useState(me.bio || "");
  const [squad, setSquad] = useState(me.squad || "");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOwn && userId !== undefined) {
      setOther(null);
      api.user(userId).then(setOther).catch(() => {});
    }
  }, [isOwn, userId]);

  useEffect(() => {
    setBio(me.bio || "");
    setSquad(me.squad || "");
  }, [me.bio, me.squad]);

  useEffect(() => {
    const targetId = isOwn ? me.id : userId;
    if (targetId === undefined) return;
    api.userPosts(targetId).then(setPosts).catch(() => {});
  }, [isOwn, userId, me.id]);

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

  async function handleAvatarFile(file: File | null) {
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append("avatar", file);
      const updated = await api.uploadAvatar(form);
      onProfileUpdated(updated);
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function switchToTelegramAvatar() {
    const updated = await api.updateMe({ avatar_source: "telegram" });
    onProfileUpdated(updated);
  }

  function switchToCustomAvatar() {
    // Всегда открываем выбор файла — так проще и понятнее, чем угадывать,
    // остался ли где-то ранее загруженный аватар.
    avatarInputRef.current?.click();
  }

  async function toggleFollow() {
    if (!other) return;
    setFollowBusy(true);
    try {
      const res = await api.toggleFollow(other.id);
      setOther({ ...other, is_following: res.following, follower_count: res.follower_count });
    } finally {
      setFollowBusy(false);
    }
  }

  if (!profile) {
    return <div className="p-8 text-center text-gray-400">Загрузка…</div>;
  }

  return (
    <div className="pb-20">
      {onBack && (
        <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-100 px-3 py-2 flex items-center">
          <button onClick={onBack} className="text-gray-600 text-lg px-2">
            ←
          </button>
          <span className="text-sm font-semibold ml-1">Профиль</span>
        </div>
      )}

      <div className="px-4 py-4 flex flex-col items-center gap-2 border-b border-gray-100">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} className="w-20 h-20 rounded-full object-cover" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-3xl">
            {(profile.first_name || profile.username || "?")[0]}
          </div>
        )}
        <div className="text-lg font-semibold">{profile.first_name || profile.username}</div>
        <div className="flex gap-2 text-xs">
          <span className="bg-brand-50 text-brand-600 px-2 py-0.5 rounded-full">{ROLE_LABELS[profile.role]}</span>
          {profile.squad && <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Отряд {profile.squad}</span>}
        </div>
        <div className="text-xs text-gray-400">{profile.follower_count} подписчиков · {profile.following_count} подписок</div>

        {!isOwn ? (
          <>
            {profile.bio && <div className="text-sm text-gray-600 text-center mt-1">{profile.bio}</div>}
            <button
              onClick={toggleFollow}
              disabled={followBusy}
              className={`mt-2 px-5 py-1.5 rounded-full text-sm font-semibold ${
                profile.is_following ? "bg-gray-100 text-gray-600" : "bg-brand-500 text-white"
              }`}
            >
              {profile.is_following ? "Вы подписаны" : "Подписаться"}
            </button>
          </>
        ) : !editing ? (
          <>
            {me.bio && <div className="text-sm text-gray-600 text-center mt-1">{me.bio}</div>}
            <button onClick={() => setEditing(true)} className="text-brand-600 text-sm font-semibold mt-2">
              Редактировать профиль
            </button>
          </>
        ) : (
          <div className="w-full mt-2 flex flex-col gap-3">
            <div>
              <div className="text-xs text-gray-500 mb-1">Аватар</div>
              <div className="flex gap-2">
                <button
                  onClick={switchToTelegramAvatar}
                  className={`flex-1 rounded-lg py-2 text-sm border ${
                    me.avatar_source === "telegram" ? "border-brand-400 text-brand-600 bg-brand-50" : "border-gray-200 text-gray-500"
                  }`}
                >
                  Из Telegram
                </button>
                <button
                  onClick={switchToCustomAvatar}
                  disabled={uploadingAvatar}
                  className={`flex-1 rounded-lg py-2 text-sm border ${
                    me.avatar_source === "custom" ? "border-brand-400 text-brand-600 bg-brand-50" : "border-gray-200 text-gray-500"
                  }`}
                >
                  {uploadingAvatar ? "Загрузка…" : "Своё фото"}
                </button>
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  handleAvatarFile(e.target.files?.[0] || null);
                  e.target.value = "";
                }}
              />
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">Отряд</div>
              <select
                value={squad}
                onChange={(e) => setSquad(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
              >
                <option value="">Не выбран</option>
                {SQUADS.map((s) => (
                  <option key={s} value={s}>
                    Отряд {s}
                  </option>
                ))}
              </select>
            </div>

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
              <img src={mediaUrl(p.thumb_path || p.media_path)} loading="lazy" className="w-full h-full object-cover" />
            ) : (
              <video src={mediaUrl(p.media_path)} preload="metadata" className="w-full h-full object-cover" muted />
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
