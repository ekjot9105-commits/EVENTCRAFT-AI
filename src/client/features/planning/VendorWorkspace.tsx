import { useMemo, useState, type FormEvent } from 'react';
import Button from '../../shared/components/Button';
import Card from '../../shared/components/Card';
import Input from '../../shared/components/Input';
import Select from '../../shared/components/Select';
import type { Vendor } from '../../../shared/types/vendor';
import type { Event } from '../../../shared/types/event';
import Tilt3DCard from '../../shared/components/Tilt3DCard';
import { fireConfetti } from '../../shared/utils/confettiBurst';
import { planningApi } from '../../shared/api/client';
import { WorkspaceLayout, RecordList, PresetChips, FormError, CategoryFilterPills } from './WorkspaceComponents';

const VENDOR_PRESET_CATEGORIES = ['Venue', 'Food & Drinks', 'Photo/Video', 'Entertainment', 'Florals & Decor', 'Rentals'];

interface VendorWorkspaceProps {
  eventId: string;
  event: Event | null;
  vendors: Vendor[];
  onChanged: () => Promise<void>;
}

export default function VendorWorkspace({ eventId, event, vendors, onChanged }: VendorWorkspaceProps) {
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

  const save = async (e: FormEvent) => {
    e.preventDefault();
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
        <FormError error={error} />

        {/* Quick Category Chips */}
        <PresetChips
          label="Quick Vendor Categories:"
          presets={VENDOR_PRESET_CATEGORIES}
          selected={category}
          onSelect={(preset) => setCategory(preset)}
        />

        <form className="form-grid" onSubmit={save}>
          <Input label="Category" required value={category} onChange={(eventInput) => setCategory(eventInput.target.value)} placeholder="Venue, Catering, Photo/Video..." />
          <Input label="Vendor name" required value={name} onChange={(eventInput) => setName(eventInput.target.value)} placeholder="e.g. Sunset Sound DJ or Flora Studio" />
          <Select
            label="Status"
            value={status}
            onChange={(eventSelect) => setStatus(eventSelect.target.value as Vendor['status'])}
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
          <CategoryFilterPills
            categories={allCategories}
            selected={selectedCategory}
            onSelect={(cat) => setSelectedCategory(cat)}
          />
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

