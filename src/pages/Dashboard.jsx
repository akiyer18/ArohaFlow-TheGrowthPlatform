import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ensureWeeklyReflectionForLastWeek } from '../services';
import {
  BookOpen,
  CalendarClock,
  CheckSquare,
  CircleDollarSign,
  Flame,
  NotebookPen,
  ShoppingCart,
  Sparkles,
  Target,
  UtensilsCrossed,
} from 'lucide-react';
import AppHeader from '../components/layout/AppHeader';
import { Badge, Card, PageContainer, SectionHeader } from '../components/ui';
import FlowOverview from '../components/flow/FlowOverview';

const Dashboard = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    ensureWeeklyReflectionForLastWeek();
  }, []);

  const handleToolClick = (toolId) => {
    switch(toolId) {
      case 1: // Money Mastery
        navigate('/money-tracker');
        break;
      case 2: // Meal Planning
        navigate('/meal-planning');
        break;
      case 3: // Smart Calendar
        navigate('/smart-calendar');
        break;
      case 4: // Task Manager
        navigate('/task-manager');
        break;
      case 5: // Grocery List
        navigate('/grocery-list');
        break;
      case 6: // Habit Tracker
        navigate('/habit-tracker');
        break;
      case 7: // Journal
        navigate('/journal');
        break;
      case 8: // Knowledge Expansion
        navigate('/knowledge-expansion');
        break;
      default:
        // For other tools, show coming soon or implement later
        break;
    }
  };

  const tools = [
    { id: 1, name: 'Money Mastery', description: 'Track expenses, set budgets, and achieve financial goals with smart insights', icon: CircleDollarSign, comingSoon: false, accent: 'emerald' },
    { id: 2, name: 'Meal Planning', description: 'Plan healthy meals, manage recipes, and generate grocery lists automatically', icon: UtensilsCrossed, comingSoon: false, accent: 'neutral' },
    { id: 3, name: 'Smart Calendar', description: 'Unified calendar: habits, tasks, meals, and events in one view', icon: CalendarClock, comingSoon: false, accent: 'neutral' },
    { id: 4, name: 'Task Manager', description: 'Organize tasks with smart prioritization and progress tracking', icon: CheckSquare, comingSoon: false, accent: 'neutral' },
    { id: 5, name: 'Grocery List', description: 'Smart grocery management with meal plan integration and inventory tracking', icon: ShoppingCart, comingSoon: false, accent: 'neutral' },
    { id: 6, name: 'Habit Tracker', description: 'Build positive habits and track progress with behavioral insights', icon: Target, comingSoon: false, accent: 'neutral' },
    { id: 7, name: 'Journal', description: 'Daily reflection and mood tracking with intelligent insights', icon: NotebookPen, comingSoon: false, accent: 'violet' },
    { id: 8, name: 'Knowledge Expansion', description: 'Structured learning journal: capture what you learn, tag it, and build a second brain', icon: BookOpen, comingSoon: false, accent: 'violet' },
  ];

  return (
    <div className="min-h-screen">
      <AppHeader title="Aroha Flow: The Growth Platform" subtitle="Flow-State Operating System" onLogout={handleLogout} />
      <PageContainer>
        <section className="flow-section">
          <FlowOverview />
        </section>
        <div className="flow-section">
          <button
            type="button"
            onClick={() => navigate('/flow-mode')}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 text-sm font-medium text-amber-400/90 hover:bg-amber-500/15 hover:border-amber-500/40 transition-all duration-300 ease-flow"
          >
            <Flame className="h-4 w-4" />
            Flow Mode
          </button>
        </div>
        <SectionHeader
          title="Modules"
          subtitle="Open the spaces that support today’s focus."
          actions={
            <div className="inline-flex items-center gap-2 rounded-ui border border-white/10 bg-white/5 px-3 py-1.5 text-xs app-muted backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Flow OS · Modules
            </div>
          }
        />

        <div className="app-grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Card
                key={tool.id}
                hover={!tool.comingSoon}
                accent={tool.accent || 'neutral'}
                className="flex h-full flex-col gap-3"
                onClick={!tool.comingSoon ? () => handleToolClick(tool.id) : undefined}
              >
                <div className="flex items-start justify-between">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-ui border border-white/10 bg-white/5 text-app-text-muted">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  {tool.comingSoon ? <Badge tone="warning">Coming Soon</Badge> : null}
                </div>
                <h3>{tool.name}</h3>
                <p className="app-muted">{tool.description}</p>
              </Card>
            );
          })}
        </div>
      </PageContainer>
    </div>
  );
};

export default Dashboard; 