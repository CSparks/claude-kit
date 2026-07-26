// Create a ticket from the board (KIT-T153). Type and priority options come from the project row
// (config.yml's own taxonomy) rather than a hardcoded list, so the form can never offer a type the
// server will reject. The id is MINTED server-side (KIT-D011) — nothing here picks one. On success
// the caller navigates to the new ticket, which is where its criteria and plan get filled in.

import { useState, type FormEvent } from 'react';
import { createTicket, ApiError } from '../../services/api';
import type { ProjectSummary } from '../../types';

const FALLBACK_TYPE = 'feature';
const FALLBACK_PRIORITY = 'medium';

interface Props {
  project: ProjectSummary | null;
  projectKey: string;
  onCreated: (id: string) => void;
  onCancel: () => void;
}

export function NewTicketForm({ project, projectKey, onCreated, onCancel }: Props) {
  const types = project?.types?.length ? project.types : [FALLBACK_TYPE];
  const priorities = project?.priorities?.length ? project.priorities : [FALLBACK_PRIORITY];
  const [type, setType] = useState(types.includes(FALLBACK_TYPE) ? FALLBACK_TYPE : types[0]);
  const [priority, setPriority] = useState(priorities.includes(FALLBACK_PRIORITY) ? FALLBACK_PRIORITY : priorities[0]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createTicket(projectKey, {
        type,
        title: title.trim(),
        priority,
        description: description.trim() || undefined,
      });
      onCreated(created.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'failed to create the ticket');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="new-ticket-form" onSubmit={submit}>
      <div className="new-ticket-row">
        <label>
          <span>Type</span>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>
          <span>Priority</span>
          <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
            {priorities.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
      </div>
      <label className="new-ticket-field">
        <span>Title</span>
        <input
          className="input"
          autoFocus
          placeholder="Short imperative title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label className="new-ticket-field">
        <span>Description</span>
        <textarea
          className="input"
          rows={4}
          placeholder="What and why (optional — fill it in on the ticket page)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      {error && <div className="inline-error">{error}</div>}
      <div className="new-ticket-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting || !title.trim()}>
          {submitting ? 'Creating…' : 'Create ticket'}
        </button>
      </div>
    </form>
  );
}
