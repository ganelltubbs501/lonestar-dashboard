'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useFetch } from '@/lib/hooks';
import { WorkItemTypeLabel, cn } from '@/lib/utils';
import { Plus, Edit2, Trash2, Save, X, AlertTriangle, Loader2, FileText } from 'lucide-react';
import { WorkItemType } from '@prisma/client';

interface SubtaskTemplate {
  title: string;
  offsetDays?: number;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  workItemType: WorkItemType;
  subtasks: SubtaskTemplate[];
  dueDaysOffset: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function AdminTemplatesPage() {
  const { data: session } = useSession();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: templates, refetch, isLoading } = useFetch<Template[]>('/api/templates?all=true');

  // Form state
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState<WorkItemType>(WorkItemType.GENERAL);
  const [formDueDays, setFormDueDays] = useState(7);
  const [formSubtasks, setFormSubtasks] = useState<SubtaskTemplate[]>([]);
  const [formActive, setFormActive] = useState(true);

  // Check admin access
  if (session?.user?.role !== 'ADMIN') {
    return (
      <div className="p-10 text-center">
        <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-500">You need admin permissions to view this page.</p>
      </div>
    );
  }

  const resetForm = () => {
    setFormName('');
    setFormDesc('');
    setFormType(WorkItemType.GENERAL);
    setFormDueDays(7);
    setFormSubtasks([]);
    setFormActive(true);
    setEditingId(null);
    setShowCreate(false);
    setError(null);
  };

  const startEdit = (template: Template) => {
    setFormName(template.name);
    setFormDesc(template.description || '');
    setFormType(template.workItemType);
    setFormDueDays(template.dueDaysOffset);
    setFormSubtasks(template.subtasks || []);
    setFormActive(template.isActive);
    setEditingId(template.id);
    setShowCreate(false);
    setError(null);
  };

  const startCreate = () => {
    resetForm();
    setShowCreate(true);
  };

  const addSubtask = () => {
    setFormSubtasks([...formSubtasks, { title: '' }]);
  };

  const updateSubtask = (index: number, title: string) => {
    const updated = [...formSubtasks];
    updated[index] = { ...updated[index], title };
    setFormSubtasks(updated);
  };

  const removeSubtask = (index: number) => {
    setFormSubtasks(formSubtasks.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      setError('Name is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        name: formName,
        description: formDesc || null,
        workItemType: formType,
        dueDaysOffset: formDueDays,
        subtasks: formSubtasks.filter(s => s.title.trim()),
        isActive: formActive,
      };

      const url = editingId ? `/api/templates/${editingId}` : '/api/templates';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save template');
      }

      resetForm();
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete');
      }
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const toggleActive = async (id: string, currentlyActive: boolean) => {
    try {
      const res = await fetch(`/api/templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentlyActive }),
      });
      if (!res.ok) throw new Error('Failed to update');
      refetch();
    } catch {
      alert('Failed to toggle status');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-indigo-600" /> Trigger Templates
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage default subtasks for each work item type
          </p>
        </div>
        <button
          onClick={startCreate}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Template
        </button>
      </div>

      {/* Create/Edit Form */}
      {(showCreate || editingId) && (
        <div className="card p-6 border-2 border-indigo-200">
          <h3 className="font-bold text-lg mb-4">
            {editingId ? 'Edit Template' : 'Create New Template'}
          </h3>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template Name *
              </label>
              <input
                className="input"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Book Campaign Default"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Work Item Type *
              </label>
              <select
                className="select"
                value={formType}
                onChange={(e) => setFormType(e.target.value as WorkItemType)}
                disabled={!!editingId}
              >
                {Object.entries(WorkItemTypeLabel).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Due Days
              </label>
              <input
                type="number"
                className="input"
                value={formDueDays}
                onChange={(e) => setFormDueDays(parseInt(e.target.value) || 0)}
                min={0}
              />
              <p className="text-xs text-gray-500 mt-1">
                Days from creation until due date
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <input
                className="input"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="Brief description..."
              />
            </div>
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Default Subtasks
              </label>
              <button
                type="button"
                onClick={addSubtask}
                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Subtask
              </button>
            </div>
            <div className="space-y-2">
              {formSubtasks.map((subtask, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <span className="text-xs text-gray-400 w-6">{index + 1}.</span>
                  <input
                    className="input flex-1"
                    value={subtask.title}
                    onChange={(e) => updateSubtask(index, e.target.value)}
                    placeholder="Subtask title..."
                  />
                  <button
                    type="button"
                    onClick={() => removeSubtask(index)}
                    className="text-gray-400 hover:text-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {formSubtasks.length === 0 && (
                <p className="text-sm text-gray-400 italic">No subtasks defined</p>
              )}
            </div>
          </div>

          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formActive}
                onChange={(e) => setFormActive(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-gray-700">Active</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={resetForm}
              className="btn-secondary"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="btn-primary flex items-center gap-2"
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Templates List */}
      <div className="space-y-4">
        {templates?.map((template) => (
          <div
            key={template.id}
            className={cn(
              'card p-4',
              !template.isActive && 'opacity-60 bg-gray-50'
            )}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-gray-900">{template.name}</h3>
                  <span
                    className={cn(
                      'text-[10px] px-2 py-0.5 rounded-full font-bold uppercase',
                      template.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-200 text-gray-500'
                    )}
                  >
                    {template.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-500 mb-2">
                  <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
                    {WorkItemTypeLabel[template.workItemType]}
                  </span>
                  <span>Due: +{template.dueDaysOffset} days</span>
                </div>
                {template.description && (
                  <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                )}
                {template.subtasks.length > 0 && (
                  <div className="mt-2">
                    <span className="text-xs font-medium text-gray-500">
                      Subtasks ({template.subtasks.length}):
                    </span>
                    <ul className="mt-1 text-sm text-gray-600 list-disc list-inside">
                      {template.subtasks.slice(0, 4).map((st, i) => (
                        <li key={i} className="truncate">{st.title}</li>
                      ))}
                      {template.subtasks.length > 4 && (
                        <li className="text-gray-400">
                          +{template.subtasks.length - 4} more...
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleActive(template.id, template.isActive)}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded-lg transition',
                    template.isActive
                      ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      : 'bg-green-50 text-green-600 hover:bg-green-100'
                  )}
                >
                  {template.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => startEdit(template)}
                  className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(template.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {(!templates || templates.length === 0) && (
          <div className="text-center py-12 text-gray-500">
            No templates found. Create one to get started.
          </div>
        )}
      </div>
    </div>
  );
}
