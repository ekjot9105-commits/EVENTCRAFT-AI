import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { eventsApi } from '../../shared/api/client';
import Card from '../../shared/components/Card';
import Spinner from '../../shared/components/Spinner';
import Badge from '../../shared/components/Badge';
import type { Event } from '../../../shared/types/event';
import { EVENT_TYPE_LABELS, EVENT_TYPE_ICONS } from '../../../shared/constants/eventTypes';

/** Loads the user's events and provides the primary entry point into planning. */
export default function Dashboard() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    eventsApi
      .list()
      .then((data) => { if (!cancelled) setEvents(data); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <section className="text-center py-12 mb-8">
        <h1 className="font-display font-extrabold text-4xl sm:text-5xl gradient-text mb-4">
          Your Events
        </h1>
        <p className="text-surface-400 text-lg max-w-xl mx-auto">
          Plan weddings, birthdays, and community events with AI-powered budgets, timelines, and vendor management.
        </p>
      </section>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      )}

      {/* Error */}
      {error && (
        <Card className="text-center py-12">
          <p className="text-red-400 mb-2">Failed to load events</p>
          <p className="text-surface-500 text-sm">{error}</p>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && events.length === 0 && (
        <Card className="text-center py-16">
          <p className="text-4xl mb-4" role="img" aria-label="Party popper">🎉</p>
          <h2 className="font-display font-semibold text-xl text-surface-200 mb-2">No events yet</h2>
          <p className="text-surface-500 mb-6">Create your first event to get started with AI-powered planning.</p>
          <Link
            to="/events/new"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-medium transition-all hover:shadow-lg hover:shadow-brand-600/25"
          >
            <span aria-hidden="true">✨</span>
            Create Your First Event
          </Link>
        </Card>
      )}

      {/* Event Grid */}
      {!loading && !error && events.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Link key={event.id} to={`/events/${event.id}`} className="block group">
              <Card hover as="article">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-2xl" role="img" aria-label={EVENT_TYPE_LABELS[event.type]}>
                    {EVENT_TYPE_ICONS[event.type]}
                  </span>
                  <Badge color="brand">{EVENT_TYPE_LABELS[event.type]}</Badge>
                </div>
                <h2 className="font-display font-semibold text-lg text-surface-100 mb-1 group-hover:text-brand-400 transition-colors">
                  {event.title}
                </h2>
                {event.description && (
                  <p className="text-surface-500 text-sm line-clamp-2 mb-3">{event.description}</p>
                )}
                <div className="flex items-center gap-4 text-xs text-surface-600">
                  {event.date && (
                    <span>📅 {new Date(event.date).toLocaleDateString()}</span>
                  )}
                  {event.guest_count && (
                    <span>👥 {event.guest_count} guests</span>
                  )}
                  {event.location && (
                    <span>📍 {event.location}</span>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
