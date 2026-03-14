"use client";

import { useState, useEffect, useCallback } from "react";
import { calculateBMR, getAge } from "@/lib/bmr";

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

function getAdviceForDate(
  totalCalories: number,
  totalBurned: number,
  totalProtein: number,
  totalCarbs: number,
  totalFat: number,
  goal: Goal | null,
  latestWeight: number | null,
  isToday: boolean,
  hour: number
): string[] {
  const tips: string[] = [];
  if (!goal) {
    tips.push("右上の「目標設定」から目標を設定すると詳しいアドバイスが表示されます");
    return tips;
  }

  const net = totalCalories - totalBurned;
  const target = goal.daily_calorie_target;
  const remaining = target - net;

  let bmr: number | null = null;
  if (goal.height_cm && goal.birth_date && goal.gender && latestWeight) {
    bmr = calculateBMR(
      latestWeight,
      goal.height_cm,
      getAge(goal.birth_date),
      goal.gender
    );
  }

  if (totalCalories === 0 && totalBurned === 0) {
    if (isToday) {
      tips.push("まだ記録がありません。チャットで食べたものを教えてください");
    } else {
      tips.push("この日は記録がありません");
    }
    return tips;
  }

  // --- カロリー評価 ---
  if (isToday) {
    if (remaining > 0) {
      tips.push(`あと ${Math.round(remaining)} kcal 食べられます。${hour >= 18 ? "夜食は消化の良いものがおすすめ" : hour >= 14 ? "夕食でバランスよく摂りましょう" : "午後もバランスよく食べましょう"}`);
    } else {
      tips.push(`目標を ${Math.round(Math.abs(remaining))} kcal 超過中。${Math.abs(remaining) < 200 ? "軽い運動で調整できる範囲です" : "明日は少し控えめにして調整しましょう"}`);
    }
  } else {
    // 過去の日
    if (remaining > 300) {
      tips.push(`目標より ${Math.round(remaining)} kcal 少なめでした。継続的に少なすぎると筋肉が落ちるので注意`);
    } else if (remaining > 0) {
      tips.push(`目標内に収まっていました（残り ${Math.round(remaining)} kcal）。いいペースです`);
    } else if (Math.abs(remaining) < 200) {
      tips.push(`目標を少しだけ超過（${Math.round(Math.abs(remaining))} kcal）。誤差の範囲なので問題なし`);
    } else {
      tips.push(`${Math.round(Math.abs(remaining))} kcal オーバーでした。次の日で調整できていれば大丈夫`);
    }
  }

  // --- BMRチェック ---
  if (bmr && totalCalories > 0 && totalCalories < bmr * 0.8) {
    tips.push(
      `基礎代謝(${bmr}kcal)を大きく下回っています。体が省エネモードに入ると痩せにくくなるので最低限は食べましょう`
    );
  }

  // --- PFC改善提案 ---
  const pfcTotal =
    (totalProtein || 0) * 4 + (totalCarbs || 0) * 4 + (totalFat || 0) * 9;
  if (pfcTotal > 0 && totalCalories > 300) {
    const pRatio = Math.round(((totalProtein * 4) / pfcTotal) * 100);
    const fRatio = Math.round(((totalFat * 9) / pfcTotal) * 100);

    if (pRatio < 15) {
      tips.push(
        isToday
          ? `タンパク質不足(${pRatio}%)。次の食事で鶏むね・卵・豆腐などを足すと改善します`
          : `タンパク質が${pRatio}%と少なめでした。1食あたり手のひら1枚分のタンパク質を意識すると◎`
      );
    }
    if (fRatio > 30) {
      tips.push(
        isToday
          ? `脂質多め(${fRatio}%)。残りの食事はサラダ・蒸し料理などあっさり系がおすすめ`
          : `脂質が${fRatio}%と多めでした。揚げ物→焼き・蒸しに変えるだけで改善できます`
      );
    }
  }

  // --- 目標体重 ---
  if (latestWeight && goal.target_weight) {
    const diff = latestWeight - goal.target_weight;
    if (diff > 0) {
      const weeks = Math.ceil(diff / 0.5);
      tips.push(`目標体重まで${diff.toFixed(1)}kg。1日${Math.round((diff * 7700) / (weeks * 7))}kcalの赤字で${weeks}週間で達成できます`);
    } else if (Math.abs(diff) < 1) {
      tips.push("目標体重圏内！維持するために今の食事ペースを続けましょう");
    }
  }

  // --- 運動アドバイス ---
  if (totalBurned === 0) {
    if (isToday) {
      tips.push("運動記録がまだありません。15分の早歩きでも約60kcal消費できますよ");
    }
  } else if (totalBurned > 300) {
    tips.push(`${totalBurned}kcal消費！その分栄養補給も忘れずに`);
  }

  return tips;
}

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function getWeekDays(selectedDate: string): { date: string; dayLabel: string; dayNum: number; isToday: boolean; isSelected: boolean }[] {
  const sel = new Date(selectedDate + "T00:00:00");
  const today = getLocalDate();
  const days: { date: string; dayLabel: string; dayNum: number; isToday: boolean; isSelected: boolean }[] = [];
  // Show 7 days centered around selected, but cap at today
  for (let i = -3; i <= 3; i++) {
    const d = new Date(sel);
    d.setDate(d.getDate() + i);
    const ds = getLocalDate(d);
    days.push({
      date: ds,
      dayLabel: DAY_LABELS[d.getDay()],
      dayNum: d.getDate(),
      isToday: ds === today,
      isSelected: ds === selectedDate,
    });
  }
  return days;
}

