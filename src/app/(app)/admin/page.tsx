'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useFetch } from '@/lib/hooks';
import { formatDateTime, cn } from '@/lib/utils';
import { Shield, Zap, Activity, RefreshCw, AlertTriangle, FileText, Users, Key, Loader2, X } from 'lucide-react';

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

export default function AdminPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<'users' | 'ghl'>('ghl');
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
    </div>
  );
}
