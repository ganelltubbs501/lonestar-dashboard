'use client';

import { useState } from 'react';
import { useFetch, api } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  XCircle,
  Circle,
  SkipForward,
  AlertTriangle,
  Plus,
  ClipboardCheck,
} from 'lucide-react';

interface QCCheck {
  id: string;
  checkpoint: string;
  status: 'PENDING' | 'PASSED' | 'FAILED' | 'SKIPPED';
  notes: string | null;
  checkedAt: string | null;
  checkedById: string | null;
}

interface QCStats {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  completionRate: number;
}

interface QCResponse {
  checks: QCCheck[];
  stats: QCStats;
}

interface Props {
  workItemId: string;
  workItemType: string;
  onComplete?: () => void;
}

// Default checkpoints for TBP/Magazine work items
const DEFAULT_TBP_CHECKPOINTS = [
  'Spelling & Grammar Verified',
  'Links Tested & Working',
  'Graphics Assets Present',
  'Dates Confirmed',
  'Texas Tie Documented',
  'Contact Info Verified',
  'Formatting Consistent',
];

const DEFAULT_MAGAZINE_CHECKPOINTS = [
  'Content Proofread',
  'Images High Resolution',
  'Layout Approved',
  'Credits Verified',
  'Issue Number Correct',
  'Print-Ready Format',
];

export function QAChecklist({ workItemId, workItemType, onComplete }: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [customCheckpoint, setCustomCheckpoint] = useState('');

  const { data, refetch, isLoading } = useFetch<QCResponse>(
    `/api/work-items/${workItemId}/qc`
  );

  const handleStatusChange = async (
    checkpoint: string,
    newStatus: 'PASSED' | 'FAILED' | 'SKIPPED'
  ) => {
    try {
      await api.qc.updateCheckpoint(workItemId, checkpoint, newStatus);
      refetch();
      if (onComplete) onComplete();
    } catch (error) {
      console.error('Failed to update checkpoint:', error);
    }
  };

  const handleAddCheckpoint = async (checkpointName: string) => {
    if (!checkpointName.trim()) return;
    try {
      await api.qc.addCheckpoints(workItemId, [checkpointName.trim()]);
      setCustomCheckpoint('');
      setIsAdding(false);
      refetch();
    } catch (error) {
      console.error('Failed to add checkpoint:', error);
    }
  };

  const handleInitializeChecklist = async () => {
    const defaultCheckpoints =
      workItemType === 'TX_BOOK_PREVIEW_LEAD' || workItemType === 'SPONSORED_EDITORIAL_REVIEW'
        ? DEFAULT_TBP_CHECKPOINTS
        : DEFAULT_MAGAZINE_CHECKPOINTS;

    try {
      await api.qc.addCheckpoints(workItemId, defaultCheckpoints);
      refetch();
    } catch (error) {
      console.error('Failed to initialize checklist:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PASSED':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'FAILED':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'SKIPPED':
        return <SkipForward className="w-5 h-5 text-gray-400" />;
      default:
        return <Circle className="w-5 h-5 text-gray-300" />;
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 text-center text-gray-400 text-sm">
        Loading QA checklist...
      </div>
    );
  }

  const checks = data?.checks || [];
  const stats = data?.stats || { total: 0, passed: 0, failed: 0, pending: 0, completionRate: 0 };

  // No checklist initialized yet
  if (checks.length === 0) {
    return (
      <div className="p-4 border border-dashed border-orange-300 rounded-lg bg-orange-50">
        <div className="flex items-center gap-2 text-orange-700 mb-3">
          <ClipboardCheck className="w-5 h-5" />
          <span className="font-medium">QA Checklist Required</span>
        </div>
        <p className="text-sm text-orange-600 mb-4">
          This item requires a QA review before it can be marked as Done.
        </p>
        <button
          onClick={handleInitializeChecklist}
          className="btn-primary text-sm"
        >
          Initialize QA Checklist
        </button>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header with stats */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-orange-600" />
            <span className="font-semibold text-gray-700">QA Checklist</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-green-600">{stats.passed} passed</span>
            {stats.failed > 0 && (
              <span className="text-red-600">{stats.failed} failed</span>
            )}
            <span className="text-gray-400">{stats.pending} pending</span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full transition-all duration-300',
              stats.failed > 0 ? 'bg-red-500' : 'bg-green-500'
            )}
            style={{ width: `${stats.completionRate}%` }}
          />
        </div>
      </div>

      {/* Checklist items */}
      <div className="divide-y divide-gray-100">
        {checks.map((check) => (
          <div
            key={check.id}
            className={cn(
              'px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50',
              check.status === 'FAILED' && 'bg-red-50'
            )}
          >
            <div className="flex items-center gap-3">
              {getStatusIcon(check.status)}
              <span
                className={cn(
                  'text-sm',
                  check.status === 'PASSED' && 'text-gray-500 line-through',
                  check.status === 'FAILED' && 'text-red-700 font-medium',
                  check.status === 'SKIPPED' && 'text-gray-400'
                )}
              >
                {check.checkpoint}
              </span>
            </div>
            {check.status === 'PENDING' && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleStatusChange(check.checkpoint, 'PASSED')}
                  className="p-1.5 text-green-600 hover:bg-green-100 rounded"
                  title="Mark as Passed"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleStatusChange(check.checkpoint, 'FAILED')}
                  className="p-1.5 text-red-600 hover:bg-red-100 rounded"
                  title="Mark as Failed"
                >
                  <XCircle className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleStatusChange(check.checkpoint, 'SKIPPED')}
                  className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"
                  title="Skip"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add custom checkpoint */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
        {isAdding ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAddCheckpoint(customCheckpoint);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={customCheckpoint}
              onChange={(e) => setCustomCheckpoint(e.target.value)}
              placeholder="Add custom checkpoint..."
              className="input flex-1 text-sm"
              autoFocus
            />
            <button type="submit" className="btn-primary text-sm">
              Add
            </button>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="btn-secondary text-sm"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> Add Checkpoint
          </button>
        )}
      </div>

      {/* Warning if there are failures */}
      {stats.failed > 0 && (
        <div className="px-4 py-3 bg-red-50 border-t border-red-200 flex items-center gap-2 text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4" />
          <span>
            {stats.failed} checkpoint{stats.failed > 1 ? 's' : ''} failed. Resolve before marking as Done.
          </span>
        </div>
      )}
    </div>
  );
}
