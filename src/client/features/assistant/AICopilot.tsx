import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { aiApi } from '../../shared/api/client';
import Button from '../../shared/components/Button';
import Card from '../../shared/components/Card';
import Input from '../../shared/components/Input';
import type { CopilotResponse, StoredPlan } from '../../../shared/types/ai';
import BackButton from '../../shared/components/BackButton';

/** Provides accessible question, response, and explicit proposal confirmation flows. */
export default function AICopilot() {
  const { id } = useParams<{ id: string }>();
  const [message, setMessage] = useState('');
  const [answer, setAnswer] = useState<CopilotResponse | null>(null);
  const [plan, setPlan] = useState<StoredPlan | null>(null);
  const [versions, setVersions] = useState<StoredPlan[]>([]);
  const [providerLabel, setProviderLabel] = useState('AI provider');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void aiApi.status().then((status) => setProviderLabel(status.label)).catch(() => setProviderLabel('AI provider unavailable'));
  }, []);

  const ask = async (event: FormEvent) => {
    event.preventDefault();
    if (!id || !message.trim()) return;
    setBusy(true); setError(null);
    try { setAnswer(await aiApi.copilot(id, message)); setMessage(''); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to contact the AI assistant.'); }
    finally { setBusy(false); }
  };

  const generate = async () => {
    if (!id) return;
    setBusy(true); setError(null);
    try {
      const generated = await aiApi.generatePlan(id);
      setPlan(generated);
      setVersions(await aiApi.listPlans(id));
    }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to generate a plan.'); }
    finally { setBusy(false); }
  };

  const applyPlan = async () => {
    if (!id || !plan) return;
    setBusy(true); setError(null);
    try {
      const applied = await aiApi.applyPlan(id, plan.plan_id);
      setPlan(applied);
      setVersions(await aiApi.listPlans(id));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The plan could not be applied.');
    } finally { setBusy(false); }
  };

  const printPlan = () => window.print();

  const confirm = async () => {
    if (!id || !answer?.proposal) return;
    setBusy(true); setError(null);
    try {
      if (!answer.proposal.proposal_id) throw new Error('This proposal is no longer available. Ask the copilot again.');
      await aiApi.confirmProposal(id, answer.proposal.proposal_id);
      setAnswer({ ...answer, proposal: null, answer: 'The confirmed budget change was saved.' });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The proposal could not be saved.');
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <BackButton />
      <div>
        <p className="eyebrow">Context-aware planning</p>
        <h1 className="page-title">AI Copilot</h1>
        <p className="page-subtitle">Ask about this event or generate a structured, editable plan.</p>
        <span className="mt-2 inline-flex rounded-full border border-brand-400/30 bg-brand-400/10 px-3 py-1 text-xs text-brand-200">{providerLabel}</span>
      </div>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-semibold text-surface-100">Structured plan preview</h2><p className="text-sm text-surface-400">Review the proposed records before applying them to your budget, timeline, vendors, and ideas.</p></div>
          <Button onClick={generate} loading={busy}>Generate plan</Button>
        </div>
        {plan && <div className="mt-4 space-y-4 text-sm text-surface-300">
          <div className="flex flex-wrap gap-2 text-xs text-surface-500"><span>Version generated {new Date(plan.generated_at).toLocaleString()}</span><span>{plan.applied_at ? 'Applied' : 'Preview only'}</span></div>
          <p>{plan.plan.summary}</p>
          <p><strong>{plan.plan.budget_proposal.categories.length}</strong> budget categories · <strong>{plan.plan.timeline.length}</strong> timeline tasks · <strong>{plan.plan.vendor_checklist.length}</strong> vendors · <strong>{plan.plan.personalized_ideas.length}</strong> ideas</p>
          <div className="grid gap-3 md:grid-cols-2">
            <PreviewList title="Budget proposals" items={plan.plan.budget_proposal.categories.map((item) => `${item.category}: ${item.amount.toFixed(2)}`)} />
            <PreviewList title="Timeline proposals" items={plan.plan.timeline.map((item) => `${item.title} — ${new Date(item.due_date).toLocaleDateString()}`)} />
            <PreviewList title="Vendor checklist" items={plan.plan.vendor_checklist.map((item) => item.category)} />
            <PreviewList title="Personalized ideas" items={plan.plan.personalized_ideas.map((item) => item.title)} />
          </div>
          <div className="flex flex-wrap gap-2"><Button onClick={applyPlan} loading={busy} disabled={Boolean(plan.applied_at)}>Apply this plan</Button><Button variant="secondary" onClick={printPlan}>Print / save PDF</Button></div>
        </div>}
        {versions.length > 1 && <div className="mt-5 border-t border-white/10 pt-4"><h3 className="text-sm font-semibold text-surface-200">Plan versions</h3><div className="mt-2 flex flex-wrap gap-2">{versions.map((version) => <Button key={version.plan_id} size="sm" variant="secondary" onClick={() => setPlan(version)}>{new Date(version.generated_at).toLocaleString()}</Button>)}</div></div>}
      </Card>
      <Card>
        <h2 className="text-lg font-semibold text-surface-100">Ask about your event</h2>
        <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={ask}>
          <Input label="Question" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="What should I complete this week?" required />
          <div className="flex items-end"><Button type="submit" loading={busy}>Send</Button></div>
        </form>
        <p className="mt-2 text-xs text-surface-500" aria-live="polite">{busy ? 'AI is reviewing your event context…' : 'Responses use only this event’s saved planning data.'}</p>
        {error && <p className="form-error mt-3" role="alert">{error}</p>}
        {answer && <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-surface-200"><p>{answer.answer}</p>{answer.clarification_question && <p className="mt-2 text-brand-200">{answer.clarification_question}</p>}{answer.proposal && <div className="mt-4 border-t border-white/10 pt-4"><p className="font-medium">{answer.proposal.explanation}</p><p className="mt-1 text-surface-400">Expected budget impact: {answer.proposal.expected_budget_impact.toFixed(2)}</p><div className="mt-3 flex gap-2"><Button onClick={confirm} loading={busy}>Confirm change</Button><Button variant="secondary" onClick={() => setAnswer({ ...answer, proposal: null })}>Cancel</Button></div></div>}</div>}
      </Card>
    </div>
  );
}

function PreviewList({ title, items }: { title: string; items: string[] }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><h3 className="font-medium text-surface-200">{title}</h3><ul className="mt-2 space-y-1 text-xs text-surface-400">{items.slice(0, 6).map((item) => <li key={item}>• {item}</li>)}</ul></div>;
}
