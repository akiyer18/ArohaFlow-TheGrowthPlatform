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

const MoneyTracker = lazy(() => import('./pages/MoneyTracker'));
const TaskManager = lazy(() => import('./pages/TaskManager'));
const MealPlanning = lazy(() => import('./pages/MealPlanning'));
const GroceryList = lazy(() => import('./pages/GroceryList'));
const HabitTracker = lazy(() => import('./pages/HabitTracker'));
const SmartCalendar = lazy(() => import('./pages/SmartCalendar'));
const FlowMode = lazy(() => import('./pages/FlowMode'));
const Journal = lazy(() => import('./pages/Journal'));
const KnowledgeExpansion = lazy(() => import('./pages/KnowledgeExpansion'));

function App() {
  return (
    <AuthProvider>
      <TimeThemeProvider>
        <Router>
          <div className="App min-h-screen relative">
            <FlowFieldBackground />
            <NoiseOverlay />
            <div className="relative z-10 min-h-screen">
              <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-app-text-muted">Loading…</div>}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />
                <Route
                  path="/money-tracker"
              element={
                <PrivateRoute>
                  <MoneyTracker />
                </PrivateRoute>
              }
                />
                <Route
                  path="/task-manager"
              element={
                <PrivateRoute>
                  <TaskManager />
                </PrivateRoute>
              }
            />
            <Route
              path="/meal-planning"
              element={
                <PrivateRoute>
                  <MealPlanning />
                </PrivateRoute>
              }
            />
            <Route
              path="/grocery-list"
              element={
                <PrivateRoute>
                  <GroceryList />
                </PrivateRoute>
              }
            />
            <Route
              path="/habit-tracker"
              element={
                <PrivateRoute>
                  <HabitTracker />
                </PrivateRoute>
              }
            />
            <Route
              path="/smart-calendar"
              element={
                <PrivateRoute>
                  <SmartCalendar />
                </PrivateRoute>
              }
            />
            <Route
              path="/flow-mode"
              element={
                <PrivateRoute>
                  <FlowMode />
                </PrivateRoute>
              }
            />
            <Route
              path="/journal"
              element={
                <PrivateRoute>
                  <Journal />
                </PrivateRoute>
              }
            />
            <Route
              path="/knowledge-expansion"
              element={
                <PrivateRoute>
                  <KnowledgeExpansion />
                </PrivateRoute>
              }
            />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
              </Routes>
              </Suspense>
            </div>
          </div>
        </Router>
      </TimeThemeProvider>
    </AuthProvider>
  );
}

export default App; 