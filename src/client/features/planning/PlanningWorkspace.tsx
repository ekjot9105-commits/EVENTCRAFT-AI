import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { planningApi } from '../../shared/api/client';
import Button from '../../shared/components/Button';
import Card from '../../shared/components/Card';
import Input from '../../shared/components/Input';
import Spinner from '../../shared/components/Spinner';
import type { BudgetItem } from '../../../shared/types/budget';
import type { TimelineItem } from '../../../shared/types/timeline';
import type { Vendor } from '../../../shared/types/vendor';

type WorkspaceKind = 'budget' | 'timeline' | 'vendors';

interface PlanningWorkspaceProps {
  kind: WorkspaceKind;
}

/** Provides the first persistent CRUD surface for each Phase 2 planning area. */
export default function PlanningWorkspace({ kind }: PlanningWorkspaceProps) {
  const { id } = useParams<{ id: string }>();
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      if (kind === 'budget') setBudgetItems(await planningApi.budget.list(id));
      if (kind === 'timeline') setTimelineItems(await planningApi.timeline.list(id));
      if (kind === 'vendors') setVendors(await planningApi.vendors.list(id));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load planning data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const fetchWorkspace = async () => {
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
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : 'Unable to load planning data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchWorkspace();
    return () => { cancelled = true; };
  }, [id, kind]);

  if (loading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  if (error) return <Card><p className="form-error" role="alert">{error}</p></Card>;

  return (
    <div className="space-y-5">
      {kind === 'budget' && <BudgetWorkspace eventId={id!} items={budgetItems} onChanged={load} />}
      {kind === 'timeline' && <TimelineWorkspace eventId={id!} items={timelineItems} onChanged={load} />}
      {kind === 'vendors' && <VendorWorkspace eventId={id!} vendors={vendors} onChanged={load} />}
    </div>
  );
}

function BudgetWorkspace({ eventId, items, onChanged }: { eventId: string; items: BudgetItem[]; onChanged: () => void }) {
  const [category, setCategory] = useState('');
  const [name, setName] = useState('');
  const [estimated, setEstimated] = useState('');
  const total = items.reduce((sum, item) => sum + item.estimated_cost, 0);

  const addItem = async (event: FormEvent) => {
    event.preventDefault();
    await planningApi.budget.create(eventId, { category, name, estimated_cost: Number(estimated) });
    setCategory(''); setName(''); setEstimated('');
    onChanged();
  };

  return (
    <>
      <WorkspaceHeader title="Budget workspace" description="Track planned costs now; AI generation will be added in a later phase." />
      <Card><p className="text-sm text-surface-400">Planned spending</p><p className="mt-1 text-3xl font-semibold text-surface-100">{total.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}</p></Card>
      <Card>
        <form className="form-grid" onSubmit={addItem}>
          <Input label="Category" required value={category} onChange={(event) => setCategory(event.target.value)} />
          <Input label="Item name" required value={name} onChange={(event) => setName(event.target.value)} />
          <Input label="Estimated cost" required type="number" min={0} step="0.01" value={estimated} onChange={(event) => setEstimated(event.target.value)} />
          <div className="flex items-end"><Button type="submit">Add budget item</Button></div>
        </form>
      </Card>
      <ItemList empty="No budget items yet." items={items.map((item) => `${item.category} · ${item.name} — ${item.estimated_cost.toFixed(2)}`)} />
    </>
  );
}

function TimelineWorkspace({ eventId, items, onChanged }: { eventId: string; items: TimelineItem[]; onChanged: () => void }) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');

  const addItem = async (event: FormEvent) => {
    event.preventDefault();
    await planningApi.timeline.create(eventId, { title, due_date: dueDate ? new Date(`${dueDate}T00:00:00`).toISOString() : undefined });
    setTitle(''); setDueDate('');
    onChanged();
  };

  return (
    <>
      <WorkspaceHeader title="Timeline workspace" description="Create milestones and track completion against your event date." />
      <Card><form className="form-grid" onSubmit={addItem}><Input label="Task or milestone" required value={title} onChange={(event) => setTitle(event.target.value)} /><Input label="Due date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /><div className="flex items-end"><Button type="submit">Add milestone</Button></div></form></Card>
      <ItemList empty="No milestones yet." items={items.map((item) => `${item.title} · ${item.status}${item.due_date ? ` · ${new Date(item.due_date).toLocaleDateString()}` : ''}`)} />
    </>
  );
}

function VendorWorkspace({ eventId, vendors, onChanged }: { eventId: string; vendors: Vendor[]; onChanged: () => void }) {
  const [category, setCategory] = useState('');
  const [name, setName] = useState('');

  const addVendor = async (event: FormEvent) => {
    event.preventDefault();
    await planningApi.vendors.create(eventId, { category, name });
    setCategory(''); setName('');
    onChanged();
  };

  return (
    <>
      <WorkspaceHeader title="Vendor checklist" description="Keep vendor categories and booking status visible as your plan develops." />
      <Card><form className="form-grid" onSubmit={addVendor}><Input label="Category" required value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Catering, venue, photography..." /><Input label="Vendor name" required value={name} onChange={(event) => setName(event.target.value)} /><div className="flex items-end"><Button type="submit">Add vendor</Button></div></form></Card>
      <ItemList empty="No vendors yet." items={vendors.map((vendor) => `${vendor.category} · ${vendor.name} — ${vendor.status.replace('_', ' ')}`)} />
    </>
  );
}

function WorkspaceHeader({ title, description }: { title: string; description: string }) {
  return <div><p className="eyebrow">Persistent workspace</p><h1 className="page-title">{title}</h1><p className="page-subtitle">{description}</p></div>;
}

function ItemList({ items, empty }: { items: string[]; empty: string }) {
  return <Card>{items.length === 0 ? <p className="text-sm text-surface-400">{empty}</p> : <ul className="divide-y divide-white/5">{items.map((item) => <li key={item} className="py-3 text-sm text-surface-200">{item}</li>)}</ul>}</Card>;
}
