import { useState } from "react";
import { api, Post } from "../api";

interface Props {
  onClose: () => void;
  onCreated: (post: Post) => void;
}

export default function CreatePostModal({ onClose, onCreated }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [hideFromCounselors, setHideFromCounselors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFile(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  const canSubmit = !!file || caption.trim().length > 0;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      if (file) form.append("media", file);
      form.append("caption", caption);
      form.append("visibility", hideFromCounselors ? "hide_from_counselors" : "public");
      const post = await api.createPost(form);
      onCreated(post);
      onClose();
    } catch (e: any) {
      setError(e.message || "Не получилось опубликовать");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-ink-900 border border-white/10 w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center mb-3">
          <h2 className="text-lg font-semibold text-white">Новый пост</h2>
          <button onClick={onClose} className="ml-auto text-2xl leading-none px-2 text-ink-300">
            ×
          </button>
        </div>

        {!preview ? (
          <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-ink-600 rounded-xl text-ink-500 cursor-pointer">
            <span className="text-3xl mb-1">📷</span>
            <span className="text-sm">Выбрать фото или видео</span>
            <span className="text-xs text-ink-500 mt-0.5">(необязательно — можно опубликовать просто текст)</span>
            <input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
            />
          </label>
        ) : (
          <div className="relative">
            {file?.type.startsWith("video/") ? (
              <video src={preview} className="w-full max-h-64 object-contain rounded-xl bg-black" controls />
            ) : (
              <img src={preview} className="w-full max-h-64 object-contain rounded-xl bg-black" />
            )}
            <button
              onClick={() => handleFile(null)}
              className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm"
            >
              ×
            </button>
          </div>
        )}

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder={file ? "Подпись к посту…" : "Напиши что-нибудь…"}
          className="w-full mt-3 bg-ink-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-ink-500 outline-none focus:border-accent-500 resize-none"
          rows={file ? 3 : 5}
        />

        <label className="flex items-center gap-2 mt-3 text-sm text-ink-300">
          <input type="checkbox" checked={hideFromCounselors} onChange={(e) => setHideFromCounselors(e.target.checked)} />
          Скрыть от вожатых (для администрации всё равно будет видно — модерация безопасности)
        </label>

        {error && <div className="text-red-400 text-sm mt-2">{error}</div>}

        <button
          onClick={submit}
          disabled={!canSubmit || submitting}
          className="w-full mt-4 bg-accent-500 disabled:bg-ink-700 disabled:text-ink-500 text-white rounded-xl py-2.5 font-semibold"
        >
          {submitting ? "Публикуем…" : "Опубликовать"}
        </button>
      </div>
    </div>
  );
}
