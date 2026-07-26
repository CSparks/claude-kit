// Add an acceptance criterion from the ticket page (KIT-T153). One line of text — the server
// appends it under `## Acceptance Criteria` and stamps History — then the parent re-fetches so the
// new row appears with the index its tick will address. Same inline-guard convention as CommentForm.

import { useState, type FormEvent } from 'react';
import { postCriterion, ApiError } from '../../services/api';

interface Props {
  projectKey: string;
  ticketId: string;
  onAdded: () => void;
}

export function CriterionForm({ projectKey, ticketId, onAdded }: Props) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await postCriterion(projectKey, ticketId, { text: text.trim() });
      setText('');
      onAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'failed to add the criterion');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="criterion-form" onSubmit={submit}>
      <input
        className="input criterion-input"
        placeholder="Add a criterion — one checkable observation"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button type="submit" className="btn btn-secondary" disabled={submitting || !text.trim()}>
        {submitting ? 'Adding…' : 'Add'}
      </button>
      {error && <div className="inline-error">{error}</div>}
    </form>
  );
}
