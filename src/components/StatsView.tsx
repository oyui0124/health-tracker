"use client";

import { useState, useEffect } from "react";
import {
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Area,
  AreaChart,
  LabelList,
} from "recharts";
import { calculateBMR, getAge } from "@/lib/bmr";

// デザインルール: shadow-sm + border-gray-100 のみ使用

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
  const avgNet = days > 0 ? Math.round((totalCal - totalBurned) / days) : 0;

  // 目標達成までの期間計算
  const goalMonths = (() => {
    if (!latestWeight || !data.goal?.target_weight || !data.goal?.daily_calorie_target) return null;
    const diff = latestWeight - data.goal.target_weight;
    if (diff <= 0) return 0;
    // 日々の赤字 = 目標カロリー - 実際の平均消費（BMR × 1.2活動係数）
    const dailyDeficit = bmr ? (bmr * 1.2) - data.goal.daily_calorie_target : 300;
    if (dailyDeficit <= 0) return null;
    const daysNeeded = (diff * 7700) / dailyDeficit;
    return Math.ceil(daysNeeded / 30);
  })();

  // 達成カレンダーデータ
  const calendarDays = buildCalendarDays(data.dailyStats, data.goal);
  const actual = calendarDays.filter((d) => !d.blank);
  const goodCount = actual.filter((d) => d.status === "good").length;
  const recordedCount = actual.filter((d) => d.status !== "nodata").length;
  const rate = recordedCount > 0 ? Math.round((goodCount / recordedCount) * 100) : 0;
  let streak = 0;
  for (let i = actual.length - 1; i >= 0; i--) {
    if (actual[i].status === "good") streak++;
    else break;
  }

  // グラフの最終値ラベル用
  const lastNet = chartData.length > 0 ? chartData[chartData.length - 1].net : null;
  const lastWeight = weightData.length > 0 ? weightData[weightData.length - 1].weight : null;

  return (
    <div className="h-full overflow-y-auto no-scrollbar px-4 py-4 space-y-4">
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

      {/* BMR + 目標達成予測 - コンパクト */}
      {(bmr || goalMonths !== null) && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            {bmr && (
              <div className="flex-1">
                <div className="text-[11px] text-gray-400 font-medium">基礎代謝</div>
                <div className="text-lg font-bold text-gray-800">{bmr}<span className="text-xs text-gray-400 ml-0.5">kcal</span></div>
              </div>
            )}
            {latestWeight && (
              <div className="flex-1">
                <div className="text-[11px] text-gray-400 font-medium">現在</div>
                <div className="text-lg font-bold text-gray-800">{latestWeight}<span className="text-xs text-gray-400 ml-0.5">kg</span></div>
              </div>
            )}
            {goalMonths !== null && goalMonths > 0 && (
              <div className="flex-1">
                <div className="text-[11px] text-gray-400 font-medium">目標達成</div>
                <div className="text-lg font-bold text-green-600">約{goalMonths}<span className="text-xs text-gray-400 ml-0.5">ヶ月</span></div>
              </div>
            )}
            {goalMonths === 0 && (
              <div className="flex-1">
                <div className="text-[11px] text-gray-400 font-medium">目標</div>
                <div className="text-sm font-bold text-green-600">達成圏内!</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 平均 + 達成カレンダー 横並び */}
      <div className="flex gap-3">
        {/* 平均 */}
        {days > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 w-[130px] shrink-0">
            <div className="text-[11px] text-gray-400 font-medium mb-2">平均（{range}日）</div>
            <div className="text-2xl font-bold text-gray-800 leading-none mb-1">{avgNet}</div>
            <div className="text-[11px] text-gray-400">kcal/日</div>
            {data.goal && (
              <div className={`mt-2 text-[11px] font-semibold ${
                avgNet > data.goal.daily_calorie_target ? "text-red-500" : "text-green-600"
              }`}>
                {avgNet > data.goal.daily_calorie_target
                  ? `+${avgNet - data.goal.daily_calorie_target} 超過`
                  : `${data.goal.daily_calorie_target - avgNet} 余裕`}
              </div>
            )}
          </div>
        )}

        {/* 達成カレンダー */}
        {data.goal && calendarDays.length > 0 && (
          <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[11px] text-gray-400 font-medium">達成カレンダー</div>
              <div className="flex items-center gap-1.5 text-[10px]">
                {streak > 0 && <span className="text-green-600 font-bold">{streak}日連続</span>}
                <span className="text-green-600 font-bold">{rate}%</span>
              </div>
            </div>
            <div className="overflow-hidden">
              <div className="grid grid-cols-7 gap-[3px] text-center mb-0.5">
                {["月","火","水","木","金","土","日"].map((d) => (
                  <div key={d} className="text-[8px] text-gray-300 font-medium">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-[3px]">
                {calendarDays.map((day, i) => (
                  <div key={i} className="aspect-square flex items-center justify-center">
                    {day.blank ? null : (
                      <div
                        className={`w-full h-full rounded-[4px] flex items-center justify-center text-[8px] font-bold ${
                          day.status === "good"
                            ? "bg-green-500 text-white"
                            : day.status === "over"
                              ? "bg-red-400 text-white"
                              : "bg-gray-50 text-gray-300"
                        }`}
                      >
                        {day.dayNum}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 mt-1.5 text-[9px] text-gray-400">
              <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-sm bg-green-500 inline-block" /> 達成</span>
              <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-sm bg-red-400 inline-block" /> 超過</span>
            </div>
          </div>
        )}
      </div>

      {/* カロリー推移グラフ */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-500">
            カロリー推移
          </h3>
          <div className="flex gap-1.5">
            {([["net", "実質"], ["detail", "摂取/消費"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setChartMode(key as ChartMode)}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${
                  chartMode === key
                    ? "bg-green-500 text-white"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {lastNet !== null && chartMode === "net" && (
          <div className="mb-2">
            <span className="text-2xl font-bold text-gray-800">{lastNet}</span>
            <span className="text-xs text-gray-400 ml-1">kcal（最新）</span>
          </div>
        )}
        {chartData.length > 0 ? (
          chartMode === "detail" ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={35} />
                <Bar dataKey="calories" fill="#22c55e" name="摂取" radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="calories" position="top" fontSize={8} fill="#9ca3af" />
                </Bar>
                <Bar dataKey="burned" fill="#fb923c" name="消費" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={35} />
                <Area
                  type="monotone"
                  dataKey="net"
                  stroke="#22c55e"
                  strokeWidth={2.5}
                  fill="url(#netGrad)"
                  dot={{ fill: "#fff", stroke: "#22c55e", strokeWidth: 2, r: 3 }}
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
              </AreaChart>
            </ResponsiveContainer>
          )
        ) : (
          <p className="text-center text-gray-400 py-8">データがありません</p>
        )}
      </div>

      {/* 体重推移グラフ */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-500">体重推移</h3>
          {lastWeight !== null && (
            <span className="text-xs text-gray-400">最新 <span className="font-bold text-gray-600">{lastWeight}kg</span></span>
          )}
        </div>
        {weightData.length > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={weightData}>
              <defs>
                <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis
                domain={["dataMin - 1", "dataMax + 1"]}
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                width={35}
              />
              <Area
                type="monotone"
                dataKey="weight"
                stroke="#3b82f6"
                strokeWidth={2.5}
                fill="url(#weightGrad)"
                dot={{ fill: "#fff", stroke: "#3b82f6", strokeWidth: 2, r: 3 }}
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
            </AreaChart>
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
