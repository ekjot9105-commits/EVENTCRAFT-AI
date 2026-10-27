import { useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { aiApi } from '../../shared/api/client';
import Button from '../../shared/components/Button';
import Card from '../../shared/components/Card';
import Input from '../../shared/components/Input';
import type { CopilotResponse, GeneratedPlan } from '../../../shared/types/ai';

/** Provides accessible question, response, and explicit proposal confirmation flows. */
export default function AICopilot() {
  const { id } = useParams<{ id: string }>();
  const [message, setMessage] = useState('');
  const [answer, setAnswer] = useState<CopilotResponse | null>(null);
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    try { setPlan(await aiApi.generatePlan(id)); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to generate a plan.'); }
    finally { setBusy(false); }
  };

  const confirm = async () => {
    if (!id || !answer?.proposal) return;
    setBusy(true); setError(null);
    try {
      await aiApi.confirmProposal(id, answer.proposal);
      setAnswer({ ...answer, proposal: null, answer: 'The confirmed budget change was saved.' });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The proposal could not be saved.');
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow">Context-aware planning</p>
        <h1 className="page-title">AI Copilot</h1>
        <p className="page-subtitle">Ask about this event or generate a structured, editable plan.</p>
      </div>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-semibold text-surface-100">Structured plan</h2><p className="text-sm text-surface-400">Gemini suggestions are validated before they are saved.</p></div>
          <Button onClick={generate} loading={busy}>Generate plan</Button>
        </div>
        {plan && <div className="mt-4 space-y-3 text-sm text-surface-300"><p>{plan.summary}</p><p><strong>{plan.budget_proposal.categories.length}</strong> budget categories · <strong>{plan.timeline.length}</strong> timeline tasks · <strong>{plan.personalized_ideas.length}</strong> ideas</p></div>}
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