export default function RecordsView() {
  const [date, setDate] = useState(getLocalDate());
  const [showCalendar, setShowCalendar] = useState(false);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [weights, setWeights] = useState<Weight[]>([]);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [addType, setAddType] = useState<"meal" | "exercise" | "weight" | null>(null);
  const [filter, setFilter] = useState<"all" | "meal" | "exercise">("all");
  const [showAddMenu, setShowAddMenu] = useState(false);

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

  useEffect(() => {
    fetch("/api/goals")
      .then((r) => r.json())
      .then((d) => {
        if (d.goal) setGoal(d.goal);
      })
      .catch(() => {});
    fetch("/api/summary?range=30")
      .then((r) => r.json())
      .then((d) => {
        if (d.weights?.length > 0) {
          setLatestWeight(d.weights[d.weights.length - 1].weight);
        }
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

  const isToday = date === getLocalDate();

  const totalCalories = meals.reduce((s, m) => s + (m.calories || 0), 0);
  const totalBurned = exercises.reduce(
    (s, e) => s + (e.calories_burned || 0),
    0
  );
  const totalProtein = meals.reduce((s, m) => s + (m.protein || 0), 0);
  const totalCarbs = meals.reduce((s, m) => s + (m.carbs || 0), 0);
  const totalFat = meals.reduce((s, m) => s + (m.fat || 0), 0);

  // PFC比率
  const pfcTotal =
    totalProtein * 4 + totalCarbs * 4 + totalFat * 9;
  const pfcRatio =
    pfcTotal > 0
      ? {
          p: Math.round((totalProtein * 4 / pfcTotal) * 100),
          f: Math.round((totalFat * 9 / pfcTotal) * 100),
          c: Math.round((totalCarbs * 4 / pfcTotal) * 100),
        }
      : null;

  const adviceTips = getAdviceForDate(
    totalCalories,
    totalBurned,
    totalProtein,
    totalCarbs,
    totalFat,
    goal,
    latestWeight,
    isToday,
    new Date().getHours()
  );

  const weekDays = getWeekDays(date);
  const selectedMonth = new Date(date + "T00:00:00").getMonth() + 1;

  // filtered records
  const filteredMeals = filter === "exercise" ? [] : meals;
  const filteredExercises = filter === "meal" ? [] : exercises;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        読み込み中...
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto no-scrollbar" style={{ background: "linear-gradient(180deg, #f0fdf4 0%, #f8fafc 40%)" }}>
      {/* 月ヘッダー */}
      <div className="text-center pt-4 pb-1.5">
        <button
          onClick={() => setShowCalendar(!showCalendar)}
          className="text-lg font-bold text-gray-900 tracking-tight active:opacity-60"
        >
          {selectedMonth}月
        </button>
      </div>

      {/* カレンダー日付選択 */}
      {showCalendar && (
        <div className="px-5 pb-3">
          <input
            type="date"
            value={date}
            max={getLocalDate()}
            onChange={(e) => {
              setDate(e.target.value);
              setShowCalendar(false);
            }}
            className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-base focus:outline-none focus:border-green-500 bg-white shadow-sm"
          />
          <button
            onClick={() => { setDate(getLocalDate()); setShowCalendar(false); }}
            className="w-full mt-2 py-2.5 text-sm text-green-600 font-semibold active:bg-green-50 rounded-xl"
          >
            今日に戻る
          </button>
        </div>
      )}

      {/* 週スクロール */}
      <div className="flex justify-between px-5 pb-4">
        {weekDays.map((d) => (
          <button
            key={d.date}
            onClick={() => setDate(d.date)}
            className="flex flex-col items-center gap-1"
          >
            <span className={`text-[11px] font-semibold tracking-wide uppercase ${d.isSelected ? "text-green-600" : "text-gray-500"}`}>
              {d.dayLabel}
            </span>
            <span
              className={`w-11 h-11 rounded-2xl flex items-center justify-center text-[17px] font-bold transition-all ${
                d.isSelected
                  ? "bg-green-500 text-white shadow-lg shadow-green-500/30"
                  : d.isToday
                    ? "text-green-600 bg-green-50 ring-2 ring-green-200"
                    : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {d.dayNum}
            </span>
          </button>
        ))}
      </div>

      <div className="px-4 space-y-3.5 pb-28">
        {/* カロリーサマリーカード */}
        <div className="bg-white rounded-3xl p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <div className="flex items-baseline justify-between mb-1.5">
            <div>
              <span className="text-[34px] font-extrabold text-gray-900 tracking-tight">{totalCalories - totalBurned}</span>
              <span className="text-base text-gray-400 ml-1 font-medium">kcal</span>
            </div>
            {goal && (
              <span className="text-sm text-gray-500 font-medium">/ {goal.daily_calorie_target}kcal</span>
            )}
          </div>
          <div className="flex gap-5 text-[13px] text-gray-500 mb-3">
            <span>摂取：<span className="font-semibold text-gray-700">{totalCalories}</span>kcal</span>
            <span>運動：<span className="font-semibold text-gray-700">{totalBurned}</span>kcal</span>
          </div>
          {goal && (
            <div className="h-3.5 bg-gray-100 rounded-full overflow-hidden relative">
              <div
                className={`h-full rounded-full transition-all ${
                  totalCalories - totalBurned > goal.daily_calorie_target ? "bg-red-400" : "bg-green-500"
                }`}
                style={{ width: `${Math.min(100, ((totalCalories - totalBurned) / goal.daily_calorie_target) * 100)}%` }}
              />
              {totalBurned > 0 && (
                <div
                  className="absolute top-0 h-full bg-gray-300/60 rounded-r-full"
                  style={{
                    left: `${Math.min(100, ((totalCalories - totalBurned) / goal.daily_calorie_target) * 100)}%`,
                    width: `${Math.min(100 - Math.min(100, ((totalCalories - totalBurned) / goal.daily_calorie_target) * 100), (totalBurned / goal.daily_calorie_target) * 100)}%`,
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* 体重 + PFC 横並び */}
        <div className="flex gap-3">
          {/* 体重カード */}
          <div className="bg-white rounded-3xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] flex-shrink-0 w-[120px]">
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">体重</div>
            <div className="flex items-baseline">
              <span className="text-[32px] font-extrabold text-gray-900 tracking-tight leading-none">
                {weights.length > 0 ? weights[0].weight : latestWeight || "—"}
              </span>
              <span className="text-sm text-gray-400 ml-0.5 font-medium">kg</span>
            </div>
          </div>

          {/* PFCカード */}
          <div className="bg-white rounded-3xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)] flex-1">
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">PFCバランス</div>
            {pfcRatio && (
              <div className="mb-2.5">
                <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                  <div className="bg-emerald-500 rounded-full" style={{ width: `${pfcRatio.p}%` }} />
                  <div className="bg-green-400 rounded-full" style={{ width: `${pfcRatio.c}%` }} />
                  <div className="bg-teal-200 rounded-full" style={{ width: `${pfcRatio.f}%` }} />
                </div>
              </div>
            )}
            <div className="grid grid-cols-3 gap-1 text-center">
              <div>
                <div className="text-[15px] font-bold text-gray-900">
                  {Math.round(totalProtein)}<span className="text-gray-400 font-medium text-[11px]">/{goal ? Math.round(goal.daily_calorie_target * 0.175 / 4) : "—"}</span>
                </div>
                <div className="text-[10px] font-semibold text-gray-400">P</div>
              </div>
              <div>
                <div className="text-[15px] font-bold text-gray-900">
                  {Math.round(totalFat)}<span className="text-gray-400 font-medium text-[11px]">/{goal ? Math.round(goal.daily_calorie_target * 0.25 / 9) : "—"}</span>
                </div>
                <div className="text-[10px] font-semibold text-gray-400">F</div>
              </div>
              <div>
                <div className="text-[15px] font-bold text-gray-900">
                  {Math.round(totalCarbs)}<span className="text-gray-400 font-medium text-[11px]">/{goal ? Math.round(goal.daily_calorie_target * 0.575 / 4) : "—"}</span>
                </div>
                <div className="text-[10px] font-semibold text-gray-400">C</div>
              </div>
            </div>
          </div>
        </div>

        {/* アドバイス */}
        {adviceTips.length > 0 && (
          <div className="bg-amber-50 rounded-3xl p-4 border border-amber-200/60 shadow-[0_2px_8px_rgba(245,158,11,0.08)]">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg leading-none">💡</span>
              <span className="text-[13px] font-bold text-amber-700">
                {isToday ? "アドバイス" : "振り返り"}
              </span>
            </div>
            <div className="space-y-1.5">
              {adviceTips.map((tip, i) => (
                <div key={i} className="text-[13px] text-gray-700 leading-relaxed flex gap-2">
                  <span className="shrink-0 text-amber-400 mt-0.5">•</span>
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* フィルタータブ */}
        <div className="flex gap-2">
          {([["all", "すべて"], ["meal", "食事"], ["exercise", "運動"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-2 rounded-full text-[13px] font-semibold transition-all ${
                filter === key
                  ? "bg-green-500 text-white shadow-sm shadow-green-500/20"
                  : "bg-white text-gray-500 border border-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* + 追加 ボタン（右寄せ） */}
        <div className="flex justify-end">
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full border-2 border-green-500 text-green-600 text-[13px] font-bold active:bg-green-50 transition-colors"
          >
            <span className="text-lg leading-none">+</span> 追加
          </button>
        </div>

        {/* 記録一覧 */}
        <div className="space-y-3">
          {/* 食事 */}
          {filteredMeals.map((m) => (
            <div key={m.id} className="bg-white rounded-3xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-sm">🍽</span>
                    <span className="text-[11px] font-bold text-green-700 uppercase tracking-wide">
                      {MEAL_TYPE_LABEL[m.meal_type] || m.meal_type}
                    </span>
                  </div>
                  <div className="text-[15px] font-semibold text-gray-900 mb-1.5 leading-snug">
                    {m.description}
                  </div>
                  <div className="flex gap-3 text-[12px]">
                    <span className="font-bold text-green-600">{m.calories} kcal</span>
                    <span className="text-gray-500">P:{m.protein || 0}g</span>
                    <span className="text-gray-500">F:{m.fat || 0}g</span>
                    <span className="text-gray-500">C:{m.carbs || 0}g</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2 shrink-0 mt-1">
                  <button
                    onClick={() => setEditTarget({ type: "meal", data: { ...m } })}
                    className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-600 active:bg-gray-200 text-[13px] border border-gray-100"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => handleDelete("meal", m.id)}
                    disabled={deleting === m.id}
                    className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 active:bg-gray-200 text-[13px] border border-gray-100"
                  >
                    {deleting === m.id ? "…" : "✕"}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* 運動 */}
          {filteredExercises.map((e) => (
            <div key={e.id} className="bg-white rounded-3xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center text-sm">🏃</span>
                    <span className="text-[11px] font-bold text-orange-600 uppercase tracking-wide">運動</span>
                  </div>
                  <div className="text-[15px] font-semibold text-gray-900 mb-1.5 leading-snug">
                    {e.description}
                  </div>
                  <div className="flex gap-3 text-[12px]">
                    <span className="font-bold text-orange-600">-{e.calories_burned} kcal</span>
                    <span className="text-gray-500">{e.duration_minutes}分</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2 shrink-0 mt-1">
                  <button
                    onClick={() => setEditTarget({ type: "exercise", data: { ...e } })}
                    className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-600 active:bg-gray-200 text-[13px] border border-gray-100"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => handleDelete("exercise", e.id)}
                    disabled={deleting === e.id}
                    className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 active:bg-gray-200 text-[13px] border border-gray-100"
                  >
                    {deleting === e.id ? "…" : "✕"}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* 体重 */}
          {filter === "all" && weights.map((w) => (
            <div key={w.id} className="bg-white rounded-3xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-sm">⚖️</span>
                  <span className="text-[15px] font-semibold text-gray-900">{w.weight} kg</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditTarget({ type: "weight", data: { ...w } })}
                    className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-600 active:bg-gray-200 text-[13px] border border-gray-100"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => handleDelete("weight", w.id)}
                    disabled={deleting === w.id}
                    className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 active:bg-gray-200 text-[13px] border border-gray-100"
                  >
                    {deleting === w.id ? "…" : "✕"}
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* 空の場合 */}
          {filteredMeals.length === 0 && filteredExercises.length === 0 && (filter !== "all" || weights.length === 0) && (
            <div className="text-center py-12">
              <div className="text-3xl mb-2">📝</div>
              <p className="text-gray-400 text-sm">記録がありません</p>
            </div>
          )}
        </div>

        <div className="h-4" />
      </div>

      {/* FABメニュー */}
      {showAddMenu && (
        <>
          <div className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[2px]" onClick={() => setShowAddMenu(false)} />
          <div className="fixed bottom-24 right-5 z-40 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 w-40">
            <button
              onClick={() => { setAddType("meal"); setShowAddMenu(false); }}
              className="w-full px-4 py-3 text-left text-[14px] font-medium text-gray-800 active:bg-gray-50 flex items-center gap-3"
            >
              <span className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-sm">🍽</span> 食事
            </button>
            <button
              onClick={() => { setAddType("exercise"); setShowAddMenu(false); }}
              className="w-full px-4 py-3 text-left text-[14px] font-medium text-gray-800 active:bg-gray-50 flex items-center gap-3"
            >
              <span className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center text-sm">🏃</span> 運動
            </button>
            <button
              onClick={() => { setAddType("weight"); setShowAddMenu(false); }}
              className="w-full px-4 py-3 text-left text-[14px] font-medium text-gray-800 active:bg-gray-50 flex items-center gap-3"
            >
              <span className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-sm">⚖️</span> 体重
            </button>
          </div>
        </>
      )}

      {editTarget && (
        <EditModal
          target={editTarget}
          onSave={handleSaveEdit}
          onClose={() => setEditTarget(null)}
        />
      )}

      {addType && (
        <AddModal
          type={addType}
          date={date}
          onSave={async (data) => {
            await fetch("/api/records/add", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(data),
            });
            setAddType(null);
            fetchRecords();
          }}
          onClose={() => setAddType(null)}
        />
      )}
    </div>
  );
}

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
    "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:border-green-500";

  const inputClass2 = inputClass;

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
          <div>
            <label className="block text-xs text-gray-500 mb-1">日付</label>
            <input
              type="date"
              value={form.date || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, date: e.target.value }))
              }
              className={inputClass2}
            />
          </div>

          {target.type === "meal" && (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">食事タイプ</label>
                <select
                  value={form.meal_type || ""}
                  onChange={(e) => setForm((f) => ({ ...f, meal_type: e.target.value }))}
                  className={inputClass2}
                >
                  <option value="breakfast">朝食</option>
                  <option value="lunch">昼食</option>
                  <option value="dinner">夕食</option>
                  <option value="snack">間食</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">内容</label>
                <input
                  value={form.description || ""}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className={inputClass2}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">カロリー</label>
                  <input type="number" value={form.calories || ""} onChange={(e) => setForm((f) => ({ ...f, calories: e.target.value }))} className={inputClass2} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">タンパク質(g)</label>
                  <input type="number" value={form.protein || ""} onChange={(e) => setForm((f) => ({ ...f, protein: e.target.value }))} className={inputClass2} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">脂質(g)</label>
                  <input type="number" value={form.fat || ""} onChange={(e) => setForm((f) => ({ ...f, fat: e.target.value }))} className={inputClass2} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">炭水化物(g)</label>
                  <input type="number" value={form.carbs || ""} onChange={(e) => setForm((f) => ({ ...f, carbs: e.target.value }))} className={inputClass2} />
                </div>
              </div>
            </>
          )}

          {target.type === "exercise" && (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">内容</label>
                <input value={form.description || ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={inputClass2} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">消費カロリー</label>
                  <input type="number" value={form.calories_burned || ""} onChange={(e) => setForm((f) => ({ ...f, calories_burned: e.target.value }))} className={inputClass2} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">時間(分)</label>
                  <input type="number" value={form.duration_minutes || ""} onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value }))} className={inputClass2} />
                </div>
              </div>
            </>
          )}

          {target.type === "weight" && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">体重(kg)</label>
              <input type="number" step="0.1" value={form.weight || ""} onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))} className={inputClass2} />
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-3 rounded-lg border border-gray-300 text-gray-600 font-medium text-base">
            キャンセル
          </button>
          <button onClick={handleSubmit} className="flex-1 py-3 rounded-lg bg-green-500 text-white font-medium text-base active:bg-green-600">
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

function AddModal({
  type,
  date,
  onSave,
  onClose,
}: {
  type: "meal" | "exercise" | "weight";
  date: string;
  onSave: (data: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const getInitialForm = (): Record<string, string> => {
    if (type === "meal") {
      return { date, meal_type: "breakfast", description: "", calories: "", protein: "", fat: "", carbs: "" };
    } else if (type === "exercise") {
      return { date, description: "", calories_burned: "", duration_minutes: "" };
    }
    return { date, weight: "" };
  };
  const [form, setForm] = useState<Record<string, string>>(getInitialForm);

  const handleSubmit = () => {
    if (type === "meal") {
      if (!form.description) return;
      onSave({
        type: "meal",
        date: form.date,
        meal_type: form.meal_type,
        description: form.description,
        calories: parseInt(form.calories) || 0,
        protein: parseInt(form.protein) || 0,
        fat: parseInt(form.fat) || 0,
        carbs: parseInt(form.carbs) || 0,
      });
    } else if (type === "exercise") {
      if (!form.description) return;
      onSave({
        type: "exercise",
        date: form.date,
        description: form.description,
        calories_burned: parseInt(form.calories_burned) || 0,
        duration_minutes: parseInt(form.duration_minutes) || 0,
      });
    } else {
      if (!form.weight) return;
      onSave({
        type: "weight",
        date: form.date,
        weight: parseFloat(form.weight) || 0,
      });
    }
  };

  const inputClass =
    "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:border-green-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl p-5 mx-4 w-full max-w-sm shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-base font-bold mb-4">
          {type === "meal" ? "食事を追加" : type === "exercise" ? "運動を追加" : "体重を記録"}
        </h2>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">日付</label>
            <input
              type="date"
              value={form.date || ""}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className={inputClass}
            />
          </div>

          {type === "meal" && (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">食事タイプ</label>
                <select
                  value={form.meal_type || ""}
                  onChange={(e) => setForm((f) => ({ ...f, meal_type: e.target.value }))}
                  className={inputClass}
                >
                  <option value="breakfast">朝食</option>
                  <option value="lunch">昼食</option>
                  <option value="dinner">夕食</option>
                  <option value="snack">間食</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">内容</label>
                <input
                  value={form.description || ""}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="例: トースト1枚とコーヒー"
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">カロリー</label>
                  <input type="number" value={form.calories || ""} onChange={(e) => setForm((f) => ({ ...f, calories: e.target.value }))} placeholder="kcal" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">タンパク質(g)</label>
                  <input type="number" value={form.protein || ""} onChange={(e) => setForm((f) => ({ ...f, protein: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">脂質(g)</label>
                  <input type="number" value={form.fat || ""} onChange={(e) => setForm((f) => ({ ...f, fat: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">炭水化物(g)</label>
                  <input type="number" value={form.carbs || ""} onChange={(e) => setForm((f) => ({ ...f, carbs: e.target.value }))} className={inputClass} />
                </div>
              </div>
            </>
          )}

          {type === "exercise" && (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">内容</label>
                <input
                  value={form.description || ""}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="例: ジョギング"
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">消費カロリー</label>
                  <input type="number" value={form.calories_burned || ""} onChange={(e) => setForm((f) => ({ ...f, calories_burned: e.target.value }))} placeholder="kcal" className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">時間(分)</label>
                  <input type="number" value={form.duration_minutes || ""} onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value }))} placeholder="分" className={inputClass} />
                </div>
              </div>
            </>
          )}

          {type === "weight" && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">体重(kg)</label>
              <input type="number" step="0.1" value={form.weight || ""} onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))} placeholder="例: 65.2" className={inputClass} />
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-3 rounded-lg border border-gray-300 text-gray-600 font-medium text-base">
            キャンセル
          </button>
          <button onClick={handleSubmit} className="flex-1 py-3 rounded-lg bg-green-500 text-white font-medium text-base active:bg-green-600">
            追加
          </button>
        </div>
      </div>
    </div>
  );
}
