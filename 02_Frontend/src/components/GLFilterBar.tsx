/**
 * GLFilterBar — shared GL Account + Gen Posting Type filter strip.
 * Drop into any page's filter panel.
 */

const ACCOUNT_OPTIONS = [
  { key: '',  label: 'All Accounts' },
  { key: '1', label: '1xx Assets' },
  { key: '2', label: '2xx Liabilities' },
  { key: '3', label: '3xx Equity' },
  { key: '4', label: '4xx Revenue' },
  { key: '5', label: '5xx COGS' },
  { key: '6', label: '6xx OpEx' },
  { key: '7', label: '7xx Other Income' },
  { key: '8', label: '8xx Tax' },
];

const POSTING_TYPES = [
  { key: '',              label: 'All Types' },
  { key: 'Invoice',       label: 'Invoice' },
  { key: 'Credit Memo',   label: 'Credit Memo' },
  { key: 'Payment',       label: 'Payment' },
  { key: 'Refund',        label: 'Refund' },
  { key: 'Finance Charge Memo', label: 'Finance Charge' },
  { key: 'Reminder',      label: 'Reminder' },
];

interface Props {
  accountPrefix: string;
  onAccountPrefix: (v: string) => void;
  genPostType: string;
  onGenPostType: (v: string) => void;
}

export function GLFilterBar({ accountPrefix, onAccountPrefix, genPostType, onGenPostType }: Props) {
  const chip = (selected: boolean) => ({
    padding: '3px 9px',
    borderRadius: 10,
    fontSize: 11,
    cursor: 'pointer',
    border: '1px solid',
    borderColor: selected ? '#8b5cf6' : 'var(--color-border)',
    background: selected ? 'rgba(139,92,246,0.12)' : 'transparent',
    color: selected ? '#8b5cf6' : 'inherit',
    fontWeight: selected ? 600 : 400,
    whiteSpace: 'nowrap' as const,
  });

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
      {/* GL Account */}
      <div>
        <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          GL Account
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {ACCOUNT_OPTIONS.map((opt) => (
            <button key={opt.key} onClick={() => onAccountPrefix(opt.key)} style={chip(accountPrefix === opt.key)}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Gen Post Type */}
      <div>
        <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Gen Post Type
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {POSTING_TYPES.map((opt) => (
            <button key={opt.key} onClick={() => onGenPostType(opt.key)} style={chip(genPostType === opt.key)}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
