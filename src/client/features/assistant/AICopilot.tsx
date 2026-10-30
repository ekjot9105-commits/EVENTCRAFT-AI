import { useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { aiApi, eventsApi } from '../../shared/api/client';
import Button from '../../shared/components/Button';
import Card from '../../shared/components/Card';
import Input from '../../shared/components/Input';
import Badge from '../../shared/components/Badge';
import type { CopilotResponse, StoredPlan } from '../../../shared/types/ai';
import type { Event } from '../../../shared/types/event';
import { EVENT_TYPE_LABELS, EVENT_TYPE_ICONS } from '../../../shared/constants/eventTypes';
import { EVENT_THEMES } from '../../shared/constants/eventThemes';
import BackButton from '../../shared/components/BackButton';
import AIOrb from '../../shared/components/AIOrb';
import { fireConfetti } from '../../shared/utils/confettiBurst';
import { BUSY_STEPS, QUICK_ACTIONS, STARTER_PROMPTS, confirmationMessage } from './copilotPrompts';
import PlanPreviewCard from './PlanPreviewCard';
import CopilotAnswer from './CopilotAnswer';

/** Provides accessible question, response, and explicit proposal confirmation flows. */
export default function AICopilot() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [message, setMessage] = useState('');
  const [answer, setAnswer] = useState<CopilotResponse | null>(null);
  const [plan, setPlan] = useState<StoredPlan | null>(null);
  const [versions, setVersions] = useState<StoredPlan[]>([]);
  const [providerLabel, setProviderLabel] = useState('AI provider');
  const [busy, setBusy] = useState(false);
  const [busyStep, setBusyStep] = useState(BUSY_STEPS[0]!);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void aiApi.status().then((status) => setProviderLabel(status.label)).catch(() => setProviderLabel('AI provider unavailable'));
    if (id) {
      eventsApi.getById(id).then(setEvent).catch(() => setError('This event could not be loaded. Refresh to try again.'));
    }
  }, [id]);

  useEffect(() => {
    if (!busy) return;
    let index = 0;
    const interval = setInterval(() => {
      index = (index + 1) % BUSY_STEPS.length;
      setBusyStep(BUSY_STEPS[index]!);
    }, 1800);
    return () => clearInterval(interval);
  }, [busy]);

  /** Shared busy/error handling so every AI action fails the same, recoverable way. */
  const run = async (work: (eventId: string) => Promise<void>, fallbackError: string) => {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      await work(id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : fallbackError);
    } finally {
      setBusy(false);
    }
  };

  const askQuery = (queryText: string) => {
    if (!queryText.trim()) return Promise.resolve();
    setMessage(queryText);
    return run(async (eventId) => {
      setAnswer(await aiApi.copilot(eventId, queryText));
      setMessage('');
    }, 'Unable to contact the AI assistant.');
  };

  const ask = (e: FormEvent) => {
    e.preventDefault();
    void askQuery(message);
  };

  const generate = () => run(async (eventId) => {
    setPlan(await aiApi.generatePlan(eventId));
    setVersions(await aiApi.listPlans(eventId));
  }, 'Unable to generate a plan.');

  const applyPlan = () => run(async (eventId) => {
    if (!plan) return;
    setPlan(await aiApi.applyPlan(eventId, plan.plan_id));
    setVersions(await aiApi.listPlans(eventId));
    fireConfetti(undefined, undefined, 75);
  }, 'The plan could not be applied.');

  const confirm = () => run(async (eventId) => {
    const proposal = answer?.proposal;
    if (!answer || !proposal) return;
    if (!proposal.proposal_id) throw new Error('This proposal is no longer available. Ask the copilot again.');
    await aiApi.confirmProposal(eventId, proposal.proposal_id);
    fireConfetti(undefined, undefined, 60);
    setAnswer({ ...answer, proposal: null, answer: confirmationMessage(proposal.action) });
  }, 'The proposal could not be saved.');

  const eventType = event?.type ?? 'wedding';
  const eventTheme = EVENT_THEMES[eventType];
  const currency = event?.currency ?? 'USD';

  return (
    <div className="space-y-5 animate-fade-in">
      <BackButton />

      <div className={`rounded-2xl border p-5 bg-gradient-to-r relative overflow-hidden ${eventTheme?.gradientBg || 'from-surface-900 to-surface-800'} ${eventTheme?.borderAccent || 'border-white/10'}`}>
        <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <AIOrb state={busy ? 'thinking' : answer ? 'answered' : 'idle'} size={84} className="flex-shrink-0" />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl" aria-hidden="true">{event ? EVENT_TYPE_ICONS[event.type] : '✨'}</span>
                <p className="eyebrow">Context-aware planning</p>
                {event && <Badge color={eventTheme.badgeColor} size="sm">{EVENT_TYPE_LABELS[event.type]}</Badge>}
              </div>
              <h1 className="page-title text-2xl font-bold text-surface-100">
                {event ? `${event.title} — AI Copilot` : 'AI Copilot'}
              </h1>
              <p className="page-subtitle text-sm text-surface-400">
                Ask questions tailored to your event type or generate a full structured plan.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-400/30 bg-brand-400/10 px-3 py-1 text-xs text-brand-200">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
            {providerLabel}
          </span>
        </div>
      </div>

      <PlanPreviewCard
        plan={plan}
        versions={versions}
        currency={currency}
        busy={busy}
        onGenerate={() => void generate()}
        onApply={() => void applyPlan()}
        onSelectVersion={setPlan}
      />

      <Card>
        <h2 className="text-lg font-semibold text-surface-100 flex items-center gap-2">
          <span aria-hidden="true">💬</span> Ask about your event
        </h2>

        <PromptChips
          heading="Quick Actions"
          prompts={QUICK_ACTIONS}
          icon="⚡"
          disabled={busy}
          onPick={(prompt) => void askQuery(prompt)}
          className="rounded-full border border-brand-500/30 bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-300 hover:bg-brand-500/25"
        />
        <PromptChips
          heading={event ? `${EVENT_TYPE_LABELS[event.type]} Ideas & Questions` : 'Suggested Questions'}
          prompts={STARTER_PROMPTS[eventType]}
          icon="💡"
          disabled={busy}
          onPick={(prompt) => void askQuery(prompt)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-surface-300 hover:border-white/20 hover:text-surface-100 text-left"
        />

        <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={ask}>
          <div className="flex-1">
            <Input
              label="Ask anything about your budget, timeline, or vendors"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g., What should I complete this week? or How to cut catering costs?"
              required
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" loading={busy}>Send</Button>
          </div>
        </form>

        {/* One polite live region announces progress and the final reply to screen readers. */}
        <div aria-live="polite" aria-busy={busy}>
          {busy && (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-brand-500/30 bg-brand-950/40 p-4">
              <div className="flex items-center gap-1.5" aria-hidden="true">
                {[0, 150, 300].map((delay) => (
                  <span key={delay} className="h-2.5 w-2.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                ))}
              </div>
              <div className="text-sm">
                <span className="font-semibold text-brand-300">AI Copilot is thinking...</span>
                <p className="text-xs text-surface-400">{busyStep}</p>
              </div>
            </div>
          )}
          {!busy && answer && (
            <CopilotAnswer
              answer={answer}
              currency={currency}
              busy={busy}
              onConfirm={() => void confirm()}
              onDismissProposal={() => setAnswer({ ...answer, proposal: null })}
            />
          )}
        </div>

        {error && <p className="form-error mt-3" role="alert">{error}</p>}
      </Card>
    </div>
  );
}

interface PromptChipsProps {
  heading: string;
  prompts: string[];
  icon: string;
  disabled: boolean;
  className: string;
  onPick: (prompt: string) => void;
}

function PromptChips({ heading, prompts, icon, disabled, className, onPick }: PromptChipsProps) {
  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold text-surface-400 mb-2 uppercase tracking-wider">{heading}</h3>
      <div className="flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={disabled}
            onClick={() => onPick(prompt)}
            className={`transition-all active:scale-95 disabled:opacity-50 ${className}`}
          >
            <span aria-hidden="true">{icon}</span> {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
