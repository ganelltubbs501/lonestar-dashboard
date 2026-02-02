'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import {
  Link2,
  Calendar,
  MapPin,
  Image,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

interface TBPFields {
  tbpGraphicsLocation: string | null;
  tbpPublishDate: string | null;
  tbpArticleLink: string | null;
  tbpTxTie: string | null;
  tbpMagazineIssue: string | null;
}

interface Props {
  workItemId: string;
  workItemType: string;
  initialData: TBPFields;
  onUpdate: () => void;
}

export function TBPRequiredFields({ workItemId, workItemType, initialData, onUpdate }: Props) {
  const [fields, setFields] = useState<TBPFields>(initialData);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFields(initialData);
  }, [initialData]);

  const isTBP = workItemType === 'TX_BOOK_PREVIEW_LEAD';
  const isSER = workItemType === 'SPONSORED_EDITORIAL_REVIEW';

  // Check completion status
  const isComplete =
    !!fields.tbpGraphicsLocation &&
    !!fields.tbpPublishDate &&
    !!fields.tbpArticleLink &&
    !!fields.tbpTxTie;

  const missingCount = [
    !fields.tbpGraphicsLocation,
    !fields.tbpPublishDate,
    !fields.tbpArticleLink,
    !fields.tbpTxTie,
  ].filter(Boolean).length;

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      await api.workItems.update(workItemId, {
        tbpGraphicsLocation: fields.tbpGraphicsLocation,
        tbpPublishDate: fields.tbpPublishDate,
        tbpArticleLink: fields.tbpArticleLink,
        tbpTxTie: fields.tbpTxTie,
        tbpMagazineIssue: fields.tbpMagazineIssue,
      });
      setIsEditing(false);
      onUpdate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isTBP && !isSER) {
    return null;
  }

  return (
    <div
      className={cn(
        'border rounded-lg overflow-hidden',
        isComplete ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'px-4 py-3 flex items-center justify-between',
          isComplete ? 'bg-green-100' : 'bg-orange-100'
        )}
      >
        <div className="flex items-center gap-2">
          {isComplete ? (
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-orange-600" />
          )}
          <span
            className={cn(
              'font-semibold',
              isComplete ? 'text-green-700' : 'text-orange-700'
            )}
          >
            {isTBP ? 'TBP Required Fields' : 'Editorial Required Fields'}
          </span>
        </div>
        {!isComplete && (
          <span className="text-sm text-orange-600">
            {missingCount} field{missingCount > 1 ? 's' : ''} missing
          </span>
        )}
      </div>

      {/* Fields */}
      <div className="p-4 space-y-4">
        {error && (
          <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
            {error}
          </div>
        )}

        {/* Graphics Location */}
        <div>
          <label className="text-xs text-gray-500 font-medium flex items-center gap-1 mb-1">
            <Image className="w-3 h-3" /> Graphics Location *
          </label>
          {isEditing ? (
            <input
              type="text"
              value={fields.tbpGraphicsLocation || ''}
              onChange={(e) =>
                setFields({ ...fields, tbpGraphicsLocation: e.target.value || null })
              }
              placeholder="e.g., /assets/campaigns/2026/march/"
              className="input w-full text-sm"
            />
          ) : (
            <div
              className={cn(
                'text-sm p-2 rounded',
                fields.tbpGraphicsLocation ? 'bg-white border' : 'bg-red-100 text-red-700'
              )}
            >
              {fields.tbpGraphicsLocation || 'Not specified'}
            </div>
          )}
        </div>

        {/* Publish Date */}
        <div>
          <label className="text-xs text-gray-500 font-medium flex items-center gap-1 mb-1">
            <Calendar className="w-3 h-3" /> Publish Date *
          </label>
          {isEditing ? (
            <input
              type="datetime-local"
              value={
                fields.tbpPublishDate
                  ? new Date(fields.tbpPublishDate).toISOString().slice(0, 16)
                  : ''
              }
              onChange={(e) =>
                setFields({
                  ...fields,
                  tbpPublishDate: e.target.value ? new Date(e.target.value).toISOString() : null,
                })
              }
              className="input w-full text-sm"
            />
          ) : (
            <div
              className={cn(
                'text-sm p-2 rounded',
                fields.tbpPublishDate ? 'bg-white border' : 'bg-red-100 text-red-700'
              )}
            >
              {fields.tbpPublishDate
                ? new Date(fields.tbpPublishDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : 'Not specified'}
            </div>
          )}
        </div>

        {/* Article Link */}
        <div>
          <label className="text-xs text-gray-500 font-medium flex items-center gap-1 mb-1">
            <Link2 className="w-3 h-3" /> Article Link *
          </label>
          {isEditing ? (
            <input
              type="url"
              value={fields.tbpArticleLink || ''}
              onChange={(e) =>
                setFields({ ...fields, tbpArticleLink: e.target.value || null })
              }
              placeholder="https://..."
              className="input w-full text-sm"
            />
          ) : (
            <div
              className={cn(
                'text-sm p-2 rounded',
                fields.tbpArticleLink ? 'bg-white border' : 'bg-red-100 text-red-700'
              )}
            >
              {fields.tbpArticleLink ? (
                <a
                  href={fields.tbpArticleLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline truncate block"
                >
                  {fields.tbpArticleLink}
                </a>
              ) : (
                'Not specified'
              )}
            </div>
          )}
        </div>

        {/* Texas Tie */}
        <div>
          <label className="text-xs text-gray-500 font-medium flex items-center gap-1 mb-1">
            <MapPin className="w-3 h-3" /> Texas Connection/Tie *
          </label>
          {isEditing ? (
            <textarea
              value={fields.tbpTxTie || ''}
              onChange={(e) =>
                setFields({ ...fields, tbpTxTie: e.target.value || null })
              }
              placeholder="Describe the Texas connection..."
              className="input w-full text-sm"
              rows={2}
            />
          ) : (
            <div
              className={cn(
                'text-sm p-2 rounded',
                fields.tbpTxTie ? 'bg-white border' : 'bg-red-100 text-red-700'
              )}
            >
              {fields.tbpTxTie || 'Not specified'}
            </div>
          )}
        </div>

        {/* Magazine Issue (optional) */}
        <div>
          <label className="text-xs text-gray-500 font-medium flex items-center gap-1 mb-1">
            <FileText className="w-3 h-3" /> Magazine Issue
          </label>
          {isEditing ? (
            <input
              type="text"
              value={fields.tbpMagazineIssue || ''}
              onChange={(e) =>
                setFields({ ...fields, tbpMagazineIssue: e.target.value || null })
              }
              placeholder="e.g., March 2026"
              className="input w-full text-sm"
            />
          ) : (
            <div className="text-sm p-2 rounded bg-white border">
              {fields.tbpMagazineIssue || 'Not specified'}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-2 pt-2">
          {isEditing ? (
            <>
              <button
                onClick={() => {
                  setFields(initialData);
                  setIsEditing(false);
                  setError(null);
                }}
                className="btn-secondary text-sm"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="btn-primary text-sm flex items-center gap-1"
                disabled={isSaving}
              >
                {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                Save
              </button>
            </>
          ) : (
            <button onClick={() => setIsEditing(true)} className="btn-secondary text-sm">
              Edit Fields
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
