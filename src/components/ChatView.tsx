"use client";

import { useState, useRef, useEffect } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
  pendingEntries?: PendingEntry[];
};

type PendingEntry = {
  action: string;
  type: string;
  date?: string;
  meal_type?: string;
  description?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  weight?: number;
  duration_minutes?: number;
  calories_burned?: number;
  id?: string;
  updates?: Record<string, unknown>;
  _saved?: boolean;
  _dismissed?: boolean;
  _editing?: boolean;
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
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [savingEntries, setSavingEntries] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (historyLoaded) return;
    const cached = loadCachedMessages();
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

  // エントリを保存
  const saveEntry = async (msgIndex: number, entryIndex: number, entry: PendingEntry) => {
    const key = `${msgIndex}-${entryIndex}`;
    setSavingEntries((prev) => new Set(prev).add(key));
    try {
      const res = await fetch("/api/chat/save-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry }),
      });
      const data = await res.json();
      if (data.ok) {
        updateEntry(msgIndex, entryIndex, { _saved: true, _editing: false });
      }
    } catch {
      // fail silently
    } finally {
      setSavingEntries((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  // エントリを更新
  const updateEntry = (msgIndex: number, entryIndex: number, updates: Partial<PendingEntry>) => {
    setMessages((prev) =>
      prev.map((msg, i) => {
        if (i !== msgIndex || !msg.pendingEntries) return msg;
        const updated = msg.pendingEntries.map((e, j) =>
          j === entryIndex ? { ...e, ...updates } : e
        ) as PendingEntry[];
        return { ...msg, pendingEntries: updated };
      })
    );
  };

  // エントリを却下
  const dismissEntry = (msgIndex: number, entryIndex: number) => {
    updateEntry(msgIndex, entryIndex, { _dismissed: true });
  };

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
          {
            role: "assistant",
            content: data.message,
            pendingEntries: data.pendingEntries || undefined,
          },
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size === 0) return;

        setIsTranscribing(true);
        try {
          const formData = new FormData();
          formData.append("audio", blob, "recording.webm");
          const res = await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
          });
          const data = await res.json();
          if (data.text) {
            setInput((prev) => (prev ? prev + " " + data.text : data.text));
            inputRef.current?.focus();
          }
        } catch {
          // silently fail
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      // マイクの許可がない場合
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  // URLをリンクに変換
  const renderContent = (text: string, isUser: boolean) => {
    const urlRegex = /(https?:\/\/[^\s）\)]+)/g;
    const parts = text.split(urlRegex);
    return parts.map((part, i) =>
      urlRegex.test(part) ? (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline break-all ${isUser ? "text-white/90" : "text-green-600"}`}
        >
          {part.length > 40 ? part.slice(0, 40) + "..." : part}
        </a>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  // エントリの表示ラベル
  const entryLabel = (e: PendingEntry) => {
    if (e.action === "delete") return `${e.description || "記録"}を削除`;
    if (e.action === "edit") return `${e.description || "記録"}を修正`;
    if (e.type === "meal") return e.description || "食事";
    if (e.type === "weight") return `体重 ${e.weight}kg`;
    if (e.type === "exercise") return e.description || "運動";
    return "記録";
  };

  const entryIcon = (e: PendingEntry) => {
    if (e.action === "delete") return "🗑";
    if (e.action === "edit") return "✏️";
    if (e.type === "meal") return "🍽";
    if (e.type === "weight") return "⚖️";
    if (e.type === "exercise") return "🏃";
    return "📝";
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-3 space-y-3">
        {messages.map((msg, i) => (
          <div key={i}>
            <div
              className={`chat-bubble flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-green-500 text-white rounded-br-md"
                    : "bg-gray-100 text-gray-800 rounded-bl-md"
                }`}
              >
                {renderContent(msg.content, msg.role === "user")}
              </div>
            </div>

            {/* 記録追加の確認カード */}
            {msg.pendingEntries && msg.pendingEntries.length > 0 && (
              <div className="flex justify-start mt-2">
                <div className="w-full rounded-2xl border border-green-200 bg-green-50 p-3 space-y-2">
                  <div className="text-[12px] font-semibold text-green-700">記録に追加しますか？</div>
                  {msg.pendingEntries.map((entry, j) => {
                    const isSaved = entry._saved;
                    const isDismissed = entry._dismissed;
                    const isEditing = entry._editing;
                    const isSaving = savingEntries.has(`${i}-${j}`);

                    if (isDismissed) {
                      return (
                        <div key={j} className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 opacity-50">
                          <span className="text-lg">{entryIcon(entry)}</span>
                          <div className="flex-1 text-[13px] text-gray-400 line-through truncate">{entry.description || "記録"}</div>
                          <span className="text-[11px] text-gray-400">スキップ</span>
                        </div>
                      );
                    }

                    return (
                      <div key={j} className={`w-full rounded-xl relative transition-all ${
                        isSaved
                          ? "bg-green-100 border border-green-300"
                          : "bg-white border border-gray-200"
                      }`}>
                        {/* ✕ 右上 */}
                        {!isSaved && !isSaving && (
                          <button
                            onClick={() => dismissEntry(i, j)}
                            className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-gray-300 active:text-gray-500 rounded-full"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5"><path d="M5.28 4.22a.75.75 0 00-1.06 1.06L6.94 8l-2.72 2.72a.75.75 0 101.06 1.06L8 9.06l2.72 2.72a.75.75 0 101.06-1.06L9.06 8l2.72-2.72a.75.75 0 00-1.06-1.06L8 6.94 5.28 4.22z" /></svg>
                          </button>
                        )}
                        <div className="flex items-center gap-2.5 px-3 py-2.5 pr-8">
                          <span className="text-lg">{entryIcon(entry)}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-medium text-gray-800 truncate">
                              {entryLabel(entry)}
                            </div>
                            {entry.type === "meal" && (entry.protein != null || entry.calories != null) && (
                              <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-gray-400 mt-0.5">
                                {entry.calories != null && <span className="font-medium text-gray-500">{entry.calories}kcal</span>}
                                {entry.protein != null && <span>P:{entry.protein}g</span>}
                                {entry.fat != null && <span>F:{entry.fat}g</span>}
                                {entry.carbs != null && <span>C:{entry.carbs}g</span>}
                              </div>
                            )}
                            {entry.type === "exercise" && entry.calories_burned != null && (
                              <div className="text-[11px] text-gray-400 mt-0.5">
                                {entry.duration_minutes && <span>{entry.duration_minutes}分</span>}
                                <span className="ml-1.5">-{entry.calories_burned}kcal</span>
                              </div>
                            )}
                          </div>
                          {isSaved && (
                            <span className="text-[12px] font-semibold text-green-600 shrink-0">追加済み ✓</span>
                          )}
                          {isSaving && (
                            <span className="text-[12px] text-gray-400 shrink-0">保存中...</span>
                          )}
                        </div>
                        {!isSaved && !isSaving && (
                          <div className="flex items-center gap-2 px-3 pb-2.5">
                            <button
                              onClick={() => saveEntry(i, j, entry)}
                              className="flex-1 py-2 rounded-xl text-[13px] font-semibold text-white bg-green-500 active:bg-green-600"
                            >
                              記録する
                            </button>
                            <button
                              onClick={() => updateEntry(i, j, { _editing: !isEditing })}
                              className="py-2 px-3.5 rounded-xl text-[13px] text-gray-500 bg-gray-100 active:bg-gray-200 font-medium"
                            >
                              編集
                            </button>
                          </div>
                        )}
                        {/* インライン編集フォーム */}
                        {isEditing && !isSaved && (
                          <div className="px-3 pb-3 pt-1 border-t border-gray-100 space-y-2">
                            {entry.type === "meal" && (
                              <>
                                <input
                                  type="text"
                                  defaultValue={entry.description || ""}
                                  onChange={(e) => updateEntry(i, j, { description: e.target.value })}
                                  className="w-full text-[13px] border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-green-400"
                                  placeholder="食事内容"
                                />
                                <div>
                                  <input
                                    type="number"
                                    defaultValue={entry.calories || ""}
                                    onChange={(e) => updateEntry(i, j, { calories: Number(e.target.value) || 0 })}
                                    className="w-full text-[13px] border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-green-400 mb-2"
                                    placeholder="カロリー (kcal)"
                                  />
                                  <div className="grid grid-cols-3 gap-2">
                                    <input
                                      type="number"
                                      defaultValue={entry.protein || ""}
                                      onChange={(e) => updateEntry(i, j, { protein: Number(e.target.value) || 0 })}
                                      className="text-[13px] border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-green-400"
                                      placeholder="P(g)"
                                    />
                                    <input
                                      type="number"
                                      defaultValue={entry.fat || ""}
                                      onChange={(e) => updateEntry(i, j, { fat: Number(e.target.value) || 0 })}
                                      className="text-[13px] border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-green-400"
                                      placeholder="F(g)"
                                    />
                                    <input
                                      type="number"
                                      defaultValue={entry.carbs || ""}
                                      onChange={(e) => updateEntry(i, j, { carbs: Number(e.target.value) || 0 })}
                                      className="text-[13px] border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-green-400"
                                      placeholder="C(g)"
                                    />
                                  </div>
                                </div>
                              </>
                            )}
                            {entry.type === "weight" && (
                              <input
                                type="number"
                                step="0.1"
                                defaultValue={entry.weight || ""}
                                onChange={(e) => updateEntry(i, j, { weight: Number(e.target.value) || 0 })}
                                className="w-full text-[13px] border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-green-400"
                                placeholder="体重(kg)"
                              />
                            )}
                            {entry.type === "exercise" && (
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  defaultValue={entry.description || ""}
                                  onChange={(e) => updateEntry(i, j, { description: e.target.value })}
                                  className="flex-1 text-[13px] border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-green-400"
                                  placeholder="運動内容"
                                />
                                <input
                                  type="number"
                                  defaultValue={entry.calories_burned || ""}
                                  onChange={(e) => updateEntry(i, j, { calories_burned: Number(e.target.value) || 0 })}
                                  className="w-20 text-[13px] border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-green-400"
                                  placeholder="kcal"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
            className="flex-1 resize-none rounded-2xl border border-gray-300 px-4 py-2.5 text-[15px] focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 bg-gray-50"
          />
          {/* マイクボタン */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isTranscribing}
            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              isRecording
                ? "bg-red-500 text-white animate-pulse"
                : isTranscribing
                  ? "bg-gray-300 text-gray-500"
                  : "bg-gray-100 text-gray-600 active:bg-gray-200"
            }`}
          >
            {isTranscribing ? (
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z" />
                <path d="M5.5 9.643a.75.75 0 00-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-1.5v-1.546A6.001 6.001 0 0016 10v-.357a.75.75 0 00-1.5 0V10a4.5 4.5 0 01-9 0v-.357z" />
              </svg>
            )}
          </button>
          {/* 送信ボタン */}
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
