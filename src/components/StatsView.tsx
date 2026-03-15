"use client";

import { useState, useEffect, useCallback } from "react";
import PullToRefresh from "./PullToRefresh";
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
import LoadingSpinner from "./LoadingSpinner";

/*
 * 統一デザインルール (Records / Stats 共通):
 * - カード: bg-white rounded-2xl p-4
 * - 見出し: text-[13px] font-bold text-gray-800 + アイコン (gap-1.5)
 * - サブラベル: text-[11px] text-gray-400 font-medium + アイコン (gap-1)
 * - 大数字: text-[28px] font-extrabold text-gray-900
 * - 中数字: text-lg font-bold text-gray-800
 * - 小数字: text-[13px] font-semibold
 * - セグメント: glassmorphism rounded-xl p-1, ボタン rounded-[10px]
 * - モーダルinput: rounded-xl border-gray-200
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MobileTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm px-3 py-2 rounded-xl text-xs shadow-sm border border-gray-200/60">
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
    hasExercise?: boolean;
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

export default function StatsView({ refreshKey }: { refreshKey?: number }) {
  const [data, setData] = useState<SummaryData | null>(null);
  const [range, setRange] = useState(7);
  const [loading, setLoading] = useState(true);
  const [chartMode, setChartMode] = useState<ChartMode>("net");
  const [calendarMode, setCalendarMode] = useState<"calorie" | "exercise">("calorie");

  const fetchData = useCallback(() => {
    setLoading(true);
    return fetch(`/api/summary?range=${range}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [range, refreshKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner />
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
  const calendarDays = buildCalendarDays(data.dailyStats, data.goal, calendarMode);

  return (
    <PullToRefresh onRefresh={fetchData} className="px-4 py-4 space-y-4">
      {/* 期間切り替え */}
      <div
        className="flex rounded-xl p-1 border border-white/40"
        style={{
          background: "rgba(255,255,255,0.45)",
          backdropFilter: "blur(16px) saturate(180%)",
          WebkitBackdropFilter: "blur(16px) saturate(180%)",
        }}
      >
        {[7, 14, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setRange(d)}
            className={`flex-1 py-2 rounded-[10px] text-[13px] font-semibold transition-all ${
              range === d
                ? "bg-white/90 text-green-700 shadow-sm"
                : "text-gray-500"
            }`}
          >
            {d}日
          </button>
        ))}
      </div>

      {/* ヒーローカード: 目標進捗（最も重要） */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200/60">
        <div className="text-[13px] font-bold text-gray-800 mb-3 flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-green-500"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg>
          目標の進捗
        </div>
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
                <div className="text-[11px] text-gray-400 font-medium flex items-center justify-end gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M8 1a7 7 0 100 14A7 7 0 008 1zM5.657 5.657a4 4 0 015.033.391.75.75 0 001.06-1.06 5.5 5.5 0 00-6.92-.537.75.75 0 10.827 1.252V5.657z" clipRule="evenodd" /></svg>
                  現在
                </div>
                <div className="text-lg font-bold text-gray-800">{latestWeight}<span className="text-[11px] text-gray-400 ml-0.5">kg</span></div>
              </div>
            )}
            {bmr && (
              <div>
                <div className="text-[11px] text-gray-400 font-medium flex items-center justify-end gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3"><path d="M8 1a.75.75 0 01.75.75v6.5a.75.75 0 01-1.5 0v-6.5A.75.75 0 018 1zM3 9.5a5 5 0 0110 0c0 2.21-2.239 4.5-5 4.5S3 11.71 3 9.5z" /></svg>
                  基礎代謝
                </div>
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

      {/* 平均実質カロリー + ダイエットアドバイス */}
      {days > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-gray-200/60">
          <div className="text-[13px] font-bold text-gray-800 mb-2 flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-green-500"><path d="M12.5 16.5a.75.75 0 01-.75-.75v-9.5a.75.75 0 011.5 0v9.5a.75.75 0 01-.75.75zM7.5 16.5a.75.75 0 01-.75-.75V10a.75.75 0 011.5 0v5.75a.75.75 0 01-.75.75zM10 16.5a.75.75 0 01-.75-.75v-7.5a.75.75 0 011.5 0v7.5a.75.75 0 01-.75.75z" /></svg>
            実質カロリー
            <span className="text-[11px] text-gray-400 font-medium ml-1">{range}日平均</span>
          </div>
          <div className="flex items-baseline gap-1 mb-2">
            <span className="text-[28px] font-extrabold text-gray-900">{avgNet}</span>
            <span className="text-sm text-gray-400 font-medium">kcal</span>
          </div>
          {(() => {
            const target = data.goal?.daily_calorie_target;
            const insights: string[] = [];

            // カロリー傾向分析
            const sortedDates = Object.keys(data.dailyStats).sort();
            const recentDays = sortedDates.slice(-7);
            const olderDays = sortedDates.slice(-14, -7);

            if (recentDays.length >= 3) {
              const recentAvg = recentDays.reduce((s, d) => s + (data.dailyStats[d].calories - data.dailyStats[d].burned), 0) / recentDays.length;
              if (olderDays.length >= 3) {
                const olderAvg = olderDays.reduce((s, d) => s + (data.dailyStats[d].calories - data.dailyStats[d].burned), 0) / olderDays.length;
                const trendDiff = Math.round(recentAvg - olderAvg);
                if (trendDiff > 100) {
                  insights.push(`直近7日は前の週より平均${trendDiff}kcal増加傾向`);
                } else if (trendDiff < -100) {
                  insights.push(`直近7日は前の週より平均${Math.abs(trendDiff)}kcal減少。いい流れです`);
                }
              }
            }

            // 目標との乖離
            if (target) {
              const diff = avgNet - target;
              if (Math.abs(diff) >= 50) {
                if (diff > 0) {
                  const weeklyOver = diff * 7;
                  insights.push(`1週間で約${weeklyOver}kcal分の余剰。体脂肪に換算すると週${(weeklyOver / 7700).toFixed(1)}kg相当`);
                } else {
                  if (goalDiff && goalDiff > 0 && goalMonths) {
                    insights.push(`目標体重まであと${goalDiff.toFixed(1)}kg。今のペースなら約${goalMonths}ヶ月で達成見込み`);
                  } else {
                    insights.push(`目標より平均${Math.abs(diff)}kcal少なめで推移中`);
                  }
                }
              } else {
                insights.push("目標カロリーをほぼ達成できています");
              }
            }

            // PFCバランス
            const totalP = Object.values(data.dailyStats).reduce((s, d) => s + d.protein, 0);
            const totalC = Object.values(data.dailyStats).reduce((s, d) => s + d.carbs, 0);
            const totalF = Object.values(data.dailyStats).reduce((s, d) => s + d.fat, 0);
            const pfcTotal = totalP * 4 + totalC * 4 + totalF * 9;
            if (pfcTotal > 0 && days >= 3) {
              const pRatio = Math.round((totalP * 4 / pfcTotal) * 100);
              const fRatio = Math.round((totalF * 9 / pfcTotal) * 100);
              if (pRatio < 15) insights.push(`タンパク質が${pRatio}%と不足気味。筋肉維持のため20%以上を目指しましょう`);
              if (fRatio > 30) insights.push(`脂質が${fRatio}%とやや高め。揚げ物を焼き・蒸しに変えると改善しやすいです`);
            }

            // 運動
            const exerciseDays = Object.values(data.dailyStats).filter(d => d.burned > 0).length;
            if (days >= 7) {
              const exRate = Math.round((exerciseDays / days) * 100);
              if (exRate < 30) insights.push(`運動した日が${exRate}%。週3回を目標にすると代謝が上がりやすくなります`);
            }

            if (insights.length === 0) return null;
            return (
              <div className="space-y-1">
                {insights.map((t, i) => (
                  <div key={i} className="text-[13px] text-gray-600 leading-relaxed flex gap-2">
                    <span className="shrink-0 text-green-400 mt-0.5">•</span>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

        {/* 達成カレンダー */}
        {(data.goal || calendarMode === "exercise") && calendarDays.length > 0 && (
          <div className="bg-white rounded-2xl p-4 border border-gray-200/60">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[13px] font-bold text-gray-800 flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-green-500"><path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z" clipRule="evenodd" /></svg>
                カレンダー
              </div>
              <div className="flex bg-gray-100 rounded-xl p-0.5">
                {([["calorie", "カロリー"], ["exercise", "運動"]] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setCalendarMode(key)}
                    className={`px-4 py-1.5 rounded-[10px] text-[12px] font-semibold transition-all ${
                      calendarMode === key
                        ? "bg-white text-gray-800 shadow-sm"
                        : "text-gray-400"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-hidden">
              <div className="grid grid-cols-7 text-center mb-2">
                {["月","火","水","木","金","土","日"].map((d) => (
                  <div key={d} className="text-[12px] text-gray-400 font-medium py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {calendarDays.map((day, i) => (
                  <div key={i} className="flex items-center justify-center py-[6px]">
                    {day.blank ? (
                      <div className="w-8 h-8" />
                    ) : (
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold ${
                          calendarMode === "exercise"
                            ? (day.status === "good"
                              ? "bg-orange-100 text-orange-600"
                              : "text-gray-800")
                            : (day.status === "good"
                              ? "bg-green-100 text-green-600"
                              : day.status === "over"
                                ? "bg-red-50 text-red-400"
                                : "text-gray-800")
                        }`}
                      >
                        {day.dayNum}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3 mt-2 text-[11px] text-gray-400">
              {calendarMode === "calorie" ? (
                <>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-100 inline-block" /> 達成</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-50 inline-block" /> 超過</span>
                </>
              ) : (
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-orange-100 inline-block" /> 運動した</span>
              )}
            </div>
          </div>
        )}

      {/* カロリー推移グラフ */}
      <div className="bg-white rounded-2xl p-4 border border-gray-200/60">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[13px] font-bold text-gray-800 flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-green-500"><path d="M15.5 2A1.5 1.5 0 0014 3.5v13a1.5 1.5 0 001.5 1.5h1a1.5 1.5 0 001.5-1.5v-13A1.5 1.5 0 0016.5 2h-1zM9.5 6A1.5 1.5 0 008 7.5v9A1.5 1.5 0 009.5 18h1a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0010.5 6h-1zM3.5 10A1.5 1.5 0 002 11.5v5A1.5 1.5 0 003.5 18h1A1.5 1.5 0 006 16.5v-5A1.5 1.5 0 004.5 10h-1z" /></svg>
            カロリー推移
          </div>
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
      <div className="bg-white rounded-2xl p-4 border border-gray-200/60">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[13px] font-bold text-gray-800 flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-blue-500"><path d="M10 1a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 1zM5.05 3.05a.75.75 0 011.06 0l1.062 1.06A.75.75 0 116.11 5.173L5.05 4.11a.75.75 0 010-1.06zm9.9 0a.75.75 0 010 1.06l-1.06 1.062a.75.75 0 01-1.062-1.061l1.061-1.06a.75.75 0 011.06 0zM3 8a7 7 0 1114 0A7 7 0 013 8zm4-1a.75.75 0 000 1.5h2.25V10a.75.75 0 001.5 0V8.5H13a.75.75 0 000-1.5h-2.25V5.5a.75.75 0 00-1.5 0V7H7z" clipRule="evenodd" /></svg>
            体重推移
          </div>
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
    </PullToRefresh>
  );
}

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildCalendarDays(
  dailyStats: DailyStats,
  goal: Goal | null,
  mode: "calorie" | "exercise" = "calorie"
): { dayNum: number; status: "good" | "over" | "nodata" | "future"; label: string; blank?: boolean }[] {
  const today = new Date();
  today.setHours(23, 59, 59, 999); // 今日の終わりまで含める
  const todayStr = toLocalDateStr(today);

  // 当月1日から表示
  const startDate = new Date(today.getFullYear(), today.getMonth(), 1);

  // 月曜始まりに揃える（1日より前は空白）
  const dow = startDate.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const startDay = new Date(startDate);
  startDay.setDate(startDay.getDate() + mondayOffset);

  const result: { dayNum: number; status: "good" | "over" | "nodata" | "future"; label: string; blank?: boolean }[] = [];

  const current = new Date(startDay);
  while (toLocalDateStr(current) <= todayStr) {
    const dateStr = toLocalDateStr(current);
    const dayNum = current.getDate();

    if (current < startDate) {
      result.push({ dayNum, status: "nodata", label: "", blank: true });
    } else {
      const stats = dailyStats[dateStr];
      if (mode === "exercise") {
        if (stats?.hasExercise) {
          result.push({ dayNum, status: "good", label: `${dateStr}: 運動した` });
        } else {
          result.push({ dayNum, status: "nodata", label: dateStr });
        }
      } else {
        if (goal && stats && stats.calories > 0) {
          const net = stats.calories - stats.burned;
          const status = net <= goal.daily_calorie_target ? "good" : "over";
          result.push({ dayNum, status, label: `${dateStr}: ${net}/${goal.daily_calorie_target} kcal` });
        } else {
          result.push({ dayNum, status: "nodata", label: dateStr });
        }
      }
    }

    current.setDate(current.getDate() + 1);
    if (result.length > 100) break;
  }

  return result;
}
