-- =============================================
-- Health Tracker v2 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- 1. user_goals にプロフィール情報を追加（BMR計算用）
ALTER TABLE user_goals ADD COLUMN IF NOT EXISTS height_cm REAL;
ALTER TABLE user_goals ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE user_goals ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female'));

-- 2. 変更履歴テーブル
CREATE TABLE IF NOT EXISTS change_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL CHECK (action IN ('add', 'edit', 'delete')),
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_change_log_created ON change_log(created_at);

ALTER TABLE change_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON change_log FOR ALL USING (true) WITH CHECK (true);
