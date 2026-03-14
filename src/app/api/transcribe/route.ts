import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

function getGroq() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");
  return new Groq({ apiKey });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audio = formData.get("audio") as File | null;
    if (!audio) {
      return NextResponse.json({ error: "音声データがありません" }, { status: 400 });
    }

    const groq = getGroq();
    const transcription = await groq.audio.transcriptions.create({
      file: audio,
      model: "whisper-large-v3",
      language: "ja",
      response_format: "json",
    });

    return NextResponse.json({ text: transcription.text });
  } catch (error) {
    console.error("Transcribe error:", error);
    return NextResponse.json(
      { error: "音声の文字起こしに失敗しました" },
      { status: 500 }
    );
  }
}
