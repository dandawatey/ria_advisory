import { RBACUser } from '../../types';

interface UsersTableProps {
  users: RBACUser[];
  loading: boolean;
  onChangeRole: (user: RBACUser) => void;
  onResetRole: (user: RBACUser) => void;
  onImpersonate: (user: RBACUser) => void;
}

export function UsersTable({
  users,
  loading,
  onChangeRole,
  onResetRole,
  onImpersonate
}: UsersTableProps) {
  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Loading users...</p>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-8 bg-white rounded border border-gray-200 p-6">
        <p className="text-gray-500">No users found in your tenant</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Login</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {users.map(user => (
            <tr key={user.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.display_name}</td>
              <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
              <td className="px-6 py-4 text-sm">
                <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                  {user.role}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-gray-600">
                {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
              </td>
              <td className="px-6 py-4 text-sm space-x-2">
                <button
                  onClick={() => onChangeRole(user)}
                  className="text-blue-600 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1"
                  aria-label={`Change role for ${user.display_name}`}
                >
                  Change Role
                </button>
                <button
                  onClick={() => onResetRole(user)}
                  className="text-red-600 hover:underline focus:outline-none focus:ring-2 focus:ring-red-500 rounded px-1"
                  aria-label={`Reset role for ${user.display_name}`}
                >
                  Reset
                </button>
                <button
                  onClick={() => onImpersonate(user)}
                  className="text-green-600 hover:underline focus:outline-none focus:ring-2 focus:ring-green-500 rounded px-1"
                  aria-label={`Impersonate ${user.display_name}`}
                >
                  Impersonate
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
