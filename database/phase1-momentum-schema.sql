-- Phase 1: Flow & Momentum schema
-- Safe to run multiple times.

-- 1. Daily Flow Scores
CREATE TABLE IF NOT EXISTS daily_flow_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  flow_score INTEGER NOT NULL CHECK (flow_score BETWEEN 0 AND 100),
  habit_completion_pct INTEGER NOT NULL CHECK (habit_completion_pct BETWEEN 0 AND 100),
  task_completion_pct INTEGER NOT NULL CHECK (task_completion_pct BETWEEN 0 AND 100),
  meal_planned BOOLEAN NOT NULL DEFAULT FALSE,
  deep_work_minutes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_flow_scores_user_date
  ON daily_flow_scores(user_id, date);

-- 2. Momentum Snapshots (rolling 14-day signal)
CREATE TABLE IF NOT EXISTS momentum_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  momentum_score INTEGER NOT NULL CHECK (momentum_score BETWEEN 0 AND 100),
  rolling_14_day_habit_avg NUMERIC NOT NULL,
  rolling_14_day_task_avg NUMERIC NOT NULL,
  meal_consistency NUMERIC NOT NULL,
  deep_work_sessions INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_momentum_snapshots_user_date
  ON momentum_snapshots(user_id, date);

-- 3. Daily Reflection (mood)
CREATE TABLE IF NOT EXISTS daily_reflection (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  mood TEXT NOT NULL CHECK (mood IN ('great','good','neutral','low','difficult')),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_reflection_user_date
  ON daily_reflection(user_id, date);

-- 4. Flow Sessions (for deep work / Flow Mode)
CREATE TABLE IF NOT EXISTS flow_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  task_id UUID NULL REFERENCES tasks(id) ON DELETE SET NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER NOT NULL,
  flow_rating INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flow_sessions_user_date
  ON flow_sessions(user_id, date);

CREATE INDEX IF NOT EXISTS idx_flow_sessions_user_start
  ON flow_sessions(user_id, start_time);

-- 5. Weekly Summaries (cached Sunday snapshots)
CREATE TABLE IF NOT EXISTS weekly_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  avg_flow_score NUMERIC NOT NULL,
  momentum_delta NUMERIC NOT NULL,
  habit_completion_pct NUMERIC NOT NULL,
  follow_through_rate NUMERIC NOT NULL,
  most_consistent_habit_id UUID NULL REFERENCES habits(id) ON DELETE SET NULL,
  mood_distribution JSONB NOT NULL,
  deep_work_minutes INTEGER NOT NULL,
  ai_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_summaries_user_week
  ON weekly_summaries(user_id, week_start);

