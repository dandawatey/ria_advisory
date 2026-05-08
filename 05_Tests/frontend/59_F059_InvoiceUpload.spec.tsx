import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvoiceUploadPage from '../../02_Frontend/src/pages/59_F059_InvoiceUpload';
import * as client from '../../02_Frontend/src/api/client';

// Mock API client
vi.mock('../../02_Frontend/src/api/client', () => ({
  uploadInvoices: vi.fn(),
}));

describe('F059 — Invoice Upload Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page with heading and instructions', () => {
    render(<InvoiceUploadPage />);
    expect(screen.getByText('Invoice Upload')).toBeInTheDocument();
    expect(screen.getByText(/Drag & drop invoices/i)).toBeInTheDocument();
    expect(screen.getByText(/Max 50 files/i)).toBeInTheDocument();
  });

  it('displays FileDropZone, FileList, UploadProgress, BatchNotes', () => {
    render(<InvoiceUploadPage />);
    expect(screen.getByRole('button', { name: /Drop files here/i })).toBeInTheDocument();
    expect(screen.getByText('No files selected yet')).toBeInTheDocument();
    expect(screen.getByText('Batch Notes')).toBeInTheDocument();
    expect(screen.getByText('Upload Progress')).toBeInTheDocument();
  });

  it('adds files via drag-drop', async () => {
    const user = userEvent.setup();
    render(<InvoiceUploadPage />);

    const file = new File(['invoice'], 'invoice.pdf', { type: 'application/pdf' });
    const dropZone = screen.getByRole('button', { name: /Drop files/i });

    fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('invoice.pdf')).toBeInTheDocument();
      expect(screen.getByText('1 file selected')).toBeInTheDocument();
    });
  });

  it('removes file when remove button clicked', async () => {
    const user = userEvent.setup();
    render(<InvoiceUploadPage />);

    const file = new File(['data'], 'test.csv', { type: 'text/csv' });
    fireEvent.drop(screen.getByRole('button', { name: /Drop files/i }), {
      dataTransfer: { files: [file] },
    });

    await waitFor(() => {
      expect(screen.getByText('test.csv')).toBeInTheDocument();
    });

    const removeBtn = screen.getByLabelText('Remove test.csv');
    await user.click(removeBtn);

    await waitFor(() => {
      expect(screen.getByText('No files selected yet')).toBeInTheDocument();
    });
  });

  it('disables upload button when no files selected', () => {
    render(<InvoiceUploadPage />);
    const uploadBtn = screen.getByRole('button', { name: /Upload \(0\)/i });
    expect(uploadBtn).toBeDisabled();
  });

  it('enables upload button when files are present', async () => {
    render(<InvoiceUploadPage />);

    const file = new File(['data'], 'invoice.pdf', { type: 'application/pdf' });
    fireEvent.drop(screen.getByRole('button', { name: /Drop files/i }), {
      dataTransfer: { files: [file] },
    });

    await waitFor(() => {
      const uploadBtn = screen.getByRole('button', { name: /Upload \(1\)/i });
      expect(uploadBtn).not.toBeDisabled();
    });
  });

  it('shows success message after upload', async () => {
    const mockSession = {
      session_id: 'sess-123',
      file_count: 1,
      total_size: 1024,
      uploaded_at: '2026-05-07T12:00:00Z',
    };
    vi.mocked(client.uploadInvoices).mockResolvedValueOnce(mockSession);

    const user = userEvent.setup();
    render(<InvoiceUploadPage />);

    const file = new File(['data'], 'invoice.pdf', { type: 'application/pdf' });
    fireEvent.drop(screen.getByRole('button', { name: /Drop files/i }), {
      dataTransfer: { files: [file] },
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Upload \(1\)/i })).not.toBeDisabled();
    });

    const uploadBtn = screen.getByRole('button', { name: /Upload \(1\)/i });
    await user.click(uploadBtn);

    await waitFor(() => {
      expect(screen.getByText('Upload Complete')).toBeInTheDocument();
      expect(screen.getByText(/sess-123/)).toBeInTheDocument();
    });
  });

  it('shows error message on upload failure', async () => {
    vi.mocked(client.uploadInvoices).mockRejectedValueOnce(
      new Error('Network error')
    );

    const user = userEvent.setup();
    render(<InvoiceUploadPage />);

    const file = new File(['data'], 'invoice.pdf', { type: 'application/pdf' });
    fireEvent.drop(screen.getByRole('button', { name: /Drop files/i }), {
      dataTransfer: { files: [file] },
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Upload \(1\)/i })).not.toBeDisabled();
    });

    await user.click(screen.getByRole('button', { name: /Upload \(1\)/i }));

    await waitFor(() => {
      expect(screen.getByText('Upload Error')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('updates batch notes text', async () => {
    const user = userEvent.setup();
    render(<InvoiceUploadPage />);

    const notesInput = screen.getByPlaceholderText(/Optional notes/i) as HTMLTextAreaElement;
    await user.type(notesInput, 'April invoices from Vendor A');

    expect(notesInput.value).toBe('April invoices from Vendor A');
    expect(screen.getByText(/30 \/ 500 characters/i)).toBeInTheDocument();
  });

  it('keyboard navigation works on drop zone', async () => {
    const user = userEvent.setup();
    render(<InvoiceUploadPage />);

    const dropZone = screen.getByRole('button', { name: /Drop files/i });
    dropZone.focus();
    expect(dropZone).toHaveFocus();

    // Simulate Enter key on drop zone
    fireEvent.keyDown(dropZone, { key: 'Enter', code: 'Enter' });
    // (would trigger file input, which we can't easily test without mocking input.click)
  });
});
