"use client";

import { useState } from "react";
import ChatView from "@/components/ChatView";
import RecordsView from "@/components/RecordsView";
import StatsView from "@/components/StatsView";
import GoalModal from "@/components/GoalModal";

type Tab = "chat" | "records" | "stats";

const tabs: { key: Tab; label: string; icon: (active: boolean) => React.ReactNode }[] = [
  {
    key: "chat",
    label: "チャット",
    icon: (active) => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-[24px] h-[24px] transition-transform duration-300 ${active ? "scale-110" : ""}`}>
        <path fillRule="evenodd" d="M4.804 21.644A6.707 6.707 0 006 21.75a6.721 6.721 0 003.583-1.029c.774.182 1.584.279 2.417.279 5.322 0 9.75-3.97 9.75-9 0-5.03-4.428-9-9.75-9s-9.75 3.97-9.75 9c0 2.409 1.025 4.587 2.674 6.192.232.226.277.428.254.543a3.73 3.73 0 01-.814 1.686.75.75 0 00.44 1.223zM8.25 10.875a1.125 1.125 0 100 2.25 1.125 1.125 0 000-2.25zM10.875 12a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zm4.875-1.125a1.125 1.125 0 100 2.25 1.125 1.125 0 000-2.25z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    key: "records",
    label: "記録",
    icon: (active) => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-[24px] h-[24px] transition-transform duration-300 ${active ? "scale-110" : ""}`}>
        <path fillRule="evenodd" d="M7.502 6h7.128A3.375 3.375 0 0118 9.375v9.375a3 3 0 003-3V6.108c0-1.505-1.125-2.811-2.664-2.94a48.972 48.972 0 00-.673-.05A3 3 0 0015 1.5h-1.5a3 3 0 00-2.663 1.618c-.225.015-.45.032-.673.05C8.662 3.295 7.554 4.542 7.502 6zM13.5 3A1.5 1.5 0 0012 4.5h4.5A1.5 1.5 0 0015 3h-1.5z" clipRule="evenodd" />
        <path fillRule="evenodd" d="M3 9.375C3 8.339 3.84 7.5 4.875 7.5h9.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-9.75A1.875 1.875 0 013 20.625V9.375zM6 12a.75.75 0 01.75-.75h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75H6.75a.75.75 0 01-.75-.75V12zm2.25 0a.75.75 0 01.75-.75h3.75a.75.75 0 010 1.5H9a.75.75 0 01-.75-.75zM6 15a.75.75 0 01.75-.75h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75H6.75a.75.75 0 01-.75-.75V15zm2.25 0a.75.75 0 01.75-.75h3.75a.75.75 0 010 1.5H9a.75.75 0 01-.75-.75zM6 18a.75.75 0 01.75-.75h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75H6.75a.75.75 0 01-.75-.75V18zm2.25 0a.75.75 0 01.75-.75h3.75a.75.75 0 010 1.5H9a.75.75 0 01-.75-.75z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    key: "stats",
    label: "統計",
    icon: (active) => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-[24px] h-[24px] transition-transform duration-300 ${active ? "scale-110" : ""}`}>
        <path d="M18.375 2.25c-1.035 0-1.875.84-1.875 1.875v15.75c0 1.035.84 1.875 1.875 1.875h.75c1.035 0 1.875-.84 1.875-1.875V4.125c0-1.036-.84-1.875-1.875-1.875h-.75zM9.75 8.625c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-.75a1.875 1.875 0 01-1.875-1.875V8.625zM3 13.125c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v6.75c0 1.035-.84 1.875-1.875 1.875h-.75A1.875 1.875 0 013 19.875v-6.75z" />
      </svg>
    ),
  },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === "records" || tab === "stats") {
      setRefreshKey((k) => k + 1);
    }
  };

  return (
    <div className="h-dvh flex flex-col bg-[var(--background)] overflow-hidden overscroll-none">
      {/* ヘッダー */}
      <header className="flex-shrink-0 bg-white backdrop-blur-xl border-b border-gray-100 px-4 py-3 pt-[max(env(safe-area-inset-top,0px),12px)] flex items-center justify-between">
        <h1 className="text-lg font-bold text-green-600">Health Tracker</h1>
        <button
          onClick={() => setShowGoalModal(true)}
          className="text-sm text-gray-500 active:text-green-600 transition-colors"
        >
          目標設定
        </button>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 min-h-0 relative overflow-hidden">
        <div
          className="absolute inset-0 transition-opacity duration-300 ease-out"
          style={{ opacity: activeTab === "chat" ? 1 : 0, pointerEvents: activeTab === "chat" ? "auto" : "none" }}
        >
          <ChatView />
        </div>
        <div
          className="absolute inset-0 transition-opacity duration-300 ease-out"
          style={{ opacity: activeTab === "records" ? 1 : 0, pointerEvents: activeTab === "records" ? "auto" : "none" }}
        >
          <RecordsView refreshKey={refreshKey} />
        </div>
        <div
          className="absolute inset-0 transition-opacity duration-300 ease-out"
          style={{ opacity: activeTab === "stats" ? 1 : 0, pointerEvents: activeTab === "stats" ? "auto" : "none" }}
        >
          <StatsView refreshKey={refreshKey} />
        </div>
      </main>

      {/* モダンタブバー */}
      <nav
        className="flex-shrink-0 relative bg-white/80 backdrop-blur-xl border-t border-gray-100/50 flex pb-[max(env(safe-area-inset-bottom,0px),8px)]"
      >
{/* no indicator */}
        {tabs.map((tab) => (
          <button
            key={tab.key}
            data-tab={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`flex-1 pt-3.5 pb-3 flex flex-col items-center gap-1 transition-all duration-300 ${
              activeTab === tab.key
                ? "text-green-600"
                : "text-gray-400 active:text-gray-500"
            }`}
          >
            {tab.icon(activeTab === tab.key)}
            <span className={`text-[11px] transition-all duration-300 ${
              activeTab === tab.key ? "font-semibold" : "font-medium"
            }`}>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* 目標設定モーダル */}
      {showGoalModal && (
        <GoalModal onClose={() => setShowGoalModal(false)} />
      )}
    </div>
  );
}
