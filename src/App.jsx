import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { TimeThemeProvider } from './contexts/TimeThemeContext';
import FlowFieldBackground from './components/layout/FlowFieldBackground';
import NoiseOverlay from './components/layout/NoiseOverlay';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import OsShell from './os/OsShell';
import TodayPage from './os/TodayPage';
import HabitsPage from './os/HabitsPage';
import ApplicationsPage from './os/ApplicationsPage';
import EmailDigestPage from './os/EmailDigestPage';
import AnalyticsPage from './os/AnalyticsPage';
import CalendarViewPage from './os/CalendarViewPage';
import GoalsPage from './os/GoalsPage';
import AllowlistPage from './os/AllowlistPage';
import MoreToolsPage from './os/MoreToolsPage';
import MoneyPage from './os/MoneyPage';

const MoneyTracker = lazy(() => import('./pages/MoneyTracker'));
const TaskManager = lazy(() => import('./pages/TaskManager'));
const MealPlanning = lazy(() => import('./pages/MealPlanning'));
const GroceryList = lazy(() => import('./pages/GroceryList'));
const FlowMode = lazy(() => import('./pages/FlowMode'));
const Journal = lazy(() => import('./pages/Journal'));
const KnowledgeExpansion = lazy(() => import('./pages/KnowledgeExpansion'));

function LegacyFrame({ children }) {
  return (
    <PrivateRoute>
      <div className="relative z-10 min-h-screen">
        <FlowFieldBackground />
        <NoiseOverlay />
        <Suspense
          fallback={
            <div className="flex min-h-screen items-center justify-center text-app-text-muted">Loading…</div>
          }
        >
          <div className="relative z-10">{children}</div>
        </Suspense>
      </div>
    </PrivateRoute>
  );
}

function App() {
  return (
    <AuthProvider>
      <TimeThemeProvider>
        <Router>
          <div className="App min-h-screen relative">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              <Route
                element={
                  <PrivateRoute>
                    <OsShell />
                  </PrivateRoute>
                }
              >
                <Route path="/today" element={<TodayPage />} />
                <Route path="/habits" element={<HabitsPage />} />
                <Route path="/email-digest" element={<EmailDigestPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/calendar" element={<CalendarViewPage />} />
                <Route path="/smart-calendar" element={<CalendarViewPage />} />
                <Route path="/goals" element={<GoalsPage />} />
                <Route path="/applications" element={<ApplicationsPage />} />
                <Route path="/allowlist" element={<AllowlistPage />} />
                <Route path="/more-tools" element={<MoreToolsPage />} />
                <Route path="/money" element={<MoneyPage />} />
                <Route path="/food" element={<Navigate to="/meal-planning?tab=plan" replace />} />
                <Route
                  path="/meal-planning"
                  element={
                    <Suspense fallback={<div className="os-state">Loading Food…</div>}>
                      <MealPlanning />
                    </Suspense>
                  }
                />
                <Route
                  path="/grocery-list"
                  element={
                    <Suspense fallback={<div className="os-state">Loading grocery list…</div>}>
                      <GroceryList />
                    </Suspense>
                  }
                />
              </Route>

              <Route path="/dashboard" element={<LegacyFrame><Dashboard /></LegacyFrame>} />
              <Route path="/money-tracker" element={<LegacyFrame><MoneyTracker /></LegacyFrame>} />
              <Route path="/task-manager" element={<LegacyFrame><TaskManager /></LegacyFrame>} />
              <Route path="/habit-tracker" element={<Navigate to="/habits" replace />} />
              <Route path="/flow-mode" element={<LegacyFrame><FlowMode /></LegacyFrame>} />
              <Route path="/journal" element={<LegacyFrame><Journal /></LegacyFrame>} />
              <Route path="/knowledge-expansion" element={<LegacyFrame><KnowledgeExpansion /></LegacyFrame>} />
              <Route path="/" element={<Navigate to="/today" replace />} />
            </Routes>
          </div>
        </Router>
      </TimeThemeProvider>
    </AuthProvider>
  );
}

export default App;
