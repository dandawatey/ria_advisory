/**
 * F056 — Field Mapping UI
 * Create, view, and delete ERP account/dimension mapping rules.
 * ERP-CF-004 | Agent: Ananya_Frontend_004
 */
import { useState, useEffect } from 'react';
import { get, post, del } from '../api/client';

interface ERPSource {
  erp_source_id: number;
  erp_type: string;
  display_name: string;
}

interface MappingRow {
  mapping_id: number;
  erp_source_id: number;
  mapping_type: string;
  source_value: string;
  canonical_account_no: string | null;
  target_value: string | null;
  target_label: string | null;
}

const MAPPING_TYPES = ['account', 'department', 'project', 'cost_centre', 'geography'];

function badge(label: string, color: string) {
  return (
    <span style={{
      display: 'inline-block', padding: '1px 7px', borderRadius: 4,
      background: `${color}22`, color, fontSize: 11, fontWeight: 600,
    }}>
      {label}
    </span>
  );
}

const TYPE_COLORS: Record<string, string> = {
  account:     '#3b82f6',
  department:  '#10b981',
  project:     '#f59e0b',
  cost_centre: '#8b5cf6',
  geography:   '#06b6d4',
};

export default function FieldMapping() {
  const [sources,         setSources]         = useState<ERPSource[]>([]);
  const [selectedSource,  setSelectedSource]  = useState<number | null>(null);
  const [mappings,        setMappings]        = useState<MappingRow[]>([]);
  const [filterType,      setFilterType]      = useState('');
  const [loading,         setLoading]         = useState(false);
  const [saving,          setSaving]          = useState(false);
  const [error,           setError]           = useState('');

  // New mapping form
  const [form, setForm] = useState({
    mapping_type: 'account',
    source_value: '',
    canonical_account_no: '',
    target_value: '',
    target_label: '',
  });

  useEffect(() => {
    get<ERPSource[]>('/api/erp/sources').then((rows) => {
      setSources(rows);
      if (rows.length > 0) {
        setSelectedSource(rows[0].erp_source_id);
      }
    }).catch(() => setError('Could not load ERP sources'));
  }, []);

  useEffect(() => {
    if (selectedSource == null) return;
    setLoading(true);
    get<MappingRow[]>(`/api/erp/mapping/${selectedSource}`)
      .then(setMappings)
      .catch(() => setMappings([]))
      .finally(() => setLoading(false));
  }, [selectedSource]);

  async function handleSave() {
    if (!selectedSource || !form.source_value.trim()) return;
    setSaving(true);
    setError('');
    try {
      await post('/api/erp/mapping', {
        erp_source_id: selectedSource,
        ...form,
        canonical_account_no: form.canonical_account_no || null,
        target_value: form.target_value || null,
        target_label: form.target_label || null,
      });
      setForm({ mapping_type: 'account', source_value: '', canonical_account_no: '', target_value: '', target_label: '' });
      const updated = await get<MappingRow[]>(`/api/erp/mapping/${selectedSource}`);
      setMappings(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this mapping rule?')) return;
    try {
      await del(`/api/erp/mapping/${id}`);
      setMappings((prev) => prev.filter((m) => m.mapping_id !== id));
    } catch {
      setError('Delete failed');
    }
  }

  const filtered = filterType
    ? mappings.filter((m) => m.mapping_type === filterType)
    : mappings;

  const inputStyle: React.CSSProperties = {
    background: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    borderRadius: 6,
    color: 'var(--color-text)',
    padding: '6px 10px',
    fontSize: 13,
    width: '100%',
  };

  const selectStyle: React.CSSProperties = { ...inputStyle, width: 'auto' };

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Field Mapping</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, margin: '4px 0 0' }}>
          Map ERP-native account/dimension codes to canonical values
        </p>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: 10, color: '#dc2626', marginBottom: 14, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* ERP source selector */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}>
        <label style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>ERP Source:</label>
        <select
          style={selectStyle}
          value={selectedSource ?? ''}
          onChange={(e) => setSelectedSource(Number(e.target.value))}
          aria-label="Select ERP source"
        >
          {sources.map((s) => (
            <option key={s.erp_source_id} value={s.erp_source_id}>
              [{s.erp_type}] {s.display_name}
            </option>
          ))}
        </select>

        <label style={{ fontSize: 13, color: 'var(--color-text-muted)', marginLeft: 12 }}>Type:</label>
        <select
          style={selectStyle}
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          aria-label="Filter by mapping type"
        >
          <option value="">All types</option>
          {MAPPING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-text-muted)' }}>
          {filtered.length} rule{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>
        {/* Mapping table */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
              Loading mappings…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
              No mappings yet. Add one on the right.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)' }}>
                  {['Type', 'ERP Value', 'Canonical / Target', 'Label', ''].map((h) => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.mapping_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '8px 12px' }}>{badge(m.mapping_type, TYPE_COLORS[m.mapping_type] ?? '#6b7280')}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11 }}>{m.source_value}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: 11 }}>
                      {m.canonical_account_no ?? m.target_value ?? '—'}
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--color-text-muted)' }}>{m.target_label ?? '—'}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleDelete(m.mapping_id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 14 }}
                        aria-label={`Delete mapping ${m.source_value}`}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Add mapping form */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Add Mapping Rule</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Mapping Type</label>
              <select
                style={inputStyle}
                value={form.mapping_type}
                onChange={(e) => setForm({ ...form, mapping_type: e.target.value })}
                aria-label="Mapping type"
              >
                {MAPPING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
                ERP Source Value <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                style={inputStyle}
                placeholder="e.g. 4001, DEPT-01"
                value={form.source_value}
                onChange={(e) => setForm({ ...form, source_value: e.target.value })}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Canonical Account No</label>
              <input
                style={inputStyle}
                placeholder="e.g. REV.PROD.001"
                value={form.canonical_account_no}
                onChange={(e) => setForm({ ...form, canonical_account_no: e.target.value })}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Target Value</label>
              <input
                style={inputStyle}
                placeholder="e.g. DEPT-FINANCE"
                value={form.target_value}
                onChange={(e) => setForm({ ...form, target_value: e.target.value })}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Display Label</label>
              <input
                style={inputStyle}
                placeholder="e.g. Finance Department"
                value={form.target_label}
                onChange={(e) => setForm({ ...form, target_label: e.target.value })}
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving || !form.source_value.trim()}
              style={{
                background: 'var(--color-primary)', color: '#fff',
                border: 'none', borderRadius: 6, padding: '8px 0',
                fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving || !form.source_value.trim() ? 0.6 : 1,
                marginTop: 4,
              }}
            >
              {saving ? 'Saving…' : 'Save Mapping'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
