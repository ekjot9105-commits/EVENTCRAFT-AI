import { useState, useCallback, useEffect } from 'react';

/** Minimal application-wide notification payload. */
interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

let toastIdCounter = 0;
const listeners: Set<(toast: Toast) => void> = new Set();

/** Show a toast notification from anywhere in the app. */
export function showToast(message: string, type: Toast['type'] = 'info') {
  const toast: Toast = { id: ++toastIdCounter, message, type };
  listeners.forEach((listener) => listener(toast));
}

/** Toast container — render once in the application shell. */
export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Toast) => {
    setToasts((prev) => [...prev, toast]);
    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, 4000);
  }, []);

  useEffect(() => {
    listeners.add(addToast);
    return () => { listeners.delete(addToast); };
  }, [addToast]);

  const colors = {
    success: 'bg-green-500/15 border-green-500/30 text-green-300',
    error: 'bg-red-500/15 border-red-500/30 text-red-300',
    info: 'bg-brand-500/15 border-brand-500/30 text-brand-300',
  };

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl animate-slide-up ${colors[toast.type]}`}
          role="alert"
        >
          <span className="text-sm font-bold" aria-hidden="true">{icons[toast.type]}</span>
          <p className="text-sm">{toast.message}</p>
          <button
            onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
            className="ml-auto p-1 rounded hover:bg-white/10 transition-colors"
            aria-label="Dismiss notification"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
