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

// Routing note: the dashboard owns `/resume` (no slash) as a CLIENT route; the
// bare résumé host (apps/site) is static-served at `/resume/` (TRAILING slash).
// The API (app.ts) exempts ONLY `/resume/` (trailing slash) from the SPA
// fallback, so a hard nav/refresh/deep-link to `/resume` falls through to this
// SPA and renders ResumePage. Locked by services/api/test/app.test.ts
// ("static routing: /resume (SPA route) vs /resume/ (bare host)"). Do not widen
// the exemption to bare `/resume` — that re-shadows this route.
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
