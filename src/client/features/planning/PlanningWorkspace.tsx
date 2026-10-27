import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { planningApi } from '../../shared/api/client';
import Button from '../../shared/components/Button';
import Card from '../../shared/components/Card';
import Input from '../../shared/components/Input';
import Select from '../../shared/components/Select';
import Spinner from '../../shared/components/Spinner';
import type { BudgetItem } from '../../../shared/types/budget';
import type { TimelineItem } from '../../../shared/types/timeline';
import type { Vendor } from '../../../shared/types/vendor';

type WorkspaceKind = 'budget' | 'timeline' | 'vendors';

interface PlanningWorkspaceProps { kind: WorkspaceKind }

/** Provides event-scoped, persisted CRUD controls for the three planning workspaces. */
export default function PlanningWorkspace({ kind }: PlanningWorkspaceProps) {
  const { id } = useParams<{ id: string }>();
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true); setError(null);
    try {
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
        if (kind === 'budget') {
          const items = await planningApi.budget.list(id);
          if (!cancelled) setBudgetItems(items);
        }
        if (kind === 'timeline') {
          const items = await planningApi.timeline.list(id);
          if (!cancelled) setTimelineItems(items);
        }
        if (kind === 'vendors') {
          const items = await planningApi.vendors.list(id);
          if (!cancelled) setVendors(items);
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

  if (kind === 'budget') return <BudgetWorkspace eventId={id} items={budgetItems} onChanged={load} />;
  if (kind === 'timeline') return <TimelineWorkspace eventId={id} items={timelineItems} onChanged={load} />;
  return <VendorWorkspace eventId={id} vendors={vendors} onChanged={load} />;
}

function BudgetWorkspace({ eventId, items, onChanged }: { eventId: string; items: BudgetItem[]; onChanged: () => Promise<void> }) {
  const [category, setCategory] = useState('');
  const [name, setName] = useState('');
  const [estimated, setEstimated] = useState('');
  const [actual, setActual] = useState('');
  const [editing, setEditing] = useState<BudgetItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const planned = useMemo(() => items.reduce((sum, item) => sum + item.estimated_cost, 0), [items]);
  const actualTotal = useMemo(() => items.reduce((sum, item) => sum + (item.actual_cost ?? 0), 0), [items]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const estimatedCost = Number(estimated);
    if (!category.trim() || !name.trim() || !Number.isFinite(estimatedCost) || estimatedCost < 0) {
      setError('Enter a category, item name, and a nonnegative estimated cost.'); return;
    }
    setBusy(true); setError(null);
    try {
      const payload = { category, name, estimated_cost: estimatedCost, actual_cost: actual ? Number(actual) : undefined };
      if (editing) await planningApi.budget.update(eventId, editing.id, payload);
      else await planningApi.budget.create(eventId, payload);
      reset(); await onChanged();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to save budget item.'); }
    finally { setBusy(false); }
  };

  const remove = async (item: BudgetItem) => {
    if (!window.confirm(`Delete ${item.name}?`)) return;
    setBusy(true); setError(null);
    try { await planningApi.budget.remove(eventId, item.id); await onChanged(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to delete budget item.'); }
    finally { setBusy(false); }
  };

  const reset = () => { setCategory(''); setName(''); setEstimated(''); setActual(''); setEditing(null); };
  const edit = (item: BudgetItem) => { setEditing(item); setCategory(item.category); setName(item.name); setEstimated(String(item.estimated_cost)); setActual(item.actual_cost == null ? '' : String(item.actual_cost)); };

  return <WorkspaceLayout title="Budget workspace" description="Track planned and actual spending with persisted, editable expense records.">
    <div className="grid gap-4 sm:grid-cols-2"><Metric label="Planned spending" value={planned.toLocaleString(undefined, { style: 'currency', currency: 'USD' })} /><Metric label="Actual spending" value={actualTotal.toLocaleString(undefined, { style: 'currency', currency: 'USD' })} /></div>
    <Card>{error && <p className="form-error mb-3" role="alert">{error}</p>}<form className="form-grid" onSubmit={save}><Input label="Category" required value={category} onChange={(event) => setCategory(event.target.value)} /><Input label="Item name" required value={name} onChange={(event) => setName(event.target.value)} /><Input label="Estimated cost" required type="number" min={0} step="0.01" value={estimated} onChange={(event) => setEstimated(event.target.value)} /><Input label="Actual cost" type="number" min={0} step="0.01" value={actual} onChange={(event) => setActual(event.target.value)} /><div className="flex items-end gap-2"><Button type="submit" loading={busy}>{editing ? 'Save changes' : 'Add expense'}</Button>{editing && <Button type="button" variant="secondary" onClick={reset}>Cancel</Button>}</div></form></Card>
    <Card><RecordList empty="No expenses yet." records={items.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm text-surface-200"><span>{item.category} · {item.name} — {item.estimated_cost.toFixed(2)} estimated{item.actual_cost != null ? ` · ${item.actual_cost.toFixed(2)} actual` : ''}</span><span className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => edit(item)}>Edit</Button><Button size="sm" variant="danger" onClick={() => void remove(item)} disabled={busy}>Delete</Button></span></li>)} /></Card>
  </WorkspaceLayout>;
}

function TimelineWorkspace({ eventId, items, onChanged }: { eventId: string; items: TimelineItem[]; onChanged: () => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [editing, setEditing] = useState<TimelineItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) { setError('Enter a task or milestone title.'); return; }
    setBusy(true); setError(null);
    try {
      const payload = { title, due_date: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : undefined };
      if (editing) await planningApi.timeline.update(eventId, editing.id, payload);
      else await planningApi.timeline.create(eventId, payload);
      reset(); await onChanged();
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to save milestone.'); }
    finally { setBusy(false); }
  };
  const toggle = async (item: TimelineItem) => { setBusy(true); setError(null); try { await planningApi.timeline.update(eventId, item.id, { status: item.status === 'completed' ? 'pending' : 'completed' }); await onChanged(); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to update milestone.'); } finally { setBusy(false); } };
  const remove = async (item: TimelineItem) => { if (!window.confirm(`Delete ${item.title}?`)) return; setBusy(true); try { await planningApi.timeline.remove(eventId, item.id); await onChanged(); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to delete milestone.'); } finally { setBusy(false); } };
  const reset = () => { setTitle(''); setDueDate(''); setEditing(null); };
  const edit = (item: TimelineItem) => { setEditing(item); setTitle(item.title); setDueDate(item.due_date ? item.due_date.slice(0, 10) : ''); };
  return <WorkspaceLayout title="Timeline workspace" description="Create, edit, complete, and remove dated milestones."><Card>{error && <p className="form-error mb-3" role="alert">{error}</p>}<form className="form-grid" onSubmit={save}><Input label="Task or milestone" required value={title} onChange={(event) => setTitle(event.target.value)} /><Input label="Due date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /><div className="flex items-end gap-2"><Button type="submit" loading={busy}>{editing ? 'Save changes' : 'Add milestone'}</Button>{editing && <Button type="button" variant="secondary" onClick={reset}>Cancel</Button>}</div></form></Card><Card><RecordList empty="No milestones yet." records={items.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm text-surface-200"><span><strong>{item.title}</strong> · {item.status}{item.due_date ? ` · ${new Date(item.due_date).toLocaleDateString()}` : ''}</span><span className="flex gap-2"><Button size="sm" onClick={() => void toggle(item)} disabled={busy}>{item.status === 'completed' ? 'Reopen' : 'Complete'}</Button><Button size="sm" variant="secondary" onClick={() => edit(item)}>Edit</Button><Button size="sm" variant="danger" onClick={() => void remove(item)} disabled={busy}>Delete</Button></span></li>)}/></Card></WorkspaceLayout>;
}

function VendorWorkspace({ eventId, vendors, onChanged }: { eventId: string; vendors: Vendor[]; onChanged: () => Promise<void> }) {
  const [category, setCategory] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<Vendor['status']>('not_started');
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (event: FormEvent) => { event.preventDefault(); if (!category.trim() || !name.trim()) { setError('Enter a vendor category and name.'); return; } setBusy(true); setError(null); try { const payload = { category, name, status }; if (editing) await planningApi.vendors.update(eventId, editing.id, payload); else await planningApi.vendors.create(eventId, payload); reset(); await onChanged(); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to save vendor.'); } finally { setBusy(false); } };
  const remove = async (vendor: Vendor) => { if (!window.confirm(`Delete ${vendor.name}?`)) return; setBusy(true); try { await planningApi.vendors.remove(eventId, vendor.id); await onChanged(); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to delete vendor.'); } finally { setBusy(false); } };
  const reset = () => { setCategory(''); setName(''); setStatus('not_started'); setEditing(null); };
  const edit = (vendor: Vendor) => { setEditing(vendor); setCategory(vendor.category); setName(vendor.name); setStatus(vendor.status); };
  return <WorkspaceLayout title="Vendor checklist" description="Track vendor categories and booking status without implying an external booking was completed."><Card>{error && <p className="form-error mb-3" role="alert">{error}</p>}<form className="form-grid" onSubmit={save}><Input label="Category" required value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Catering, venue, photography..." /><Input label="Vendor name" required value={name} onChange={(event) => setName(event.target.value)} /><Select label="Status" value={status} onChange={(event) => setStatus(event.target.value as Vendor['status'])} options={[{ value: 'not_started', label: 'Not started' }, { value: 'contacted', label: 'Contacted' }, { value: 'quoted', label: 'Quoted' }, { value: 'booked', label: 'Booked' }, { value: 'paid', label: 'Paid' }]} /><div className="flex items-end gap-2"><Button type="submit" loading={busy}>{editing ? 'Save changes' : 'Add vendor'}</Button>{editing && <Button type="button" variant="secondary" onClick={reset}>Cancel</Button>}</div></form></Card><Card><RecordList empty="No vendors yet." records={vendors.map((vendor) => <li key={vendor.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm text-surface-200"><span>{vendor.category} · <strong>{vendor.name}</strong> — {vendor.status.replace('_', ' ')}</span><span className="flex gap-2"><Button size="sm" variant="secondary" onClick={() => edit(vendor)}>Edit</Button><Button size="sm" variant="danger" onClick={() => void remove(vendor)} disabled={busy}>Delete</Button></span></li>)}/></Card></WorkspaceLayout>;
}

function WorkspaceLayout({ title, description, children }: { title: string; description: string; children: ReactNode }) { return <div className="space-y-5"><div><p className="eyebrow">Persistent workspace</p><h1 className="page-title">{title}</h1><p className="page-subtitle">{description}</p></div>{children}</div>; }
function Metric({ label, value }: { label: string; value: string }) { return <Card><p className="text-sm text-surface-400">{label}</p><p className="mt-1 text-3xl font-semibold text-surface-100">{value}</p></Card>; }
function RecordList({ records, empty }: { records: ReactNode[]; empty: string }) { return records.length === 0 ? <p className="text-sm text-surface-400">{empty}</p> : <ul className="divide-y divide-white/5">{records}</ul>; }
