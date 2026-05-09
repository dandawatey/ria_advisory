import { useState, useEffect, useRef } from 'react';
import { RBACUser } from '../../types';

interface ImpersonateModalProps {
  user: RBACUser;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  loading?: boolean;
}

export function ImpersonateModal({
  user,
  isOpen,
  onClose,
  onConfirm,
  loading = false
}: ImpersonateModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async () => {
    try {
      setError(null);
      await onConfirm(reason);
      onClose();
      setReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to impersonate user');
    }
  };

  // Focus trap + Escape key handler
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const focusableElements = modalRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    firstElement?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

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
        aria-labelledby="impersonate-title"
      >
        <h2 id="impersonate-title" className="text-lg font-bold mb-4">
          Impersonate User
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded text-sm">
            {error}
          </div>
        )}

        <p className="text-gray-600 mb-4">
          You are about to impersonate <strong>{user.display_name}</strong>. This action will be
          logged.
        </p>

        <div className="mb-4">
          <label htmlFor="reason-input" className="block text-sm font-medium text-gray-700 mb-2">
            Reason (optional)
          </label>
          <input
            id="reason-input"
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g., Support ticket #1234"
            disabled={loading}
            maxLength={256}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            aria-describedby="reason-help"
          />
          <p id="reason-help" className="mt-1 text-xs text-gray-500">
            Provide a reason for auditing purposes. (256 characters max)
          </p>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={() => {
              onClose();
              setReason('');
              setError(null);
            }}
            disabled={loading}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
            aria-label="Cancel impersonation"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-green-500"
            aria-label={`Confirm impersonate ${user.display_name}`}
          >
            {loading ? 'Impersonating...' : 'Impersonate'}
          </button>
        </div>
      </div>
    </div>
  );
}
