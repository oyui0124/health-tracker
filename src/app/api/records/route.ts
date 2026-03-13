import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

function getToday() {
  return new Date().toISOString().split("T")[0];
}

// 今日の記録を取得
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || getToday();

  try {
    const db = getSupabase();

    const [meals, exercises, weights] = await Promise.all([
      db
        .from("meal_logs")
        .select("*")
        .eq("date", date)
        .order("created_at", { ascending: true }),
      db
        .from("exercise_logs")
        .select("*")
        .eq("date", date)
        .order("created_at", { ascending: true }),
      db.from("weight_logs").select("*").eq("date", date),
    ]);

    return NextResponse.json({
      meals: meals.data || [],
      exercises: exercises.data || [],
      weights: weights.data || [],
    });
  } catch (error) {
    console.error("Records API error:", error);
    return NextResponse.json(
      { error: "データの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// 記録を削除
export async function DELETE(req: NextRequest) {
  try {
    const { type, id } = await req.json();
    const db = getSupabase();

    const tableMap: Record<string, string> = {
      meal: "meal_logs",
      exercise: "exercise_logs",
      weight: "weight_logs",
    };

    const table = tableMap[type];
    if (!table || !id) {
      return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });
    }

    // 変更履歴を保存
    const { data: old } = await db
      .from(table)
      .select("*")
      .eq("id", id)
      .single();

    if (old) {
      await db.from("change_log").insert({
        action: "delete",
        table_name: table,
        record_id: id,
        old_data: old,
      });
    }

    await db.from(table).delete().eq("id", id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Records DELETE error:", error);
    return NextResponse.json(
      { error: "削除に失敗しました" },
      { status: 500 }
    );
  }
}

// 記録を編集
export async function PATCH(req: NextRequest) {
  try {
    const { type, id, updates } = await req.json();
    const db = getSupabase();

    const tableMap: Record<string, string> = {
      meal: "meal_logs",
      exercise: "exercise_logs",
      weight: "weight_logs",
    };

    const table = tableMap[type];
    if (!table || !id || !updates) {
      return NextResponse.json({ error: "不正なリクエスト" }, { status: 400 });
    }

    // 変更履歴を保存
    const { data: old } = await db
      .from(table)
      .select("*")
      .eq("id", id)
      .single();

    if (old) {
      await db.from("change_log").insert({
        action: "edit",
        table_name: table,
        record_id: id,
        old_data: old,
        new_data: updates,
      });
    }

    await db.from(table).update(updates).eq("id", id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Records PATCH error:", error);
    return NextResponse.json(
      { error: "更新に失敗しました" },
      { status: 500 }
    );
  }
}
