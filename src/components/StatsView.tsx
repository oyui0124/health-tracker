"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type DailyStats = Record<
  string,
  {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    burned: number;
    weight?: number;
  }
>;

type SummaryData = {
  dailyStats: DailyStats;
  weights: { date: string; weight: number }[];
  goal: { target_weight: number; daily_calorie_target: number } | null;
};

export default function StatsView() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [range, setRange] = useState(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/summary?range=${range}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [range]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        読み込み中...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        データを取得できませんでした
      </div>
    );
  }

  const chartData = Object.entries(data.dailyStats)
    .map(([date, stats]) => ({
      date: date.slice(5), // MM-DD
      calories: stats.calories,
      burned: stats.burned,
      net: stats.calories - stats.burned,
      weight: stats.weight,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const weightData = data.weights.map((w) => ({
    date: w.date.slice(5),
    weight: w.weight,
  }));

  const todayKey = new Date().toISOString().split("T")[0];
  const today = data.dailyStats[todayKey];
  const goalCalorie = data.goal?.daily_calorie_target || 2000;

  return (
    <div className="h-full overflow-y-auto no-scrollbar px-4 py-4 space-y-5">
      {/* 期間切り替え */}
      <div className="flex gap-2">
        {[7, 14, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setRange(d)}
            className={`flex-1 py-1.5 rounded-full text-sm font-medium transition-colors ${
              range === d
                ? "bg-green-500 text-white"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {d}日
          </button>
        ))}
      </div>

      {/* 今日のサマリー */}
      {today && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">
            今日のサマリー
          </h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-2xl font-bold text-green-600">
                {today.calories}
              </div>
              <div className="text-xs text-gray-400">摂取 kcal</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-500">
                {today.burned}
              </div>
              <div className="text-xs text-gray-400">消費 kcal</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-500">
                {today.calories - today.burned}
              </div>
              <div className="text-xs text-gray-400">正味 kcal</div>
            </div>
          </div>

          {/* カロリーバー */}
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>目標: {goalCalorie} kcal</span>
              <span>
                残り: {Math.max(0, goalCalorie - today.calories + today.burned)}{" "}
                kcal
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  today.calories - today.burned > goalCalorie
                    ? "bg-red-400"
                    : "bg-green-400"
                }`}
                style={{
                  width: `${Math.min(100, ((today.calories - today.burned) / goalCalorie) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* カロリー推移グラフ */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-500 mb-3">
          カロリー推移
        </h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="calories" fill="#22c55e" name="摂取" radius={[4, 4, 0, 0]} />
              <Bar dataKey="burned" fill="#f97316" name="消費" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-gray-400 py-8">データがありません</p>
        )}
      </div>

      {/* 体重推移グラフ */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-500 mb-3">体重推移</h3>
        {weightData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={weightData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis
                domain={["dataMin - 1", "dataMax + 1"]}
                tick={{ fontSize: 11 }}
              />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: "#3b82f6", r: 4 }}
                name="体重 (kg)"
              />
              {data.goal && (
                <Line
                  type="monotone"
                  dataKey={() => data.goal!.target_weight}
                  stroke="#ef4444"
                  strokeDasharray="5 5"
                  strokeWidth={1}
                  dot={false}
                  name="目標"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-gray-400 py-8">データがありません</p>
        )}
      </div>

      {/* PFCバランス */}
      {today && (today.protein > 0 || today.carbs > 0 || today.fat > 0) && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">
            今日のPFCバランス
          </h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-lg font-bold text-purple-500">
                {Math.round(today.protein)}g
              </div>
              <div className="text-xs text-gray-400">タンパク質</div>
            </div>
            <div>
              <div className="text-lg font-bold text-yellow-500">
                {Math.round(today.carbs)}g
              </div>
              <div className="text-xs text-gray-400">炭水化物</div>
            </div>
            <div>
              <div className="text-lg font-bold text-red-400">
                {Math.round(today.fat)}g
              </div>
              <div className="text-xs text-gray-400">脂質</div>
            </div>
          </div>
        </div>
      )}

      <div className="h-4" />
    </div>
  );
}
