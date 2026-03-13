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

type EditingItem = {
  type: "meal" | "exercise" | "weight";
  id: string;
  field: string;
  value: string;
};

const MEAL_TYPE_LABEL: Record<string, string> = {
  breakfast: "朝食",
  lunch: "昼食",
  dinner: "夕食",
  snack: "間食",
};

export default function RecordsView() {
  const [date, setDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [meals, setMeals] = useState<Meal[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [weights, setWeights] = useState<Weight[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditingItem | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

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

  const handleEdit = async (
    type: string,
    id: string,
    updates: Record<string, unknown>
  ) => {
    await fetch("/api/records", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id, updates }),
    });
    setEditing(null);
    fetchRecords();
  };

  const changeDate = (offset: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + offset);
    setDate(d.toISOString().split("T")[0]);
  };

  const isToday = date === new Date().toISOString().split("T")[0];

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
          <p className="text-sm text-gray-300 text-center py-4">
            記録なし
          </p>
        ) : (
          <div className="space-y-2">
            {meals.map((m) => (
              <div
                key={m.id}
                className="bg-white rounded-xl p-3 shadow-sm border border-gray-100"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                        {MEAL_TYPE_LABEL[m.meal_type] || m.meal_type}
                      </span>
                      {editing?.id === m.id && editing.field === "description" ? (
                        <input
                          autoFocus
                          defaultValue={m.description}
                          onBlur={(e) =>
                            handleEdit("meal", m.id, {
                              description: e.target.value,
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleEdit("meal", m.id, {
                                description: (e.target as HTMLInputElement)
                                  .value,
                              });
                            }
                          }}
                          className="flex-1 text-sm border-b border-green-400 outline-none bg-transparent"
                        />
                      ) : (
                        <span
                          className="text-sm font-medium text-gray-800 cursor-pointer"
                          onClick={() =>
                            setEditing({
                              type: "meal",
                              id: m.id,
                              field: "description",
                              value: m.description,
                            })
                          }
                        >
                          {m.description}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-3 mt-1.5 text-xs text-gray-400">
                      {editing?.id === m.id && editing.field === "calories" ? (
                        <input
                          autoFocus
                          type="number"
                          defaultValue={m.calories}
                          onBlur={(e) =>
                            handleEdit("meal", m.id, {
                              calories: parseInt(e.target.value),
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleEdit("meal", m.id, {
                                calories: parseInt(
                                  (e.target as HTMLInputElement).value
                                ),
                              });
                            }
                          }}
                          className="w-16 border-b border-green-400 outline-none bg-transparent text-sm"
                        />
                      ) : (
                        <span
                          className="cursor-pointer font-medium text-green-600"
                          onClick={() =>
                            setEditing({
                              type: "meal",
                              id: m.id,
                              field: "calories",
                              value: String(m.calories),
                            })
                          }
                        >
                          {m.calories} kcal
                        </span>
                      )}
                      <span>P:{m.protein || 0}g</span>
                      <span>F:{m.fat || 0}g</span>
                      <span>C:{m.carbs || 0}g</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete("meal", m.id)}
                    disabled={deleting === m.id}
                    className="ml-2 text-red-300 hover:text-red-500 active:text-red-600 text-lg leading-none"
                  >
                    {deleting === m.id ? "..." : "×"}
                  </button>
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
          <p className="text-sm text-gray-300 text-center py-4">
            記録なし
          </p>
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
                  <button
                    onClick={() => handleDelete("exercise", e.id)}
                    disabled={deleting === e.id}
                    className="ml-2 text-red-300 hover:text-red-500 active:text-red-600 text-lg leading-none"
                  >
                    {deleting === e.id ? "..." : "×"}
                  </button>
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
              <button
                onClick={() => handleDelete("weight", w.id)}
                disabled={deleting === w.id}
                className="text-red-300 hover:text-red-500 active:text-red-600 text-lg leading-none"
              >
                {deleting === w.id ? "..." : "×"}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="h-4" />
    </div>
  );
}
