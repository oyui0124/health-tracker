import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { getSupabase } from "@/lib/supabase";

function getGroq() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set");
  }
  return new Groq({ apiKey });
}

function getToday() {
  return new Date().toISOString().split("T")[0];
}

const SYSTEM_PROMPT = `あなたは優しくて知識豊富なパーソナル健康管理アシスタントです。
ユーザーが日本語で食事、体重、運動を報告してくるので、それを記録し、アドバイスを返してください。

## あなたの役割
1. ユーザーの入力から食事・体重・運動の情報を抽出してJSON形式で構造化する
2. カロリーや栄養素を推定する
3. 今日の摂取状況をまとめる
4. 目標に対するアドバイスを返す
5. PFC（タンパク質・脂質・炭水化物）バランスについてもアドバイスする
6. 基礎代謝（BMR）を考慮したアドバイスをする

## 応答フォーマット
データを記録する場合は、メッセージの最初に以下のJSONブロックを含めてください。

### 食事の追加：
\`\`\`json
{
  "entries": [
    {
      "action": "add",
      "type": "meal",
      "date": "YYYY-MM-DD",
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

### 体重の追加：
\`\`\`json
{
  "entries": [
    {
      "action": "add",
      "type": "weight",
      "date": "YYYY-MM-DD",
      "weight": 体重kg(数値)
    }
  ]
}
\`\`\`

### 運動の追加：
\`\`\`json
{
  "entries": [
    {
      "action": "add",
      "type": "exercise",
      "date": "YYYY-MM-DD",
      "description": "運動の説明",
      "duration_minutes": 時間(数値),
      "calories_burned": 推定消費カロリー(数値)
    }
  ]
}
\`\`\`

### 記録の削除（ユーザーが削除を依頼した場合）：
\`\`\`json
{
  "entries": [
    {
      "action": "delete",
      "type": "meal|weight|exercise",
      "id": "記録のUUID"
    }
  ]
}
\`\`\`

### 記録の編集（ユーザーが修正を依頼した場合）：
\`\`\`json
{
  "entries": [
    {
      "action": "edit",
      "type": "meal",
      "id": "記録のUUID",
      "updates": { "calories": 500, "description": "修正後の説明" }
    }
  ]
}
\`\`\`

## 日付について
- ユーザーが「昨日」「一昨日」「3/12」「先週の月曜」等と言った場合、適切な日付を計算してdateフィールドに入れてください
- 日付の指定がない場合は今日の日付を使ってください
- dateフィールドは必ず"YYYY-MM-DD"形式で

## 削除・編集について
- ユーザーが「さっきのカレー消して」「朝食の記録を修正して」等と言った場合は、今日の記録一覧に含まれるIDを使って削除・編集してください
- IDがわからない場合は、ユーザーにどの記録を操作するか確認してください

## 重要な注意点
- カロリーは一般的な日本の食事量で推定
- わからない場合は控えめに推定して「推定です」と伝える
- 励ましの言葉を忘れない
- 目標に対する進捗を定期的に伝える
- PFCバランスについてアドバイスする（理想は P:15-20%, F:20-30%, C:50-65%）
- 基礎代謝を下回らないよう注意喚起する`;

