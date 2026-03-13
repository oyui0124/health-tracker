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
import { calculateBMR, getAge } from "@/lib/bmr";

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

type Goal = {
  target_weight: number;
  daily_calorie_target: number;
  height_cm?: number;
  birth_date?: string;
  gender?: "male" | "female";
};

type SummaryData = {
  dailyStats: DailyStats;
  weights: { date: string; weight: number }[];
  goal: Goal | null;
};

export default function StatsView() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [range, setRange] = useState(7);
  const [loading, setLoading] = useState(true);
  const [showDetail, setShowDetail] = useState(false);

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
      date: date.slice(5),
      calories: stats.calories,
      burned: stats.burned,
      net: stats.calories - stats.burned,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const weightData = data.weights.map((w) => ({
    date: w.date.slice(5),
    weight: w.weight,
  }));

  // BMR計算
  const latestWeight = data.weights.length
    ? data.weights[data.weights.length - 1].weight
    : null;
  const bmr =
    data.goal?.height_cm && data.goal?.birth_date && data.goal?.gender && latestWeight
      ? calculateBMR(
          latestWeight,
          data.goal.height_cm,
          getAge(data.goal.birth_date),
          data.goal.gender
        )
      : null;

  // 期間の平均カロリー
  const days = Object.keys(data.dailyStats).length;
  const totalCal = Object.values(data.dailyStats).reduce((s, d) => s + d.calories, 0);
  const totalBurned = Object.values(data.dailyStats).reduce((s, d) => s + d.burned, 0);
  const avgCalories = days > 0 ? Math.round(totalCal / days) : 0;
  const avgBurned = days > 0 ? Math.round(totalBurned / days) : 0;

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

      {/* BMR & 基本情報 */}
      {bmr && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl p-4 border border-green-100">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500">基礎代謝（BMR）</div>
              <div className="text-2xl font-bold text-green-700">{bmr} kcal/日</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">最新体重</div>
              <div className="text-lg font-bold text-blue-600">
                {latestWeight} kg
              </div>
            </div>
            {data.goal?.target_weight && (
              <div className="text-right">
                <div className="text-xs text-gray-500">目標まで</div>
                <div className="text-lg font-bold text-orange-500">
                  {latestWeight
                    ? `${(latestWeight - data.goal.target_weight).toFixed(1)} kg`
                    : "-"}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 期間の平均 */}
      {days > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">
            {range}日間の平均
          </h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-xl font-bold text-green-600">{avgCalories}</div>
              <div className="text-xs text-gray-400">摂取 kcal/日</div>
            </div>
            <div>
              <div className="text-xl font-bold text-orange-500">{avgBurned}</div>
              <div className="text-xs text-gray-400">消費 kcal/日</div>
            </div>
            <div>
              <div className="text-xl font-bold text-blue-500">{avgCalories - avgBurned}</div>
              <div className="text-xs text-gray-400">正味 kcal/日</div>
            </div>
          </div>
          {data.goal && (
            <div className="mt-2 text-xs text-center text-gray-400">
              目標 {data.goal.daily_calorie_target} kcal/日 → 平均{" "}
              {avgCalories - avgBurned > data.goal.daily_calorie_target
                ? `${avgCalories - avgBurned - data.goal.daily_calorie_target} kcal 超過`
                : `${data.goal.daily_calorie_target - avgCalories + avgBurned} kcal 余裕`}
            </div>
          )}
        </div>
      )}

      {/* カロリー推移グラフ */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-500">
            カロリー推移
          </h3>
          <button
            onClick={() => setShowDetail(!showDetail)}
            className="text-xs text-gray-400 border border-gray-200 rounded-full px-3 py-1 active:bg-gray-50"
          >
            {showDetail ? "正味のみ" : "内訳を見る"}
          </button>
        </div>
        {chartData.length > 0 ? (
          showDetail ? (
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
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="net"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ fill: "#22c55e", r: 3 }}
                  name="正味 kcal"
                />
                {data.goal && (
                  <Line
                    type="monotone"
                    dataKey={() => data.goal!.daily_calorie_target}
                    stroke="#ef4444"
                    strokeDasharray="5 5"
                    strokeWidth={1}
                    dot={false}
                    name="目標"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          )
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

      <div className="h-4" />
    </div>
  );
}
