import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ideasApi, planningApi } from '../../shared/api/client';
import Button from '../../shared/components/Button';
import Card from '../../shared/components/Card';
import Spinner from '../../shared/components/Spinner';
import { showToast } from '../../shared/components/toastBus';
import type { Idea } from '../../../shared/types/idea';
import BackButton from '../../shared/components/BackButton';
import { fireConfetti } from '../../shared/utils/confettiBurst';
import IdeaCard from './IdeaCard';
import { filterIdeas, TAG_CHIPS, type IdeaTag } from './ideaFilters';

/** Displays generated ideas as safe, persistable records with save/dismiss and conversion actions. */
export default function IdeasWorkspace() {
  const { id } = useParams<{ id: string }>();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<IdeaTag>('#All');
  const [addedToBudget, setAddedToBudget] = useState<Set<string>>(new Set());
  const [addedToTimeline, setAddedToTimeline] = useState<Set<string>>(new Set());

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setIdeas(await ideasApi.list(id));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load ideas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const fetchIdeas = async () => {
      if (!id) return;
      try {
        const data = await ideasApi.list(id);
        if (!cancelled) setIdeas(data);
      } catch (requestError) {
        if (!cancelled) setError(requestError instanceof Error ? requestError.message : 'Unable to load ideas.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchIdeas();
    return () => { cancelled = true; };
  }, [id]);

  const handleGenerateIdeas = async () => {
    if (!id) return;
    setGenerating(true);
    setError(null);
    try {
      const generated = await ideasApi.generate(id);
      fireConfetti(undefined, undefined, 60);
      showToast(`Generated ${generated.length} personalized ideas!`, 'success');
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to generate ideas.');
    } finally {
      setGenerating(false);
    }
  };

  const update = async (idea: Idea, status: 'saved' | 'dismissed') => {
    if (!id) return;
    try {
      await (status === 'saved' ? ideasApi.save(id, idea.id) : ideasApi.remove(id, idea.id));
      showToast(status === 'saved' ? 'Idea saved to your plan' : 'Idea dismissed', 'info');
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update idea.');
    }
  };

  const addToBudgetAction = async (idea: Idea) => {
    if (!id) return;
    try {
      await planningApi.budget.create(id, { category: idea.category || 'Personalized Ideas', name: idea.title, estimated_cost: idea.estimated_cost ?? 0 });
      setAddedToBudget((previous) => new Set(previous).add(idea.id));
      fireConfetti(undefined, undefined, 45);
      showToast(`Added "${idea.title}" to Budget items`, 'success');
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Failed to add to budget', 'error');
    }
  };

  const addToTimelineAction = async (idea: Idea) => {
    if (!id) return;
    try {
      await planningApi.timeline.create(id, { title: idea.title });
      setAddedToTimeline((previous) => new Set(previous).add(idea.id));
      fireConfetti(undefined, undefined, 45);
      showToast(`Added "${idea.title}" to Timeline milestones`, 'success');
    } catch (requestError) {
      showToast(requestError instanceof Error ? requestError.message : 'Failed to add to timeline', 'error');
    }
  };

  const filteredIdeas = useMemo(() => filterIdeas(ideas, selectedTag), [ideas, selectedTag]);

  if (loading) {
    return <div className="flex justify-center py-16" role="status"><Spinner size="lg" /><span className="sr-only">Loading ideas</span></div>;
  }

  return (
    <div className="animate-fade-in space-y-5">
      <BackButton />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Personalization studio</p>
          <h1 className="page-title">Personalized Ideas</h1>
          <p className="page-subtitle">Review generated creative suggestions, filter by tag, and directly convert them into budget items or timeline tasks.</p>
        </div>
        <Button onClick={() => void handleGenerateIdeas()} loading={generating}>✨ Generate Ideas with AI</Button>
      </div>

      {error && <Card><p className="form-error" role="alert">{error}</p><Button className="mt-4" onClick={() => void load()}>Retry</Button></Card>}

      <Card className="py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-surface-400">Filter by Concept Tag:</span>
          <div className="flex flex-wrap gap-2">
            {TAG_CHIPS.map((tag) => (
              <button key={tag} type="button" onClick={() => setSelectedTag(tag)} aria-pressed={selectedTag === tag} className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${selectedTag === tag ? 'bg-brand-700 text-white shadow-sm' : 'bg-white/5 text-surface-400 hover:bg-white/10 hover:text-surface-200'}`}>
                {tag}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        {filteredIdeas.length === 0 ? (
          <div className="py-8 text-center">
            <p className="mb-4 text-sm text-surface-400">{ideas.length === 0 ? 'No personalized ideas yet for this event.' : `No ideas found matching "${selectedTag}". Try selecting another tag.`}</p>
            {ideas.length === 0 && <Button size="sm" onClick={() => void handleGenerateIdeas()} loading={generating}>⚡ Auto-Generate Creative Ideas</Button>}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredIdeas.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} inBudget={addedToBudget.has(idea.id)} inTimeline={addedToTimeline.has(idea.id)} onAddToBudget={(selected) => void addToBudgetAction(selected)} onAddToTimeline={(selected) => void addToTimelineAction(selected)} onUpdate={(selected, status) => void update(selected, status)} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
