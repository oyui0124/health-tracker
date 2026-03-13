import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

export function getSupabase() {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error("Supabase environment variables are not set");
    }
    _supabase = createClient(url, key);
  }
  return _supabase;
}

export type MealLog = {
  id?: string;
  date: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  description: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  created_at?: string;
};

export type WeightLog = {
  id?: string;
  date: string;
  weight: number;
  created_at?: string;
};

export type ExerciseLog = {
  id?: string;
  date: string;
  description: string;
  duration_minutes: number;
  calories_burned: number;
  created_at?: string;
};

export type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
};

export type UserGoal = {
  id?: string;
  target_weight: number;
  daily_calorie_target: number;
  created_at?: string;
  updated_at?: string;
};
