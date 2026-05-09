import { useState, useEffect, useRef } from 'react';
import { RBACUser, RoleOption, UserRole } from '../../types';

const ROLE_OPTIONS: RoleOption[] = [
  { value: 'viewer', label: 'Viewer (Read-only)' },
  { value: 'finance_user', label: 'Finance User' },
  { value: 'isource_admin', label: 'iSource Admin' },
  { value: 'ria_admin', label: 'RIA Admin' },
  { value: 'superadmin', label: 'Superadmin' }
];

interface RoleChangeModalProps {
  user: RBACUser;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newRole: string) => Promise<void>;
  loading?: boolean;
}

export function RoleChangeModal({
  user,
  isOpen,
  onClose,
  onConfirm,
  loading = false
}: RoleChangeModalProps) {
  const [newRole, setNewRole] = useState<UserRole>(user.role);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async () => {
    if (!newRole) return;
    try {
      setError(null);
      await onConfirm(newRole as string);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change role');
    }
  };

  // Focus trap + Escape key handler
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    // Get all focusable elements
    const focusableElements = modalRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    // Focus first element on modal open
    firstElement?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle Escape key
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Handle Tab key focus trap
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    modalRef.current?.addEventListener('keydown', handleKeyDown);
    return () => modalRef.current?.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div
        className="fixed inset-0 bg-black bg-opacity-50"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={modalRef}
        className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-lg relative z-10"
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-change-title"
      >
        <h2 id="role-change-title" className="text-lg font-bold mb-4">
          Change Role: {user.display_name}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded text-sm">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label htmlFor="role-select" className="block text-sm font-medium text-gray-700 mb-2">
            New Role
          </label>
          <select
            id="role-select"
            value={newRole}
            onChange={e => setNewRole(e.target.value as UserRole)}
            disabled={loading}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-describedby="role-help"
          >
            <option value="">Select a role...</option>
            {ROLE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p id="role-help" className="mt-1 text-xs text-gray-500">
            Select the new role for this user. They will have all permissions of this role.
          </p>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            aria-label="Cancel role change"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!newRole || loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={`Confirm change to ${newRole}`}
          >
            {loading ? 'Saving...' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
}
