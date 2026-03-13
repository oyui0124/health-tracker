"use client";

import { useState } from "react";
import ChatView from "@/components/ChatView";
import StatsView from "@/components/StatsView";
import GoalModal from "@/components/GoalModal";

type Tab = "chat" | "stats";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [showGoalModal, setShowGoalModal] = useState(false);

  return (
    <div className="h-dvh flex flex-col bg-[var(--background)]">
      {/* ヘッダー */}
      <header className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-green-600">Health Tracker</h1>
        <button
          onClick={() => setShowGoalModal(true)}
          className="text-sm text-gray-500 hover:text-green-600 transition-colors"
        >
          目標設定
        </button>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 min-h-0">
        {activeTab === "chat" ? <ChatView /> : <StatsView />}
      </main>

      {/* タブバー */}
      <nav className="flex-shrink-0 bg-white border-t border-gray-200 flex pb-[env(safe-area-inset-bottom,0px)]">
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex-1 py-3 flex flex-col items-center gap-0.5 transition-colors ${
            activeTab === "chat" ? "text-green-600" : "text-gray-400"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-6 h-6"
          >
            <path
              fillRule="evenodd"
              d="M4.804 21.644A6.707 6.707 0 006 21.75a6.721 6.721 0 003.583-1.029c.774.182 1.584.279 2.417.279 5.322 0 9.75-3.97 9.75-9 0-5.03-4.428-9-9.75-9s-9.75 3.97-9.75 9c0 2.409 1.025 4.587 2.674 6.192.232.226.277.428.254.543a3.73 3.73 0 01-.814 1.686.75.75 0 00.44 1.223zM8.25 10.875a1.125 1.125 0 100 2.25 1.125 1.125 0 000-2.25zM10.875 12a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0zm4.875-1.125a1.125 1.125 0 100 2.25 1.125 1.125 0 000-2.25z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-[10px] font-medium">チャット</span>
        </button>
        <button
          onClick={() => setActiveTab("stats")}
          className={`flex-1 py-3 flex flex-col items-center gap-0.5 transition-colors ${
            activeTab === "stats" ? "text-green-600" : "text-gray-400"
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-6 h-6"
          >
            <path d="M18.375 2.25c-1.035 0-1.875.84-1.875 1.875v15.75c0 1.035.84 1.875 1.875 1.875h.75c1.035 0 1.875-.84 1.875-1.875V4.125c0-1.036-.84-1.875-1.875-1.875h-.75zM9.75 8.625c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-.75a1.875 1.875 0 01-1.875-1.875V8.625zM3 13.125c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v6.75c0 1.035-.84 1.875-1.875 1.875h-.75A1.875 1.875 0 013 19.875v-6.75z" />
          </svg>
          <span className="text-[10px] font-medium">統計</span>
        </button>
      </nav>

      {/* 目標設定モーダル */}
      {showGoalModal && (
        <GoalModal onClose={() => setShowGoalModal(false)} />
      )}
    </div>
  );
}
