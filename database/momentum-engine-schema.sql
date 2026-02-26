-- Momentum Engine: Daily Effort (0-100), Momentum (0-1000), Weekly Reflections, Mood Logs
-- Safe to run multiple times. Backward compatible with existing tables.

-- 1. Daily Effort Scores (replaces flow "free 100%" logic; harder to earn)
CREATE TABLE IF NOT EXISTS daily_effort_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  effort_score INTEGER NOT NULL CHECK (effort_score BETWEEN 0 AND 100),
  habit_pct INTEGER NOT NULL CHECK (habit_pct BETWEEN 0 AND 100),
  task_pct INTEGER NOT NULL CHECK (task_pct BETWEEN 0 AND 100),
  deep_work_minutes INTEGER NOT NULL DEFAULT 0,
  meal_score INTEGER NOT NULL DEFAULT 0 CHECK (meal_score IN (0, 5, 10)),
  reflection_submitted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_effort_scores_user_date
  ON daily_effort_scores(user_id, date);

-- 2. Momentum History (0-1000 scale; cumulative, penalizes misses)
CREATE TABLE IF NOT EXISTS momentum_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  momentum_score INTEGER NOT NULL CHECK (momentum_score BETWEEN 0 AND 1000),
  delta INTEGER NOT NULL,
  reason_breakdown JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_momentum_history_user_date
  ON momentum_history(user_id, date);

-- 3. Weekly Reflections (Sunday auto-summary)
CREATE TABLE IF NOT EXISTS weekly_reflections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  week_start DATE NOT NULL,
  avg_effort NUMERIC NOT NULL,
  momentum_change INTEGER NOT NULL,
  strongest_area TEXT,
  weakest_area TEXT,
  mood_summary JSONB NOT NULL DEFAULT '{}',
  longest_streak_days INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_weekly_reflections_user_week
  ON weekly_reflections(user_id, week_start);

-- 4. Mood Logs (1-5 scale for analytics; optional note)
CREATE TABLE IF NOT EXISTS mood_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  mood_score INTEGER NOT NULL CHECK (mood_score BETWEEN 1 AND 5),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_mood_logs_user_date
  ON mood_logs(user_id, date);
