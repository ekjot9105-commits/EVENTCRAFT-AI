import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './shared/components/Layout';

const Dashboard = lazy(() => import('./features/dashboard/Dashboard'));
const CreateEvent = lazy(() => import('./features/events/CreateEvent'));
const EventDetail = lazy(() => import('./features/events/EventDetail'));
const NotFound = lazy(() => import('./features/shared/NotFound'));
const PlanningWorkspace = lazy(() => import('./features/planning/PlanningWorkspace'));
const AICopilot = lazy(() => import('./features/assistant/AICopilot'));
const IdeasWorkspace = lazy(() => import('./features/ideas/IdeasWorkspace'));
const LandingPage = lazy(() => import('./features/landing/LandingPage'));

/**
 * Defines the application's route tree.
 *
 * Feature routes are present even before their backend services are complete so
 * users can understand the product scope without seeing misleading controls.
 */
export default function App() {
  return (
    <>
      {/* Keep keyboard users oriented when navigating between routed pages. */}
      <a href="#main-content" className="skip-nav">Skip to main content</a>
      <Suspense fallback={<div className="p-6 text-center" role="status">Loading workspace…</div>}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/events/new" element={<CreateEvent />} />
            <Route path="/events/:id" element={<EventDetail />} />
            <Route path="/events/:id/budget" element={<PlanningWorkspace kind="budget" />} />
            <Route path="/events/:id/timeline" element={<PlanningWorkspace kind="timeline" />} />
            <Route path="/events/:id/vendors" element={<PlanningWorkspace kind="vendors" />} />
            <Route path="/events/:id/ideas" element={<IdeasWorkspace />} />
            <Route path="/events/:id/assistant" element={<AICopilot />} />
            <Route path="/events/:id/overview" element={<Navigate to=".." relative="path" replace />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
