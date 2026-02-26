'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useFetch, api } from '@/lib/hooks';
import {
  WorkItemTypeLabel,
  formatDate,
  formatRelativeTime,
  PriorityColors,
  StatusLabel,
  cn,
} from '@/lib/utils';
import {
  X,
  CheckCircle2,
  Circle,
  Send,
  Clock,
  AlertCircle,
  Loader2,
  Plus,
  AlertTriangle,
} from 'lucide-react';
import { WorkItemStatus, WorkItemPriority, WorkItemType } from '@prisma/client';
import { QAChecklist } from './QAChecklist';
import { TBPRequiredFields } from './TBPRequiredFields';
import { TBP_MAGAZINE_TYPES } from '@/lib/validations';

interface WorkItemDetail {
  id: string;
  type: WorkItemType;
  title: string;
  description: string;
  status: WorkItemStatus;
  priority: WorkItemPriority;
  dueAt: string | null;
  blockedReason: string | null;
  tags: string[];
  needsProofing: boolean;
  tbpGraphicsLocation: string | null;
  tbpPublishDate: string | null;
  tbpArticleLink: string | null;
  tbpTxTie: string | null;
  tbpMagazineIssue: string | null;
  requester: { id: string; name: string | null; email: string; image: string | null };
  owner: { id: string; name: string | null; email: string; image: string | null } | null;
  subtasks: { id: string; title: string; completedAt: string | null; order: number }[];
  comments: {
    id: string;
    body: string;
    createdAt: string;
    user: { id: string; name: string | null; image: string | null };
  }[];
}

interface User {
  id: string;
  name: string | null;
  email: string;
}

interface Props {
  itemId: string;
  onClose: () => void;
  onUpdate: () => void;
}

