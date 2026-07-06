import { useRef, useState } from "react";
import { api, Post } from "../api";

interface Props {
  onClose: () => void;
  onCreated: (post: Post) => void;
}

const MAX_SLIDES = 10;

export default function CreatePostModal({ onClose, onCreated }: Props) {
  // files.length === 0 — текстовый пост (или ещё ничего не выбрано).
  // files.length === 1 — обычный пост с одним фото/видео (как раньше).
  // files.length > 1 — карусель (слайдшоу из нескольких фото, как в Instagram; видео сюда не годится).
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [droppedVideoNotice, setDroppedVideoNotice] = useState(false);
  const [caption, setCaption] = useState("");
  const [hideFromCounselors, setHideFromCounselors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addMoreRef = useRef<HTMLInputElement>(null);

  function applyFiles(next: File[]) {
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  }

  function handleInitialSelect(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const picked = Array.from(fileList);

    if (picked.length === 1) {
      setDroppedVideoNotice(false);
      applyFiles(picked);
      return;
    }

    // Выбрано сразу несколько файлов — это карусель, а карусель поддерживает только фото.
    const onlyPhotos = picked.filter((f) => f.type.startsWith("image/")).slice(0, MAX_SLIDES);
    setDroppedVideoNotice(onlyPhotos.length !== picked.length);
    if (onlyPhotos.length > 0) applyFiles(onlyPhotos);
  }

  function handleAddMore(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const picked = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    setDroppedVideoNotice(picked.length !== fileList.length);
    if (picked.length === 0) return;
    applyFiles([...files, ...picked].slice(0, MAX_SLIDES));
  }

  function removeFileAt(idx: number) {
    applyFiles(files.filter((_, i) => i !== idx));
  }

  const isSingleVideo = files.length === 1 && files[0].type.startsWith("video/");
  const canAddMore = files.length > 0 && files.length < MAX_SLIDES && !isSingleVideo;
  const canSubmit = files.length > 0 || caption.trim().length > 0;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      files.forEach((f) => form.append("media", f));
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

        {files.length === 0 ? (
          <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-ink-600 rounded-xl text-ink-500 cursor-pointer">
            <span className="text-3xl mb-1">📷</span>
            <span className="text-sm">Выбрать фото или видео</span>
            <span className="text-xs text-ink-500 mt-0.5">
              (необязательно — можно опубликовать просто текст, или выбрать сразу несколько фото для карусели)
            </span>
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => handleInitialSelect(e.target.files)}
            />
          </label>
        ) : isSingleVideo ? (
          <div className="relative">
            <video src={previews[0]} className="w-full max-h-64 object-contain rounded-xl bg-black" controls />
            <button
              onClick={() => removeFileAt(0)}
              className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm"
            >
              ×
            </button>
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {previews.map((src, idx) => (
              <div key={idx} className="relative shrink-0 w-24 h-24">
                <img src={src} className="w-24 h-24 object-cover rounded-xl bg-black" />
                <button
                  onClick={() => removeFileAt(idx)}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                >
                  ×
                </button>
                {files.length > 1 && (
                  <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                    {idx + 1}
                  </span>
                )}
              </div>
            ))}
            {canAddMore && (
              <button
                onClick={() => addMoreRef.current?.click()}
                className="shrink-0 w-24 h-24 rounded-xl border-2 border-dashed border-ink-600 text-ink-500 flex items-center justify-center text-2xl"
              >
                +
              </button>
            )}
            <input
              ref={addMoreRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                handleAddMore(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        )}

        {droppedVideoNotice && (
          <div className="text-xs text-amber-400 mt-2">Карусель поддерживает только фото — видео из выбора убрано</div>
        )}

        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder={files.length > 0 ? "Подпись к посту…" : "Напиши что-нибудь…"}
          className="w-full mt-3 bg-ink-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-ink-500 outline-none focus:border-accent-500 resize-none"
          rows={files.length > 0 ? 3 : 5}
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
