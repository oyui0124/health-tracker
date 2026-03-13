import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSupabase } from "@/lib/supabase";

function getGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in environment variables");
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
}

const SYSTEM_PROMPT = `あなたは優しくて知識豊富なパーソナル健康管理アシスタントです。
ユーザーが日本語で食事、体重、運動を報告してくるので、それを記録し、アドバイスを返してください。

## あなたの役割
1. ユーザーの入力から食事・体重・運動の情報を抽出してJSON形式で構造化する
2. カロリーや栄養素を推定する
3. 今日の摂取状況をまとめる
4. 目標に対するアドバイスを返す

## 応答フォーマット
データを記録する場合は、メッセージの最初に以下のJSONブロックを含めてください：
\`\`\`json
{
  "entries": [
    {
      "type": "meal",
      "meal_type": "breakfast|lunch|dinner|snack",
      "description": "食事の説明",
      "calories": 推定カロリー(数値),
      "protein": 推定タンパク質g(数値),
      "carbs": 推定炭水化物g(数値),
      "fat": 推定脂質g(数値)
    }
  ]
}
\`\`\`

体重の場合：
\`\`\`json
{
  "entries": [
    {
      "type": "weight",
      "weight": 体重kg(数値)
    }
  ]
}
\`\`\`

運動の場合：
\`\`\`json
{
  "entries": [
    {
      "type": "exercise",
      "description": "運動の説明",
      "duration_minutes": 時間(数値),
      "calories_burned": 推定消費カロリー(数値)
    }
  ]
}
\`\`\`

データの記録が不要な一般的な会話の場合はJSONブロックを含めないでください。

## 重要な注意点
- カロリーは一般的な日本の食事量で推定
- わからない場合は控えめに推定して「推定です」と伝える
- 励ましの言葉を忘れない
- 目標に対する進捗を定期的に伝える
- 食事のバランスについてアドバイスする`;

async function getTodaysSummary() {
  const db = getSupabase();
  const today = new Date().toISOString().split("T")[0];

  const [meals, weight, exercises, goals] = await Promise.all([
    db.from("meal_logs").select("*").eq("date", today),
    db
      .from("weight_logs")
      .select("*")
      .order("date", { ascending: false })
      .limit(5),
    db.from("exercise_logs").select("*").eq("date", today),
    db
      .from("user_goals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const totalCalories =
    meals.data?.reduce(
      (sum: number, m: { calories?: number }) => sum + (m.calories || 0),
      0
    ) || 0;
  const totalBurned =
    exercises.data?.reduce(
      (sum: number, e: { calories_burned?: number }) =>
        sum + (e.calories_burned || 0),
      0
    ) || 0;
  const goal = goals.data?.[0];

  return `
## 今日の記録（${today}）
- 摂取カロリー合計: ${totalCalories} kcal
- 消費カロリー（運動）: ${totalBurned} kcal
- 正味カロリー: ${totalCalories - totalBurned} kcal
${goal ? `- 目標カロリー: ${goal.daily_calorie_target} kcal/日` : "- 目標: 未設定"}
${goal ? `- 目標体重: ${goal.target_weight} kg` : ""}
${weight.data?.length ? `- 最新体重: ${weight.data[0].weight} kg（${weight.data[0].date}）` : "- 体重: 未記録"}

### 今日の食事:
${
  meals.data
    ?.map(
      (m: { meal_type: string; description: string; calories: number }) =>
        `- [${m.meal_type}] ${m.description} (${m.calories} kcal)`
    )
    .join("\n") || "まだ記録がありません"
}

### 今日の運動:
${
  exercises.data
    ?.map(
      (e: {
        description: string;
        duration_minutes: number;
        calories_burned: number;
      }) => `- ${e.description} ${e.duration_minutes}分 (-${e.calories_burned} kcal)`
    )
    .join("\n") || "まだ記録がありません"
}
`;
}

async function getRecentHistory() {
  const db = getSupabase();
  const weekAgo = new Date(Date.now() - 7 * 86400000)
    .toISOString()
    .split("T")[0];

  const [weights, dailyCalories] = await Promise.all([
    db
      .from("weight_logs")
      .select("date, weight")
      .gte("date", weekAgo)
      .order("date"),
    db
      .from("meal_logs")
      .select("date, calories")
      .gte("date", weekAgo)
      .order("date"),
  ]);

  const caloriesByDate: Record<string, number> = {};
  dailyCalories.data?.forEach((m: { date: string; calories: number }) => {
    caloriesByDate[m.date] = (caloriesByDate[m.date] || 0) + m.calories;
  });

  return `
## 直近7日間の推移
### 体重:
${
  weights.data
    ?.map((w: { date: string; weight: number }) => `- ${w.date}: ${w.weight} kg`)
    .join("\n") || "記録なし"
}

### 日別カロリー:
${
  Object.entries(caloriesByDate)
    .map(([d, c]) => `- ${d}: ${c} kcal`)
    .join("\n") || "記録なし"
}
`;
}

function parseEntries(content: string) {
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[1]);
  } catch {
    return null;
  }
}

async function saveEntries(parsed: {
  entries: Array<Record<string, unknown>>;
}) {
  const db = getSupabase();
  const today = new Date().toISOString().split("T")[0];

  for (const entry of parsed.entries) {
    if (entry.type === "meal") {
      await db.from("meal_logs").insert({
        date: today,
        meal_type: entry.meal_type,
        description: entry.description,
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fat: entry.fat,
      });
    } else if (entry.type === "weight") {
      await db
        .from("weight_logs")
        .upsert({ date: today, weight: entry.weight }, { onConflict: "date" });
    } else if (entry.type === "exercise") {
      await db.from("exercise_logs").insert({
        date: today,
        description: entry.description,
        duration_minutes: entry.duration_minutes,
        calories_burned: entry.calories_burned,
      });
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = getSupabase();
    const { message } = await req.json();

    // コンテキスト情報を取得
    const [todaySummary, recentHistory] = await Promise.all([
      getTodaysSummary(),
      getRecentHistory(),
    ]);

    // 直近のチャット履歴を取得
    const { data: chatHistory } = await db
      .from("chat_messages")
      .select("role, content")
      .order("created_at", { ascending: false })
      .limit(20);

    // Gemini用の履歴を構築
    const history = (chatHistory || [])
      .reverse()
      .map((m: { role: string; content: string }) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const model = getGemini();
    const chat = model.startChat({
      history,
      systemInstruction: {
        role: "user",
        parts: [{ text: `${SYSTEM_PROMPT}\n\n${todaySummary}\n${recentHistory}` }],
      },
    });

    const result = await chat.sendMessage(message);
    const assistantMessage = result.response.text();

    // エントリを解析して保存
    const parsed = parseEntries(assistantMessage);
    if (parsed?.entries) {
      await saveEntries(parsed);
    }

    // ユーザーメッセージとアシスタントメッセージを保存
    const cleanMessage = assistantMessage
      .replace(/```json[\s\S]*?```\n?/g, "")
      .trim();

    await db
      .from("chat_messages")
      .insert({ role: "user", content: message });
    await db
      .from("chat_messages")
      .insert({ role: "assistant", content: cleanMessage });

    return NextResponse.json({ message: cleanMessage });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "メッセージの処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
