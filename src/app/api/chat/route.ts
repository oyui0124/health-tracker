import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { getSupabase } from "@/lib/supabase";

function getGroq() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");
  return new Groq({ apiKey });
}

function getToday() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().split("T")[0];
}

// --- Web検索で栄養情報を取得 ---
async function searchNutritionInfo(query: string): Promise<string> {
  try {
    const searchQuery = encodeURIComponent(`${query} カロリー 栄養成分 PFC`);
    const res = await fetch(
      `https://html.duckduckgo.com/html/?q=${searchQuery}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; HealthTracker/1.0)",
        },
      }
    );
    const html = await res.text();

    // 検索結果からスニペット+URLを抽出
    const results: { snippet: string; url: string }[] = [];

    // URLを抽出
    const urlMatches = [...html.matchAll(/<a class="result__a" href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)];
    const snippetMatches = [...html.matchAll(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)];

    for (let i = 0; i < Math.min(snippetMatches.length, 5); i++) {
      const snippet = snippetMatches[i][1]
        .replace(/<\/?b>/g, "")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .trim();
      const url = urlMatches[i]
        ? decodeURIComponent(
            urlMatches[i][1].replace(/.*uddg=/, "").replace(/&.*/, "")
          )
        : "";
      if (snippet) results.push({ snippet, url });
    }

    if (results.length === 0) return "";
    return `\n## Web検索結果（「${query}」の栄養情報）:\n${results.map((r, i) => `${i + 1}. ${r.snippet}${r.url ? `\n   出典: ${r.url}` : ""}`).join("\n")}`;
  } catch (e) {
    console.error("Nutrition search error:", e);
    return "";
  }
}

// ブランド・チェーン名を検出してWeb検索
async function fetchNutritionContext(message: string): Promise<string> {
  // ブランド/チェーン/商品名のパターン
  const brandPatterns = [
    // コンビニ
    /セブン|ファミマ|ローソン|ミニストップ/,
    // ファストフード
    /マック|マクド|モス|バーガーキング|ケンタ|KFC|サブウェイ|ウェンディーズ/,
    // チェーン店
    /松屋|吉野家|すき家|なか卯|CoCo壱|ココイチ|丸亀|はなまる|日高屋|幸楽苑|天下一品|一蘭|一風堂/,
    /サイゼ|サイゼリヤ|ガスト|デニーズ|ジョイフル|ロイホ|バーミヤン|夢庵/,
    /スタバ|タリーズ|ドトール|コメダ/,
    /大戸屋|やよい軒|さぼてん|かつや|松のや/,
    /くら寿司|スシロー|はま寿司|かっぱ寿司/,
    // 商品名
    /ファミチキ|からあげクン|Lチキ|ビッグマック|てりやき|チキンマック|ナゲット|フィレオフィッシュ/,
    /フラペチーノ|ラテ|アメリカーノ/,
    // 一般ブランド
    /カップヌードル|どん兵衛|赤いきつね|ペヤング|U\.F\.O/,
    /ポカリ|アクエリ|モンスター|レッドブル/,
  ];

  const matched = brandPatterns.some((p) => p.test(message));
  if (!matched) return "";

  // メッセージから食品名を抽出してWeb検索
  return await searchNutritionInfo(message);
}

const CHAT_SYSTEM_PROMPT = `あなたは優しくて知識豊富なパーソナル健康管理アシスタントです。
ユーザーが日本語で食事、体重、運動を報告してくるので、アドバイスを返してください。

## あなたの役割
1. ユーザーの入力に対して健康的なアドバイスを返す
2. カロリーや栄養素について説明する
3. 今日の摂取状況をまとめる
4. 目標に対するアドバイスを返す

## カロリー・栄養素について
- Web検索結果が提供されている場合は、必ずその情報を優先して使用し、出典URLも回答に含める（例:「出典: https://...」）
- ユーザーが過去に「これは○○kcalだよ」と教えてくれた情報（ユーザー定義の栄養情報）がある場合は、それを最優先で使用する
- ブランド商品の場合は「📌公式値:」と表記し、出典URLを添える
- 一般食品の場合は「📊成分表:」と表記
- 推定の場合は「🔄推定:」と表記
- カロリーの内訳（P/F/C）を簡潔に添える

## ユーザーからのカロリー訂正
- ユーザーが「これは実は○○kcalだよ」「○○のカロリーは△△だよ」と教えてくれた場合、それを記憶として保存するので、以降はその値を使用する

## 重要
- 励ましの言葉を忘れない
- 目標に対する進捗を定期的に伝える
- PFCバランスについてアドバイスする（理想は P:15-20%, F:20-30%, C:50-65%）
- 基礎代謝を下回らないよう注意喚起する
- JSONやデータ構造は絶対に出力しない（別システムが処理する）`;

const EXTRACT_SYSTEM_PROMPT = `ユーザーのメッセージから食事・体重・運動のデータを抽出してJSONで返してください。
データがない場合（雑談・質問など）は {"entries": []} を返してください。

Web検索結果が提供されている場合は、必ずその栄養情報を使ってください。
ユーザー定義の栄養情報が提供されている場合は、それを最優先で使ってください。

今日の日付: {{TODAY}}

ルール:
- meal_type は "breakfast", "lunch", "dinner", "snack" のいずれか
- 時間帯の目安: 朝=breakfast, 昼=lunch, 夜/夕=dinner, 間食/おやつ=snack
- 「昨日」「一昨日」等は日付を計算
- カロリー・PFCは数値のみ（単位不要）
- 削除・編集はIDが必要（既存記録のIDリストを参照）
- ユーザーが「○○は△△kcalだよ」と栄養情報を教えてくれた場合は、food_memoriesに追加する

返すJSON形式:
{
  "entries": [
    {
      "action": "add",
      "type": "meal",
      "date": "YYYY-MM-DD",
      "meal_type": "breakfast|lunch|dinner|snack",
      "description": "食事の説明",
      "calories": 数値,
      "protein": 数値,
      "carbs": 数値,
      "fat": 数値
    }
  ],
  "food_memories": [
    {
      "food_name": "食品名",
      "calories": 数値,
      "protein": 数値,
      "carbs": 数値,
      "fat": 数値,
      "note": "ユーザーが教えてくれた補足情報"
    }
  ]
}

体重: {"entries": [{"action": "add", "type": "weight", "date": "YYYY-MM-DD", "weight": 数値}]}
運動: {"entries": [{"action": "add", "type": "exercise", "date": "YYYY-MM-DD", "description": "説明", "duration_minutes": 数値, "calories_burned": 数値}]}
削除: {"entries": [{"action": "delete", "type": "meal|weight|exercise", "id": "UUID"}]}
編集: {"entries": [{"action": "edit", "type": "meal", "id": "UUID", "updates": {"calories": 500}}]}`;

async function getTodaysSummary() {
  const db = getSupabase();
  const today = getToday();

  const [meals, weight, exercises, goals] = await Promise.all([
    db.from("meal_logs").select("*").eq("date", today),
    db.from("weight_logs").select("*").order("date", { ascending: false }).limit(5),
    db.from("exercise_logs").select("*").eq("date", today),
    db.from("user_goals").select("*").order("created_at", { ascending: false }).limit(1),
  ]);

  const totalCalories = meals.data?.reduce((sum: number, m: { calories?: number }) => sum + (m.calories || 0), 0) || 0;
  const totalBurned = exercises.data?.reduce((sum: number, e: { calories_burned?: number }) => sum + (e.calories_burned || 0), 0) || 0;
  const totalProtein = meals.data?.reduce((sum: number, m: { protein?: number }) => sum + (m.protein || 0), 0) || 0;
  const totalCarbs = meals.data?.reduce((sum: number, m: { carbs?: number }) => sum + (m.carbs || 0), 0) || 0;
  const totalFat = meals.data?.reduce((sum: number, m: { fat?: number }) => sum + (m.fat || 0), 0) || 0;
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
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

  const [weights, dailyCalories] = await Promise.all([
    db.from("weight_logs").select("date, weight").gte("date", weekAgo).order("date"),
    db.from("meal_logs").select("date, calories").gte("date", weekAgo).order("date"),
  ]);

  const caloriesByDate: Record<string, number> = {};
  dailyCalories.data?.forEach((m: { date: string; calories: number }) => {
    caloriesByDate[m.date] = (caloriesByDate[m.date] || 0) + m.calories;
  });

  return `
## 直近7日間の推移
### 体重:
${weights.data?.map((w: { date: string; weight: number }) => `- ${w.date}: ${w.weight} kg`).join("\n") || "記録なし"}

### 日別カロリー:
${Object.entries(caloriesByDate).map(([d, c]) => `- ${d}: ${c} kcal`).join("\n") || "記録なし"}
`;
}

const TABLE_MAP: Record<string, string> = {
  meal: "meal_logs",
  weight: "weight_logs",
  exercise: "exercise_logs",
};

async function processEntries(parsed: { entries: Array<Record<string, unknown>> }) {
  const db = getSupabase();
  const today = getToday();
  const results: string[] = [];

  for (const entry of parsed.entries) {
    const action = (entry.action as string) || "add";
    const entryDate = (entry.date as string) || today;

    try {
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
          if (error) {
            console.error("meal insert error:", error);
            results.push(`❌ 食事の保存失敗: ${error.message}`);
          } else {
            results.push(`✅ 食事を記録: ${entry.description}`);
          }
        } else if (entry.type === "weight") {
          const { error } = await db
            .from("weight_logs")
            .upsert({ date: entryDate, weight: entry.weight }, { onConflict: "date" });
          if (error) {
            console.error("weight upsert error:", error);
            results.push(`❌ 体重の保存失敗: ${error.message}`);
          } else {
            results.push(`✅ 体重を記録: ${entry.weight}kg`);
          }
        } else if (entry.type === "exercise") {
          const { error } = await db.from("exercise_logs").insert({
            date: entryDate,
            description: entry.description,
            duration_minutes: entry.duration_minutes,
            calories_burned: entry.calories_burned,
          });
          if (error) {
            console.error("exercise insert error:", error);
            results.push(`❌ 運動の保存失敗: ${error.message}`);
          } else {
            results.push(`✅ 運動を記録: ${entry.description}`);
          }
        }
      } else if (action === "delete" && entry.id) {
        const table = TABLE_MAP[entry.type as string];
        if (table) {
          const { data: old } = await db.from(table).select("*").eq("id", entry.id).single();
          if (old) {
            await db.from("change_log").insert({
              action: "delete",
              table_name: table,
              record_id: entry.id,
              old_data: old,
            });
            await db.from(table).delete().eq("id", entry.id);
            results.push(`✅ 記録を削除`);
          }
        }
      } else if (action === "edit" && entry.id && entry.updates) {
        const table = TABLE_MAP[entry.type as string];
        if (table) {
          const { data: old } = await db.from(table).select("*").eq("id", entry.id).single();
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
            results.push(`✅ 記録を修正`);
          }
        }
      }
    } catch (e) {
      console.error("Error processing entry:", e);
      results.push(`❌ エラー: ${e}`);
    }
  }
  return results;
}

