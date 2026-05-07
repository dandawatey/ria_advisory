/**
 * F055 — ERP Sources Management
 * Lists all ERP data sources for the tenant with connection status and last sync.
 * ERP-CF-003 | Agent: Ananya_Frontend_004
 */
import { useState, useEffect } from 'react';
import { get } from '../api/client';
import { FreshnessIndicator } from '../components/erp/FreshnessIndicator';
import PageExplainer from '../components/common/PageExplainer';

interface ERPSource {
  erp_source_id: number;
  tenant_id: string;
  erp_type: string;
  display_name: string;
  connection_status: string;
  entity_id: string | null;
  last_sync_at: string | null;
  sync_schedule: string | null;
  is_active: boolean;
}

interface SyncLogEntry {
  sync_log_id: number;
  status: string;
  sync_type: string | null;
  started_at: string | null;
  completed_at: string | null;
  records_fetched: number | null;
  records_inserted: number | null;
  error_message: string | null;
}

const ERP_TYPE_COLOR: Record<string, string> = {
  BC:     '#10b981',
  SAP:    '#3b82f6',
  ODOO:   '#8b5cf6',
  DEFAULT:'#6b7280',
};

const STATUS_COLOR: Record<string, string> = {
  connected:    '#10b981',
  disconnected: '#ef4444',
  auth_expired: '#f59e0b',
  unknown:      '#9ca3af',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function ERPTypeBadge({ erp_type }: { erp_type: string }) {
  const color = ERP_TYPE_COLOR[erp_type] ?? ERP_TYPE_COLOR.DEFAULT;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      background: `${color}22`, color, fontSize: 11, fontWeight: 600,
    }}>
      {erp_type}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? STATUS_COLOR.unknown;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color, fontSize: 12 }}>
      <span style={{ fontSize: 8 }}>●</span>
      {status.replace('_', ' ')}
    </span>
  );
}

export default function ERPSources() {
  const [sources, setSources]   = useState<ERPSource[]>([]);
  const [selected, setSelected] = useState<ERPSource | null>(null);
  const [syncLog, setSyncLog]   = useState<SyncLogEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [logLoading, setLogLoading] = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    get<ERPSource[]>('/api/erp/sources')
      .then(setSources)
      .catch(() => setError('Could not load ERP sources — is the backend running?'))
      .finally(() => setLoading(false));
  }, []);

  function selectSource(src: ERPSource) {
    setSelected(src);
    setLogLoading(true);
    get<SyncLogEntry[]>(`/api/erp/sources/${src.erp_source_id}/sync-log?limit=10`)
      .then(setSyncLog)
      .catch(() => setSyncLog([]))
      .finally(() => setLogLoading(false));
  }

  const card: React.CSSProperties = {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    padding: 20,
    marginBottom: 12,
    cursor: 'pointer',
    transition: 'border-color 0.15s',
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>ERP Data Sources</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13, margin: '4px 0 0' }}>
            {sources.length} connected ERP system{sources.length !== 1 ? 's' : ''} for this tenant
          </p>
        </div>
        <FreshnessIndicator compact />
      </div>

      <PageExplainer
        icon="🔌"
        title="What are ERP Data Sources?"
        description="This page lists all <strong>ERP systems connected to your tenant</strong> — Business Central, SAP, Odoo, and others. Each source syncs GL entries, dimensions, and entities into the unified data warehouse. Click a source to see its sync history, connection status, and last sync time. A green status means data is current; amber means authentication needs refresh."
        concepts={[
          { icon: '●', color: '#10b981', label: 'Connected', desc: 'ERP is authenticated and syncing successfully' },
          { icon: '●', color: '#ef4444', label: 'Disconnected', desc: 'Connection lost — check credentials or network' },
          { icon: '●', color: '#f59e0b', label: 'Auth Expired', desc: 'OAuth token expired — re-authenticate required' },
        ]}
        glossary={[
          { term: 'Sync Type', def: 'Full = all historical data; Incremental = only changes since last sync' },
          { term: 'Records Fetched', def: 'Number of GL lines pulled from the ERP in the last sync run' },
        ]}
      />

      {/* Error */}
      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: 12, color: '#dc2626', marginBottom: 16, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
          Loading ERP sources…
        </div>
      )}

      {/* Content */}
      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 16 }}>
          {/* Source list */}
          <div>
            {sources.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-muted)' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>⊙</div>
                <div style={{ fontSize: 14 }}>No ERP sources configured for this tenant.</div>
              </div>
            ) : (
              sources.map((src) => (
                <div
                  key={src.erp_source_id}
                  style={{
                    ...card,
                    borderColor: selected?.erp_source_id === src.erp_source_id
                      ? 'var(--color-primary)'
                      : 'var(--color-border)',
                  }}
                  onClick={() => selectSource(src)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <ERPTypeBadge erp_type={src.erp_type} />
                        <span style={{ fontWeight: 600, fontSize: 15 }}>{src.display_name}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 20, fontSize: 12, color: 'var(--color-text-muted)' }}>
                        <span>Entity: <code style={{ fontSize: 11 }}>{src.entity_id ?? '—'}</code></span>
                        <span>Schedule: {src.sync_schedule ?? 'manual'}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <StatusDot status={src.connection_status} />
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                        Last sync: {fmtDate(src.last_sync_at)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Sync log detail panel */}
          {selected && (
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              padding: 16,
              height: 'fit-content',
              position: 'sticky',
              top: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Sync Log — {selected.display_name}</div>
                <button
                  onClick={() => setSelected(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 16 }}
                  aria-label="Close panel"
                >
                  ×
                </button>
              </div>

              {logLoading ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>
                  Loading sync log…
                </div>
              ) : syncLog.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>
                  No sync history yet.
                </div>
              ) : (
                syncLog.map((log) => {
                  const statusColor = log.status === 'success' ? '#10b981'
                                    : log.status === 'failed'  ? '#ef4444'
                                    : '#f59e0b';
                  return (
                    <div
                      key={log.sync_log_id}
                      style={{
                        borderLeft: `3px solid ${statusColor}`,
                        paddingLeft: 10,
                        marginBottom: 10,
                        fontSize: 12,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, color: statusColor, textTransform: 'capitalize' }}>
                          {log.status}
                        </span>
                        <span style={{ color: 'var(--color-text-muted)' }}>{log.sync_type ?? 'full'}</span>
                      </div>
                      <div style={{ color: 'var(--color-text-muted)' }}>{fmtDate(log.started_at)}</div>
                      {log.records_inserted != null && (
                        <div>↑ {log.records_inserted.toLocaleString()} inserted</div>
                      )}
                      {log.error_message && (
                        <div style={{ color: '#ef4444', marginTop: 2, wordBreak: 'break-word' }}>
                          {log.error_message}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
