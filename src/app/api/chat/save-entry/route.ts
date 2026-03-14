import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

function getToday() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split("T")[0];
}

const TABLE_MAP: Record<string, string> = {
  meal: "meal_logs",
  weight: "weight_logs",
  exercise: "exercise_logs",
};

export async function POST(req: NextRequest) {
  try {
    const db = getSupabase();
    const { entry } = await req.json();
    const today = getToday();
    const action = (entry.action as string) || "add";
    const entryDate = (entry.date as string) || today;

    if (action === "add") {
      if (entry.type === "meal") {
        const { error } = await db.from("meal_logs").insert({
          date: entryDate,
          meal_type: entry.meal_type,
          description: entry.description,
          calories: entry.calories,
          protein: entry.protein,
          carbs: entry.carbs,
          fat: entry.fat,
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true, message: `食事を記録: ${entry.description}` });
      } else if (entry.type === "weight") {
        const { error } = await db
          .from("weight_logs")
          .upsert({ date: entryDate, weight: entry.weight }, { onConflict: "date" });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true, message: `体重を記録: ${entry.weight}kg` });
      } else if (entry.type === "exercise") {
        const { error } = await db.from("exercise_logs").insert({
          date: entryDate,
          description: entry.description,
          duration_minutes: entry.duration_minutes,
          calories_burned: entry.calories_burned,
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true, message: `運動を記録: ${entry.description}` });
      }
    } else if (action === "delete" && entry.id) {
      const table = TABLE_MAP[entry.type as string];
      if (table) {
        const { data: old } = await db.from(table).select("*").eq("id", entry.id).single();
        if (old) {
          await db.from("change_log").insert({ action: "delete", table_name: table, record_id: entry.id, old_data: old });
          await db.from(table).delete().eq("id", entry.id);
          return NextResponse.json({ ok: true, message: "記録を削除しました" });
        }
      }
    } else if (action === "edit" && entry.id && entry.updates) {
      const table = TABLE_MAP[entry.type as string];
      if (table) {
        const { data: old } = await db.from(table).select("*").eq("id", entry.id).single();
        if (old) {
          const { error } = await db.from(table).update(entry.updates).eq("id", entry.id);
          if (error) return NextResponse.json({ error: error.message }, { status: 500 });
          await db.from("change_log").insert({ action: "edit", table_name: table, record_id: entry.id, old_data: old, new_data: entry.updates });
          return NextResponse.json({ ok: true, message: "記録を修正しました" });
        }
      }
    }

    return NextResponse.json({ error: "不明なアクション" }, { status: 400 });
  } catch (error) {
    console.error("Save entry error:", error);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}
