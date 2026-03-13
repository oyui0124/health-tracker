import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, date, ...fields } = body;
    const db = getSupabase();

    if (type === "meal") {
      await db.from("meal_logs").insert({
        date,
        meal_type: fields.meal_type || "snack",
        description: fields.description,
        calories: fields.calories || 0,
        protein: fields.protein || 0,
        fat: fields.fat || 0,
        carbs: fields.carbs || 0,
      });
    } else if (type === "exercise") {
      await db.from("exercise_logs").insert({
        date,
        description: fields.description,
        calories_burned: fields.calories_burned || 0,
        duration_minutes: fields.duration_minutes || 0,
      });
    } else if (type === "weight") {
      await db.from("weight_logs").insert({
        date,
        weight: fields.weight || 0,
      });
    } else {
      return NextResponse.json({ error: "不正なタイプ" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Records add error:", error);
    return NextResponse.json(
      { error: "追加に失敗しました" },
      { status: 500 }
    );
  }
}
