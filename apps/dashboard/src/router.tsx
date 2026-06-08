import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Shell } from '@/components/Shell';
import { DashboardPage } from '@/routes/DashboardPage';
import { ReviewPage } from '@/routes/ReviewPage';
import { ResumePage } from '@/routes/ResumePage';
import { ScrawlingPage } from '@/routes/ScrawlingPage';
import { LlmPage } from '@/routes/LlmPage';
import { PreferencesPage } from '@/routes/PreferencesPage';
import { ConstraintsPage } from '@/routes/ConstraintsPage';
import { AnswersPage } from '@/routes/AnswersPage';

// NOTE for the integrator: the API serves the bare résumé host (apps/site) at
// /resume/ and exempts any URL starting with /resume from the SPA fallback
// (app.ts setNotFoundHandler). So a HARD navigation/refresh to the dashboard's
// /resume route is shadowed by the bare host. Client-side nav (the sidebar) works
// fine. Flagged in the report — recommend the API tighten the exemption to
// `/resume/` (with the trailing slash) so the dashboard's /resume deep-links work.
export const router = createBrowserRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'review', element: <ReviewPage /> },
      { path: 'review/:id', element: <ReviewPage /> },
      { path: 'resume', element: <ResumePage /> },
      { path: 'scrawling', element: <ScrawlingPage /> },
      { path: 'llm', element: <LlmPage /> },
      { path: 'preferences', element: <PreferencesPage /> },
      { path: 'constraints', element: <ConstraintsPage /> },
      { path: 'answers', element: <AnswersPage /> },
      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
  },
]);
