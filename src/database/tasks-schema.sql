-- Task Manager Database Schema for Supabase
-- Add these tables to your existing database (run after the main schema.sql)

-- 1. Tasks Table
CREATE TABLE IF NOT EXISTS tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    task_name VARCHAR(255) NOT NULL,
    notes TEXT,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('Critical', 'High', 'Medium', 'Low')),
    category VARCHAR(50) NOT NULL CHECK (category IN ('Bills', 'Communication', 'Work', 'Health', 'Other')),
    status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Completed', 'Cancelled')),
    completed_on TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Task Categories Table (for custom categories)
CREATE TABLE IF NOT EXISTS task_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#6366f1', -- hex color code
    icon VARCHAR(10) DEFAULT '📝', -- emoji icon
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, name) -- Prevent duplicate category names per user
);

-- 3. Task Comments/Updates Table (for task history)
CREATE TABLE IF NOT EXISTS task_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Task Attachments Table (for future file attachments)
CREATE TABLE IF NOT EXISTS task_attachments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies for Tasks
CREATE POLICY "Users can view own tasks" ON tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tasks" ON tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tasks" ON tasks FOR DELETE USING (auth.uid() = user_id);

-- Create RLS Policies for Task Categories
CREATE POLICY "Users can view own task categories" ON task_categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own task categories" ON task_categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own task categories" ON task_categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own task categories" ON task_categories FOR DELETE USING (auth.uid() = user_id);

-- Create RLS Policies for Task Comments
CREATE POLICY "Users can view own task comments" ON task_comments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own task comments" ON task_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own task comments" ON task_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own task comments" ON task_comments FOR DELETE USING (auth.uid() = user_id);

-- Create RLS Policies for Task Attachments
CREATE POLICY "Users can view own task attachments" ON task_attachments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own task attachments" ON task_attachments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own task attachments" ON task_attachments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own task attachments" ON task_attachments FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_task_categories_user_id ON task_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);

-- Create updated_at triggers for tasks
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_task_categories_updated_at BEFORE UPDATE ON task_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default categories for all users (optional - can be done via application)
-- This function will create default categories for new users
CREATE OR REPLACE FUNCTION create_default_task_categories()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert default categories for the new user
    INSERT INTO task_categories (user_id, name, color, icon, is_default) VALUES
    (NEW.id, 'Bills', '#ef4444', '💳', true),
    (NEW.id, 'Communication', '#3b82f6', '💬', true),
    (NEW.id, 'Work', '#8b5cf6', '💼', true),
    (NEW.id, 'Health', '#10b981', '🏥', true),
    (NEW.id, 'Other', '#6b7280', '📝', true);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to add default categories when user signs up
-- Note: This trigger runs on the auth.users table, so it may need to be created manually
-- in your Supabase dashboard if the auth schema is restricted
/*
CREATE TRIGGER create_default_task_categories_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_task_categories();
*/

-- Views for easier querying
-- Active tasks view
CREATE OR REPLACE VIEW active_tasks AS
SELECT 
    t.*,
    tc.color as category_color,
    tc.icon as category_icon
FROM tasks t
LEFT JOIN task_categories tc ON tc.name = t.category AND tc.user_id = t.user_id
WHERE t.status = 'Pending';

-- Completed tasks view (last 30 days)
CREATE OR REPLACE VIEW recent_completed_tasks AS
SELECT 
    t.*,
    tc.color as category_color,
    tc.icon as category_icon
FROM tasks t
LEFT JOIN task_categories tc ON tc.name = t.category AND tc.user_id = t.user_id
WHERE t.status = 'Completed' 
AND t.completed_on >= NOW() - INTERVAL '30 days';

-- Tasks due today view
CREATE OR REPLACE VIEW tasks_due_today AS
SELECT 
    t.*,
    tc.color as category_color,
    tc.icon as category_icon
FROM tasks t
LEFT JOIN task_categories tc ON tc.name = t.category AND tc.user_id = t.user_id
WHERE t.status = 'Pending' 
AND DATE(t.due_date) = CURRENT_DATE;

-- Overdue tasks view
CREATE OR REPLACE VIEW overdue_tasks AS
SELECT 
    t.*,
    tc.color as category_color,
    tc.icon as category_icon
FROM tasks t
LEFT JOIN task_categories tc ON tc.name = t.category AND tc.user_id = t.user_id
WHERE t.status = 'Pending' 
AND t.due_date < NOW();

-- Grant permissions on views
GRANT SELECT ON active_tasks TO authenticated;
GRANT SELECT ON recent_completed_tasks TO authenticated;
GRANT SELECT ON tasks_due_today TO authenticated;
GRANT SELECT ON overdue_tasks TO authenticated; 