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
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around py-2 pb-[env(safe-area-inset-bottom)] z-40">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`flex flex-col items-center px-4 py-1 text-xs ${active === t.key ? "text-brand-600 font-semibold" : "text-gray-400"}`}
        >
          <span className="text-xl leading-none mb-0.5">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
