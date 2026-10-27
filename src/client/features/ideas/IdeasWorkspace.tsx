import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ideasApi } from '../../shared/api/client';
import Button from '../../shared/components/Button';
import Card from '../../shared/components/Card';
import Spinner from '../../shared/components/Spinner';
import type { Idea } from '../../../shared/types/idea';
import BackButton from '../../shared/components/BackButton';

/** Displays generated ideas as safe, persistable records with save/dismiss actions. */
export default function IdeasWorkspace() {
  const { id } = useParams<{ id: string }>();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true); setError(null);
    try { setIdeas(await ideasApi.list(id)); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to load ideas.'); }
    finally { setLoading(false); }
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

  const update = async (idea: Idea, status: 'saved' | 'dismissed') => {
    if (!id) return;
    try { await (status === 'saved' ? ideasApi.save(id, idea.id) : ideasApi.remove(id, idea.id)); await load(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to update idea.'); }
  };

  if (loading) return <div className="flex justify-center py-16" role="status"><Spinner size="lg" /><span className="sr-only">Loading ideas</span></div>;
  return <div className="space-y-5"><BackButton /><div><p className="eyebrow">Personalization studio</p><h1 className="page-title">Ideas</h1><p className="page-subtitle">Review generated suggestions and save only what fits your event.</p></div>{error && <Card><p className="form-error" role="alert">{error}</p><Button className="mt-4" onClick={() => void load()}>Retry</Button></Card>}<Card>{ideas.length === 0 ? <p className="text-sm text-surface-400">No ideas yet. Generate a plan from AI Copilot to add event-specific suggestions.</p> : <div className="grid gap-4 md:grid-cols-2">{ideas.filter((idea) => idea.status !== 'dismissed').map((idea) => <article key={idea.id} className="rounded-xl border border-white/10 p-4"><p className="eyebrow">{idea.category}</p><h2 className="mt-1 text-lg font-semibold text-surface-100">{idea.title}</h2><p className="mt-2 text-sm text-surface-300">{idea.description}</p>{idea.estimated_cost != null && <p className="mt-3 text-xs text-surface-500">Estimated cost: {idea.estimated_cost.toFixed(2)}</p>}<div className="mt-4 flex gap-2"><Button size="sm" onClick={() => void update(idea, 'saved')} disabled={idea.status === 'saved'}>{idea.status === 'saved' ? 'Saved' : 'Save idea'}</Button><Button size="sm" variant="secondary" onClick={() => void update(idea, 'dismissed')}>Remove</Button></div></article>)}</div>}</Card></div>;
}
