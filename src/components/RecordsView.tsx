"use client";

import { useState, useEffect, useCallback } from "react";

type Meal = {
  id: string;
  date: string;
  meal_type: string;
  description: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
};

type Exercise = {
  id: string;
  date: string;
  description: string;
  duration_minutes: number;
  calories_burned: number;
};

type Weight = {
  id: string;
  date: string;
  weight: number;
};

type EditTarget =
  | { type: "meal"; data: Meal }
  | { type: "exercise"; data: Exercise }
  | { type: "weight"; data: Weight };

const MEAL_TYPE_LABEL: Record<string, string> = {
  breakfast: "朝食",
  lunch: "昼食",
  dinner: "夕食",
  snack: "間食",
};

// ローカルタイムでYYYY-MM-DD
function getLocalDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function RecordsView() {
  const [date, setDate] = useState(getLocalDate());
  const [meals, setMeals] = useState<Meal[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [weights, setWeights] = useState<Weight[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  const fetchRecords = useCallback(() => {
    setLoading(true);
    fetch(`/api/records?date=${date}`)
      .then((r) => r.json())
      .then((d) => {
        setMeals(d.meals || []);
        setExercises(d.exercises || []);
        setWeights(d.weights || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [date]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleDelete = async (type: string, id: string) => {
    if (deleting) return;
    setDeleting(id);
    try {
      await fetch("/api/records", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id }),
      });
      fetchRecords();
    } finally {
      setDeleting(null);
    }
  };

  const handleSaveEdit = async (
    type: string,
    id: string,
    updates: Record<string, unknown>
  ) => {
    await fetch("/api/records", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id, updates }),
    });
    setEditTarget(null);
    fetchRecords();
  };

  const changeDate = (offset: number) => {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + offset);
    setDate(getLocalDate(d));
  };

  const isToday = date === getLocalDate();

  const totalCalories = meals.reduce((s, m) => s + (m.calories || 0), 0);
  const totalBurned = exercises.reduce(
    (s, e) => s + (e.calories_burned || 0),
    0
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        読み込み中...
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto no-scrollbar px-4 py-4 space-y-4">
      {/* 日付ナビゲーション */}
      <div className="flex items-center justify-between bg-white rounded-2xl p-3 shadow-sm border border-gray-100">
        <button
          onClick={() => changeDate(-1)}
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 active:bg-gray-200"
        >
          &lt;
        </button>
        <div className="text-center">
          <div className="text-lg font-bold text-gray-800">
            {date.slice(5).replace("-", "/")}
          </div>
          {isToday && (
            <div className="text-xs text-green-500 font-medium">今日</div>
          )}
        </div>
        <button
          onClick={() => changeDate(1)}
          disabled={isToday}
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 active:bg-gray-200 disabled:opacity-30"
        >
          &gt;
        </button>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-green-50 rounded-xl p-2">
          <div className="text-lg font-bold text-green-600">
            {totalCalories}
          </div>
          <div className="text-[10px] text-gray-400">摂取 kcal</div>
        </div>
        <div className="bg-orange-50 rounded-xl p-2">
          <div className="text-lg font-bold text-orange-500">
            {totalBurned}
          </div>
          <div className="text-[10px] text-gray-400">消費 kcal</div>
        </div>
        <div className="bg-blue-50 rounded-xl p-2">
          <div className="text-lg font-bold text-blue-500">
            {totalCalories - totalBurned}
          </div>
          <div className="text-[10px] text-gray-400">正味 kcal</div>
        </div>
      </div>

      {/* 食事一覧 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 mb-2">
          食事 ({meals.length}件)
        </h3>
        {meals.length === 0 ? (
          <p className="text-sm text-gray-300 text-center py-4">記録なし</p>
        ) : (
          <div className="space-y-2">
            {meals.map((m) => (
              <div
                key={m.id}
                className="bg-white rounded-xl p-3 shadow-sm border border-gray-100"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium shrink-0">
                        {MEAL_TYPE_LABEL[m.meal_type] || m.meal_type}
                      </span>
                      <span className="text-sm font-medium text-gray-800 truncate">
                        {m.description}
                      </span>
                    </div>
                    <div className="flex gap-3 mt-1.5 text-xs text-gray-400">
                      <span className="font-medium text-green-600">
                        {m.calories} kcal
                      </span>
                      <span>P:{m.protein || 0}g</span>
                      <span>F:{m.fat || 0}g</span>
                      <span>C:{m.carbs || 0}g</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    <button
                      onClick={() =>
                        setEditTarget({ type: "meal", data: { ...m } })
                      }
                      className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 active:bg-gray-200 text-sm"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => handleDelete("meal", m.id)}
                      disabled={deleting === m.id}
                      className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-red-300 active:bg-red-50 active:text-red-500 text-sm"
                    >
                      {deleting === m.id ? "…" : "✕"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 運動一覧 */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 mb-2">
          運動 ({exercises.length}件)
        </h3>
        {exercises.length === 0 ? (
          <p className="text-sm text-gray-300 text-center py-4">記録なし</p>
        ) : (
          <div className="space-y-2">
            {exercises.map((e) => (
              <div
                key={e.id}
                className="bg-white rounded-xl p-3 shadow-sm border border-gray-100"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-800">
                      {e.description}
                    </div>
                    <div className="flex gap-3 mt-1 text-xs text-gray-400">
                      <span className="text-orange-500 font-medium">
                        -{e.calories_burned} kcal
                      </span>
                      <span>{e.duration_minutes}分</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2 shrink-0">
                    <button
                      onClick={() =>
                        setEditTarget({ type: "exercise", data: { ...e } })
                      }
                      className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 active:bg-gray-200 text-sm"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => handleDelete("exercise", e.id)}
                      disabled={deleting === e.id}
                      className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-red-300 active:bg-red-50 active:text-red-500 text-sm"
                    >
                      {deleting === e.id ? "…" : "✕"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 体重 */}
      {weights.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 mb-2">体重</h3>
          {weights.map((w) => (
            <div
              key={w.id}
              className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex items-center justify-between"
            >
              <span className="text-lg font-bold text-blue-500">
                {w.weight} kg
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() =>
                    setEditTarget({ type: "weight", data: { ...w } })
                  }
                  className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 active:bg-gray-200 text-sm"
                >
                  ✎
                </button>
                <button
                  onClick={() => handleDelete("weight", w.id)}
                  disabled={deleting === w.id}
                  className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-red-300 active:bg-red-50 active:text-red-500 text-sm"
                >
                  {deleting === w.id ? "…" : "✕"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="h-4" />

      {/* 編集モーダル */}
      {editTarget && (
        <EditModal
          target={editTarget}
          onSave={handleSaveEdit}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}

// --- 編集モーダル ---
function EditModal({
  target,
  onSave,
  onClose,
}: {
  target: EditTarget;
  onSave: (type: string, id: string, updates: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (target.type === "meal") {
      const m = target.data;
      setForm({
        description: m.description,
        calories: String(m.calories),
        protein: String(m.protein || 0),
        fat: String(m.fat || 0),
        carbs: String(m.carbs || 0),
        meal_type: m.meal_type,
      });
    } else if (target.type === "exercise") {
      const e = target.data;
      setForm({
        description: e.description,
        calories_burned: String(e.calories_burned),
        duration_minutes: String(e.duration_minutes),
      });
    } else {
      setForm({ weight: String(target.data.weight) });
    }
  }, [target]);

  const handleSubmit = () => {
    if (target.type === "meal") {
      onSave(target.type, target.data.id, {
        description: form.description,
        calories: parseInt(form.calories) || 0,
        protein: parseInt(form.protein) || 0,
        fat: parseInt(form.fat) || 0,
        carbs: parseInt(form.carbs) || 0,
        meal_type: form.meal_type,
      });
    } else if (target.type === "exercise") {
      onSave(target.type, target.data.id, {
        description: form.description,
        calories_burned: parseInt(form.calories_burned) || 0,
        duration_minutes: parseInt(form.duration_minutes) || 0,
      });
    } else {
      onSave(target.type, target.data.id, {
        weight: parseFloat(form.weight) || 0,
      });
    }
  };

  const inputClass =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl p-5 mx-4 w-full max-w-sm shadow-xl">
        <h2 className="text-base font-bold mb-4">
          {target.type === "meal"
            ? "食事を編集"
            : target.type === "exercise"
              ? "運動を編集"
              : "体重を編集"}
        </h2>

        <div className="space-y-3">
          {target.type === "meal" && (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  食事タイプ
                </label>
                <select
                  value={form.meal_type || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, meal_type: e.target.value }))
                  }
                  className={inputClass}
                >
                  <option value="breakfast">朝食</option>
                  <option value="lunch">昼食</option>
                  <option value="dinner">夕食</option>
                  <option value="snack">間食</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  内容
                </label>
                <input
                  value={form.description || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    カロリー (kcal)
                  </label>
                  <input
                    type="number"
                    value={form.calories || ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, calories: e.target.value }))
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    タンパク質 (g)
                  </label>
                  <input
                    type="number"
                    value={form.protein || ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, protein: e.target.value }))
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    脂質 (g)
                  </label>
                  <input
                    type="number"
                    value={form.fat || ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, fat: e.target.value }))
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    炭水化物 (g)
                  </label>
                  <input
                    type="number"
                    value={form.carbs || ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, carbs: e.target.value }))
                    }
                    className={inputClass}
                  />
                </div>
              </div>
            </>
          )}

          {target.type === "exercise" && (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  内容
                </label>
                <input
                  value={form.description || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    消費カロリー (kcal)
                  </label>
                  <input
                    type="number"
                    value={form.calories_burned || ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        calories_burned: e.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    時間 (分)
                  </label>
                  <input
                    type="number"
                    value={form.duration_minutes || ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        duration_minutes: e.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </div>
              </div>
            </>
          )}

          {target.type === "weight" && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                体重 (kg)
              </label>
              <input
                type="number"
                step="0.1"
                value={form.weight || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, weight: e.target.value }))
                }
                className={inputClass}
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-600 font-medium text-sm"
          >
            キャンセル
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-2.5 rounded-lg bg-green-500 text-white font-medium text-sm active:bg-green-600"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
