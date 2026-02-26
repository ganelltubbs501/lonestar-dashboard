'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useFetch } from '@/lib/hooks';
import { formatDateTime, cn } from '@/lib/utils';
import {
  Shield, Zap, Activity, RefreshCw, AlertTriangle, FileText,
  Users, Key, Loader2, X, Database, HeartPulse, CheckCircle2, XCircle,
  ShieldAlert, Check, Send,
} from 'lucide-react';

interface User {
  id: string;
  name: string | null;
  email: string;
  role: 'ADMIN' | 'STAFF';
}

interface IntegrationEvent {
  id: string;
  source: string;
  eventType: string;
  payload: any;
  receivedAt: string;
  processedAt: string | null;
  workItem: { id: string; title: string } | null;
}

interface SyncRun {
  id: string;
  kind: string;
  spreadsheetId: string;
  range: string;
  status: 'SUCCESS' | 'FAILED';
  inserted: number;
  updated: number;
  skipped: number;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  createdAt: string;
}

interface SyncStatus {
  recentRuns: SyncRun[];
  lastRun: SyncRun | null;
  hasRecentFailure: boolean;
}

interface CronRunLog {
  id: string;
  jobName: string;
  status: 'success' | 'error';
  result: Record<string, unknown> | null;
  error: string | null;
  durationMs: number | null;
  createdAt: string;
}

interface HealthData {
  checkedAt: string;
  db: { ok: boolean; error: string | null };
  lastSheetsSync: SyncRun | null;
  lastRecurrence: CronRunLog | null;
  lastTxSync: CronRunLog | null;
  upcomingDeadlines: number | null;
  revision: string | null;
  service: string | null;
}

