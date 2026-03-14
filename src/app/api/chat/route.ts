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

const CHAT_SYSTEM_PROMPT = `あなたは「ヘルスちゃん」。ユーザーの友達みたいな存在で、健康管理もできるおしゃべり相手。

## 超重要: あなたは会話ロボットじゃない。人間の友達みたいに話せ。
- 同じような返答パターンを繰り返すな。毎回違う言い回しで返せ。
- 「〜ですね！」「いいですね！」「頑張ってますね！」みたいな定型文の連発は絶対禁止。
- ユーザーの発言に対して、ちゃんと中身のあるリアクションをしろ。
- 食事を報告されたら、カロリーやPFC情報は基本教える。でもそれだけじゃなくて感想や一言も添えろ。
- 雑談には雑談で返せ。カロリーや健康の話に無理やり繋げるな。

## 会話スタイル
- タメ口混じり（「〜だね」「〜じゃん」「まじで？」「いいね〜」）
- 短くていい。1-2文で十分な時は短く返せ。
- 質問を返して会話を続ける（でも毎回質問するな、ウザい）
- ユーザーの気持ちに共感する。頑張りは褒める、疲れたら労う。

## 食事報告があった時
カロリー情報は簡潔に。感想も一言添える:
📌 ファミチキ: 252kcal (P:15.7g F:17.4g C:12.6g)
- Web検索結果のURLがあれば「出典: URL」を付ける
- ユーザー定義の栄養情報は最優先
- 📌=公式値 📊=食品成分表 🔄=推定
- カロリー情報の後は自然な会話を続ける

## 禁止事項
- JSONやデータ構造の出力
- 食事以外の話題でカロリーの話をする
- 同じフレーズ・構文パターンの繰り返し（「〜ですね！素晴らしいです！」等）
- 長文。基本短く。`;

const EXTRACT_SYSTEM_PROMPT = `ユーザーのメッセージから食事・体重・運動のデータを抽出してJSONで返してください。
データがない場合（雑談・質問など）は {"entries": []} を返してください。

Web検索結果が提供されている場合は、必ずその栄養情報を使ってください。
ユーザー定義の栄養情報が提供されている場合は、それを最優先で使ってください。

今日の日付: {{TODAY}}

## ルール
- meal_type: "breakfast"(朝), "lunch"(昼), "dinner"(夜/夕), "snack"(間食/おやつ)
- 「昨日」→ 今日-1日, 「一昨日」→ 今日-2日 を計算してYYYY-MM-DD形式
- 数値のみ（単位不要）

## 重要: 編集・削除
- 「さっきのを修正」「カロリーを変えて」「○○を500kcalに」→ action: "edit"
- 「消して」「削除して」→ action: "delete"
- 今日の記録一覧のIDを使う（[ID:xxx]の部分）

## 追加の例（calories, protein, carbs, fat は必ず含めること）
{"entries": [{"action": "add", "type": "meal", "date": "2026-03-14", "meal_type": "lunch", "description": "ファミチキ", "calories": 252, "protein": 16, "carbs": 13, "fat": 17}]}

## 重要: 食事の場合は calories, protein, carbs, fat を必ず数値で返す（不明でも推定して返す）

## 編集の例
ユーザー: 「さっきのファミチキ300kcalに修正して」
記録一覧に [ID:abc-123] ファミチキ がある場合:
{"entries": [{"action": "edit", "type": "meal", "id": "abc-123", "updates": {"calories": 300}}]}

## 削除の例
ユーザー: 「朝食の記録消して」
記録一覧に [ID:def-456] [breakfast] トースト がある場合:
{"entries": [{"action": "delete", "type": "meal", "id": "def-456"}]}

## food_memories（ユーザーが栄養情報を教えてくれた場合のみ）
ユーザー: 「ファミチキは252kcalだよ」
→ "food_memories": [{"food_name": "ファミチキ", "calories": 252}]`;

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
      .limit(10);

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
      temperature: 0.85,
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

    // データ抽出結果をパース（自動保存せず、フロントに返す）
    let extractedEntries: Record<string, unknown>[] = [];
    try {
      const parsed = JSON.parse(extractedJson);
      console.log("Extracted data:", JSON.stringify(parsed).slice(0, 300));
      extractedEntries = parsed?.entries || [];
      // food_memoriesは自動保存（ユーザーが教えた情報なので確認不要）
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
        }
      }
    } catch (e) {
      console.error("JSON parse error:", e, "Raw:", extractedJson.slice(0, 200));
    }

    // メッセージを保存
    const cleanMessage = assistantMessage.replace(/```json[\s\S]*?```\n?/g, "").trim();

    await db.from("chat_messages").insert({ role: "user", content: message });
    await db.from("chat_messages").insert({ role: "assistant", content: cleanMessage });

    // 抽出データをフロントに返す（ユーザーが確認して保存）
    return NextResponse.json({
      message: cleanMessage,
      pendingEntries: extractedEntries.length > 0 ? extractedEntries : undefined,
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "メッセージの処理中にエラーが発生しました" },
      { status: 500 }
    );
  }
}
