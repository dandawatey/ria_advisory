import { ImpersonationAudit } from '../../types';

interface AuditLogTableProps {
  auditLog: ImpersonationAudit[];
  loading?: boolean;
}

export function AuditLogTable({ auditLog, loading = false }: AuditLogTableProps) {
  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Loading audit log...</p>
      </div>
    );
  }

  if (auditLog.length === 0) {
    return (
      <div className="text-center py-8 bg-white rounded border border-gray-200 p-6">
        <p className="text-gray-500">No impersonation activity</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Admin
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Target User
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Started
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Ended
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Reason
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {auditLog.map((entry, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-6 py-4 text-sm font-medium text-gray-900">{entry.admin_name}</td>
              <td className="px-6 py-4 text-sm text-gray-600">{entry.target_name}</td>
              <td className="px-6 py-4 text-sm text-gray-600">
                {new Date(entry.started_at).toLocaleString()}
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">
                {entry.ended_at ? new Date(entry.ended_at).toLocaleString() : '—'}
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">{entry.reason || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