export async function POST(req: NextRequest) {
  try {
    const db = getSupabase();
    const { message } = await req.json();
    const today = getToday();
    const groq = getGroq();

    // コンテキスト情報、Web栄養検索、ユーザー定義栄養情報を並列取得
    const [todaySummary, recentHistory, nutritionContext, foodMemories] = await Promise.all([
      getTodaysSummary(),
      getRecentHistory(),
      fetchNutritionContext(message),
      db.from("food_memories").select("*").order("created_at", { ascending: false }).limit(50)
        .then(r => r.data || []),
    ]);

    // ユーザー定義の栄養情報をコンテキストに追加
    const foodMemoryContext = foodMemories.length > 0
      ? `\n## ユーザーが教えてくれた栄養情報（最優先で使用）:\n${foodMemories.map((f: { food_name: string; calories: number; protein?: number; carbs?: number; fat?: number; note?: string }) => `- ${f.food_name}: ${f.calories}kcal${f.protein ? ` P:${f.protein}g` : ""}${f.carbs ? ` C:${f.carbs}g` : ""}${f.fat ? ` F:${f.fat}g` : ""}${f.note ? ` (${f.note})` : ""}`).join("\n")}`
      : "";

    // 直近のチャット履歴を取得
    const { data: chatHistory } = await db
      .from("chat_messages")
      .select("role, content")
      .order("created_at", { ascending: false })
      .limit(20);

    const contextInfo = `${todaySummary}\n${recentHistory}${nutritionContext}${foodMemoryContext}`;

    // --- 2つのLLM呼び出しを並列実行 ---

    // 呼び出し1: チャット応答を生成
    const chatPromise = groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `${CHAT_SYSTEM_PROMPT}\n\n${contextInfo}`,
        },
        ...(chatHistory || [])
          .reverse()
          .map((m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        { role: "user" as const, content: message },
      ],
      max_tokens: 1024,
      temperature: 0.7,
    });

    // 呼び出し2: データ抽出（JSON mode強制）
    const extractPromise = groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: EXTRACT_SYSTEM_PROMPT.replace("{{TODAY}}", today) + `\n\n${contextInfo}`,
        },
        { role: "user", content: message },
      ],
      max_tokens: 512,
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const [chatResponse, extractResponse] = await Promise.all([chatPromise, extractPromise]);

    const assistantMessage = chatResponse.choices[0]?.message?.content || "";
    const extractedJson = extractResponse.choices[0]?.message?.content || "{}";

    // データ抽出結果を処理
    let saveResults: string[] = [];
    try {
      const parsed = JSON.parse(extractedJson);
      console.log("Extracted data:", JSON.stringify(parsed).slice(0, 300));
      if (parsed?.entries?.length > 0) {
        saveResults = await processEntries(parsed);
        console.log("Save results:", saveResults);
      }
      // ユーザーが教えてくれた栄養情報を保存
      if (parsed?.food_memories?.length > 0) {
        for (const mem of parsed.food_memories) {
          const { error } = await db.from("food_memories").upsert(
            {
              food_name: mem.food_name,
              calories: mem.calories,
              protein: mem.protein || null,
              carbs: mem.carbs || null,
              fat: mem.fat || null,
              note: mem.note || null,
            },
            { onConflict: "food_name" }
          );
          if (error) console.error("food_memory save error:", error);
          else console.log("Saved food memory:", mem.food_name);
        }
      }
    } catch (e) {
      console.error("JSON parse error:", e, "Raw:", extractedJson.slice(0, 200));
    }

    // メッセージを保存
    const cleanMessage = assistantMessage.replace(/```json[\s\S]*?```\n?/g, "").trim();

    await db.from("chat_messages").insert({ role: "user", content: message });
    await db.from("chat_messages").insert({ role: "assistant", content: cleanMessage });

    return NextResponse.json({ message: cleanMessage });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "メッセージの処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
