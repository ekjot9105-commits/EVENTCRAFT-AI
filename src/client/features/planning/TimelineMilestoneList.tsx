import Button from '../../shared/components/Button';
import type { TimelineItem } from '../../../shared/types/timeline';
import { RecordList } from './WorkspaceComponents';
import { URGENCY_BADGE, getUrgency } from './timelineModel';

interface TimelineMilestoneListProps {
  items: TimelineItem[];
  busy: boolean;
  onToggle: (item: TimelineItem) => void;
  onEdit: (item: TimelineItem) => void;
  onRemove: (item: TimelineItem) => void;
}

/** Plain list view of milestones with urgency badges and per-item actions. */
export default function TimelineMilestoneList({ items, busy, onToggle, onEdit, onRemove }: TimelineMilestoneListProps) {
  return (
    <RecordList
      empty="No tasks match this filter."
      records={items.map((item) => {
        const urgency = getUrgency(item);
        const completed = item.status === 'completed';
        return (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm text-surface-200 border-b border-white/5 last:border-none">
            <div className="flex items-center gap-2">
              <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${URGENCY_BADGE[urgency]}`}>{urgency}</span>
              <span className={completed ? 'line-through text-surface-400' : 'text-surface-100 font-medium'}>{item.title}</span>
              {item.due_date && (
                <span className="text-xs text-surface-400">
                  <span aria-hidden="true">📅 </span>
                  <time dateTime={item.due_date}>{new Date(item.due_date).toLocaleDateString()}</time>
                </span>
              )}
            </div>
            <span className="flex gap-2">
              <Button size="sm" onClick={() => onToggle(item)} disabled={busy} variant={completed ? 'secondary' : 'primary'} aria-label={`${completed ? 'Reopen' : 'Complete'} ${item.title}`}>
                {completed ? 'Reopen' : '✓ Complete'}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => onEdit(item)} aria-label={`Edit ${item.title}`}>Edit</Button>
              <Button size="sm" variant="danger" onClick={() => onRemove(item)} disabled={busy} aria-label={`Delete ${item.title}`}>Delete</Button>
            </span>
          </li>
        );
      })}
    />
  );
}
