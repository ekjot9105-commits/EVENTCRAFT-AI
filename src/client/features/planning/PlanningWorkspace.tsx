import { useEffect, useMemo, useState, useCallback, type FormEvent, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { planningApi, eventsApi } from '../../shared/api/client';
import Button from '../../shared/components/Button';
import Card from '../../shared/components/Card';
import Input from '../../shared/components/Input';
import Select from '../../shared/components/Select';
import Spinner from '../../shared/components/Spinner';
import type { BudgetItem } from '../../../shared/types/budget';
import type { TimelineItem } from '../../../shared/types/timeline';
import type { Vendor } from '../../../shared/types/vendor';
import type { Event } from '../../../shared/types/event';
import BackButton from '../../shared/components/BackButton';
import Tilt3DCard from '../../shared/components/Tilt3DCard';
import Budget3DDonut from '../../shared/components/Budget3DDonut';
import TimelineHighway3D from './TimelineHighway3D';
import { fireConfetti } from '../../shared/utils/confettiBurst';

type WorkspaceKind = 'budget' | 'timeline' | 'vendors';

interface PlanningWorkspaceProps { kind: WorkspaceKind }

/** Provides event-scoped, persisted CRUD controls for the three planning workspaces. */
export default function PlanningWorkspace({ kind }: PlanningWorkspaceProps) {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true); setError(null);
    try {
      const ev = await eventsApi.getById(id).catch(() => null);
      if (ev) setEvent(ev);
      if (kind === 'budget') setBudgetItems(await planningApi.budget.list(id));
      if (kind === 'timeline') setTimelineItems(await planningApi.timeline.list(id));
      if (kind === 'vendors') setVendors(await planningApi.vendors.list(id));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load planning data.');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    let cancelled = false;
    const fetchWorkspace = async () => {
      if (!id) return;
      setLoading(true); setError(null);
      try {
        const [ev, items] = await Promise.all([
          eventsApi.getById(id).catch(() => null),
          kind === 'budget' ? planningApi.budget.list(id) : kind === 'timeline' ? planningApi.timeline.list(id) : planningApi.vendors.list(id),
        ]);
        if (!cancelled) {
          if (ev) setEvent(ev);
          if (kind === 'budget') setBudgetItems(items as BudgetItem[]);
          if (kind === 'timeline') setTimelineItems(items as TimelineItem[]);
          if (kind === 'vendors') setVendors(items as Vendor[]);
        }
      } catch (requestError) {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : 'Unable to load planning data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchWorkspace();
    return () => { cancelled = true; };
  }, [id, kind]);

  if (!id) return <Card><p className="form-error" role="alert">This workspace is missing an event ID.</p></Card>;
  if (loading) return <div className="flex justify-center py-16" role="status"><Spinner size="lg" /><span className="sr-only">Loading planning data</span></div>;
  if (error) return <Card><p className="form-error" role="alert">{error}</p><Button className="mt-4" onClick={() => void load()}>Retry</Button></Card>;

  if (kind === 'budget') return <BudgetWorkspace eventId={id} event={event} items={budgetItems} onChanged={load} />;
  if (kind === 'timeline') return <TimelineWorkspace eventId={id} event={event} items={timelineItems} onChanged={load} />;
  return <VendorWorkspace eventId={id} event={event} vendors={vendors} onChanged={load} />;
}

const BUDGET_PRESET_CATEGORIES = ['Venue', 'Catering', 'Decor', 'Media', 'Permits', 'Entertainment', 'Transport'];
const VENDOR_PRESET_CATEGORIES = ['Venue', 'Food & Drinks', 'Photo/Video', 'Entertainment', 'Florals & Decor', 'Rentals'];

function BudgetWorkspace({ eventId, event, items, onChanged }: { eventId: string; event: Event | null; items: BudgetItem[]; onChanged: () => Promise<void> }) {
  const [category, setCategory] = useState('');
  const [name, setName] = useState('');
  const [estimated, setEstimated] = useState('');
  const [actual, setActual] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [editing, setEditing] = useState<BudgetItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const planned = useMemo(() => items.reduce((sum, item) => sum + item.estimated_cost, 0), [items]);
  const actualTotal = useMemo(() => items.reduce((sum, item) => sum + (item.actual_cost ?? 0), 0), [items]);
  const totalEventBudget = (event?.budget_amount && event.budget_amount > 0) ? event.budget_amount : (planned > 0 ? planned : 0);
  const remaining = totalEventBudget - actualTotal;
  const percentSpent = totalEventBudget > 0 ? Math.min(Math.round((actualTotal / totalEventBudget) * 100), 100) : 0;

  // Determine Budget Health status
  let healthStatus = 'On Track';
  let healthBadgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  let progressFillColor = 'bg-emerald-500';

  if (actualTotal > totalEventBudget && totalEventBudget > 0) {
    healthStatus = 'Over Budget';
    healthBadgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    progressFillColor = 'bg-rose-500';
  } else if (actualTotal >= totalEventBudget * 0.85 && totalEventBudget > 0) {
    healthStatus = 'Approaching Limit';
    healthBadgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    progressFillColor = 'bg-amber-500';
  }

  // Categories list
  const allCategories = useMemo(() => {
    const set = new Set([...BUDGET_PRESET_CATEGORIES, ...items.map((i) => i.category)]);
    return ['All', ...Array.from(set)];
  }, [items]);

  const filteredItems = useMemo(() => {
    if (selectedCategory === 'All') return items;
    return items.filter((i) => i.category.toLowerCase() === selectedCategory.toLowerCase());
  }, [items, selectedCategory]);

  const autoSeedBudget = async () => {
    setBusy(true); setError(null);
    try {
      const type = event?.type ?? 'wedding';
      const effBudget = totalEventBudget > 0 ? totalEventBudget : 1000;
      const categories: Array<[string, number]> = type === 'wedding'
        ? [['Venue & Catering', 0.45], ['Photography & Media', 0.15], ['Flowers & Decor', 0.15], ['Music & DJ', 0.15], ['Contingency Buffer', 0.10]]
        : type === 'birthday'
          ? [['Venue & Food', 0.40], ['Entertainment & Games', 0.25], ['Cake & Decor', 0.20], ['Favors & Contingency', 0.15]]
          : [['Venue & Permits', 0.35], ['Food & Supplies', 0.30], ['Sound & Activities', 0.20], ['Volunteers & Safety', 0.15]];
      for (const [cat, ratio] of categories) {
        await planningApi.budget.create(eventId, {
          category: String(cat),
          name: `${cat} Allocation`,
          estimated_cost: Math.round(effBudget * Number(ratio) * 100) / 100,
        });
      }
      fireConfetti(undefined, undefined, 60);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to initialize budget');
    } finally {
      setBusy(false);
    }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const estimatedCost = Number(estimated);
    if (!category.trim() || !name.trim() || !Number.isFinite(estimatedCost) || estimatedCost < 0) {
      setError('Enter a category, item name, and a nonnegative estimated cost.');
      return;
    }
    setBusy(true); setError(null);
    try {
      const payload = { category, name, estimated_cost: estimatedCost, actual_cost: actual ? Number(actual) : undefined };
      if (editing) await planningApi.budget.update(eventId, editing.id, payload);
      else await planningApi.budget.create(eventId, payload);
      fireConfetti(undefined, undefined, 45);
      reset(); await onChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save budget item.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item: BudgetItem) => {
    if (!window.confirm(`Delete ${item.name}?`)) return;
    setBusy(true); setError(null);
    try {
      await planningApi.budget.remove(eventId, item.id);
      await onChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to delete budget item.');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => { setCategory(''); setName(''); setEstimated(''); setActual(''); setEditing(null); };
  const edit = (item: BudgetItem) => {
    setEditing(item);
    setCategory(item.category);
    setName(item.name);
    setEstimated(String(item.estimated_cost));
    setActual(item.actual_cost == null ? '' : String(item.actual_cost));
  };

  return (
    <WorkspaceLayout title="Budget workspace" description="Track planned and actual spending with persisted, editable expense records.">
      {/* Dynamic Budget Health Card */}
      <Card className="border border-white/10 bg-gradient-to-br from-surface-900 to-surface-850 p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <span className="eyebrow">Financial Overview</span>
            <h2 className="text-xl font-bold text-surface-100 flex items-center gap-2">
              <span>📊</span> Budget Health & Tracking
            </h2>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${healthBadgeColor}`}>
            <span className={`h-2 w-2 rounded-full ${progressFillColor} animate-pulse`} />
            {healthStatus}
          </span>
        </div>

        {/* Holographic 3D Budget Ring & Progress Meter */}
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] items-center mb-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium text-surface-300">
                <span>Spending Progress ({percentSpent}%)</span>
                <span>{remaining >= 0 ? `$${remaining.toLocaleString()} Remaining` : `$${Math.abs(remaining).toLocaleString()} Over`}</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-white/10 p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${progressFillColor}`}
                  style={{ width: `${percentSpent}%` }}
                />
              </div>
            </div>
            <p className="text-xs text-surface-400">
              Interactive 3D budget ring reflects your live category allocations. Rotate the ring or hover slices to inspect financial distribution.
            </p>
          </div>
          <div className="flex justify-center">
            <Budget3DDonut
              items={items}
              totalBudget={totalEventBudget}
              currency={event?.currency}
            />
          </div>
        </div>

        {/* Metric Cards Grid with 3D Tilt */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tilt3DCard intensity={8} glare={true} className="rounded-xl">
            <div className="rounded-xl border border-brand-500/20 bg-brand-950/20 p-4 text-center h-full">
              <p className="text-xs uppercase tracking-wider text-brand-300 font-semibold">Target Event Budget</p>
              <p className="mt-1 text-2xl font-bold text-surface-100">
                ${totalEventBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </Tilt3DCard>
          <Tilt3DCard intensity={8} glare={true} className="rounded-xl">
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4 text-center h-full">
              <p className="text-xs uppercase tracking-wider text-surface-400">Planned Allocations</p>
              <p className="mt-1 text-2xl font-bold text-surface-100">${planned.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </Tilt3DCard>
          <Tilt3DCard intensity={8} glare={true} className="rounded-xl">
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4 text-center h-full">
              <p className="text-xs uppercase tracking-wider text-surface-400">Actual Spent</p>
              <p className="mt-1 text-2xl font-bold text-surface-100">${actualTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </Tilt3DCard>
          <Tilt3DCard intensity={8} glare={true} className="rounded-xl">
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4 text-center h-full">
              <p className="text-xs uppercase tracking-wider text-surface-400">Remaining Balance</p>
              <p className={`mt-1 text-2xl font-bold ${remaining >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ${remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </Tilt3DCard>
        </div>

        {/* Empty Items Helper */}
        {items.length === 0 && (
          <div className="mt-5 rounded-xl border border-brand-500/30 bg-brand-950/30 p-4 text-center">
            <p className="text-sm text-surface-200">
              Your target budget of <strong className="text-brand-300">${totalEventBudget.toLocaleString()}</strong> has not been distributed to line items yet.
            </p>
            <Button className="mt-3" size="sm" onClick={() => void autoSeedBudget()} loading={busy}>
              ⚡ Auto-Allocate ${totalEventBudget.toLocaleString()} across Categories
            </Button>
          </div>
        )}
      </Card>

      {/* Add / Edit Form */}
      <Card>
        <h3 className="text-sm font-semibold text-surface-200 mb-3">{editing ? 'Edit Expense' : 'Add New Expense'}</h3>
        {error && <p className="form-error mb-3" role="alert">{error}</p>}
        
        {/* Preset Category Chips */}
        <div className="mb-4">
          <p className="text-xs text-surface-400 mb-2">Quick Categories:</p>
          <div className="flex flex-wrap gap-1.5">
            {BUDGET_PRESET_CATEGORIES.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setCategory(preset)}
                className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                  category === preset
                    ? 'bg-brand-500 text-white'
                    : 'bg-white/5 text-surface-300 hover:bg-white/10'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <form className="form-grid" onSubmit={save}>
          <Input label="Category" required value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Venue, Catering, Decor..." />
          <Input label="Item name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Wedding Hall Deposit" />
          <Input label="Estimated cost ($)" required type="number" min={0} step="0.01" value={estimated} onChange={(event) => setEstimated(event.target.value)} />
          <Input label="Actual cost ($)" type="number" min={0} step="0.01" value={actual} onChange={(event) => setActual(event.target.value)} placeholder="Optional until paid" />
          <div className="flex items-end gap-2">
            <Button type="submit" loading={busy}>{editing ? 'Save changes' : 'Add expense'}</Button>
            {editing && <Button type="button" variant="secondary" onClick={reset}>Cancel</Button>}
          </div>
        </form>
      </Card>

      {/* Category Filter Pills & Items List */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold text-surface-200">
            Expenses List ({filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'})
          </h3>
          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-1.5">
            {allCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  selectedCategory === cat
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'bg-white/5 text-surface-400 hover:text-surface-200 hover:bg-white/10'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <RecordList
          empty="No expenses found in this category."
          records={filteredItems.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm text-surface-200 border-b border-white/5 last:border-none">
              <div>
                <span className="inline-block rounded-md bg-white/5 px-2 py-0.5 text-xs text-brand-300 mr-2 font-medium">
                  {item.category}
                </span>
                <strong className="text-surface-100">{item.name}</strong>
                <span className="text-surface-400 ml-2">
                  — ${item.estimated_cost.toFixed(2)} est.{item.actual_cost != null ? ` · $${item.actual_cost.toFixed(2)} actual` : ''}
                </span>
              </div>
              <span className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => edit(item)}>Edit</Button>
                <Button size="sm" variant="danger" onClick={() => void remove(item)} disabled={busy}>Delete</Button>
              </span>
            </li>
          ))}
        />
      </Card>
    </WorkspaceLayout>
  );
}

function TimelineWorkspace({ eventId, event, items, onChanged }: { eventId: string; event: Event | null; items: TimelineItem[]; onChanged: () => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [editing, setEditing] = useState<TimelineItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urgencyFilter, setUrgencyFilter] = useState<'All' | 'Overdue' | 'Due this week' | 'Upcoming' | 'Completed'>('All');
  const [viewMode, setViewMode] = useState<'3d-highway' | 'milestones' | 'run-of-show'>('3d-highway');

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const endOfWeek = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(23, 59, 59, 999);
    return d;
  }, []);

  const getUrgency = useCallback((item: TimelineItem) => {
    if (item.status === 'completed') return 'Completed';
    if (!item.due_date) return 'Upcoming';
    const due = new Date(item.due_date);
    if (due < today) return 'Overdue';
    if (due <= endOfWeek) return 'Due this week';
    return 'Upcoming';
  }, [today, endOfWeek]);

  const counts = useMemo(() => {
    const map = { Overdue: 0, 'Due this week': 0, Upcoming: 0, Completed: 0 };
    items.forEach((item) => {
      const u = getUrgency(item);
      map[u]++;
    });
    return map;
  }, [items, getUrgency]);

  const filteredItems = useMemo(() => {
    if (urgencyFilter === 'All') return items;
    return items.filter((item) => getUrgency(item) === urgencyFilter);
  }, [items, urgencyFilter, getUrgency]);

  const autoSeedTimeline = async () => {
    setBusy(true); setError(null);
    try {
      const eventTime = event?.date ? new Date(event.date).getTime() : Date.now() + 60 * 86_400_000;
      const daysBefore = (days: number) => new Date(Math.max(Date.now() + 86_400_000, eventTime - days * 86_400_000)).toISOString();
      const milestones = [
        { title: 'Confirm Venue Contract & Deposit', due: daysBefore(45) },
        { title: 'Lock in Catering & Dietary Choices', due: daysBefore(30) },
        { title: 'Book Photographer & Music Team', due: daysBefore(21) },
        { title: 'Send Invitations & Confirm RSVPs', due: daysBefore(14) },
        { title: 'Day-Of Setup & Event Execution', due: daysBefore(0) },
      ];
      for (const m of milestones) {
        await planningApi.timeline.create(eventId, { title: m.title, due_date: m.due });
      }
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to initialize timeline');
    } finally {
      setBusy(false);
    }
  };

  const save = async (eventForm: FormEvent) => {
    eventForm.preventDefault();
    if (!title.trim()) { setError('Enter a task or milestone title.'); return; }
    setBusy(true); setError(null);
    try {
      const payload = { title, due_date: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : undefined };
      if (editing) await planningApi.timeline.update(eventId, editing.id, payload);
      else await planningApi.timeline.create(eventId, payload);
      reset(); await onChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save milestone.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (item: TimelineItem) => {
    setBusy(true); setError(null);
    try {
      if (item.status !== 'completed') {
        fireConfetti(undefined, undefined, 50);
      }
      await planningApi.timeline.update(eventId, item.id, { status: item.status === 'completed' ? 'pending' : 'completed' });
      await onChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update milestone.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item: TimelineItem) => {
    if (!window.confirm(`Delete ${item.title}?`)) return;
    setBusy(true);
    try {
      await planningApi.timeline.remove(eventId, item.id);
      await onChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to delete milestone.');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => { setTitle(''); setDueDate(''); setEditing(null); };
  const edit = (item: TimelineItem) => {
    setEditing(item);
    setTitle(item.title);
    setDueDate(item.due_date ? item.due_date.slice(0, 10) : '');
  };

  // Day-Of Run of Show Templates
  const applyRunOfShowPreset = async (presetTitle: string) => {
    setTitle(presetTitle);
  };

  const runOfShowSuggestions = [
    '08:00 AM — Vendor & Catering Load-in',
    '10:30 AM — Decor, Floral & AV Soundcheck',
    '01:00 PM — Guest Arrival & Welcome Refreshments',
    '02:00 PM — Main Ceremony / Event Kickoff',
    '04:00 PM — Dinner, Toasts & Entertainment',
    '07:30 PM — Cake Cutting / Highlight Moment',
    '09:30 PM — Closing Remarks & Teardown',
  ];

  return (
    <WorkspaceLayout title="Timeline workspace" description="Create, edit, complete, and organize milestones and day-of schedules.">
      {/* View Mode Toggle: 3D Highway vs Milestones vs Day-Of Run-of-Show */}
      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
        <button
          type="button"
          onClick={() => setViewMode('3d-highway')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
            viewMode === '3d-highway'
              ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-lg shadow-brand-600/30 ring-1 ring-white/20'
              : 'text-surface-400 hover:text-surface-200 hover:bg-white/5'
          }`}
        >
          <span>🛣️</span> 3D Spatial Highway
        </button>
        <button
          type="button"
          onClick={() => setViewMode('milestones')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
            viewMode === 'milestones'
              ? 'bg-brand-600 text-white shadow-md'
              : 'text-surface-400 hover:text-surface-200 hover:bg-white/5'
          }`}
        >
          <span>📅</span> Milestone List
        </button>
        <button
          type="button"
          onClick={() => setViewMode('run-of-show')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
            viewMode === 'run-of-show'
              ? 'bg-brand-600 text-white shadow-md'
              : 'text-surface-400 hover:text-surface-200 hover:bg-white/5'
          }`}
        >
          <span>⏱️</span> Day-Of "Run-of-Show" View
        </button>
      </div>

      {/* Empty Milestones Helper */}
      {items.length === 0 && (
        <Card className="border border-brand-500/30 bg-brand-950/20 p-5 text-center">
          <p className="text-sm text-surface-200">
            No milestones have been added to your timeline yet.
          </p>
          <Button className="mt-3" size="sm" onClick={() => void autoSeedTimeline()} loading={busy}>
            ⚡ Add Starter Milestones for this Event
          </Button>
        </Card>
      )}

      {/* Day-Of Run of Show Banner */}
      {viewMode === 'run-of-show' && (
        <Card className="border border-brand-500/30 bg-brand-950/20 p-5">
          <div className="flex items-center gap-2 text-brand-300 font-semibold mb-2">
            <span>⏱️</span>
            <h3>Day-Of "Run-of-Show" Schedule Builder</h3>
          </div>
          <p className="text-xs text-surface-300 mb-3">
            Click any hour-by-hour slot below to quickly add it to your schedule:
          </p>
          <div className="flex flex-wrap gap-2">
            {runOfShowSuggestions.map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => void applyRunOfShowPreset(slot)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-surface-200 hover:bg-brand-500/20 hover:border-brand-400 transition-colors"
              >
                + {slot}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Add / Edit Form */}
      <Card>
        <h3 className="text-sm font-semibold text-surface-200 mb-3">
          {editing ? 'Edit Milestone' : viewMode === 'run-of-show' ? 'Add Day-Of Schedule Item' : 'Add Milestone'}
        </h3>
        {error && <p className="form-error mb-3" role="alert">{error}</p>}
        <form className="form-grid" onSubmit={save}>
          <Input
            label={viewMode === 'run-of-show' ? 'Hour & Activity' : 'Task or milestone'}
            required
            value={title}
            onChange={(eventInput) => setTitle(eventInput.target.value)}
            placeholder={viewMode === 'run-of-show' ? 'e.g. 02:00 PM — Main Ceremony' : 'e.g. Book Photographer Deposit'}
          />
          <Input label="Due date" type="date" value={dueDate} onChange={(eventInput) => setDueDate(eventInput.target.value)} />
          <div className="flex items-end gap-2">
            <Button type="submit" loading={busy}>{editing ? 'Save changes' : 'Add milestone'}</Button>
            {editing && <Button type="button" variant="secondary" onClick={reset}>Cancel</Button>}
          </div>
        </form>
      </Card>

      {/* Urgency Filter Pills & Timeline Records */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold text-surface-200">
            {viewMode === 'run-of-show' ? 'Day-Of Schedule' : 'Milestones'} ({filteredItems.length})
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {(['All', 'Overdue', 'Due this week', 'Upcoming', 'Completed'] as const).map((filter) => {
              const count = filter === 'All' ? items.length : counts[filter];
              const isOverdue = filter === 'Overdue' && count > 0;
              const isDueThisWeek = filter === 'Due this week' && count > 0;
              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setUrgencyFilter(filter)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                    urgencyFilter === filter
                      ? 'bg-brand-500 text-white shadow-sm'
                      : isOverdue
                      ? 'bg-rose-500/15 text-rose-300 hover:bg-rose-500/25'
                      : isDueThisWeek
                      ? 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
                      : 'bg-white/5 text-surface-400 hover:text-surface-200 hover:bg-white/10'
                  }`}
                >
                  {filter} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {viewMode === '3d-highway' ? (
          <TimelineHighway3D
            items={filteredItems}
            onToggle={toggle}
            onEdit={edit}
            onRemove={remove}
            busy={busy}
          />
        ) : (
          <RecordList
            empty="No tasks match this filter."
            records={filteredItems.map((item) => {
              const urgency = getUrgency(item);
              let badgeStyle = 'bg-surface-700/50 text-surface-300';
              if (urgency === 'Overdue') badgeStyle = 'bg-rose-500/20 text-rose-300 border border-rose-500/30';
              else if (urgency === 'Due this week') badgeStyle = 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
              else if (urgency === 'Completed') badgeStyle = 'bg-emerald-500/20 text-emerald-300';

              return (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm text-surface-200 border-b border-white/5 last:border-none">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${badgeStyle}`}>
                      {urgency}
                    </span>
                    <span className={item.status === 'completed' ? 'line-through text-surface-500' : 'text-surface-100 font-medium'}>
                      {item.title}
                    </span>
                    {item.due_date && (
                      <span className="text-xs text-surface-400">
                        📅 {new Date(item.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <span className="flex gap-2">
                    <Button size="sm" onClick={() => void toggle(item)} disabled={busy} variant={item.status === 'completed' ? 'secondary' : 'primary'}>
                      {item.status === 'completed' ? 'Reopen' : '✓ Complete'}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => edit(item)}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => void remove(item)} disabled={busy}>Delete</Button>
                  </span>
                </li>
              );
            })}
          />
        )}
      </Card>
    </WorkspaceLayout>
  );
}

function VendorWorkspace({ eventId, event, vendors, onChanged }: { eventId: string; event: Event | null; vendors: Vendor[]; onChanged: () => Promise<void> }) {
  const [category, setCategory] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<Vendor['status']>('not_started');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Vendor Readiness calculations
  const bookedCount = useMemo(() => vendors.filter((v) => v.status === 'booked' || v.status === 'paid').length, [vendors]);
  const readinessPercent = vendors.length > 0 ? Math.round((bookedCount / vendors.length) * 100) : 0;

  // Category list
  const allCategories = useMemo(() => {
    const set = new Set([...VENDOR_PRESET_CATEGORIES, ...vendors.map((v) => v.category)]);
    return ['All', ...Array.from(set)];
  }, [vendors]);

  const filteredVendors = useMemo(() => {
    if (selectedCategory === 'All') return vendors;
    return vendors.filter((v) => v.category.toLowerCase() === selectedCategory.toLowerCase());
  }, [vendors, selectedCategory]);

  const autoSeedVendors = async () => {
    setBusy(true); setError(null);
    try {
      const type = event?.type ?? 'wedding';
      const vendorList = type === 'wedding'
        ? ['Venue Coordinator', 'Catering Specialist', 'Wedding Photographer', 'DJ / Sound Engineer', 'Florist & Decor']
        : type === 'birthday'
          ? ['Party Venue Host', 'Cake Artist', 'Party Entertainer / DJ', 'Balloon & Decor Specialist']
          : ['Venue & Permits Office', 'Sound & Audio Provider', 'Food & Supplies Vendor', 'Safety Coordinator'];
      for (const vName of vendorList) {
        await planningApi.vendors.create(eventId, { category: vName, name: `${vName}`, status: 'not_started' });
      }
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to initialize vendors');
    } finally {
      setBusy(false);
    }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!category.trim() || !name.trim()) { setError('Enter a vendor category and name.'); return; }
    setBusy(true); setError(null);
    try {
      const payload = { category, name, status };
      if (status === 'booked' || status === 'paid') {
        fireConfetti(undefined, undefined, 50);
      }
      if (editing) await planningApi.vendors.update(eventId, editing.id, payload);
      else await planningApi.vendors.create(eventId, payload);
      reset(); await onChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save vendor.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (vendor: Vendor) => {
    if (!window.confirm(`Delete ${vendor.name}?`)) return;
    setBusy(true);
    try {
      await planningApi.vendors.remove(eventId, vendor.id);
      await onChanged();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to delete vendor.');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => { setCategory(''); setName(''); setStatus('not_started'); setEditing(null); };
  const edit = (vendor: Vendor) => {
    setEditing(vendor);
    setCategory(vendor.category);
    setName(vendor.name);
    setStatus(vendor.status);
  };

  return (
    <WorkspaceLayout title="Vendor checklist" description="Track vendor categories, quotes, and booking readiness in one place.">
      {/* Vendor Readiness Progress Bar Card with 3D Tilt */}
      <Tilt3DCard intensity={6} glare={true} className="rounded-2xl">
        <Card className="border border-white/10 bg-gradient-to-br from-surface-900 to-surface-850 p-6 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <span className="eyebrow">Booking Status</span>
              <h2 className="text-xl font-bold text-surface-100 flex items-center gap-2">
                <span>🤝</span> Vendor Readiness: {bookedCount} of {vendors.length} Booked
              </h2>
            </div>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              {readinessPercent}% Ready
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-3 w-full overflow-hidden rounded-full bg-white/10 p-0.5">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-700 ease-out"
              style={{ width: `${readinessPercent}%` }}
            />
          </div>

          {vendors.length === 0 && (
            <div className="mt-5 rounded-xl border border-brand-500/30 bg-brand-950/30 p-4 text-center">
              <p className="text-sm text-surface-200">
                No vendors tracked yet for this event.
              </p>
              <Button className="mt-3" size="sm" onClick={() => void autoSeedVendors()} loading={busy}>
                ⚡ Auto-Generate Essential Vendor Checklist
              </Button>
            </div>
          )}
        </Card>
      </Tilt3DCard>

      {/* Add / Edit Form */}
      <Card>
        <h3 className="text-sm font-semibold text-surface-200 mb-3">{editing ? 'Edit Vendor' : 'Add New Vendor'}</h3>
        {error && <p className="form-error mb-3" role="alert">{error}</p>}

        {/* Quick Category Chips */}
        <div className="mb-4">
          <p className="text-xs text-surface-400 mb-2">Quick Vendor Categories:</p>
          <div className="flex flex-wrap gap-1.5">
            {VENDOR_PRESET_CATEGORIES.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setCategory(preset)}
                className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                  category === preset
                    ? 'bg-brand-500 text-white'
                    : 'bg-white/5 text-surface-300 hover:bg-white/10'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <form className="form-grid" onSubmit={save}>
          <Input label="Category" required value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Venue, Catering, Photo/Video..." />
          <Input label="Vendor name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Sunset Sound DJ or Flora Studio" />
          <Select
            label="Status"
            value={status}
            onChange={(event) => setStatus(event.target.value as Vendor['status'])}
            options={[
              { value: 'not_started', label: 'Not started' },
              { value: 'contacted', label: 'Contacted' },
              { value: 'quoted', label: 'Quoted' },
              { value: 'booked', label: 'Booked' },
              { value: 'paid', label: 'Paid' },
            ]}
          />
          <div className="flex items-end gap-2">
            <Button type="submit" loading={busy}>{editing ? 'Save changes' : 'Add vendor'}</Button>
            {editing && <Button type="button" variant="secondary" onClick={reset}>Cancel</Button>}
          </div>
        </form>
      </Card>

      {/* Quick-filter by Category & Vendors List */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold text-surface-200">
            Vendors ({filteredVendors.length})
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {allCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  selectedCategory === cat
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'bg-white/5 text-surface-400 hover:text-surface-200 hover:bg-white/10'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <RecordList
          empty="No vendors in this category."
          records={filteredVendors.map((vendor) => {
            const isBooked = vendor.status === 'booked' || vendor.status === 'paid';
            return (
              <li key={vendor.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm text-surface-200 border-b border-white/5 last:border-none">
                <div>
                  <span className="inline-block rounded-md bg-white/5 px-2 py-0.5 text-xs text-brand-300 mr-2 font-medium">
                    {vendor.category}
                  </span>
                  <strong className="text-surface-100">{vendor.name}</strong>
                  <span className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                    isBooked ? 'bg-emerald-500/20 text-emerald-300' : 'bg-surface-700/50 text-surface-400'
                  }`}>
                    {vendor.status.replace('_', ' ')}
                  </span>
                </div>
                <span className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => edit(vendor)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => void remove(vendor)} disabled={busy}>Delete</Button>
                </span>
              </li>
            );
          })}
        />
      </Card>
    </WorkspaceLayout>
  );
}

function WorkspaceLayout({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="space-y-5 animate-fade-in">
      <BackButton />
      <div>
        <p className="eyebrow">Persistent workspace</p>
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{description}</p>
      </div>
      {children}
    </div>
  );
}

function RecordList({ records, empty }: { records: ReactNode[]; empty: string }) {
  return records.length === 0 ? <p className="text-sm text-surface-400 py-4 text-center">{empty}</p> : <ul className="divide-y divide-white/5">{records}</ul>;
}
