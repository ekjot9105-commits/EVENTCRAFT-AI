import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { planningApi, eventsApi } from '../../shared/api/client';
import Button from '../../shared/components/Button';
import Card from '../../shared/components/Card';
import Spinner from '../../shared/components/Spinner';
import type { BudgetItem } from '../../../shared/types/budget';
import type { TimelineItem } from '../../../shared/types/timeline';
import type { Vendor } from '../../../shared/types/vendor';
import type { Event } from '../../../shared/types/event';

import BudgetWorkspace from './BudgetWorkspace';
import TimelineWorkspace from './TimelineWorkspace';
import VendorWorkspace from './VendorWorkspace';

type WorkspaceKind = 'budget' | 'timeline' | 'vendors';

interface PlanningWorkspaceProps {
  kind: WorkspaceKind;
}

interface WorkspaceRecords {
  budget: BudgetItem[];
  timeline: TimelineItem[];
  vendors: Vendor[];
}

const EMPTY_RECORDS: WorkspaceRecords = { budget: [], timeline: [], vendors: [] };

const listRecords = (kind: WorkspaceKind, eventId: string): Promise<WorkspaceRecords[WorkspaceKind]> =>
  kind === 'budget' ? planningApi.budget.list(eventId)
    : kind === 'timeline' ? planningApi.timeline.list(eventId)
      : planningApi.vendors.list(eventId);

/**
 * Top-level planning workspace orchestrator.
 * Loads event-scoped data and delegates to dedicated domain workspaces:
 * - BudgetWorkspace: Real-time 3D donut visualizer & expense management
 * - TimelineWorkspace: 3D spatial highway, milestones & run-of-show schedules
 * - VendorWorkspace: Readiness tracker, booking status & checklists
 */
export default function PlanningWorkspace({ kind }: PlanningWorkspaceProps) {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [records, setRecords] = useState<WorkspaceRecords>(EMPTY_RECORDS);
  const [attempt, setAttempt] = useState(0);
  // Which request has settled; loading is derived from it so the effect never sets state synchronously.
  const [settled, setSettled] = useState<{ key: string; error: string | null } | null>(null);
  const requestKey = `${id}:${kind}:${attempt}`;
  const loading = settled?.key !== requestKey;
  const error = loading ? null : settled.error;

  // Initial load (and explicit retries) show the spinner; the event is fetched alongside its records.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    Promise.all([eventsApi.getById(id).catch(() => null), listRecords(kind, id)])
      .then(([loadedEvent, items]) => {
        if (cancelled) return;
        if (loadedEvent) setEvent(loadedEvent);
        setRecords((current) => ({ ...current, [kind]: items }));
        setSettled({ key: requestKey, error: null });
      })
      .catch((requestError: unknown) => {
        if (cancelled) return;
        setSettled({ key: requestKey, error: requestError instanceof Error ? requestError.message : 'Unable to load planning data.' });
      });
    return () => { cancelled = true; };
  }, [id, kind, requestKey]);

  /**
   * After a save, refresh only this workspace's records in place. The workspace stays mounted,
   * so the chosen view, filters, and keyboard focus survive; errors surface in the workspace form.
   */
  const refresh = useCallback(async () => {
    if (!id) return;
    const items = await listRecords(kind, id);
    setRecords((current) => ({ ...current, [kind]: items }));
  }, [id, kind]);

  if (!id) {
    return (
      <Card>
        <p className="form-error" role="alert">This workspace is missing an event ID.</p>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16" role="status">
        <Spinner size="lg" />
        <span className="sr-only">Loading planning data</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <p className="form-error" role="alert">{error}</p>
        <Button className="mt-4" onClick={() => setAttempt((count) => count + 1)}>Retry</Button>
      </Card>
    );
  }

  if (kind === 'budget') {
    return <BudgetWorkspace eventId={id} event={event} items={records.budget} onChanged={refresh} />;
  }

  if (kind === 'timeline') {
    return <TimelineWorkspace eventId={id} event={event} items={records.timeline} onChanged={refresh} />;
  }

  return <VendorWorkspace eventId={id} event={event} vendors={records.vendors} onChanged={refresh} />;
}