async function getTodaysSummary() {
  const db = getSupabase();
  const today = getToday();

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
  const totalProtein =
    meals.data?.reduce(
      (sum: number, m: { protein?: number }) => sum + (m.protein || 0),
      0
    ) || 0;
  const totalCarbs =
    meals.data?.reduce(
      (sum: number, m: { carbs?: number }) => sum + (m.carbs || 0),
      0
    ) || 0;
  const totalFat =
    meals.data?.reduce(
      (sum: number, m: { fat?: number }) => sum + (m.fat || 0),
      0
    ) || 0;
  const goal = goals.data?.[0];

  return `
今日の日付: ${today}

## 今日の記録（${today}）
- 摂取カロリー合計: ${totalCalories} kcal
- 消費カロリー（運動）: ${totalBurned} kcal
- 正味カロリー: ${totalCalories - totalBurned} kcal
- PFC: P=${Math.round(totalProtein)}g / F=${Math.round(totalFat)}g / C=${Math.round(totalCarbs)}g
${goal ? `- 目標カロリー: ${goal.daily_calorie_target} kcal/日` : "- 目標: 未設定"}
${goal ? `- 目標体重: ${goal.target_weight} kg` : ""}
${goal?.height_cm ? `- 身長: ${goal.height_cm} cm` : ""}
${goal?.gender ? `- 性別: ${goal.gender === "male" ? "男性" : "女性"}` : ""}
${weight.data?.length ? `- 最新体重: ${weight.data[0].weight} kg（${weight.data[0].date}）` : "- 体重: 未記録"}

### 今日の食事（ID付き）:
${
  meals.data
    ?.map(
      (m: { id: string; meal_type: string; description: string; calories: number; protein?: number; carbs?: number; fat?: number }) =>
        `- [ID:${m.id}] [${m.meal_type}] ${m.description} (${m.calories}kcal, P:${m.protein || 0}g F:${m.fat || 0}g C:${m.carbs || 0}g)`
    )
    .join("\n") || "まだ記録がありません"
}

### 今日の運動（ID付き）:
${
  exercises.data
    ?.map(
      (e: { id: string; description: string; duration_minutes: number; calories_burned: number }) =>
        `- [ID:${e.id}] ${e.description} ${e.duration_minutes}分 (-${e.calories_burned}kcal)`
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

const TABLE_MAP: Record<string, string> = {
  meal: "meal_logs",
  weight: "weight_logs",
  exercise: "exercise_logs",
};

async function processEntries(parsed: {
  entries: Array<Record<string, unknown>>;
}) {
  const db = getSupabase();
  const today = getToday();

  for (const entry of parsed.entries) {
    const action = (entry.action as string) || "add";
    const entryDate = (entry.date as string) || today;

    try {
      if (action === "add") {
        if (entry.type === "meal") {
          await db.from("meal_logs").insert({
            date: entryDate,
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
            .upsert(
              { date: entryDate, weight: entry.weight },
              { onConflict: "date" }
            );
        } else if (entry.type === "exercise") {
          await db.from("exercise_logs").insert({
            date: entryDate,
            description: entry.description,
            duration_minutes: entry.duration_minutes,
            calories_burned: entry.calories_burned,
          });
        }
      } else if (action === "delete" && entry.id) {
        const table = TABLE_MAP[entry.type as string];
        if (table) {
          const { data: old } = await db
            .from(table)
            .select("*")
            .eq("id", entry.id)
            .single();
          if (old) {
            await db.from("change_log").insert({
              action: "delete",
              table_name: table,
              record_id: entry.id,
              old_data: old,
            });
            await db.from(table).delete().eq("id", entry.id);
          }
        }
      } else if (action === "edit" && entry.id && entry.updates) {
        const table = TABLE_MAP[entry.type as string];
        if (table) {
          const { data: old } = await db
            .from(table)
            .select("*")
            .eq("id", entry.id)
            .single();
          if (old) {
            await db
              .from(table)
              .update(entry.updates as Record<string, unknown>)
              .eq("id", entry.id);
            await db.from("change_log").insert({
              action: "edit",
              table_name: table,
              record_id: entry.id as string,
              old_data: old,
              new_data: entry.updates,
            });
          }
        }
      }
    } catch (e) {
      console.error("Error processing entry:", e);
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

    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      {
        role: "system",
        content: `${SYSTEM_PROMPT}\n\n${todaySummary}\n${recentHistory}`,
      },
      ...(chatHistory || [])
        .reverse()
        .map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      {
        role: "user" as const,
        content: message,
      },
    ];

    const groq = getGroq();
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      max_tokens: 1024,
      temperature: 0.7,
    });

    const assistantMessage = response.choices[0]?.message?.content || "";

    // エントリを解析して保存
    const parsed = parseEntries(assistantMessage);
    if (parsed?.entries) {
      await processEntries(parsed);
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
