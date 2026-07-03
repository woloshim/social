import { useEffect, useState } from "react";
import { StoryGroup, api, mediaUrl } from "../api";

interface Props {
  groups: StoryGroup[];
  startIndex: number;
  onClose: () => void;
}

const STORY_DURATION_MS = 5000;

export default function StoryViewer({ groups, startIndex, onClose }: Props) {
  const [groupIndex, setGroupIndex] = useState(startIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  const group = groups[groupIndex];
  const story = group?.stories[storyIndex];

  useEffect(() => {
    if (!story) return;
    api.viewStory(story.id).catch(() => {});
    setProgress(0);
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / STORY_DURATION_MS) * 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(interval);
        goNext();
      }
    }, 50);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIndex, storyIndex]);

  function goNext() {
    if (!group) return;
    if (storyIndex < group.stories.length - 1) {
      setStoryIndex(storyIndex + 1);
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex(groupIndex + 1);
      setStoryIndex(0);
    } else {
      onClose();
    }
  }

  function goPrev() {
    if (storyIndex > 0) {
      setStoryIndex(storyIndex - 1);
    } else if (groupIndex > 0) {
      setGroupIndex(groupIndex - 1);
      setStoryIndex(groups[groupIndex - 1].stories.length - 1);
    }
  }

  if (!group || !story) return null;

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex gap-1 px-2 pt-3">
        {group.stories.map((s, i) => (
          <div key={s.id} className="flex-1 h-0.5 bg-white/30 rounded overflow-hidden">
            <div
              className="h-full bg-white"
              style={{ width: i < storyIndex ? "100%" : i === storyIndex ? `${progress}%` : "0%" }}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 px-3 py-2 text-white">
        {group.author.photo_url ? (
          <img src={group.author.photo_url} className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-white/20" />
        )}
        <span className="text-sm font-medium">{group.author.first_name || group.author.username}</span>
        <button onClick={onClose} className="ml-auto text-2xl leading-none px-2">
          ×
        </button>
      </div>

      <div className="flex-1 relative flex items-center justify-center">
        {story.media_type === "photo" ? (
          <img src={mediaUrl(story.media_path)} className="max-h-full max-w-full object-contain" />
        ) : (
          <video src={mediaUrl(story.media_path)} className="max-h-full max-w-full object-contain" autoPlay muted playsInline />
        )}
        <button onClick={goPrev} className="absolute left-0 top-0 h-full w-1/3" aria-label="Назад" />
        <button onClick={goNext} className="absolute right-0 top-0 h-full w-1/3" aria-label="Вперёд" />
      </div>
    </div>
  );
}
