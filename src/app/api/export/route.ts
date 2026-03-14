import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const range = parseInt(searchParams.get("range") || "30");
  const startDate = new Date(Date.now() - range * 86400000)
    .toISOString()
    .split("T")[0];

  try {
    const db = getSupabase();

    const [meals, exercises, weights] = await Promise.all([
      db.from("meal_logs").select("*").gte("date", startDate).order("date"),
      db.from("exercise_logs").select("*").gte("date", startDate).order("date"),
      db.from("weight_logs").select("*").gte("date", startDate).order("date"),
    ]);

    const lines: string[] = [
      "日付,種別,内容,カロリー(kcal),タンパク質(g),脂質(g),炭水化物(g),時間(分),体重(kg)",
    ];

    meals.data?.forEach((m: { date: string; meal_type: string; description: string; calories: number; protein?: number; fat?: number; carbs?: number }) => {
      const mealLabel: Record<string, string> = { breakfast: "朝食", lunch: "昼食", dinner: "夕食", snack: "間食" };
      lines.push(
        `${m.date},${mealLabel[m.meal_type] || m.meal_type},"${(m.description || "").replace(/"/g, '""')}",${m.calories || 0},${m.protein || 0},${m.fat || 0},${m.carbs || 0},,`
      );
    });

    exercises.data?.forEach((e: { date: string; description: string; calories_burned: number; duration_minutes: number }) => {
      lines.push(
        `${e.date},運動,"${(e.description || "").replace(/"/g, '""')}",${-(e.calories_burned || 0)},,,,,${e.duration_minutes || 0},`
      );
    });

    weights.data?.forEach((w: { date: string; weight: number }) => {
      lines.push(`${w.date},体重,,,,,,,,${w.weight}`);
    });

    // Sort by date
    const header = lines[0];
    const rows = lines.slice(1).sort();
    const csv = "\uFEFF" + [header, ...rows].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="health-records-${startDate}.csv"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "エクスポートに失敗しました" }, { status: 500 });
  }
}
