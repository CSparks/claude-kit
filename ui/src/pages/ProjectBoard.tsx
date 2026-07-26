// Per-project kanban (/p/:key): the reusable KanbanBoard over /api/projects/:key/tickets, with a
// ?status= filter that narrows to one column. The page owns the header (title + filter); the column
// grid + cards are the shared component. Cards link into detail.

import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getProjects, getTickets } from '../services/api';
import { useAsync } from '../lib/useAsync';
import { STATUS_FLOW, statusLabel } from '../lib/status';
import { KanbanBoard } from '../components/KanbanBoard';
import { Loading, ErrorState } from '../components/AsyncState';
import { Modal, ModalHeader, ModalContent } from '../components/Modal';
import { NewTicketForm } from '../components/ticket/NewTicketForm';
import './ProjectBoard.css';

export default function ProjectBoard() {
  const { key = '' } = useParams<{ key: string }>();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const statusFilter = params.get('status') ?? '';

  const fetchTickets = useCallback(() => getTickets(key, statusFilter || undefined), [key, statusFilter]);
  const { data, loading, error, reload } = useAsync(fetchTickets, [key, statusFilter]);
  // The project row carries this store's configured types + priorities for the create form.
  const { data: projects } = useAsync(getProjects, []);
  const project = projects?.find((p) => p.key.toLowerCase() === key.toLowerCase()) ?? null;

  if (loading) return <Loading label={`Loading ${key} board…`} />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const tickets = data ?? [];
  const columns = statusFilter ? [statusFilter] : [...STATUS_FLOW];

  return (
    <div className="project-board">
      <header className="page-header board-header">
        <div>
          <h1>{key} board</h1>
          <p className="page-sub">{tickets.length} ticket{tickets.length === 1 ? '' : 's'}{statusFilter ? ` in ${statusLabel(statusFilter)}` : ''}</p>
        </div>
        <div className="board-tools">
          <select
            className="input status-filter"
            value={statusFilter}
            onChange={(e) => {
              const v = e.target.value;
              setParams(v ? { status: v } : {});
            }}
          >
            <option value="">All statuses</option>
            {STATUS_FLOW.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>New ticket</button>
          <Link className="btn btn-secondary" to={`/p/${key}/settings`}>Settings</Link>
        </div>
      </header>

      <KanbanBoard tickets={tickets} projectKey={key} columns={columns} />

      <Modal isOpen={creating} onClose={() => setCreating(false)}>
        <ModalHeader onClose={() => setCreating(false)}>New ticket in {key}</ModalHeader>
        <ModalContent>
          <NewTicketForm
            project={project}
            projectKey={key}
            onCancel={() => setCreating(false)}
            onCreated={(id) => { setCreating(false); navigate(`/p/${key}/t/${id}`); }}
          />
        </ModalContent>
      </Modal>
    </div>
  );
}
