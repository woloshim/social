import { useEffect, useState } from "react";
import { api, UserProfile } from "./api";
import { initTelegram } from "./telegram";
import Feed from "./pages/Feed";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import BottomNav from "./components/BottomNav";

export default function App() {
  const [me, setMe] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"feed" | "profile" | "admin">("feed");
  const [viewUserId, setViewUserId] = useState<number | null>(null);

  function changeTab(t: "feed" | "profile" | "admin") {
    setViewUserId(null);
    setTab(t);
  }

  function openProfile(userId: number) {
    setViewUserId(userId);
    setTab("profile");
  }

  useEffect(() => {
    initTelegram();
    api
      .me()
      .then(setMe)
      .catch((e) => setError(e.message || "Не удалось авторизоваться"));
  }, []);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-center">
        <div>
          <div className="text-3xl mb-2">😕</div>
          <div className="text-gray-600 text-sm">
            {error}
            <br />
            Открой приложение через бота в Telegram.
          </div>
        </div>
      </div>
    );
  }

  if (!me) {
    return <div className="h-full flex items-center justify-center text-gray-400">Загрузка…</div>;
  }

  return (
    <div className="min-h-full">
      {tab === "feed" && <Feed me={me} onViewProfile={openProfile} />}
      {tab === "profile" && (
        <Profile
          me={me}
          onProfileUpdated={setMe}
          userId={viewUserId ?? undefined}
          onBack={viewUserId !== null ? () => setViewUserId(null) : undefined}
        />
      )}
      {tab === "admin" && me.role === "admin" && <Admin />}
      <BottomNav active={tab} onChange={changeTab} isAdmin={me.role === "admin"} />
    </div>
  );
}
