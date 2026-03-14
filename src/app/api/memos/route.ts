import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");

  try {
    const db = getSupabase();
    let query = db.from("daily_memos").select("*").order("date", { ascending: false });
    if (date) {
      query = query.eq("date", date);
    } else {
      query = query.limit(30);
    }
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error) {
    console.error("Memo GET error:", error);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { date, content } = await req.json();
    if (!date || !content?.trim()) {
      return NextResponse.json({ error: "date and content required" }, { status: 400 });
    }

    const db = getSupabase();
    const { data, error } = await db
      .from("daily_memos")
      .upsert({ date, content: content.trim() }, { onConflict: "date" })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    console.error("Memo POST error:", error);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { date } = await req.json();
    if (!date) {
      return NextResponse.json({ error: "date required" }, { status: 400 });
    }

    const db = getSupabase();
    const { error } = await db.from("daily_memos").delete().eq("date", date);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Memo DELETE error:", error);
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
}
