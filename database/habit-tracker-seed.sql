-- Example seed data (run after habit-tracker-schema.sql)
-- Replace YOUR_USER_UUID with a real auth.users id from your project

/*
INSERT INTO habits (user_id, title, description, color, icon, frequency_type, frequency_value, target_per_day, start_date)
VALUES
  ('YOUR_USER_UUID', 'Drink water', '8 glasses per day', '#3b82f6', 'Droplets', 'daily', '{}', 8, CURRENT_DATE),
  ('YOUR_USER_UUID', 'Morning run', '30 min run or walk', '#1fa66a', 'Zap', 'daily', '{}', 1, CURRENT_DATE),
  ('YOUR_USER_UUID', 'Read', 'At least 20 pages', '#8b5cf6', 'BookOpen', 'specific_days', '{"days": [0, 1, 2, 3, 4, 5, 6]}', 1, CURRENT_DATE),
  ('YOUR_USER_UUID', 'Workout', 'Gym or home workout', '#d9515f', 'Dumbbell', 'weekly_count', '{"count": 3}', 1, CURRENT_DATE);
*/

-- Example API usage (from app):
-- createHabit({ title: 'Meditate', description: '10 min', color: '#6e7dff', icon: 'Target', frequencyType: 'daily', frequencyValue: {}, targetPerDay: 1, startDate: '2025-02-20' })
-- logCompletion(habitId, '2025-02-20', 1)
-- undoCompletion(habitId, '2025-02-20')
-- getHabits({ archived: false })
-- getHabitLogs(habitId, { fromDate: '2025-01-01', toDate: '2025-02-20' })
