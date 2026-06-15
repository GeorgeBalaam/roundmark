import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { initStore } from './lib/store';

void initStore();
import './styles/theme.css';
import { ToastProvider } from './components/ui';
import LoginPage, { RequireSession } from './pages/Login';
import MarketingPage from './pages/Marketing';
import DashboardPage from './pages/Dashboard';
import HistoryPage from './pages/History';
import EventSetupPage from './pages/EventSetup';
import ConsolePage from './pages/Console';
import ScorecardPage from './pages/Scorecard';
import LeaderboardPage from './pages/Leaderboard';
import TVPage from './pages/TV';
import ResultsPage from './pages/Results';
import QRPrintPage from './pages/QRPrint';

const router = createBrowserRouter([
  { path: '/', element: <MarketingPage /> },
  { path: '/login', element: <LoginPage /> },
  {
    path: '/app',
    element: (
      <RequireSession>
        <DashboardPage />
      </RequireSession>
    ),
  },
  {
    path: '/app/history',
    element: (
      <RequireSession>
        <HistoryPage />
      </RequireSession>
    ),
  },
  {
    path: '/app/event/:eventId',
    element: (
      <RequireSession>
        <EventSetupPage />
      </RequireSession>
    ),
  },
  {
    path: '/app/event/:eventId/console',
    element: (
      <RequireSession>
        <ConsolePage />
      </RequireSession>
    ),
  },
  { path: '/score/:eventId/:teamId', element: <ScorecardPage /> },
  { path: '/leaderboard/:eventId', element: <LeaderboardPage /> },
  { path: '/tv/:eventId', element: <TVPage /> },
  { path: '/results/:eventId', element: <ResultsPage /> },
  {
    path: '/print/:eventId/qr',
    element: (
      <RequireSession>
        <QRPrintPage />
      </RequireSession>
    ),
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  </StrictMode>,
);