export function WorkItemModal({ itemId, onClose, onUpdate }: Props) {
  const { data: session } = useSession();
  const [newComment, setNewComment] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const { data: item, refetch } = useFetch<WorkItemDetail>(`/api/work-items/${itemId}`);
  const { data: users } = useFetch<User[]>('/api/users');

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as WorkItemStatus;
    setStatusError(null);
    try {
      await api.workItems.update(itemId, { status: newStatus });
      refetch();
      onUpdate();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Status change failed';
      setStatusError(message);
      // Reset the select to previous value
      e.target.value = item?.status || WorkItemStatus.READY;
    }
  };

  // Check if this is a TBP/Magazine type work item
  const isTBPMagazineType = item && TBP_MAGAZINE_TYPES.includes(item.type);

  const handleOwnerChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newOwnerId = e.target.value === 'unassigned' ? null : e.target.value;
    await api.workItems.update(itemId, { ownerId: newOwnerId });
    refetch();
    onUpdate();
  };

  const handleDueDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    await api.workItems.update(itemId, { dueAt: value ? new Date(value).toISOString() : null });
    refetch();
    onUpdate();
  };

  const handlePriorityChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    await api.workItems.update(itemId, { priority: e.target.value });
    refetch();
    onUpdate();
  };

  const toggleSubtask = async (subtaskId: string, currentlyCompleted: boolean) => {
    await api.subtasks.toggle(subtaskId, !currentlyCompleted);
    refetch();
  };

  const addSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtask.trim()) return;

    setIsSubmitting(true);
    try {
      await api.subtasks.create(itemId, newSubtask.trim());
      setNewSubtask('');
      setShowAddSubtask(false);
      refetch();
    } finally {
      setIsSubmitting(false);
    }
  };

  const postComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      await api.comments.create(itemId, newComment.trim());
      setNewComment('');
      refetch();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (!item) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-xl p-8">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row">
        {/* Left Col: Details */}
        <div className="flex-1 p-6 overflow-y-auto border-r border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded uppercase tracking-wide">
              {WorkItemTypeLabel[item.type]}
            </span>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 md:hidden">
              <X className="w-6 h-6" />
            </button>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">{item.title}</h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Status</label>
              <select
                value={item.status}
                onChange={handleStatusChange}
                className="select"
              >
                {Object.values(WorkItemStatus).map((s) => (
                  <option key={s} value={s}>
                    {StatusLabel[s]}
                  </option>
                ))}
              </select>
              {(() => {
                const NEXT: { [k: string]: { label: string; next: WorkItemStatus } } = {
                  READY:       { label: 'Start →',           next: WorkItemStatus.IN_PROGRESS },
                  IN_PROGRESS: { label: 'Send for Review →', next: WorkItemStatus.IN_REVIEW },
                  IN_REVIEW:   { label: 'Mark Needs QA →',   next: WorkItemStatus.NEEDS_QA },
                  NEEDS_QA:    { label: 'Mark Done ✓',       next: WorkItemStatus.DONE },
                };
                const advance = NEXT[item.status];
                if (!advance) return null;
                return (
                  <button
                    onClick={async () => {
                      setStatusError(null);
                      try {
                        await api.workItems.update(itemId, { status: advance.next });
                        refetch();
                        onUpdate();
                      } catch (err) {
                        setStatusError(err instanceof Error ? err.message : 'Status change failed');
                      }
                    }}
                    className="mt-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    {advance.label}
                  </button>
                );
              })()}
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium block mb-1">Owner</label>
              <select
                value={item.owner?.id || 'unassigned'}
                onChange={handleOwnerChange}
                className="select"
              >
                <option value="unassigned">Unassigned</option>
                {users?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status change error message */}
          {statusError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">{statusError}</div>
            </div>
          )}

          {/* TBP/Magazine Required Fields */}
          {isTBPMagazineType && (
            <div className="mb-6">
              <TBPRequiredFields
                workItemId={item.id}
                workItemType={item.type}
                initialData={{
                  tbpGraphicsLocation: item.tbpGraphicsLocation,
                  tbpPublishDate: item.tbpPublishDate,
                  tbpArticleLink: item.tbpArticleLink,
                  tbpTxTie: item.tbpTxTie,
                  tbpMagazineIssue: item.tbpMagazineIssue,
                }}
                onUpdate={refetch}
              />
            </div>
          )}

          {/* QA Checklist - show for TBP/Magazine types or items in NEEDS_QA status */}
          {(isTBPMagazineType || item.status === WorkItemStatus.NEEDS_QA || item.needsProofing) && (
            <div className="mb-6">
              <QAChecklist
                workItemId={item.id}
                workItemType={item.type}
                onComplete={refetch}
              />
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Description
            </h3>
            <p className="text-gray-600 text-sm whitespace-pre-wrap p-3 bg-gray-50 rounded-lg border border-gray-100">
              {item.description || 'No description provided.'}
            </p>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Subtasks
                {item.subtasks.length > 0 && (
                  <span className="text-xs font-normal text-gray-400">
                    {item.subtasks.filter(t => t.completedAt).length}/{item.subtasks.length}
                  </span>
                )}
              </h3>
              <button
                onClick={() => setShowAddSubtask(!showAddSubtask)}
                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>

            {item.subtasks.length > 0 && (
              <div className="mb-3">
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{
                      width: `${Math.round(
                        (item.subtasks.filter(t => t.completedAt).length / item.subtasks.length) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {showAddSubtask && (
              <form onSubmit={addSubtask} className="mb-3 flex gap-2">
                <input
                  type="text"
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  placeholder="New subtask..."
                  className="input flex-1"
                  autoFocus
                />
                <button type="submit" disabled={isSubmitting} className="btn-primary">
                  Add
                </button>
              </form>
            )}

            <div className="space-y-2">
              {item.subtasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => toggleSubtask(task.id, !!task.completedAt)}
                  className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer group"
                >
                  {task.completedAt ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <Circle className="w-5 h-5 text-gray-300 group-hover:text-indigo-500" />
                  )}
                  <span className={cn('text-sm', task.completedAt && 'line-through text-gray-400')}>
                    {task.title}
                  </span>
                </div>
              ))}
              {item.subtasks.length === 0 && (
                <p className="text-sm text-gray-400 italic">No subtasks found.</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Meta & Chat */}
        <div className="w-full md:w-80 bg-gray-50 flex flex-col border-l border-gray-200">
          <div className="p-4 border-b border-gray-200 hidden md:flex justify-end">
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-4 space-y-4 border-b border-gray-200">
            <div>
              <label className="text-xs text-gray-500 font-bold uppercase block mb-1">Due Date</label>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-500 flex-shrink-0" />
                <input
                  type="date"
                  defaultValue={item.dueAt ? item.dueAt.slice(0, 10) : ''}
                  onChange={handleDueDateChange}
                  className="text-sm text-gray-700 border border-gray-200 rounded px-2 py-1 w-full focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-bold uppercase block mb-1">Priority</label>
              <select
                value={item.priority}
                onChange={handlePriorityChange}
                className={cn(
                  'select text-xs font-bold',
                  PriorityColors[item.priority].bg,
                  PriorityColors[item.priority].text
                )}
              >
                {Object.values(WorkItemPriority).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            {item.blockedReason && (
              <div>
                <label className="text-xs text-gray-500 font-bold uppercase">Blocked Reason</label>
                <p className="text-sm text-red-600 mt-1">{item.blockedReason}</p>
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col min-h-[300px]">
            <div className="p-4 flex-1 overflow-y-auto space-y-4">
              {item.comments.map((c) => (
                <div key={c.id} className="text-sm">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="font-bold text-gray-800">{c.user.name || 'User'}</span>
                    <span className="text-xs text-gray-400">{formatRelativeTime(c.createdAt)}</span>
                  </div>
                  <div className="bg-white p-2 rounded shadow-sm border border-gray-100 text-gray-600">
                    {c.body}
                  </div>
                </div>
              ))}
              {item.comments.length === 0 && (
                <div className="text-center text-gray-400 text-xs mt-10">No comments yet.</div>
              )}
            </div>
            <form onSubmit={postComment} className="p-3 border-t border-gray-200 bg-white">
              <div className="flex gap-2">
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a note..."
                  className="input flex-1"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-indigo-600 text-white p-2 rounded-md hover:bg-indigo-700"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
