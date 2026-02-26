/**
 * Habit Tracker types (reference for JSDoc or TypeScript migration)
 */

export type FrequencyType = 'daily' | 'weekly_count' | 'specific_days';

export type FrequencyValue =
  | { count?: number }
  | { days?: number[] }; // 0=Sun .. 6=Sat

export interface Habit {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  color: string;
  icon: string;
  frequency_type: FrequencyType;
  frequency_value: FrequencyValue;
  target_per_day: number | null;
  start_date: string;
  created_at: string;
  updated_at: string;
  archived: boolean;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  user_id: string;
  date: string;
  count: number;
  created_at: string;
}

export interface CreateHabitPayload {
  title: string;
  description?: string | null;
  color?: string;
  icon?: string;
  frequencyType: FrequencyType;
  frequencyValue?: FrequencyValue;
  targetPerDay?: number | null;
  startDate?: string;
}

export interface UpdateHabitPayload extends Partial<CreateHabitPayload> {}

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
}
