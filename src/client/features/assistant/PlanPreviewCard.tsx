import Button from '../../shared/components/Button';
import Card from '../../shared/components/Card';
import type { StoredPlan } from '../../../shared/types/ai';
import { formatMoney } from '../../shared/utils/formatMoney';

interface PlanPreviewCardProps {
  plan: StoredPlan | null;
  versions: StoredPlan[];
  currency: string;
  busy: boolean;
  onGenerate: () => void;
  onApply: () => void;
  onSelectVersion: (plan: StoredPlan) => void;
}

/** Shows a generated plan for review; nothing is written until the user applies it. */
export default function PlanPreviewCard({ plan, versions, currency, busy, onGenerate, onApply, onSelectVersion }: PlanPreviewCardProps) {
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-surface-100">Structured plan preview</h2>
          <p className="text-sm text-surface-400">
            Review proposed records before applying them to your budget, timeline, vendors, and ideas.
          </p>
        </div>
        <Button onClick={onGenerate} loading={busy}>
          <span aria-hidden="true">✨</span> Generate plan
        </Button>
      </div>
      {plan && (
        <div className="mt-4 space-y-4 text-sm text-surface-300">
          <div className="flex flex-wrap gap-2 text-xs text-surface-400">
            <span>Version generated {new Date(plan.generated_at).toLocaleString()}</span>
            <span>{plan.applied_at ? 'Applied' : 'Preview only'}</span>
          </div>
          <p className="rounded-lg bg-white/5 p-3 text-surface-200">{plan.plan.summary}</p>
          <p>
            <strong>{plan.plan.budget_proposal.categories.length}</strong> budget categories ·{' '}
            <strong>{plan.plan.timeline.length}</strong> timeline tasks ·{' '}
            <strong>{plan.plan.vendor_checklist.length}</strong> vendors ·{' '}
            <strong>{plan.plan.personalized_ideas.length}</strong> ideas
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <PreviewList title="Budget proposals" items={plan.plan.budget_proposal.categories.map((item) => `${item.category}: ${formatMoney(item.amount, currency)}`)} />
            <PreviewList title="Timeline proposals" items={plan.plan.timeline.map((item) => `${item.title} — ${new Date(item.due_date).toLocaleDateString()}`)} />
            <PreviewList title="Vendor checklist" items={plan.plan.vendor_checklist.map((item) => item.category)} />
            <PreviewList title="Personalized ideas" items={plan.plan.personalized_ideas.map((item) => item.title)} />
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={onApply} loading={busy} disabled={Boolean(plan.applied_at)}>
              Apply this plan
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              Print / save PDF
            </Button>
          </div>
        </div>
      )}
      {versions.length > 1 && (
        <div className="mt-5 border-t border-white/10 pt-4">
          <h3 className="text-sm font-semibold text-surface-200">Plan versions</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {versions.map((version) => (
              <Button
                key={version.plan_id}
                size="sm"
                variant="secondary"
                aria-pressed={version.plan_id === plan?.plan_id}
                onClick={() => onSelectVersion(version)}
              >
                {new Date(version.generated_at).toLocaleString()}
              </Button>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function PreviewList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <h3 className="font-medium text-surface-200 text-xs uppercase tracking-wider">{title}</h3>
      <ul className="mt-2 space-y-1 text-xs text-surface-400">
        {items.slice(0, 6).map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}
