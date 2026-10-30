import Button from '../../shared/components/Button';
import Tilt3DCard from '../../shared/components/Tilt3DCard';
import type { CopilotResponse } from '../../../shared/types/ai';
import { formatMoney } from '../../shared/utils/formatMoney';

interface CopilotAnswerProps {
  answer: CopilotResponse;
  currency: string;
  busy: boolean;
  onConfirm: () => void;
  onDismissProposal: () => void;
}

/** Renders the assistant's reply and any proposed change awaiting explicit confirmation. */
export default function CopilotAnswer({ answer, currency, busy, onConfirm, onDismissProposal }: CopilotAnswerProps) {
  const impact = answer.proposal?.expected_budget_impact ?? 0;
  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-surface-200">
      <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-brand-300">
        <span aria-hidden="true">✨</span>
        <span>Copilot Response</span>
      </div>
      <p className="whitespace-pre-line leading-relaxed">{answer.answer}</p>
      {answer.clarification_question && (
        <div className="mt-3 rounded-lg border border-brand-500/30 bg-brand-500/10 p-3 text-brand-200">
          <span className="font-semibold">Next Step: </span>
          {answer.clarification_question}
        </div>
      )}
      {answer.proposal && (
        <Tilt3DCard intensity={8} glare={true} className="mt-4 rounded-xl">
          <section aria-label="Proposed change" className="rounded-xl border border-brand-500/40 bg-gradient-to-br from-brand-950/30 to-surface-900 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-300 mb-1">
              <span aria-hidden="true">⚡</span> Proposed change — needs your confirmation
            </div>
            <p className="font-medium text-surface-100">{answer.proposal.explanation}</p>
            <p className="mt-1 text-surface-400">
              Expected budget impact:{' '}
              <strong className={impact > 0 ? 'text-amber-300' : 'text-emerald-400'}>
                {impact > 0 ? '+' : ''}{formatMoney(impact, currency)}
              </strong>
            </p>
            <div className="mt-3 flex gap-2">
              <Button onClick={onConfirm} loading={busy}>
                Confirm change
              </Button>
              <Button variant="secondary" onClick={onDismissProposal}>
                Cancel
              </Button>
            </div>
          </section>
        </Tilt3DCard>
      )}
    </div>
  );
}
