// The acceptance-criteria checklist, LIVE (KIT-T153): clicking a box POSTs a tick/untick and the
// parent re-fetches, so the rendered state is always the markdown truth — a failed write leaves the
// box exactly where it was and surfaces the guard inline (never an alert, never a silent no-op).
// Boxes are addressed by the payload's `index`, not their row position, so read and write agree.

import { useState } from 'react';
import { postCriterionState, ApiError } from '../../services/api';
import type { AcceptanceCriterion } from '../../types';

interface Props {
  items: AcceptanceCriterion[];
  projectKey: string;
  ticketId: string;
  onChanged: () => void;
}

export function AcceptanceList({ items, projectKey, ticketId, onChanged }: Props) {
  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(c: AcceptanceCriterion) {
    if (pending !== null) return;
    setPending(c.index);
    setError(null);
    try {
      await postCriterionState(projectKey, ticketId, c.index, !c.checked);
      onChanged();
    } catch (err) {
      // stale_criterion (409) = another writer got there first; refetching shows the truth.
      if (err instanceof ApiError && err.code === 'stale_criterion') onChanged();
      setError(err instanceof ApiError ? err.message : 'failed to update the criterion');
    } finally {
      setPending(null);
    }
  }

  if (!items.length) return <p className="muted">No acceptance criteria.</p>;
  const done = items.filter((c) => c.checked).length;
  return (
    <div className="ac-list">
      <div className="ac-progress">{done}/{items.length} met</div>
      <ul>
        {items.map((c) => (
          <li key={c.index} className={c.checked ? 'ac-item checked' : 'ac-item'}>
            <label>
              <input
                type="checkbox"
                checked={c.checked}
                disabled={pending !== null}
                onChange={() => toggle(c)}
              />
              <span>{c.text}</span>
            </label>
          </li>
        ))}
      </ul>
      {error && <div className="inline-error">{error}</div>}
    </div>
  );
}
