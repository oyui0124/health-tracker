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

type ChartMode = "net" | "detail";

export default function StatsView() {
  const [data, setData] = useState<SummaryData | null>(null);
  const [range, setRange] = useState(7);
  const [loading, setLoading] = useState(true);
  const [chartMode, setChartMode] = useState<ChartMode>("net");

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
      fullDate: date,
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

  // 達成カレンダーデータ
  const calendarDays = buildCalendarDays(data.dailyStats, data.goal);

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
              <div className="text-xl font-bold text-gray-700">{avgCalories - avgBurned}</div>
              <div className="text-xs text-gray-400">実質 kcal/日</div>
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

      {/* 達成カレンダー */}
      {data.goal && calendarDays.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-500 mb-3">
            目標達成カレンダー
          </h3>
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {["月","火","水","木","金","土","日"].map((d) => (
              <div key={d} className="text-[10px] text-gray-400 pb-1">{d}</div>
            ))}
            {calendarDays.map((day, i) => (
              <div key={i} className="flex flex-col items-center">
                {day.blank ? (
                  <div className="w-8 h-8" />
                ) : (
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-medium ${
                      day.status === "good"
                        ? "bg-green-100 text-green-700"
                        : day.status === "over"
                          ? "bg-red-100 text-red-600"
                          : day.status === "nodata"
                            ? "bg-gray-50 text-gray-300"
                            : "bg-gray-50 text-gray-400"
                    }`}
                    title={day.label}
                  >
                    {day.status === "good" ? "○" : day.status === "over" ? "×" : day.dayNum}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-3 justify-center text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-100 inline-block" /> 達成</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-100 inline-block" /> 超過</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-50 border border-gray-200 inline-block" /> 記録なし</span>
          </div>
        </div>
      )}

      {/* カロリー推移グラフ */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-500">
            カロリー推移
          </h3>
          <div className="flex bg-gray-100 rounded-full p-0.5">
            <button
              onClick={() => setChartMode("net")}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors ${
                chartMode === "net"
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-400"
              }`}
            >
              実質
            </button>
            <button
              onClick={() => setChartMode("detail")}
              className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors ${
                chartMode === "detail"
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-400"
              }`}
            >
              摂取/消費
            </button>
          </div>
        </div>
        {chartData.length > 0 ? (
          chartMode === "detail" ? (
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
                  name="実質 kcal"
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

      {/* CSVエクスポート */}
      <div className="text-center pb-2">
        <a
          href={`/api/export?range=${range}`}
          download
          className="text-xs text-gray-400 underline active:text-gray-600"
        >
          この期間の記録をCSVでダウンロード
        </a>
      </div>

      <div className="h-4" />
    </div>
  );
}

function buildCalendarDays(
  dailyStats: DailyStats,
  goal: Goal | null
): { dayNum: number; status: "good" | "over" | "nodata" | "future"; label: string; blank?: boolean }[] {
  if (!goal) return [];

  const dates = Object.keys(dailyStats).sort();
  if (dates.length === 0) return [];

  const firstDate = new Date(dates[0] + "T00:00:00");
  const lastDate = new Date(dates[dates.length - 1] + "T00:00:00");

  // Start from the Monday of the first date's week
  const startDay = new Date(firstDate);
  const dow = startDay.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  startDay.setDate(startDay.getDate() + mondayOffset);

  const result: { dayNum: number; status: "good" | "over" | "nodata" | "future"; label: string; blank?: boolean }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const current = new Date(startDay);
  while (current <= lastDate || current <= today) {
    const dateStr = current.toISOString().split("T")[0];
    const dayNum = current.getDate();

    if (current < firstDate) {
      result.push({ dayNum, status: "nodata", label: "", blank: true });
    } else if (current > today) {
      break;
    } else {
      const stats = dailyStats[dateStr];
      if (stats && stats.calories > 0) {
        const net = stats.calories - stats.burned;
        const status = net <= goal.daily_calorie_target ? "good" : "over";
        result.push({ dayNum, status, label: `${dateStr}: ${net}/${goal.daily_calorie_target} kcal` });
      } else {
        result.push({ dayNum, status: "nodata", label: dateStr });
      }
    }

    current.setDate(current.getDate() + 1);
    // Stop after 90 days max
    if (result.length > 100) break;
  }

  return result;
}
