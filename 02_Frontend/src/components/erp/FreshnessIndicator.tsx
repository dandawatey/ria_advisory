/**
 * FreshnessIndicator — reusable component showing data freshness for ERP sources
 * ERP-DS-004 | Agent: Ananya_Frontend_004
 * Shows a badge per ERP source: fresh (green), stale (amber), never_synced (red).
 */
import { useEffect, useState } from 'react';
import { get } from '../../api/client';

interface FreshnessStatus {
  erp_source_id: number;
  erp_name: string;
  status: 'fresh' | 'stale' | 'never_synced';
  last_sync_at: string | null;
  hours_stale: number | null;
}

interface Props {
  /** If provided, only show these ERP source IDs. Otherwise, shows all for tenant. */
  erp_source_ids?: number[];
  compact?: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  fresh:        '#10b981',
  stale:        '#f59e0b',
  never_synced: '#ef4444',
};

const STATUS_DOT: Record<string, string> = {
  fresh:        '●',
  stale:        '◑',
  never_synced: '○',
};

function formatLastSync(isoStr: string | null): string {
  if (!isoStr) return 'Never';
  const d = new Date(isoStr);
  const diffH = (Date.now() - d.getTime()) / 3_600_000;
  if (diffH < 1)   return `${Math.round(diffH * 60)}m ago`;
  if (diffH < 24)  return `${Math.round(diffH)}h ago`;
  return `${Math.round(diffH / 24)}d ago`;
}

export function FreshnessIndicator({ erp_source_ids, compact = false }: Props) {
  const [statuses, setStatuses] = useState<FreshnessStatus[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const url = erp_source_ids && erp_source_ids.length > 0
      ? `/api/erp/freshness/by-ids?erp_source_ids=${erp_source_ids.join(',')}`
      : '/api/erp/freshness';
    get<FreshnessStatus[]>(url)
      .then(setStatuses)
      .catch(() => setStatuses([]))
      .finally(() => setLoading(false));
  }, [erp_source_ids?.join(',')]);

  if (loading) {
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ color: '#9ca3af', fontSize: 11 }}>Checking data freshness…</span>
      </div>
    );
  }

  if (statuses.length === 0) return null;

  if (compact) {
    // Single badge showing worst status
    const worst = statuses.some(s => s.status === 'never_synced') ? 'never_synced'
                : statuses.some(s => s.status === 'stale')        ? 'stale'
                : 'fresh';
    const color = STATUS_COLOR[worst];
    const label = worst === 'fresh' ? 'Data up-to-date'
                : worst === 'stale' ? 'Some data stale'
                : 'No sync data';
    return (
      <span
        aria-label={`Data freshness: ${label}`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 11, color, fontWeight: 500,
          background: `${color}18`, borderRadius: 4, padding: '2px 7px',
        }}
      >
        <span style={{ fontSize: 8 }}>{STATUS_DOT[worst]}</span>
        {label}
      </span>
    );
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      {statuses.map((s) => {
        const color = STATUS_COLOR[s.status];
        return (
          <span
            key={s.erp_source_id}
            title={`${s.erp_name} — Last sync: ${formatLastSync(s.last_sync_at)}${s.hours_stale ? ` (${s.hours_stale.toFixed(1)}h stale)` : ''}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 11, color, fontWeight: 500,
              background: `${color}18`, borderRadius: 4, padding: '2px 8px',
              cursor: 'default',
            }}
          >
            <span style={{ fontSize: 8 }}>{STATUS_DOT[s.status]}</span>
            {s.erp_name}
            <span style={{ color: '#9ca3af', fontWeight: 400 }}>
              {formatLastSync(s.last_sync_at)}
            </span>
          </span>
        );
      })}
    </div>
  );
}
