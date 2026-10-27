import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './shared/components/Layout';
import Dashboard from './features/dashboard/Dashboard';
import CreateEvent from './features/events/CreateEvent';
import EventDetail from './features/events/EventDetail';
import FeaturePlaceholder from './features/shared/FeaturePlaceholder';
import NotFound from './features/shared/NotFound';

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
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/events/new" element={<CreateEvent />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/events/:id/budget" element={<FeaturePlaceholder title="Budget workspace" description="Track estimated and actual spending with a clear view of where your event budget is going." icon="wallet" />} />
          <Route path="/events/:id/timeline" element={<FeaturePlaceholder title="Timeline workspace" description="Keep important deadlines visible and turn a big event into manageable milestones." icon="timeline" />} />
          <Route path="/events/:id/vendors" element={<FeaturePlaceholder title="Vendor checklist" description="Organize vendor research, contacts, quotes, and booking status in one place." icon="users" />} />
          <Route path="/events/:id/ideas" element={<FeaturePlaceholder title="Personalized ideas" description="Collect event ideas that will be tailored to your style, priorities, and guest experience." icon="lightbulb" />} />
          <Route path="/events/:id/assistant" element={<FeaturePlaceholder title="AI Copilot" description="Ask context-aware planning questions and review suggested changes once the AI service is connected." icon="sparkles" />} />
          <Route path="/events/:id/overview" element={<Navigate to=".." replace />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}
