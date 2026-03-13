"use client";

import { useState, useRef, useEffect } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const STORAGE_KEY = "health-tracker-chat";
const GREETING: Message = {
  role: "assistant",
  content:
    "こんにちは！健康管理アシスタントです。\n\n食べたもの、体重、運動を教えてください。例えば：\n\n・「朝ごはんにトースト1枚とコーヒー」\n・「体重 65.2kg」\n・「30分ジョギングした」\n\n目標を設定したい場合は「目標体重60kg、1日1800kcal」のように教えてくださいね！",
};

function loadCachedMessages(): Message[] {
  if (typeof window === "undefined") return [GREETING];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [GREETING];
    const { messages, timestamp } = JSON.parse(raw);
    // 3時間以内なら復元
    if (Date.now() - timestamp < 3 * 60 * 60 * 1000 && messages?.length > 0) {
      return messages;
    }
  } catch {}
  return [GREETING];
}

function saveCachedMessages(messages: Message[]) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ messages, timestamp: Date.now() })
    );
  } catch {}
}

export default function ChatView() {
  const [messages, setMessages] = useState<Message[]>(() =>
    loadCachedMessages()
  );
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // DBからチャット履歴を読み込み（初回のみ、キャッシュがなければ）
  useEffect(() => {
    if (historyLoaded) return;
    const cached = loadCachedMessages();
    // キャッシュに挨拶しかない場合はDBから読む
    if (cached.length <= 1) {
      fetch("/api/chat-history")
        .then((r) => r.json())
        .then((d) => {
          if (d.messages?.length > 0) {
            const restored = [GREETING, ...d.messages];
            setMessages(restored);
            saveCachedMessages(restored);
          }
        })
        .catch(() => {})
        .finally(() => setHistoryLoaded(true));
    } else {
      setHistoryLoaded(true);
    }
  }, [historyLoaded]);

  // メッセージ変更時にlocalStorageに保存
  useEffect(() => {
    if (messages.length > 1) {
      saveCachedMessages(messages);
    }
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      const data = await res.json();

      if (data.error) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `エラー: ${data.error}` },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.message },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "通信エラーが発生しました。もう一度お試しください。",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-3 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`chat-bubble flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-green-500 text-white rounded-br-md"
                  : "bg-gray-100 text-gray-800 rounded-bl-md"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="chat-bubble flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3 flex gap-1.5">
              <div className="loading-dot w-2 h-2 bg-gray-400 rounded-full" />
              <div className="loading-dot w-2 h-2 bg-gray-400 rounded-full" />
              <div className="loading-dot w-2 h-2 bg-gray-400 rounded-full" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-200 bg-white px-4 py-3 pb-[max(env(safe-area-inset-bottom,12px),12px)]">
        {/* テンプレートボタン */}
        <div className="flex gap-2 mb-2 overflow-x-auto no-scrollbar">
          {[
            { label: "食事", text: "朝ごはんに" },
            { label: "昼食", text: "お昼に" },
            { label: "夕食", text: "夜ご飯に" },
            { label: "間食", text: "間食で" },
            { label: "体重", text: "体重 " },
            { label: "運動", text: "cal消費した、" },
            { label: "まとめて報告", text: "朝ごはん：、昼ごはん：、夜ごはん：、体重：kg、運動：" },
            { label: "修正", text: "さっきの記録を修正して、" },
          ].map((t) => (
            <button
              key={t.label}
              onClick={() => {
                setInput(t.text);
                inputRef.current?.focus();
              }}
              className="shrink-0 px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-xs font-medium border border-green-200 active:bg-green-100"
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="食べたもの、体重、運動を入力..."
            rows={1}
            className="flex-1 resize-none rounded-full border border-gray-300 px-4 py-2.5 text-[15px] focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 bg-gray-50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center disabled:opacity-40 active:bg-green-600 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
