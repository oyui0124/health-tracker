import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  try {
    const db = getSupabase();
    // 直近3時間のチャット履歴を取得
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

    const { data } = await db
      .from("chat_messages")
      .select("role, content")
      .gte("created_at", threeHoursAgo)
      .order("created_at", { ascending: true })
      .limit(50);

    return NextResponse.json({
      messages: (data || []).map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });
  } catch (error) {
    console.error("Chat history error:", error);
    return NextResponse.json({ messages: [] });
  }
}
