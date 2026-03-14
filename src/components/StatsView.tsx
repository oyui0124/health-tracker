"use client";

import { useState, useEffect } from "react";
import {
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { calculateBMR, getAge } from "@/lib/bmr";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900/90 backdrop-blur-sm text-white px-3 py-2 rounded-xl text-xs shadow-lg">
      <div className="font-medium text-gray-300 mb-0.5">{label}</div>
      {payload.map((p: { name: string; value: number; color: string }, i: number) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span>{p.name}: <span className="font-bold">{p.value}</span></span>
        </div>
      ))}
    </div>
  );
};

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
    <div className="h-full overflow-y-auto no-scrollbar px-4 py-4 space-y-5 animate-fadeIn">
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn > * {
          animation: fadeIn 0.4s ease-out both;
        }
        .animate-fadeIn > *:nth-child(1) { animation-delay: 0ms; }
        .animate-fadeIn > *:nth-child(2) { animation-delay: 60ms; }
        .animate-fadeIn > *:nth-child(3) { animation-delay: 120ms; }
        .animate-fadeIn > *:nth-child(4) { animation-delay: 180ms; }
        .animate-fadeIn > *:nth-child(5) { animation-delay: 240ms; }
        .animate-fadeIn > *:nth-child(6) { animation-delay: 300ms; }
        .animate-fadeIn > *:nth-child(7) { animation-delay: 360ms; }
      `}</style>
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
      {data.goal && calendarDays.length > 0 && (() => {
        const actual = calendarDays.filter((d) => !d.blank);
        const goodCount = actual.filter((d) => d.status === "good").length;
        const total = actual.filter((d) => d.status !== "nodata").length;
        const rate = total > 0 ? Math.round((goodCount / total) * 100) : 0;
        let streak = 0;
        for (let i = actual.length - 1; i >= 0; i--) {
          if (actual[i].status === "good") streak++;
          else break;
        }
        return (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-500">目標達成</h3>
              <div className="flex items-center gap-2 text-xs">
                {streak > 0 && (
                  <span className="text-green-600 font-semibold">{streak}日連続</span>
                )}
                <span className="text-gray-400">達成率 <span className="font-bold text-green-600">{rate}%</span></span>
              </div>
            </div>
            {/* コンパクトカレンダー: 中央寄せ、小さめセル */}
            <div className="flex justify-center">
              <div>
                <div className="grid grid-cols-7 gap-1 text-center mb-1">
                  {["月","火","水","木","金","土","日"].map((d) => (
                    <div key={d} className="w-7 text-[9px] text-gray-400 font-medium">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day, i) => (
                    <div key={i} className="w-7 h-7 flex items-center justify-center">
                      {day.blank ? (
                        <div className="w-full h-full" />
                      ) : (
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-semibold ${
                            day.status === "good"
                              ? "bg-green-500 text-white"
                              : day.status === "over"
                                ? "bg-red-400 text-white"
                                : "bg-gray-100 text-gray-300"
                          }`}
                          title={day.label}
                        >
                          {day.dayNum}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-2.5 justify-center text-[10px] text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-green-500 inline-block" /> 達成</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-400 inline-block" /> 超過</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-gray-100 inline-block" /> 未記録</span>
            </div>
          </div>
        );
      })()}

      {/* カロリー推移グラフ */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3">
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
                    ? "bg-green-500 text-white shadow-sm shadow-green-500/20"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {chartData.length > 0 ? (
          chartMode === "detail" ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={35} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="calories" fill="#22c55e" name="摂取" radius={[6, 6, 0, 0]} />
                <Bar dataKey="burned" fill="#fb923c" name="消費" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={35} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="net"
                  stroke="#22c55e"
                  strokeWidth={2.5}
                  fill="url(#netGrad)"
                  dot={{ fill: "#fff", stroke: "#22c55e", strokeWidth: 2, r: 3 }}
                  activeDot={{ fill: "#22c55e", stroke: "#fff", strokeWidth: 2, r: 5 }}
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
        <h3 className="text-sm font-semibold text-gray-500 mb-3">体重推移</h3>
        {weightData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={weightData}>
              <defs>
                <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.15} />
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
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="weight"
                stroke="#3b82f6"
                strokeWidth={2.5}
                fill="url(#weightGrad)"
                dot={{ fill: "#fff", stroke: "#3b82f6", strokeWidth: 2, r: 3 }}
                activeDot={{ fill: "#3b82f6", stroke: "#fff", strokeWidth: 2, r: 5 }}
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
