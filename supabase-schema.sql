-- Supabaseのダッシュボード > SQL Editor で実行してください

-- 食事ログ
create table meal_logs (
  id uuid default gen_random_uuid() primary key,
  date date not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  description text not null,
  calories integer not null default 0,
  protein real,
  carbs real,
  fat real,
  created_at timestamptz default now()
);

-- 体重ログ
create table weight_logs (
  id uuid default gen_random_uuid() primary key,
  date date not null unique,
  weight real not null,
  created_at timestamptz default now()
);

-- 運動ログ
create table exercise_logs (
  id uuid default gen_random_uuid() primary key,
  date date not null,
  description text not null,
  duration_minutes integer not null default 0,
  calories_burned integer not null default 0,
  created_at timestamptz default now()
);

-- チャット履歴
create table chat_messages (
  id uuid default gen_random_uuid() primary key,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

-- ユーザー目標
create table user_goals (
  id uuid default gen_random_uuid() primary key,
  target_weight real not null,
  daily_calorie_target integer not null default 2000,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- インデックス（日付で検索を高速化）
create index idx_meal_logs_date on meal_logs(date);
create index idx_weight_logs_date on weight_logs(date);
create index idx_exercise_logs_date on exercise_logs(date);
create index idx_chat_messages_created on chat_messages(created_at);

-- RLS（Row Level Security）を無効化（個人利用のため）
alter table meal_logs enable row level security;
alter table weight_logs enable row level security;
alter table exercise_logs enable row level security;
alter table chat_messages enable row level security;
alter table user_goals enable row level security;

-- 全アクセス許可ポリシー（個人利用のため簡易設定）
create policy "Allow all" on meal_logs for all using (true) with check (true);
create policy "Allow all" on weight_logs for all using (true) with check (true);
create policy "Allow all" on exercise_logs for all using (true) with check (true);
create policy "Allow all" on chat_messages for all using (true) with check (true);
create policy "Allow all" on user_goals for all using (true) with check (true);
