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

/*
 * デザインルール:
 * - カード: bg-white rounded-2xl p-4 shadow-sm border border-gray-100
 * - 見出し: text-[13px] font-bold text-gray-800
 * - サブラベル: text-[11px] text-gray-400 font-medium
 * - 大数字: text-[28px] font-extrabold text-gray-900
 * - 中数字: text-lg font-bold text-gray-800
 * - 小数字: text-[13px] font-semibold
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MobileTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm px-3 py-2 rounded-xl text-xs shadow-sm border border-gray-100">
      <div className="font-semibold text-gray-500 mb-0.5">{label}</div>
      {payload.map((p: { name: string; value: number; color: string }, i: number) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-700">{p.name}: <span className="font-bold">{Math.round(p.value)}</span></span>
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

  const days = Object.keys(data.dailyStats).length;
  const totalCal = Object.values(data.dailyStats).reduce((s, d) => s + d.calories, 0);
  const totalBurned = Object.values(data.dailyStats).reduce((s, d) => s + d.burned, 0);
  const avgNet = days > 0 ? Math.round((totalCal - totalBurned) / days) : 0;

  // 目標達成までの期間計算
  const goalDiff = latestWeight && data.goal?.target_weight
    ? latestWeight - data.goal.target_weight
    : null;
  const goalMonths = (() => {
    if (!goalDiff || goalDiff <= 0 || !data.goal?.daily_calorie_target) return null;
    const dailyDeficit = bmr ? (bmr * 1.2) - data.goal.daily_calorie_target : 300;
    if (dailyDeficit <= 0) return null;
    return Math.ceil((goalDiff * 7700) / dailyDeficit / 30);
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

  return (
    <div className="h-full overflow-y-auto no-scrollbar px-4 py-4 space-y-4">
      {/* 期間切り替え */}
      <div className="flex gap-2">
        {[7, 14, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setRange(d)}
            className={`flex-1 py-2 rounded-xl text-[13px] font-semibold transition-colors ${
              range === d
                ? "bg-green-500 text-white"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {d}日
          </button>
        ))}
      </div>

      {/* ヒーローカード: 目標進捗（最も重要） */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="text-[13px] font-bold text-gray-800 mb-3">目標の進捗</div>
        <div className="flex items-center gap-5">
          {/* 目標体重まで */}
          <div className="flex-1">
            {goalDiff !== null && goalDiff > 0 ? (
              <>
                <div className="flex items-baseline gap-1">
                  <span className="text-[28px] font-extrabold text-gray-900">あと{goalDiff.toFixed(1)}</span>
                  <span className="text-[13px] text-gray-400 font-medium">kg</span>
                </div>
                {goalMonths && (
                  <div className="text-[13px] text-green-600 font-semibold mt-0.5">
                    約{goalMonths}ヶ月で達成見込み
                  </div>
                )}
              </>
            ) : goalDiff !== null && goalDiff <= 0 ? (
              <div className="text-lg font-bold text-green-600">目標達成圏内!</div>
            ) : (
              <div className="text-[13px] text-gray-400">目標を設定してください</div>
            )}
          </div>
          {/* 右: BMR + 体重 */}
          <div className="text-right space-y-1">
            {latestWeight && (
              <div>
                <div className="text-[11px] text-gray-400 font-medium">現在</div>
                <div className="text-lg font-bold text-gray-800">{latestWeight}<span className="text-[11px] text-gray-400 ml-0.5">kg</span></div>
              </div>
            )}
            {bmr && (
              <div>
                <div className="text-[11px] text-gray-400 font-medium">基礎代謝</div>
                <div className="text-[13px] font-semibold text-gray-600">{bmr} kcal</div>
              </div>
            )}
          </div>
        </div>
        {/* プログレスバー */}
        {goalDiff !== null && goalDiff > 0 && data.goal?.target_weight && latestWeight && (
          <div className="mt-3">
            <div className="flex justify-between text-[10px] text-gray-400 mb-1">
              <span>{data.goal.target_weight}kg</span>
              <span>{latestWeight}kg</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${Math.max(5, Math.min(95, 100 - (goalDiff / (latestWeight - data.goal.target_weight + goalDiff)) * 100))}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 平均 + 達成カレンダー */}
      <div className="flex gap-3">
        {/* 平均実質カロリー */}
        {days > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 w-[130px] shrink-0">
            <div className="text-[11px] text-gray-400 font-medium mb-1">実質カロリー</div>
            <div className="text-[11px] text-gray-400 font-medium mb-2">{range}日平均</div>
            <div className="flex items-baseline gap-0.5">
              <span className="text-[24px] font-extrabold text-gray-900">{avgNet}</span>
              <span className="text-[11px] text-gray-400">kcal</span>
            </div>
            {data.goal && (
              <div className={`mt-1.5 text-[12px] font-semibold ${
                avgNet > data.goal.daily_calorie_target ? "text-red-500" : "text-green-600"
              }`}>
                目標{data.goal.daily_calorie_target}に対し
                {avgNet > data.goal.daily_calorie_target
                  ? ` +${avgNet - data.goal.daily_calorie_target}`
                  : ` -${data.goal.daily_calorie_target - avgNet}`}
              </div>
            )}
          </div>
        )}

        {/* 達成カレンダー */}
        {data.goal && calendarDays.length > 0 && (
          <div className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] text-gray-400 font-medium">達成カレンダー</div>
              <div className="flex items-center gap-2 text-[11px]">
                {streak > 0 && <span className="text-green-600 font-bold">{streak}日連続</span>}
                <span className="bg-green-50 text-green-600 font-bold px-1.5 py-0.5 rounded-md">{rate}%</span>
              </div>
            </div>
            <div className="overflow-hidden">
              <div className="grid grid-cols-7 gap-[3px] text-center mb-1">
                {["月","火","水","木","金","土","日"].map((d) => (
                  <div key={d} className="text-[9px] text-gray-400 font-semibold">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-[3px]">
                {calendarDays.map((day, i) => (
                  <div key={i} className="aspect-square flex items-center justify-center">
                    {day.blank ? null : (
                      <div
                        className={`w-full h-full rounded-md flex items-center justify-center text-[9px] font-bold ${
                          day.status === "good"
                            ? "bg-green-100 text-green-600 ring-1 ring-green-300/50"
                            : day.status === "over"
                              ? "bg-red-50 text-red-400 ring-1 ring-red-200/50"
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
            <div className="flex gap-3 mt-2 text-[9px] text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-100 ring-1 ring-green-300/50 inline-block" /> 達成</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-50 ring-1 ring-red-200/50 inline-block" /> 超過</span>
            </div>
          </div>
        )}
      </div>

      {/* カロリー推移グラフ */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[13px] font-bold text-gray-800">カロリー推移</div>
          {/* 大きめの切り替えボタン */}
          <div className="flex bg-gray-100 rounded-xl p-0.5">
            {([["net", "実質"], ["detail", "内訳"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setChartMode(key as ChartMode)}
                className={`px-4 py-1.5 rounded-[10px] text-[12px] font-semibold transition-all ${
                  chartMode === key
                    ? "bg-white text-gray-800 shadow-sm"
                    : "text-gray-400"
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
                <Tooltip content={<MobileTooltip />} />
                <Bar dataKey="calories" fill="#22c55e" name="摂取" radius={[6, 6, 0, 0]} />
                <Bar dataKey="burned" fill="#fb923c" name="消費" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
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
                <Tooltip content={<MobileTooltip />} />
                <Area
                  type="monotone"
                  dataKey="net"
                  stroke="#22c55e"
                  strokeWidth={2.5}
                  fill="url(#netGrad)"
                  dot={{ fill: "#fff", stroke: "#22c55e", strokeWidth: 2, r: 3 }}
                  activeDot={{ fill: "#22c55e", stroke: "#fff", strokeWidth: 2, r: 6 }}
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
          <p className="text-center text-gray-400 py-8 text-[13px]">データがありません</p>
        )}
        <div className="text-[11px] text-gray-400 text-center mt-1">タップで詳細を表示</div>
      </div>

      {/* 体重推移グラフ */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[13px] font-bold text-gray-800">体重推移</div>
          {weightData.length > 0 && (
            <span className="text-[12px] text-gray-500">最新 <span className="font-bold text-gray-700">{weightData[weightData.length - 1].weight}kg</span></span>
          )}
        </div>
        {weightData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
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
              <Tooltip content={<MobileTooltip />} />
              <Area
                type="monotone"
                dataKey="weight"
                stroke="#3b82f6"
                strokeWidth={2.5}
                fill="url(#weightGrad)"
                dot={{ fill: "#fff", stroke: "#3b82f6", strokeWidth: 2, r: 3 }}
                activeDot={{ fill: "#3b82f6", stroke: "#fff", strokeWidth: 2, r: 6 }}
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
          <p className="text-center text-gray-400 py-8 text-[13px]">データがありません</p>
        )}
        {weightData.length > 0 && (
          <div className="text-[11px] text-gray-400 text-center mt-1">タップで詳細を表示</div>
        )}
      </div>

      {/* CSVエクスポート */}
      <div className="text-center pb-2">
        <a
          href={`/api/export?range=${range}`}
          download
          className="text-[12px] text-gray-400 underline active:text-gray-600"
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
    if (result.length > 100) break;
  }

  return result;
}
