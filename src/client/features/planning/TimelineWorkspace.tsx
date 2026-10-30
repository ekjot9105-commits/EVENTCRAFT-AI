import { useMemo, useState, type FormEvent } from 'react';
import Button from '../../shared/components/Button';
import Card from '../../shared/components/Card';
import Input from '../../shared/components/Input';
import type { TimelineItem } from '../../../shared/types/timeline';
import type { Event } from '../../../shared/types/event';
import TimelineHighway3D from './TimelineHighway3D';
import TimelineGanttTable from './TimelineGanttTable';
import TimelineMilestoneList from './TimelineMilestoneList';
import { fireConfetti } from '../../shared/utils/confettiBurst';
import { prefersReducedMotion } from '../../shared/utils/motion';
import { planningApi } from '../../shared/api/client';
import { WorkspaceLayout, FormError } from './WorkspaceComponents';
import {
  RUN_OF_SHOW_SLOTS,
  URGENCY_FILTERS,
  VIEW_MODES,
  countByUrgency,
  getUrgency,
  starterMilestones,
  type TimelineViewMode,
  type UrgencyFilter,
} from './timelineModel';

interface TimelineWorkspaceProps {
  eventId: string;
  event: Event | null;
  items: TimelineItem[];
  onChanged: () => Promise<void>;
}

export default function TimelineWorkspace({ eventId, event, items, onChanged }: TimelineWorkspaceProps) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [editing, setEditing] = useState<TimelineItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('All');
  // Users who prefer reduced motion start on the static, screen-reader-friendly table.
  const [viewMode, setViewMode] = useState<TimelineViewMode>(() => (prefersReducedMotion() ? 'gantt-table' : '3d-highway'));

  const counts = useMemo(() => countByUrgency(items), [items]);
  const filteredItems = useMemo(
    () => (urgencyFilter === 'All' ? items : items.filter((item) => getUrgency(item) === urgencyFilter)),
    [items, urgencyFilter],
  );
  const isRunOfShow = viewMode === 'run-of-show';

  /** Shared busy/error handling; every mutation refreshes the workspace on success. */
  const run = async (work: () => Promise<unknown>, fallbackError: string) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      await onChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : fallbackError);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => { setTitle(''); setDueDate(''); setEditing(null); };

  const seedStarterMilestones = () => run(
    () => Promise.all(starterMilestones(event?.date).map((milestone) => planningApi.timeline.create(eventId, milestone))),
    'Failed to initialize timeline',
  );

  const save = (formEvent: FormEvent) => {
    formEvent.preventDefault();
    if (!title.trim()) { setError('Enter a task or milestone title.'); return; }
    const payload = { title, due_date: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : undefined };
    void run(async () => {
      if (editing) await planningApi.timeline.update(eventId, editing.id, payload);
      else await planningApi.timeline.create(eventId, payload);
      reset();
    }, 'Unable to save milestone.');
  };

  const toggle = (item: TimelineItem) => run(() => {
    if (item.status !== 'completed') fireConfetti(undefined, undefined, 50);
    return planningApi.timeline.update(eventId, item.id, { status: item.status === 'completed' ? 'pending' : 'completed' });
  }, 'Unable to update milestone.');

  const remove = (item: TimelineItem) => {
    if (!window.confirm(`Delete ${item.title}?`)) return Promise.resolve();
    return run(() => planningApi.timeline.remove(eventId, item.id), 'Unable to delete milestone.');
  };

  const edit = (item: TimelineItem) => {
    setEditing(item);
    setTitle(item.title);
    setDueDate(item.due_date ? item.due_date.slice(0, 10) : '');
  };

  const listProps = { items: filteredItems, busy, onToggle: toggle, onEdit: edit, onRemove: remove };

  return (
    <WorkspaceLayout title="Timeline workspace" description="Create, edit, complete, and organize milestones and day-of schedules.">
      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3" role="group" aria-label="Timeline view">
        {VIEW_MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            aria-pressed={viewMode === mode.id}
            title={mode.title}
            onClick={() => setViewMode(mode.id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              viewMode === mode.id ? mode.activeClass : 'text-surface-400 hover:text-surface-200 hover:bg-white/5'
            }`}
          >
            <span aria-hidden="true">{mode.icon}</span> {mode.label}
          </button>
        ))}
      </div>

      {items.length === 0 && (
        <Card className="border border-brand-500/30 bg-brand-950/20 p-5 text-center">
          <p className="text-sm text-surface-200">No milestones have been added to your timeline yet.</p>
          <Button className="mt-3" size="sm" onClick={() => void seedStarterMilestones()} loading={busy}>
            <span aria-hidden="true">⚡</span> Add Starter Milestones for this Event
          </Button>
        </Card>
      )}

      {isRunOfShow && (
        <Card className="border border-brand-500/30 bg-brand-950/20 p-5">
          <div className="flex items-center gap-2 text-brand-300 font-semibold mb-2">
            <span aria-hidden="true">⏱️</span>
            <h2>Day-Of "Run-of-Show" Schedule Builder</h2>
          </div>
          <p className="text-xs text-surface-300 mb-3">Click any hour-by-hour slot below to quickly add it to your schedule:</p>
          <div className="flex flex-wrap gap-2">
            {RUN_OF_SHOW_SLOTS.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setTitle(slot)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-surface-200 hover:bg-brand-500/20 hover:border-brand-400 transition-colors"
              >
                + {slot}
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="text-sm font-semibold text-surface-200 mb-3">
          {editing ? 'Edit Milestone' : isRunOfShow ? 'Add Day-Of Schedule Item' : 'Add Milestone'}
        </h2>
        <FormError error={error} />
        <form className="form-grid" onSubmit={save}>
          <Input
            label={isRunOfShow ? 'Hour & Activity' : 'Task or milestone'}
            required
            value={title}
            onChange={(eventInput) => setTitle(eventInput.target.value)}
            placeholder={isRunOfShow ? 'e.g. 02:00 PM — Main Ceremony' : 'e.g. Book Photographer Deposit'}
          />
          <Input label="Due date" type="date" value={dueDate} onChange={(eventInput) => setDueDate(eventInput.target.value)} />
          <div className="flex items-end gap-2">
            <Button type="submit" loading={busy}>{editing ? 'Save changes' : 'Add milestone'}</Button>
            {editing && <Button type="button" variant="secondary" onClick={reset}>Cancel</Button>}
          </div>
        </form>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-semibold text-surface-200">
            {isRunOfShow ? 'Day-Of Schedule' : 'Milestones'} ({filteredItems.length})
          </h2>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter milestones by urgency">
            {URGENCY_FILTERS.map((filter) => {
              const count = filter === 'All' ? items.length : counts[filter];
              const tone = urgencyFilter === filter
                ? 'bg-brand-700 text-white shadow-sm'
                : filter === 'Overdue' && count > 0
                  ? 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25'
                  : filter === 'Due this week' && count > 0
                    ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
                    : 'bg-white/5 text-surface-400 hover:text-surface-200 hover:bg-white/10';
              return (
                <button
                  key={filter}
                  type="button"
                  aria-pressed={urgencyFilter === filter}
                  onClick={() => setUrgencyFilter(filter)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${tone}`}
                >
                  {filter} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {viewMode === '3d-highway' ? (
          <TimelineHighway3D {...listProps} />
        ) : viewMode === 'gantt-table' ? (
          <TimelineGanttTable {...listProps} />
        ) : (
          <TimelineMilestoneList {...listProps} onToggle={(item) => void toggle(item)} onRemove={(item) => void remove(item)} />
        )}
      </Card>
    </WorkspaceLayout>
  );
}
