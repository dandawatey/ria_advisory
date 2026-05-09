import { useState, useEffect } from 'react';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { UsersTable } from '../components/rbac/UsersTable';
import { RoleChangeModal } from '../components/rbac/RoleChangeModal';
import { ResetRoleModal } from '../components/rbac/ResetRoleModal';
import { ImpersonateModal } from '../components/rbac/ImpersonateModal';
import { AuditLogTable } from '../components/rbac/AuditLogTable';
import { RBACUser, ImpersonationAudit } from '../types';

export default function ImpersonationConsole() {
  const [users, setUsers] = useState<RBACUser[]>([]);
  const [auditLog, setAuditLog] = useState<ImpersonationAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<RBACUser | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showImpersonateModal, setShowImpersonateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'audit'>('users');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
    fetchAuditLog();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = sessionStorage.getItem('auth_token');
      const response = await fetch('/api/rbac/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setUsers(Array.isArray(data) ? data : data.users || []);
    } catch (err) {
      setError(`Failed to load users: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLog = async () => {
    try {
      const token = sessionStorage.getItem('auth_token');
      const response = await fetch('/api/rbac/impersonation-audit', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setAuditLog(Array.isArray(data) ? data : data.audit || []);
    } catch (err) {
      console.error('Failed to load audit log:', err);
    }
  };

  const handleAssignRole = async (newRole: string) => {
    if (!selectedUser || !newRole) return;
    try {
      setActionLoading(true);
      const token = sessionStorage.getItem('auth_token');
      const response = await fetch('/api/rbac/assign-role', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: selectedUser.id,
          new_role: newRole
        })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      setUsers(users.map(u => (u.id === selectedUser.id ? { ...u, role: newRole as any } : u)));
      setShowRoleModal(false);
      setSelectedUser(null);
    } catch (err) {
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetRole = async () => {
    if (!selectedUser) return;
    try {
      setActionLoading(true);
      const token = sessionStorage.getItem('auth_token');
      const response = await fetch(`/api/rbac/roles/${selectedUser.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      setUsers(users.map(u => (u.id === selectedUser.id ? { ...u, role: 'viewer' } : u)));
      setShowResetModal(false);
      setSelectedUser(null);
    } catch (err) {
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  const handleImpersonate = async (reason: string) => {
    if (!selectedUser) return;
    try {
      setActionLoading(true);
      const token = sessionStorage.getItem('auth_token');
      const response = await fetch(`/api/rbac/impersonate/${selectedUser.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: reason || 'Admin impersonation for support'
        })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      sessionStorage.setItem('impersonation_token', data.impersonation_token);
      sessionStorage.setItem('impersonating_user', selectedUser.id);

      setShowImpersonateModal(false);
      setSelectedUser(null);
      fetchAuditLog();

      alert(`Now impersonating ${selectedUser.display_name}. Session will be tracked.`);
    } catch (err) {
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <ProtectedRoute requiredRole="ria_admin">
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">RBAC Impersonation Console</h1>
            <p className="text-gray-600 mt-2">Manage roles, permissions, and impersonation sessions</p>
          </div>

          {/* Error message */}
          {error && (
            <div
              className="mb-6 p-4 bg-red-50 border border-red-200 text-red-800 rounded"
              role="alert"
              aria-live="polite"
            >
              <p className="font-semibold">Error</p>
              <p className="text-sm mt-1">{error}</p>
              <button
                onClick={() => setError(null)}
                className="mt-2 text-sm underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-red-500 rounded px-1"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Tab navigation */}
          <div className="flex gap-4 border-b mb-6">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 rounded ${
                activeTab === 'users'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              aria-selected={activeTab === 'users'}
              role="tab"
            >
              Users ({users.length})
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-4 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 rounded ${
                activeTab === 'audit'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              aria-selected={activeTab === 'audit'}
              role="tab"
            >
              Audit Log ({auditLog.length})
            </button>
          </div>

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div role="tabpanel">
              <UsersTable
                users={users}
                loading={loading}
                onChangeRole={user => {
                  setSelectedUser(user);
                  setShowRoleModal(true);
                }}
                onResetRole={user => {
                  setSelectedUser(user);
                  setShowResetModal(true);
                }}
                onImpersonate={user => {
                  setSelectedUser(user);
                  setShowImpersonateModal(true);
                }}
              />
            </div>
          )}

          {/* Audit Tab */}
          {activeTab === 'audit' && (
            <div role="tabpanel">
              <AuditLogTable auditLog={auditLog} loading={loading} />
            </div>
          )}
        </div>

        {/* Modals */}
        {selectedUser && (
          <>
            <RoleChangeModal
              user={selectedUser}
              isOpen={showRoleModal}
              onClose={() => {
                setShowRoleModal(false);
                setSelectedUser(null);
              }}
              onConfirm={handleAssignRole}
              loading={actionLoading}
            />
            <ResetRoleModal
              user={selectedUser}
              isOpen={showResetModal}
              onClose={() => {
                setShowResetModal(false);
                setSelectedUser(null);
              }}
              onConfirm={handleResetRole}
              loading={actionLoading}
            />
            <ImpersonateModal
              user={selectedUser}
              isOpen={showImpersonateModal}
              onClose={() => {
                setShowImpersonateModal(false);
                setSelectedUser(null);
              }}
              onConfirm={handleImpersonate}
              loading={actionLoading}
            />
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
