import Button from '../../shared/components/Button';
import Tilt3DCard from '../../shared/components/Tilt3DCard';
import type { Idea } from '../../../shared/types/idea';

interface IdeaCardProps {
  idea: Idea;
  inBudget: boolean;
  inTimeline: boolean;
  onAddToBudget: (idea: Idea) => void;
  onAddToTimeline: (idea: Idea) => void;
  onUpdate: (idea: Idea, status: 'saved' | 'dismissed') => void;
}

/** Presentational card for one idea; mutations remain owned by the workspace. */
export default function IdeaCard({ idea, inBudget, inTimeline, onAddToBudget, onAddToTimeline, onUpdate }: IdeaCardProps) {
  return (
    <Tilt3DCard intensity={8} glare={true} className="h-full rounded-2xl">
      <article className="flex h-full flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition-all hover:border-white/20 hover:shadow-lg">
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="eyebrow font-semibold text-brand-300">{idea.category}</span>
            {idea.estimated_cost != null && (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">Est. ${idea.estimated_cost.toFixed(2)}</span>
            )}
          </div>
          <h2 className="text-lg font-bold text-surface-100">{idea.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-surface-300">{idea.description}</p>
        </div>
        <div className="mt-5 space-y-2 border-t border-white/5 pt-4">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onAddToBudget(idea)} disabled={inBudget} className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${inBudget ? 'border border-emerald-500/40 bg-emerald-500/20 text-emerald-300' : 'border border-brand-500/30 bg-brand-600/20 text-brand-300 hover:bg-brand-600/30'}`}>
              {inBudget ? '✓ In Budget' : '+ Add to Budget'}
            </button>
            <button type="button" onClick={() => onAddToTimeline(idea)} disabled={inTimeline} className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${inTimeline ? 'border border-emerald-500/40 bg-emerald-500/20 text-emerald-300' : 'border border-purple-500/30 bg-purple-600/20 text-purple-300 hover:bg-purple-600/30'}`}>
              {inTimeline ? '✓ In Timeline' : '+ Add to Timeline'}
            </button>
          </div>
          <div className="flex items-center justify-between pt-1">
            <Button size="sm" onClick={() => onUpdate(idea, 'saved')} disabled={idea.status === 'saved'} variant={idea.status === 'saved' ? 'secondary' : 'primary'}>{idea.status === 'saved' ? 'Saved' : 'Save Idea'}</Button>
            <Button size="sm" variant="danger" onClick={() => onUpdate(idea, 'dismissed')}>Dismiss</Button>
          </div>
        </div>
      </article>
    </Tilt3DCard>
  );
}
