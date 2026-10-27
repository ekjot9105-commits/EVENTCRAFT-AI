import { Outlet, Link, useLocation } from 'react-router-dom';

export default function Layout() {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 glass-card border-t-0 border-x-0 rounded-none">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between" aria-label="Main navigation">
          <Link to="/" className="flex items-center gap-3 group" aria-label="EventCraft AI — Home">
            <span className="text-2xl" role="img" aria-hidden="true">✨</span>
            <span className="font-display font-bold text-xl gradient-text group-hover:opacity-80 transition-opacity">
              EventCraft AI
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {!isHome && (
              <Link
                to="/"
                className="text-sm text-surface-400 hover:text-surface-200 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
              >
                ← All Events
              </Link>
            )}
            <Link
              to="/events/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition-all hover:shadow-lg hover:shadow-brand-600/25 active:scale-95"
            >
              <span aria-hidden="true">+</span>
              New Event
            </Link>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main id="main-content" className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-surface-600">
          <p>EventCraft AI — Powered by Google Gemini</p>
        </div>
      </footer>
    </div>
  );
}
