import { useRef } from "react";
import { StoryGroup } from "../api";

interface Props {
  groups: StoryGroup[];
  myUserId: number;
  onOpenGroup: (index: number) => void;
  onAddStory: (file: File) => void;
}

function displayName(u: { first_name: string | null; username: string | null }) {
  return u.first_name || u.username || "Без имени";
}

export default function StoriesBar({ groups, myUserId, onOpenGroup, onAddStory }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const myGroupIndex = groups.findIndex((g) => g.author.id === myUserId);

  return (
    <div className="flex gap-3 overflow-x-auto px-3 py-3 bg-white border-b border-gray-100">
      <div className="flex flex-col items-center gap-1 w-16 shrink-0">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="relative w-14 h-14 rounded-full border border-dashed border-gray-300 flex items-center justify-center text-brand-500 text-xl"
        >
          +
        </button>
        <span className="text-[10px] text-gray-500 truncate w-full text-center">Добавить</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onAddStory(file);
            e.target.value = "";
          }}
        />
      </div>

      {groups.map((g, i) => (
        <button key={g.author.id} onClick={() => onOpenGroup(i)} className="flex flex-col items-center gap-1 w-16 shrink-0">
          <div
            className={`w-14 h-14 rounded-full p-[2px] ${g.has_unseen ? "bg-brand-500" : "bg-gray-200"}`}
          >
            <div className="w-full h-full rounded-full bg-white p-[2px]">
              {g.author.avatar_url ? (
                <img src={g.author.avatar_url} loading="lazy" className="w-full h-full rounded-full object-cover" />
              ) : (
                <div className="w-full h-full rounded-full bg-gray-100 flex items-center justify-center text-lg">
                  {displayName(g.author)[0]}
                </div>
              )}
            </div>
          </div>
          <span className="text-[10px] text-gray-600 truncate w-full text-center">
            {g.author.id === myUserId ? "Вы" : displayName(g.author)}
          </span>
        </button>
      ))}
    </div>
  );
}
