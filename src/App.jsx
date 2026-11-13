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
import EmailDigestPage from './os/EmailDigestPage';
import AnalyticsPage from './os/AnalyticsPage';
import OsPlaceholderPage from './os/OsPlaceholderPage';
import MoreToolsPage from './os/MoreToolsPage';

const MoneyTracker = lazy(() => import('./pages/MoneyTracker'));
const TaskManager = lazy(() => import('./pages/TaskManager'));
const MealPlanning = lazy(() => import('./pages/MealPlanning'));
const GroceryList = lazy(() => import('./pages/GroceryList'));
const HabitTracker = lazy(() => import('./pages/HabitTracker'));
const SmartCalendar = lazy(() => import('./pages/SmartCalendar'));
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
                <Route path="/email-digest" element={<EmailDigestPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route
                  path="/goals"
                  element={
                    <OsPlaceholderPage
                      title="Goals"
                      note="Goals UI lands with OS milestone #13. Open Today for the Day Plan."
                    />
                  }
                />
                <Route
                  path="/applications"
                  element={
                    <OsPlaceholderPage
                      title="Applications"
                      note="Applications UI lands with OS milestone #13. Open Today for the Day Plan."
                    />
                  }
                />
                <Route path="/more-tools" element={<MoreToolsPage />} />
              </Route>

              <Route path="/dashboard" element={<LegacyFrame><Dashboard /></LegacyFrame>} />
              <Route path="/money-tracker" element={<LegacyFrame><MoneyTracker /></LegacyFrame>} />
              <Route path="/task-manager" element={<LegacyFrame><TaskManager /></LegacyFrame>} />
              <Route path="/meal-planning" element={<LegacyFrame><MealPlanning /></LegacyFrame>} />
              <Route path="/grocery-list" element={<LegacyFrame><GroceryList /></LegacyFrame>} />
              <Route path="/habit-tracker" element={<LegacyFrame><HabitTracker /></LegacyFrame>} />
              <Route path="/smart-calendar" element={<LegacyFrame><SmartCalendar /></LegacyFrame>} />
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
