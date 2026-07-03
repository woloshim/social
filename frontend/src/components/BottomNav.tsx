interface Props {
  active: "feed" | "profile" | "admin";
  onChange: (tab: "feed" | "profile" | "admin") => void;
  isAdmin: boolean;
}

export default function BottomNav({ active, onChange, isAdmin }: Props) {
  const tabs: { key: "feed" | "profile" | "admin"; label: string; icon: string }[] = [
    { key: "feed", label: "Лента", icon: "🏠" },
    { key: "profile", label: "Профиль", icon: "🙂" },
  ];
  if (isAdmin) tabs.push({ key: "admin", label: "Админ", icon: "🛠️" });

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+12px)]">
      <nav className="flex items-center gap-1 bg-ink-900/90 backdrop-blur-md border border-white/10 rounded-full px-2 py-2 shadow-glow">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`flex flex-col items-center px-4 py-1.5 rounded-full text-xs transition-colors ${
              active === t.key ? "bg-accent-500 text-white font-semibold" : "text-ink-500"
            }`}
          >
            <span className="text-xl leading-none mb-0.5">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