export default function AdminPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<'users' | 'ghl' | 'sync' | 'health' | 'sla'>('ghl');
  const [webhookJson, setWebhookJson] = useState(
    JSON.stringify(
      {
        type: 'ContactCreate',
        locationId: 'loc_123',
        contactId: 'cont_abc',
        email: 'newlead@test.com',
        name: 'Test Lead',
      },
      null,
      2
    )
  );
  const [isSimulating, setIsSimulating] = useState(false);

  // User management state
  const [passwordResetUser, setPasswordResetUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [userActionError, setUserActionError] = useState<string | null>(null);
  const [changingRoleUserId, setChangingRoleUserId] = useState<string | null>(null);

  const { data: users, refetch: refetchUsers } = useFetch<User[]>('/api/users');
  const { data: integrationEvents, refetch: refetchEvents } = useFetch<IntegrationEvent[]>('/api/admin/integration-events');
  const { data: syncStatus, refetch: refetchSync } = useFetch<SyncStatus>('/api/admin/sync-status');
  const { data: health, refetch: refetchHealth } = useFetch<HealthData>('/api/admin/health');

  // SLA rules editor state
  interface SlaRuleAdmin {
    id: string; workItemType: string; label: string;
    targetDays: number | null; dueDateDriven: boolean;
  }
  const { data: slaRules, refetch: refetchSla } = useFetch<SlaRuleAdmin[]>('/api/admin/sla');
  const [editingSlaType, setEditingSlaType] = useState<string | null>(null);
  const [slaEditDays, setSlaEditDays] = useState<string>('');
  const [slaEditDriven, setSlaEditDriven] = useState<boolean>(false);
  const [slaEditLabel, setSlaEditLabel] = useState<string>('');
  const [slaSaving, setSlaSaving] = useState(false);

  const startSlaEdit = (rule: SlaRuleAdmin) => {
    setEditingSlaType(rule.workItemType);
    setSlaEditDays(rule.targetDays != null ? String(rule.targetDays) : '');
    setSlaEditDriven(rule.dueDateDriven);
    setSlaEditLabel(rule.label);
  };

  const [digestSending, setDigestSending] = useState(false);

  const sendTestDigest = async () => {
    setDigestSending(true);
    try {
      const res = await fetch('/api/admin/digest', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        const { sent, summary } = data;
        alert(
          `Digest sent!\n\n` +
          `Email: ${sent.email ? '✅' : '❌ (check SMTP_HOST / DIGEST_TO)'}\n` +
          `Slack: ${sent.slack ? '✅' : '❌ (check SLACK_WEBHOOK_URL)'}\n` +
          `GHL:   ${sent.ghl ? '✅' : '❌ (check GHL_DIGEST_WEBHOOK_URL)'}\n\n` +
          `Items: ${summary.overdue} overdue · ${summary.dueToday} due today · ` +
          `${summary.dueSoon} due soon · ${summary.blockedOver3d} blocked >3d`
        );
      } else {
        alert('Digest failed: ' + (data.error ?? 'Unknown error'));
      }
    } catch {
      alert('Failed to send test digest');
    } finally {
      setDigestSending(false);
    }
  };

  const saveSlaEdit = async () => {
    if (!editingSlaType) return;
    setSlaSaving(true);
    await fetch(`/api/admin/sla/${editingSlaType}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetDays: slaEditDriven ? null : (slaEditDays ? Number(slaEditDays) : null),
        dueDateDriven: slaEditDriven,
        label: slaEditLabel,
      }),
    });
    setSlaSaving(false);
    setEditingSlaType(null);
    refetchSla();
  };

  const handleRoleChange = async (userId: string, newRole: 'ADMIN' | 'STAFF') => {
    setChangingRoleUserId(userId);
    setUserActionError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to change role');
      }
      refetchUsers();
    } catch (err) {
      setUserActionError(err instanceof Error ? err.message : 'Failed to change role');
    } finally {
      setChangingRoleUserId(null);
    }
  };

  const handlePasswordReset = async () => {
    if (!passwordResetUser || newPassword.length < 8) {
      setUserActionError('Password must be at least 8 characters');
      return;
    }
    setIsResettingPassword(true);
    setUserActionError(null);
    try {
      const res = await fetch(`/api/admin/users/${passwordResetUser.id}/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }
      setPasswordResetUser(null);
      setNewPassword('');
      alert('Password reset successfully');
    } catch (err) {
      setUserActionError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsResettingPassword(false);
    }
  };

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

  const simulateWebhook = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch('/api/webhooks/ghl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: webhookJson,
      });
      const data = await res.json();

      if (data.success) {
        alert(
          data.workItemId
            ? `Webhook simulated! Work Item created: ${data.workItemId}`
            : 'Webhook simulated! (No work item created)'
        );
      } else {
        alert('Webhook simulation failed: ' + (data.error || 'Unknown error'));
      }

      refetchEvents();
    } catch (error) {
      alert('Failed to simulate webhook');
      console.error(error);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Shield className="w-6 h-6 text-indigo-600" /> Admin Console
        </h1>
      </div>

      {/* Global failure banner — always visible regardless of active tab */}
      {syncStatus?.hasRecentFailure && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Google Sheets sync failure detected in the last 24 hours</p>
            {syncStatus.lastRun?.status === 'FAILED' && syncStatus.lastRun.error && (
              <p className="text-xs text-red-700 mt-1 truncate">{syncStatus.lastRun.error}</p>
            )}
          </div>
          <button
            onClick={() => setActiveTab('sync')}
            className="text-xs text-red-700 font-semibold underline shrink-0"
          >
            View details
          </button>
        </div>
      )}

      <div className="flex gap-6 border-b border-gray-200 mb-6">
        <button
          className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'ghl'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('ghl')}
        >
          <Zap className="w-4 h-4" />
          GHL Integration
        </button>
        <button
          className={`pb-3 text-sm font-medium border-b-2 transition flex items-center gap-1.5 ${
            activeTab === 'users'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('users')}
        >
          <Users className="w-4 h-4" />
          User Management
        </button>
        <button
          className={cn(
            'pb-3 text-sm font-medium border-b-2 transition flex items-center gap-1.5',
            activeTab === 'sync'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
          onClick={() => setActiveTab('sync')}
        >
          <Database className="w-4 h-4" />
          Sync Runs
          {syncStatus?.hasRecentFailure && (
            <span className="ml-1 w-2 h-2 rounded-full bg-red-500 inline-block" />
          )}
        </button>
        <button
          className={cn(
            'pb-3 text-sm font-medium border-b-2 transition flex items-center gap-1.5',
            activeTab === 'health'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
          onClick={() => setActiveTab('health')}
        >
          <HeartPulse className="w-4 h-4" />
          Health
        </button>
        <button
          className={cn(
            'pb-3 text-sm font-medium border-b-2 transition flex items-center gap-1.5',
            activeTab === 'sla'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
          onClick={() => setActiveTab('sla')}
        >
          <ShieldAlert className="w-4 h-4" />
          SLA Rules
        </button>
        <Link
          href="/admin/templates"
          className="pb-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition flex items-center gap-1.5"
        >
          <FileText className="w-4 h-4" />
          Templates
        </Link>
      </div>

      {activeTab === 'users' && (
        <div className="space-y-4">
          {userActionError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
              {userActionError}
              <button onClick={() => setUserActionError(null)} className="text-red-400 hover:text-red-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="card p-6">
            <h3 className="font-bold mb-4">Team Members</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Name</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Email</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Role</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users?.map((u) => (
                    <tr key={u.id} className="border-t border-gray-100">
                      <td className="px-4 py-3">
                        {u.name || '-'}
                        {u.id === session?.user?.id && (
                          <span className="ml-2 text-xs text-indigo-600">(you)</span>
                        )}
                      </td>
                      <td className="px-4 py-3">{u.email}</td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value as 'ADMIN' | 'STAFF')}
                          disabled={changingRoleUserId === u.id || u.id === session?.user?.id}
                          className={cn(
                            "px-2 py-1 rounded text-xs font-bold border-0 cursor-pointer",
                            u.role === 'ADMIN'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-gray-100 text-gray-700',
                            (changingRoleUserId === u.id || u.id === session?.user?.id) && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="STAFF">STAFF</option>
                        </select>
                        {changingRoleUserId === u.id && (
                          <Loader2 className="w-3 h-3 animate-spin inline ml-2" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            setPasswordResetUser(u);
                            setNewPassword('');
                            setUserActionError(null);
                          }}
                          className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 ml-auto"
                        >
                          <Key className="w-3 h-3" /> Reset Password
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Password Reset Modal */}
          {passwordResetUser && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
              onClick={(e) => e.target === e.currentTarget && setPasswordResetUser(null)}
            >
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                <h3 className="font-bold text-lg mb-4">Reset Password</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Set a new password for <strong>{passwordResetUser.email}</strong>
                </p>
                <input
                  type="password"
                  className="input w-full mb-4"
                  placeholder="New password (min 8 characters)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setPasswordResetUser(null)}
                    className="btn-secondary"
                    disabled={isResettingPassword}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePasswordReset}
                    className="btn-primary flex items-center gap-2"
                    disabled={isResettingPassword || newPassword.length < 8}
                  >
                    {isResettingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
                    Reset Password
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'ghl' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Simulator */}
          <div className="card p-6">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4 text-orange-500" /> Webhook Simulator
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              Paste a JSON payload here to simulate an incoming webhook from Go High Level.
            </p>
            <textarea
              className="w-full h-40 font-mono text-xs p-3 bg-slate-50 border border-gray-300 rounded-md mb-4"
              value={webhookJson}
              onChange={(e) => setWebhookJson(e.target.value)}
            />
            <button
              onClick={simulateWebhook}
              disabled={isSimulating}
              className="w-full bg-gray-900 text-white py-2 rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {isSimulating ? 'Simulating...' : 'Simulate Inbound Webhook'}
            </button>
          </div>

          {/* Logs */}
          <div className="card p-6 flex flex-col h-[500px]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500" /> Integration Logs
              </h3>
              <button
                onClick={() => refetchEvents()}
                className="text-gray-400 hover:text-gray-600"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3">
              {integrationEvents?.map((evt) => (
                <div key={evt.id} className="text-xs p-3 rounded bg-gray-50 border border-gray-100">
                  <div className="flex justify-between mb-1">
                    <span className="font-bold text-blue-600">
                      {evt.source} - {evt.eventType}
                    </span>
                    <span className="text-gray-400">{formatDateTime(evt.receivedAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        evt.processedAt
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {evt.processedAt ? 'PROCESSED' : 'PENDING'}
                    </span>
                    {evt.workItem && (
                      <span className="text-gray-500">→ {evt.workItem.title}</span>
                    )}
                  </div>
                  <pre className="text-gray-600 font-mono break-all line-clamp-2 mt-1 whitespace-pre-wrap">
                    {JSON.stringify(evt.payload, null, 2).substring(0, 200)}
                    {JSON.stringify(evt.payload).length > 200 && '...'}
                  </pre>
                </div>
              ))}
              {(!integrationEvents || integrationEvents.length === 0) && (
                <div className="text-center text-gray-400 py-8">No events yet</div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'sync' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-800">Recent Sync Runs (last 20)</h3>
            <button onClick={() => refetchSync()} className="text-gray-400 hover:text-gray-600">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {!syncStatus?.recentRuns?.length ? (
            <div className="card p-8 text-center text-gray-400 text-sm">No sync runs recorded yet.</div>
          ) : (
            <div className="card overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Tab / Range</th>
                    <th className="px-4 py-2 text-right">Ins</th>
                    <th className="px-4 py-2 text-right">Upd</th>
                    <th className="px-4 py-2 text-right">Skip</th>
                    <th className="px-4 py-2 text-right">Duration</th>
                    <th className="px-4 py-2 text-right">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {syncStatus.recentRuns.map((run) => (
                    <tr key={run.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded text-xs font-bold',
                            run.status === 'SUCCESS'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          )}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 max-w-[240px]">
                        <span className="truncate block text-gray-700" title={run.range}>
                          {run.range}
                        </span>
                        {run.status === 'FAILED' && run.error && (
                          <span className="text-xs text-red-600 block truncate" title={run.error}>
                            {run.error}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{run.inserted}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{run.updated}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{run.skipped}</td>
                      <td className="px-4 py-2.5 text-right text-gray-400 font-mono text-xs">
                        {run.durationMs != null ? `${run.durationMs}ms` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-400 text-xs whitespace-nowrap">
                        {formatDateTime(run.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'health' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-800">System Health</h3>
            <button onClick={() => refetchHealth()} className="text-gray-400 hover:text-gray-600">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {!health ? (
            <div className="card p-8 text-center text-gray-400 text-sm">Loading health data…</div>
          ) : (
            <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* DB */}
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  {health.db.ok
                    ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                    : <XCircle className="w-4 h-4 text-red-500" />}
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Database</span>
                </div>
                <p className={cn('text-sm font-semibold', health.db.ok ? 'text-green-700' : 'text-red-700')}>
                  {health.db.ok ? 'Connected' : 'Error'}
                </p>
                {health.db.error && <p className="text-xs text-red-600 mt-1 truncate">{health.db.error}</p>}
              </div>

              {/* Last Sheets Sync */}
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  {health.lastSheetsSync?.status === 'SUCCESS'
                    ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                    : health.lastSheetsSync?.status === 'FAILED'
                    ? <XCircle className="w-4 h-4 text-red-500" />
                    : <AlertTriangle className="w-4 h-4 text-gray-400" />}
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Last Sheets Sync</span>
                </div>
                {health.lastSheetsSync ? (
                  <>
                    <p className={cn('text-sm font-semibold',
                      health.lastSheetsSync.status === 'SUCCESS' ? 'text-green-700' : 'text-red-700'
                    )}>
                      {health.lastSheetsSync.status}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      +{health.lastSheetsSync.inserted} ins · +{health.lastSheetsSync.updated} upd · {health.lastSheetsSync.skipped} skip
                    </p>
                    {health.lastSheetsSync.error && (
                      <p className="text-xs text-red-600 mt-1 truncate" title={health.lastSheetsSync.error}>
                        {health.lastSheetsSync.error}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{formatDateTime(health.lastSheetsSync.createdAt)}</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400">No runs yet</p>
                )}
              </div>

              {/* Last Recurrence Run */}
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  {health.lastRecurrence?.status === 'success'
                    ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                    : health.lastRecurrence?.status === 'error'
                    ? <XCircle className="w-4 h-4 text-red-500" />
                    : <AlertTriangle className="w-4 h-4 text-gray-400" />}
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Recurrence Engine</span>
                </div>
                {health.lastRecurrence ? (
                  <>
                    <p className={cn('text-sm font-semibold',
                      health.lastRecurrence.status === 'success' ? 'text-green-700' : 'text-red-700'
                    )}>
                      {health.lastRecurrence.status === 'success' ? 'Success' : 'Error'}
                    </p>
                    {health.lastRecurrence.result && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        +{(health.lastRecurrence.result as any).created ?? '?'} created · {(health.lastRecurrence.result as any).skipped ?? '?'} skipped
                      </p>
                    )}
                    {health.lastRecurrence.error && (
                      <p className="text-xs text-red-600 mt-1 truncate">{health.lastRecurrence.error}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{formatDateTime(health.lastRecurrence.createdAt)}</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400">No runs yet</p>
                )}
              </div>

              {/* Upcoming Deadlines */}
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Upcoming Deadlines (28d)</span>
                </div>
                <p className="text-3xl font-bold text-indigo-600">
                  {health.upcomingDeadlines ?? '—'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">editorial deadlines pre-generated</p>
              </div>

              {/* Texas Authors Sync */}
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  {health.lastTxSync?.status === 'success'
                    ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                    : health.lastTxSync?.status === 'error'
                    ? <XCircle className="w-4 h-4 text-red-500" />
                    : <AlertTriangle className="w-4 h-4 text-gray-400" />}
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">TX Authors Cron</span>
                </div>
                {health.lastTxSync ? (
                  <>
                    <p className={cn('text-sm font-semibold',
                      health.lastTxSync.status === 'success' ? 'text-green-700' : 'text-red-700'
                    )}>
                      {health.lastTxSync.status === 'success' ? 'Success' : 'Error'}
                    </p>
                    {health.lastTxSync.result && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        +{(health.lastTxSync.result as any).inserted ?? '?'} ins · {(health.lastTxSync.result as any).rows ?? '?'} rows
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{formatDateTime(health.lastTxSync.createdAt)}</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400">No runs yet</p>
                )}
              </div>

              {/* Cloud Run Info */}
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Cloud Run</span>
                </div>
                <p className="text-sm font-mono text-gray-700 truncate" title={health.revision ?? undefined}>
                  {health.revision ?? '(local)'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{health.service ?? 'ops-desktop'}</p>
                <p className="text-xs text-gray-300 mt-1">checked {formatDateTime(health.checkedAt)}</p>
              </div>
            </div>

            {/* Daily Digest test trigger */}
            <div className="card p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-700">Daily Digest</p>
                <p className="text-xs text-gray-500">Email · Slack · GHL — scheduled 08:00 CT daily</p>
              </div>
              <button
                onClick={sendTestDigest}
                disabled={digestSending}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                {digestSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Send Test Digest
              </button>
            </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'sla' && (
        <div className="space-y-4">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">SLA Rules</h3>
              <p className="text-sm text-gray-500">Click Edit to modify. Changes apply immediately without a deploy.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Label</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Type</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Target Days</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Due-date Driven</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {slaRules?.map((rule) => (
                    <tr key={rule.workItemType} className="border-t border-gray-100">
                      {editingSlaType === rule.workItemType ? (
                        <>
                          <td className="px-4 py-2">
                            <input
                              className="border border-gray-300 rounded px-2 py-1 text-sm w-full"
                              value={slaEditLabel}
                              onChange={e => setSlaEditLabel(e.target.value)}
                            />
                          </td>
                          <td className="px-4 py-2 text-gray-500 font-mono text-xs">{rule.workItemType}</td>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              disabled={slaEditDriven}
                              className="border border-gray-300 rounded px-2 py-1 text-sm w-24 disabled:opacity-40"
                              value={slaEditDays}
                              onChange={e => setSlaEditDays(e.target.value)}
                              placeholder="days"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={slaEditDriven}
                                onChange={e => setSlaEditDriven(e.target.checked)}
                                className="w-4 h-4"
                              />
                              <span className="text-xs text-gray-500">use dueAt field</span>
                            </label>
                          </td>
                          <td className="px-4 py-2 text-right space-x-2">
                            <button
                              onClick={saveSlaEdit}
                              disabled={slaSaving}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 disabled:opacity-50"
                            >
                              {slaSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                              Save
                            </button>
                            <button
                              onClick={() => setEditingSlaType(null)}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200"
                            >
                              <X className="w-3 h-3" /> Cancel
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 font-medium">{rule.label}</td>
                          <td className="px-4 py-3 text-gray-500 font-mono text-xs">{rule.workItemType}</td>
                          <td className="px-4 py-3">
                            {rule.dueDateDriven ? (
                              <span className="text-gray-400 italic">due-date driven</span>
                            ) : (
                              <span>{rule.targetDays ?? '—'} days</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {rule.dueDateDriven ? (
                              <span className="inline-flex items-center gap-1 text-indigo-600 text-xs font-medium">
                                <Check className="w-3.5 h-3.5" /> Yes
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">No</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => startSlaEdit(rule)}
                              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                              Edit
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                  {!slaRules && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
