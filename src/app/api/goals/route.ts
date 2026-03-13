import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const db = getSupabase();
  const { data, error } = await db
    .from("user_goals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ goal: data?.[0] || null });
}

export async function POST(req: NextRequest) {
  const db = getSupabase();
  const { target_weight, daily_calorie_target, height_cm, birth_date, gender } =
    await req.json();

  const { data, error } = await db
    .from("user_goals")
    .insert({
      target_weight,
      daily_calorie_target,
      height_cm,
      birth_date,
      gender,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ goal: data });
}
