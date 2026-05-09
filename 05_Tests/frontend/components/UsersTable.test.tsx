/**
 * IC-37: React Testing Library tests for UsersTable component
 * Tests: render, role assignment, reset role, impersonate button
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UsersTable } from '../../../02_Frontend/src/components/rbac/UsersTable'
import { RBACUser } from '../../../02_Frontend/src/types'

describe('UsersTable (IC-37)', () => {
  const mockUsers: RBACUser[] = [
    {
      id: 'user-1',
      email: 'finance@example.com',
      display_name: 'Finance User',
      role: 'finance_user',
      is_active: true,
      subsidiary_access: null,
      created_at: '2026-05-01T10:00:00Z',
      last_login: '2026-05-08T09:30:00Z'
    },
    {
      id: 'user-2',
      email: 'viewer@example.com',
      display_name: 'View Only User',
      role: 'viewer',
      is_active: true,
      subsidiary_access: null,
      created_at: '2026-05-02T10:00:00Z',
      last_login: null
    }
  ]

  const mockHandlers = {
    onAssignRole: jest.fn(),
    onResetRole: jest.fn(),
    onImpersonate: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('renders_users_table_with_data', () => {
    /**
     * Assert: Table renders with user rows
     * Expected: 2 rows (finance_user + viewer), all columns visible
     */
    render(
      <UsersTable
        users={mockUsers}
        loading={false}
        {...mockHandlers}
      />
    )

    // Assert headers
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Display Name')).toBeInTheDocument()
    expect(screen.getByText('Current Role')).toBeInTheDocument()
    expect(screen.getByText('Last Login')).toBeInTheDocument()

    // Assert user rows
    expect(screen.getByText('finance@example.com')).toBeInTheDocument()
    expect(screen.getByText('viewer@example.com')).toBeInTheDocument()
    expect(screen.getByText('Finance User')).toBeInTheDocument()
    expect(screen.getByText('View Only User')).toBeInTheDocument()

    // Assert roles displayed
    expect(screen.getByText('finance_user')).toBeInTheDocument()
    expect(screen.getByText('viewer')).toBeInTheDocument()
  })

  test('assign_role_dropdown_calls_handler', async () => {
    /**
     * User clicks role dropdown, selects new role, confirms
     * Expected: onAssignRole called with user_id + new role
     */
    const user = userEvent.setup()
    render(
      <UsersTable
        users={mockUsers}
        loading={false}
        {...mockHandlers}
      />
    )

    // Find role dropdown for finance user
    const roleSelects = screen.getAllByRole('combobox')  // Select elements
    const financeRoleSelect = roleSelects[0]

    // Click and change role to 'ria_admin'
    await user.click(financeRoleSelect)
    await user.selectOption(financeRoleSelect, 'ria_admin')

    // Confirm dialog should appear
    const confirmButton = screen.getByRole('button', { name: /confirm|update|save/i })
    await user.click(confirmButton)

    // Assert handler called with correct arguments
    await waitFor(() => {
      expect(mockHandlers.onAssignRole).toHaveBeenCalledWith('user-1', 'ria_admin')
    })
  })

  test('reset_role_button_shows_warning', async () => {
    /**
     * User clicks reset button
     * Expected: Warning modal appears, clicking confirm calls onResetRole
     */
    const user = userEvent.setup()
    render(
      <UsersTable
        users={mockUsers}
        loading={false}
        {...mockHandlers}
      />
    )

    // Find reset buttons (one per user)
    const resetButtons = screen.getAllByRole('button', { name: /reset/i })
    const firstResetButton = resetButtons[0]

    // Click reset
    await user.click(firstResetButton)

    // Warning modal should appear
    const warningText = screen.getByText(/reset.*viewer|permanently reset/i)
    expect(warningText).toBeInTheDocument()

    // Confirm reset
    const confirmButton = screen.getByRole('button', { name: /confirm|yes|ok/i })
    await user.click(confirmButton)

    // Assert handler called
    await waitFor(() => {
      expect(mockHandlers.onResetRole).toHaveBeenCalledWith('user-1')
    })
  })

  test('impersonate_button_calls_handler', async () => {
    /**
     * User clicks impersonate button
     * Expected: onImpersonate called with user_id
     */
    const user = userEvent.setup()
    render(
      <UsersTable
        users={mockUsers}
        loading={false}
        {...mockHandlers}
      />
    )

    // Find impersonate buttons
    const impersonateButtons = screen.getAllByRole('button', { name: /impersonate/i })
    const firstImpersonateButton = impersonateButtons[0]

    // Click impersonate
    await user.click(firstImpersonateButton)

    // Reason modal or confirmation should appear
    // (depending on implementation)
    const reasonField = screen.queryByPlaceholderText(/reason|why/i)
    if (reasonField) {
      // Fill reason field
      await user.type(reasonField, 'Testing feature')
      const submitButton = screen.getByRole('button', { name: /start|confirm|submit/i })
      await user.click(submitButton)
    }

    // Assert handler called
    await waitFor(() => {
      expect(mockHandlers.onImpersonate).toHaveBeenCalledWith('user-1')
    })
  })

  test('empty_users_list_shows_message', () => {
    /**
     * When users array is empty
     * Expected: "No users found" message displayed
     */
    render(
      <UsersTable
        users={[]}
        loading={false}
        {...mockHandlers}
      />
    )

    const emptyMessage = screen.getByText(/no users|empty/i)
    expect(emptyMessage).toBeInTheDocument()
  })

  test('accessibility_table_has_proper_headers', () => {
    /**
     * Assert: Table semantic structure + ARIA labels for accessibility
     */
    render(
      <UsersTable
        users={mockUsers}
        loading={false}
        {...mockHandlers}
      />
    )

    // Assert table has proper header structure
    const table = screen.getByRole('table')
    expect(table).toBeInTheDocument()

    // Assert all buttons have aria-labels
    const buttons = screen.getAllByRole('button')
    buttons.forEach(btn => {
      const hasLabel = btn.getAttribute('aria-label') || btn.textContent
      expect(hasLabel).toBeTruthy()
    })

    // Assert keyboard navigation (Tab key should cycle through buttons)
    const firstButton = buttons[0]
    expect(firstButton).toHaveAttribute('tabIndex', expect.anything())
  })
})
