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

type Goal = {
  target_weight: number;
  daily_calorie_target: number;
  height_cm?: number;
  birth_date?: string;
  gender?: "male" | "female";
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

function getLocalDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getAdvice(
  totalCalories: number,
  totalBurned: number,
  totalProtein: number,
  totalCarbs: number,
  totalFat: number,
  goal: Goal | null,
  hour: number
): string[] {
  const tips: string[] = [];
  if (!goal) {
    tips.push("目標設定をすると、より的確なアドバイスができます！");
    return tips;
  }

  const net = totalCalories - totalBurned;
  const target = goal.daily_calorie_target;
  const remaining = target - net;

  // 時間帯による進捗チェック
  if (hour < 12) {
    if (totalCalories === 0) {
      tips.push("朝ごはんはまだですか？1日のエネルギー補給に大切です");
    }
  } else if (hour < 18) {
    const expectedRatio = 0.65; // 夕方までに65%くらい
    if (net < target * expectedRatio * 0.5) {
      tips.push("摂取が少なめです。無理な制限は逆効果になることも");
    } else if (net > target * 0.85) {
      tips.push("夕食はカロリー控えめにするといいかも");
    }
  } else {
    if (remaining > 0) {
      tips.push(`あと ${Math.round(remaining)} kcal 食べられます`);
    } else {
      tips.push(
        `目標を ${Math.round(Math.abs(remaining))} kcal オーバー中。明日で調整しましょう`
      );
    }
  }

  // PFCバランスチェック
  const pfcTotal =
    (totalProtein || 0) * 4 + (totalCarbs || 0) * 4 + (totalFat || 0) * 9;
  if (pfcTotal > 0) {
    const pRatio = ((totalProtein * 4) / pfcTotal) * 100;
    const fRatio = ((totalFat * 9) / pfcTotal) * 100;
    if (pRatio < 13 && totalCalories > 300) {
      tips.push("タンパク質が少なめ。肉・魚・卵・大豆で補いましょう");
    }
    if (fRatio > 35 && totalCalories > 300) {
      tips.push("脂質が多め。揚げ物を控えるとバランス改善");
    }
  }

  // 運動
  if (totalBurned === 0 && hour >= 15) {
    tips.push("今日はまだ運動の記録がありません。軽い散歩でもOK！");
  }

  if (tips.length === 0) {
    tips.push("いい感じです！この調子で続けましょう");
  }

  return tips;
}

export default function RecordsView() {
  const [date, setDate] = useState(getLocalDate());
  const [meals, setMeals] = useState<Meal[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [weights, setWeights] = useState<Weight[]>([]);
  const [goal, setGoal] = useState<Goal | null>(null);
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

  // 目標を取得
  useEffect(() => {
    fetch("/api/goals")
      .then((r) => r.json())
      .then((d) => {
        if (d.goal) setGoal(d.goal);
      })
      .catch(() => {});
  }, []);

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
  const totalProtein = meals.reduce((s, m) => s + (m.protein || 0), 0);
  const totalCarbs = meals.reduce((s, m) => s + (m.carbs || 0), 0);
  const totalFat = meals.reduce((s, m) => s + (m.fat || 0), 0);

  const adviceTips = isToday
    ? getAdvice(
        totalCalories,
        totalBurned,
        totalProtein,
        totalCarbs,
        totalFat,
        goal,
        new Date().getHours()
      )
    : [];

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

      {/* 目標プログレスバー */}
      {goal && (
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>目標: {goal.daily_calorie_target} kcal</span>
            <span>
              残り:{" "}
              {Math.max(
                0,
                goal.daily_calorie_target - totalCalories + totalBurned
              )}{" "}
              kcal
            </span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                totalCalories - totalBurned > goal.daily_calorie_target
                  ? "bg-red-400"
                  : "bg-green-400"
              }`}
              style={{
                width: `${Math.min(
                  100,
                  ((totalCalories - totalBurned) /
                    goal.daily_calorie_target) *
                    100
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* アドバイス（今日のみ） */}
      {isToday && adviceTips.length > 0 && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-3 border border-yellow-100">
          <div className="text-xs font-semibold text-orange-600 mb-1.5">
            今日のアドバイス
          </div>
          <div className="space-y-1">
            {adviceTips.map((tip, i) => (
              <div key={i} className="text-sm text-gray-700 flex gap-1.5">
                <span className="shrink-0">-</span>
                <span>{tip}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
  onSave: (
    type: string,
    id: string,
    updates: Record<string, unknown>
  ) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    if (target.type === "meal") {
      const m = target.data;
      setForm({
        date: m.date,
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
        date: e.date,
        description: e.description,
        calories_burned: String(e.calories_burned),
        duration_minutes: String(e.duration_minutes),
      });
    } else {
      setForm({
        date: target.data.date,
        weight: String(target.data.weight),
      });
    }
  }, [target]);

  const handleSubmit = () => {
    if (target.type === "meal") {
      onSave(target.type, target.data.id, {
        date: form.date,
        description: form.description,
        calories: parseInt(form.calories) || 0,
        protein: parseInt(form.protein) || 0,
        fat: parseInt(form.fat) || 0,
        carbs: parseInt(form.carbs) || 0,
        meal_type: form.meal_type,
      });
    } else if (target.type === "exercise") {
      onSave(target.type, target.data.id, {
        date: form.date,
        description: form.description,
        calories_burned: parseInt(form.calories_burned) || 0,
        duration_minutes: parseInt(form.duration_minutes) || 0,
      });
    } else {
      onSave(target.type, target.data.id, {
        date: form.date,
        weight: parseFloat(form.weight) || 0,
      });
    }
  };

  const inputClass =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl p-5 mx-4 w-full max-w-sm shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-base font-bold mb-4">
          {target.type === "meal"
            ? "食事を編集"
            : target.type === "exercise"
              ? "運動を編集"
              : "体重を編集"}
        </h2>

        <div className="space-y-3">
          {/* 日付（全タイプ共通） */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">日付</label>
            <input
              type="date"
              value={form.date || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, date: e.target.value }))
              }
              className={inputClass}
            />
          </div>

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
