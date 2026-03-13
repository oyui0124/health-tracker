import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range") || "7";
  const days = parseInt(range);
  const startDate = new Date(Date.now() - days * 86400000)
    .toISOString()
    .split("T")[0];

  try {
    const db = getSupabase();

    const [meals, weights, exercises, goals] = await Promise.all([
      db.from("meal_logs").select("*").gte("date", startDate).order("date"),
      db.from("weight_logs").select("*").gte("date", startDate).order("date"),
      db
        .from("exercise_logs")
        .select("*")
        .gte("date", startDate)
        .order("date"),
      db
        .from("user_goals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    // 日別集計
    type DayStat = {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      burned: number;
      weight?: number;
    };
    const dailyStats: Record<string, DayStat> = {};

    const ensureDay = (date: string): DayStat => {
      if (!dailyStats[date]) {
        dailyStats[date] = {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          burned: 0,
        };
      }
      return dailyStats[date];
    };

    meals.data?.forEach(
      (m: {
        date: string;
        calories?: number;
        protein?: number;
        carbs?: number;
        fat?: number;
      }) => {
        const day = ensureDay(m.date);
        day.calories += m.calories || 0;
        day.protein += m.protein || 0;
        day.carbs += m.carbs || 0;
        day.fat += m.fat || 0;
      }
    );

    exercises.data?.forEach(
      (e: { date: string; calories_burned?: number }) => {
        const day = ensureDay(e.date);
        day.burned += e.calories_burned || 0;
      }
    );

    weights.data?.forEach((w: { date: string; weight: number }) => {
      const day = ensureDay(w.date);
      day.weight = w.weight;
    });

    return NextResponse.json({
      dailyStats,
      weights: weights.data || [],
      goal: goals.data?.[0] || null,
    });
  } catch (error) {
    console.error("Summary API error:", error);
    return NextResponse.json(
      { error: "データの取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
