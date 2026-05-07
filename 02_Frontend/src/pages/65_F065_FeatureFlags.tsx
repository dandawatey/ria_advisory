import { useState } from 'react';
import { useFeatureFlags, FeatureFlag } from '../contexts/FeatureFlagContext';
import { useAuth } from '../contexts/AuthContext';

const CATEGORY_LABELS: Record<string, string> = {
  ar:          'Accounts Receivable',
  revenue:     'Revenue & Income',
  command:     'Command Center',
  financial:   'Financial Statements',
  performance: 'Performance',
  cost:        'Cost Management',
  planning:    'Planning',
  erp:         'ERP Integration',
  close:       'Close & Control',
  pipeline:    'Data Pipeline',
  admin:       'Administration',
  insights:    'Insights',
};

export default function FeatureFlagsPage() {
  const { flags, toggleFlag, isLoading, refresh } = useFeatureFlags();
  const { user } = useAuth();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<'all' | 'phase1' | 'phase2'>('all');

  const isSuperadmin = user?.role === 'superadmin' || user?.role === 'isource_admin';

  const handleToggle = async (flag: FeatureFlag) => {
    if (!isSuperadmin) return;
    setSaving(flag.flag_key);
    setError(null);
    try {
      await toggleFlag(flag.flag_key, !flag.is_enabled);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Toggle failed');
    } finally {
      setSaving(null);
    }
  };

  const filtered = flags.filter((f) => {
    const matchSearch = search === '' ||
      f.label.toLowerCase().includes(search.toLowerCase()) ||
      f.flag_key.toLowerCase().includes(search.toLowerCase());
    const matchPhase = phaseFilter === 'all' || f.phase === phaseFilter;
    return matchSearch && matchPhase;
  });

  const grouped = filtered.reduce<Record<string, FeatureFlag[]>>((acc, f) => {
    const cat = f.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(f);
    return acc;
  }, {});

  const phase1Count   = flags.filter((f) => f.phase === 'phase1').length;
  const enabledCount  = flags.filter((f) => f.is_enabled).length;
  const disabledCount = flags.filter((f) => !f.is_enabled).length;

  return (
    <div style={{ padding: '24px 32px', maxWidth: 960, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: '#1F2423' }}>Feature Flags</span>
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
            textTransform: 'uppercase', background: '#EEF5F4',
            color: '#1F6B66', padding: '2px 8px', borderRadius: 4,
          }}>Superadmin</span>
        </div>
        <p style={{ fontSize: 13, color: '#66726F', margin: 0 }}>
          Control which pages are visible to RIA Advisory users. Phase 1 features are enabled by default
          (promised in the 3-week proposal). Phase 2 features are hidden until explicitly enabled.
        </p>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Phase 1 (promised)', value: phase1Count, color: '#1F6B66', bg: '#EEF5F4' },
          { label: 'Enabled',            value: enabledCount,  color: '#166534', bg: '#F0FDF4' },
          { label: 'Disabled',           value: disabledCount, color: '#991B1B', bg: '#FEF2F2' },
        ].map((s) => (
          <div key={s.label} style={{
            background: s.bg, border: `1px solid ${s.color}22`,
            borderRadius: 8, padding: '12px 16px',
          }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#66726F', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search flags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, padding: '7px 12px', border: '1px solid #D1D8D8',
            borderRadius: 6, fontSize: 13, outline: 'none',
          }}
        />
        {(['all', 'phase1', 'phase2'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPhaseFilter(p)}
            style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
              border: '1px solid',
              borderColor: phaseFilter === p ? '#1F6B66' : '#D1D8D8',
              background: phaseFilter === p ? '#1F6B66' : 'white',
              color: phaseFilter === p ? 'white' : '#66726F',
              cursor: 'pointer',
            }}
          >
            {p === 'all' ? 'All' : p === 'phase1' ? 'Phase 1' : 'Phase 2'}
          </button>
        ))}
        <button
          onClick={refresh}
          style={{
            padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
            border: '1px solid #D1D8D8', background: 'white', color: '#66726F', cursor: 'pointer',
          }}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 6,
          padding: '10px 14px', color: '#991B1B', fontSize: 13, marginBottom: 16,
        }}>
          {error}
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', color: '#66726F', padding: 40 }}>Loading flags…</div>
      ) : (
        Object.entries(grouped)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([category, items]) => (
            <div key={category} style={{ marginBottom: 24 }}>
              <div style={{
                fontSize: 11, fontWeight: 800, letterSpacing: '0.12em',
                textTransform: 'uppercase', color: '#1F6B66', marginBottom: 8,
              }}>
                {CATEGORY_LABELS[category] ?? category}
              </div>
              <div style={{ border: '1px solid #E8ECEC', borderRadius: 8, overflow: 'hidden' }}>
                {items.map((flag, i) => (
                  <div
                    key={flag.flag_key}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '12px 16px',
                      borderBottom: i < items.length - 1 ? '1px solid #F4F6F6' : 'none',
                      background: flag.is_enabled ? 'white' : '#FAFBFB',
                    }}
                  >
                    {/* Toggle */}
                    <button
                      onClick={() => handleToggle(flag)}
                      disabled={!isSuperadmin || saving === flag.flag_key}
                      aria-label={`${flag.is_enabled ? 'Disable' : 'Enable'} ${flag.label}`}
                      style={{
                        flexShrink: 0,
                        width: 36, height: 20,
                        borderRadius: 10,
                        border: 'none',
                        background: saving === flag.flag_key
                          ? '#D1D8D8'
                          : flag.is_enabled ? '#1F6B66' : '#D1D8D8',
                        position: 'relative',
                        cursor: isSuperadmin ? 'pointer' : 'not-allowed',
                        transition: 'background 0.2s',
                        padding: 0,
                      }}
                    >
                      <span style={{
                        position: 'absolute',
                        top: 2, left: flag.is_enabled ? 18 : 2,
                        width: 16, height: 16,
                        borderRadius: '50%', background: 'white',
                        transition: 'left 0.2s',
                      }} />
                    </button>

                    {/* Label + description */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: 13, fontWeight: 600,
                          color: flag.is_enabled ? '#1F2423' : '#B0BABA',
                        }}>
                          {flag.label}
                        </span>
                        {flag.phase === 'phase1' && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                            textTransform: 'uppercase', background: '#EEF5F4',
                            color: '#1F6B66', padding: '1px 6px', borderRadius: 3,
                          }}>
                            Phase 1
                          </span>
                        )}
                      </div>
                      {flag.description && (
                        <div style={{ fontSize: 11, color: '#B0BABA', marginTop: 2 }}>
                          {flag.description}
                        </div>
                      )}
                    </div>

                    {/* Status badge */}
                    <span style={{
                      flexShrink: 0, fontSize: 11, fontWeight: 600,
                      padding: '2px 8px', borderRadius: 4,
                      background: flag.is_enabled ? '#F0FDF4' : '#F4F6F6',
                      color: flag.is_enabled ? '#166534' : '#66726F',
                    }}>
                      {saving === flag.flag_key ? '…' : flag.is_enabled ? 'Enabled' : 'Disabled'}
                    </span>

                    {/* Flag key */}
                    <code style={{
                      flexShrink: 0, fontSize: 10, color: '#B0BABA',
                      background: '#F4F6F6', padding: '2px 6px', borderRadius: 3,
                      fontFamily: 'JetBrains Mono, monospace',
                    }}>
                      {flag.flag_key}
                    </code>
                  </div>
                ))}
              </div>
            </div>
          ))
      )}

      {!isLoading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', color: '#B0BABA', padding: 40 }}>
          No flags match your search.
        </div>
      )}

      {!isSuperadmin && (
        <div style={{
          background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 6,
          padding: '10px 14px', color: '#92400E', fontSize: 13, marginTop: 16,
        }}>
          Read-only view. Superadmin role required to toggle flags.
        </div>
      )}
    </div>
  );
}
