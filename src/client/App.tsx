import { Routes, Route } from 'react-router-dom';
import Layout from './shared/components/Layout';
import Dashboard from './features/dashboard/Dashboard';
import CreateEvent from './features/events/CreateEvent';
import EventDetail from './features/events/EventDetail';

export default function App() {
  return (
    <>
      <a href="#main-content" className="skip-nav">
        Skip to main content
      </a>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/events/new" element={<CreateEvent />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/events/:id/:tab" element={<EventDetail />} />
        </Route>
      </Routes>
    </>
  );
}
