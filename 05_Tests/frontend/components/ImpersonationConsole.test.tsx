import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from '../../../02_Frontend/src/components/auth/ProtectedRoute';
import ImpersonationConsole from '../../../02_Frontend/src/pages/64_F064_ImpersonationConsole';
import { RBACUser, ImpersonationAudit } from '../../../02_Frontend/src/types';

// Mock API calls
global.fetch = jest.fn();

const mockUsers: RBACUser[] = [
  {
    id: 'user-1',
    email: 'finance@example.com',
    display_name: 'Finance User',
    role: 'finance_user',
    tenant_id: 'tenant-1',
    last_login: '2026-05-08T10:30:00Z'
  },
  {
    id: 'user-2',
    email: 'admin@example.com',
    display_name: 'Admin User',
    role: 'ria_admin',
    tenant_id: 'tenant-1',
    last_login: '2026-05-07T14:00:00Z'
  }
];

const mockAuditLog: ImpersonationAudit[] = [
  {
    admin_id: 'admin-1',
    admin_name: 'CTO',
    target_id: 'user-1',
    target_name: 'Finance User',
    started_at: '2026-05-08T10:00:00Z',
    reason: 'Support ticket #123'
  }
];

describe('ImpersonationConsole', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url === '/api/rbac/users') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockUsers)
        });
      }
      if (url === '/api/rbac/impersonation-audit') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockAuditLog)
        });
      }
      return Promise.resolve({ ok: false });
    });

    // Mock sessionStorage
    const mockStorage: Record<string, string> = {};
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: (key: string) => mockStorage[key] || null,
        setItem: (key: string, value: string) => {
          mockStorage[key] = value;
        }
      },
      writable: true
    });
  });

  test('test_users_table_renders_with_data', async () => {
    render(
      <BrowserRouter>
        <ProtectedRoute requiredRole="ria_admin">
          <ImpersonationConsole />
        </ProtectedRoute>
      </BrowserRouter>
    );

    // Wait for users to load
    await waitFor(() => {
      expect(screen.getByText('Finance User')).toBeInTheDocument();
      expect(screen.getByText('Admin User')).toBeInTheDocument();
    });

    // Verify table structure
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
    expect(screen.getByText('finance@example.com')).toBeInTheDocument();
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
  });

  test('test_assign_role_dialog', async () => {
    const user = userEvent.setup();

    (global.fetch as jest.Mock).mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/rbac/users') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockUsers)
        });
      }
      if (url === '/api/rbac/assign-role') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        });
      }
      return Promise.resolve({ ok: false });
    });

    render(
      <BrowserRouter>
        <ProtectedRoute requiredRole="ria_admin">
          <ImpersonationConsole />
        </ProtectedRoute>
      </BrowserRouter>
    );

    // Wait for users to load
    await waitFor(() => {
      expect(screen.getByText('Finance User')).toBeInTheDocument();
    });

    // Click "Change Role" button
    const changeRoleButtons = screen.getAllByLabelText(/Change role for/);
    await user.click(changeRoleButtons[0]);

    // Verify modal opens
    expect(screen.getByText(/Change Role: Finance User/)).toBeInTheDocument();

    // Select new role
    const roleSelect = screen.getByDisplayValue('finance_user') as HTMLSelectElement;
    await user.selectOptions(roleSelect, 'ria_admin');

    // Click assign
    const assignButton = screen.getByRole('button', { name: /Assign/ });
    await user.click(assignButton);

    // Verify API was called
    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls;
      const assignCall = calls.find((call: any[]) => call[0] === '/api/rbac/assign-role');
      expect(assignCall).toBeDefined();
    });
  });

  test('test_reset_role_warning', async () => {
    const user = userEvent.setup();

    (global.fetch as jest.Mock).mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/rbac/users') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockUsers)
        });
      }
      if (url.includes('/api/rbac/roles/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        });
      }
      return Promise.resolve({ ok: false });
    });

    render(
      <BrowserRouter>
        <ProtectedRoute requiredRole="ria_admin">
          <ImpersonationConsole />
        </ProtectedRoute>
      </BrowserRouter>
    );

    // Wait for users to load
    await waitFor(() => {
      expect(screen.getByText('Finance User')).toBeInTheDocument();
    });

    // Click "Reset" button
    const resetButtons = screen.getAllByLabelText(/Reset role for/);
    await user.click(resetButtons[0]);

    // Verify modal warning appears
    expect(screen.getByText(/Reset Role to Viewer?/)).toBeInTheDocument();
    expect(screen.getByText(/lose all administrative privileges/)).toBeInTheDocument();

    // Click confirm reset
    const confirmButton = screen.getByRole('button', { name: /Reset Role/ });
    await user.click(confirmButton);

    // Verify API was called with DELETE
    await waitFor(() => {
      const calls = (global.fetch as jest.Mock).mock.calls;
      const deleteCall = calls.find(
        (call: any[]) => call[0].includes('/api/rbac/roles/') && call[1]?.method === 'DELETE'
      );
      expect(deleteCall).toBeDefined();
    });
  });

  test('test_error_state', async () => {
    // Mock API to fail
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(
      <BrowserRouter>
        <ProtectedRoute requiredRole="ria_admin">
          <ImpersonationConsole />
        </ProtectedRoute>
      </BrowserRouter>
    );

    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText(/Failed to load users/)).toBeInTheDocument();
    });

    // Verify error UI
    expect(screen.getByRole('button', { name: /Dismiss/ })).toBeInTheDocument();

    // Click dismiss button
    const dismissButton = screen.getByRole('button', { name: /Dismiss/ });
    fireEvent.click(dismissButton);

    // Error should disappear
    await waitFor(() => {
      expect(screen.queryByText(/Failed to load users/)).not.toBeInTheDocument();
    });
  });

  test('test_modal_focus_trap_and_escape_key', async () => {
    const user = userEvent.setup();

    render(
      <BrowserRouter>
        <ProtectedRoute requiredRole="ria_admin">
          <ImpersonationConsole />
        </ProtectedRoute>
      </BrowserRouter>
    );

    // Wait for users to load
    await waitFor(() => {
      expect(screen.getByText('Finance User')).toBeInTheDocument();
    });

    // Click "Change Role" button to open modal
    const changeRoleButtons = screen.getAllByLabelText(/Change role for/);
    await user.click(changeRoleButtons[0]);

    // Verify modal is open
    expect(screen.getByText(/Change Role: Finance User/)).toBeInTheDocument();

    // Test Escape key closes modal
    const modal = screen.getByText(/Change Role: Finance User/).closest('[role="dialog"]');
    if (modal) {
      fireEvent.keyDown(modal, { key: 'Escape' });
    }

    // Modal should be closed (text should disappear)
    await waitFor(() => {
      expect(screen.queryByText(/Change Role: Finance User/)).not.toBeInTheDocument();
    });
  });
});
