import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { completeTask, createTask, deleteTask, getCompletedTasks, getPendingTasks } from '../services';
import AppHeader from '../components/layout/AppHeader';
import { Badge, Button, Card, Input, PageContainer, SectionHeader, Select, Textarea } from '../components/ui';

const categories = ['Bills', 'Communication', 'Work', 'Health', 'Other'];
const priorities = ['Critical', 'High', 'Medium', 'Low'];

const TaskManager = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pendingTasks, setPendingTasks] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [pending, completed] = await Promise.all([getPendingTasks(), getCompletedTasks(7)]);
      setPendingTasks(pending);
      setCompletedTasks(completed);
    } catch (err) {
      setError(err.message || 'Failed to load tasks.');
    } finally {
      setLoading(false);
    }
  };

  const onAddTask = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form) return;
    const formData = new FormData(form);
    try {
      await createTask({
        taskName: formData.get('taskName'),
        dueDate: formData.get('dueDate'),
        priority: formData.get('priority'),
        notes: formData.get('notes'),
        category: formData.get('category'),
      });
      if (typeof form.reset === 'function') form.reset();
    } finally {
      setShowForm(false);
      loadData();
    }
  };

  const grouped = useMemo(() => {
    const today = [];
    const week = [];
    const upcoming = [];
    const now = new Date();
    const endOfWeek = new Date(now);
    endOfWeek.setDate(now.getDate() + 7);

    pendingTasks.forEach((task) => {
      const due = new Date(task.due_date);
      if (due <= now) today.push(task);
      else if (due <= endOfWeek) week.push(task);
      else upcoming.push(task);
    });

    return { today, week, upcoming };
  }, [pendingTasks]);

  if (loading) return <div className="min-h-screen" />;

  return (
    <div className="min-h-screen">
      <AppHeader title="Task Manager" subtitle="Execution and deadlines" onLogout={() => { logout(); navigate('/login'); }} backTo="/dashboard" />
      <PageContainer className="max-w-5xl">
        <SectionHeader
          title="Task Workspace"
          subtitle="Manage priorities and keep execution clean."
          actions={
            <Button onClick={() => setShowForm((s) => !s)}>
              <Plus className="h-4 w-4" />
              {showForm ? 'Close form' : 'Add task'}
            </Button>
          }
        />

        {error ? <Card className="mb-4 border-rose-900 bg-rose-900/20 text-rose-300">{error}</Card> : null}

        {showForm ? (
          <Card className="mb-6">
            <form className="grid gap-3 md:grid-cols-2" onSubmit={onAddTask}>
              <Input name="taskName" placeholder="Task title" required className="md:col-span-2" />
              <Input type="datetime-local" name="dueDate" required />
              <Select name="priority" required>
                {priorities.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </Select>
              <Select name="category" required>
                {categories.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </Select>
              <Textarea name="notes" rows={3} placeholder="Notes" className="md:col-span-2" />
              <Button type="submit" className="md:col-span-2">Create Task</Button>
            </form>
          </Card>
        ) : null}

        <TaskSection
          title="Due / Overdue"
          tasks={grouped.today}
          onComplete={async (id) => { await completeTask(id); loadData(); }}
          onDelete={async (id) => { await deleteTask(id); loadData(); }}
        />
        <TaskSection
          title="This Week"
          tasks={grouped.week}
          onComplete={async (id) => { await completeTask(id); loadData(); }}
          onDelete={async (id) => { await deleteTask(id); loadData(); }}
        />
        <TaskSection
          title="Upcoming"
          tasks={grouped.upcoming}
          onComplete={async (id) => { await completeTask(id); loadData(); }}
          onDelete={async (id) => { await deleteTask(id); loadData(); }}
        />

        <Card className="mt-6">
          <h3 className="mb-3">Completed in Last 7 Days</h3>
          <div className="space-y-2">
            {completedTasks.length === 0 ? (
              <p className="app-muted">No completed tasks yet.</p>
            ) : (
              completedTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between rounded-ui border border-app-border bg-app-bg-primary px-3 py-2">
                  <div>
                    <p className="text-sm line-through text-app-text-muted">{task.task_name}</p>
                    <p className="text-xs app-muted">{new Date(task.completed_on).toLocaleDateString()}</p>
                  </div>
                  <Badge tone="success">{task.priority}</Badge>
                </div>
              ))
            )}
          </div>
        </Card>
      </PageContainer>
    </div>
  );
};

const TaskSection = ({ title, tasks, onComplete, onDelete }) => {
  if (!tasks.length) return null;

  return (
    <div className="mb-6">
      <h3 className="mb-3">{title}</h3>
      <div className="space-y-3">
        {tasks.map((task) => (
          <Card key={task.id} className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{task.task_name}</p>
              <p className="text-xs app-muted">
                {task.category} · {new Date(task.due_date).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => onComplete(task.id)}>
                <Check className="h-4 w-4" />
              </Button>
              <Button variant="danger" size="sm" onClick={() => onDelete(task.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default TaskManager;