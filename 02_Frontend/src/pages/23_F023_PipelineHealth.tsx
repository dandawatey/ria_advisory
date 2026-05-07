/**
 * F023 — Pipeline Health Dashboard
 * Ops page: data freshness grid, entry counts, and run status per subsidiary.
 * Real subsidiary list from /api/gl/stats.
 */
import { useState, useEffect } from 'react';
import { StatusBadge } from '../components/shared/StatusBadge';
import type { Status } from '../types';
import { api } from '../api/client';
import type { GLStats } from '../api/client';
import PageExplainer from '../components/common/PageExplainer';

interface HealthRow extends GLStats {
  status: Status;
  freshness: 'current' | 'stale' | 'unknown';
  lastRunLabel: string;
}

function inferStatus(s: GLStats): Status {
  if (!s.date_to) return 'error';
  const daysSince = (Date.now() - new Date(s.date_to).getTime()) / 86400000;
  if (daysSince < 30) return 'success';
  if (daysSince < 90) return 'warning';
  return 'error';
}

function inferFreshness(s: GLStats): 'current' | 'stale' | 'unknown' {
  if (!s.date_to) return 'unknown';
  const daysSince = (Date.now() - new Date(s.date_to).getTime()) / 86400000;
  if (daysSince < 30) return 'current';
  return 'stale';
}

function fmtDate(d: string | null) {
  return d ? d.slice(0, 10) : '—';
}

export default function PipelineHealth() {
  const [rows, setRows] = useState<HealthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = () => {
    setLoading(true);
    api.gl.stats()
      .then((stats) => {
        setRows(stats.map((s) => ({
          ...s,
          status: inferStatus(s),
          freshness: inferFreshness(s),
          lastRunLabel: s.date_to ? `Last entry: ${fmtDate(s.date_to)}` : 'No data',
        })));
      })
      .catch(() => setApiError(true))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); load(); }, 1500);
  };

  const healthy = rows.filter((r) => r.status === 'success').length;
  const warning = rows.filter((r) => r.status === 'warning').length;
  const errored = rows.filter((r) => r.status === 'error').length;
  const totalEntries = rows.reduce((s, r) => s + r.total_entries, 0);

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Pipeline Health</h1>
            <p className="page-subtitle">
              GL data freshness · {rows.length} subsidiaries · {totalEntries.toLocaleString()} total entries
              {apiError && <span style={{ color: 'var(--color-warning)', marginLeft: 8 }}>⚠ API offline</span>}
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? '⟳ Refreshing…' : '⟳ Refresh'}
          </button>
        </div>
      </div>

      <PageExplainer
        icon="💚"
        title="What is Pipeline Health?"
        description="This page shows <strong>GL data freshness and entry counts for all 17 subsidiaries</strong> based on real data from the database. It tells you whether each entity's data is current (latest entry less than 30 days old), stale (30–90 days), or outdated (over 90 days). Finance ops and DevOps use this as their first check when something looks wrong in a report — it quickly shows which entities have data issues."
        concepts={[
          { icon: '✓', color: '#16a34a', label: 'Current (< 30 days)', desc: 'Latest GL entry is recent — data is fresh for reporting' },
          { icon: '⚠', color: '#d97706', label: 'Stale (30–90 days)', desc: 'Data is aging — investigate sync schedule' },
          { icon: '✗', color: '#dc2626', label: 'Outdated (> 90 days)', desc: 'Serious data gap — pipeline may be broken for this entity' },
        ]}
        glossary={[
          { term: 'Earliest Entry', def: 'Oldest GL posting date in the database for this subsidiary' },
          { term: 'Latest Entry', def: 'Most recent GL posting date — used to determine freshness' },
          { term: 'Freshness', def: 'Classification based on days since the latest GL entry was posted' },
        ]}
      />

      {/* Summary tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Current (< 30 days)', count: healthy,       color: 'var(--color-success)' },
          { label: 'Stale (30–90 days)',  count: warning,       color: 'var(--color-warning)' },
          { label: 'Outdated (> 90 days)',count: errored,       color: 'var(--color-error)' },
          { label: 'Total GL Entries',    count: totalEntries,  color: 'var(--color-info)' },
        ].map(({ label, count, color }) => (
          <div key={label} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: count > 9999 ? 22 : 28, fontWeight: 800, color }}>
              {loading ? '…' : typeof count === 'number' ? count.toLocaleString() : count}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">Subsidiary Data Freshness</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th><th>Subsidiary</th>
                <th style={{ textAlign: 'right' }}>GL Entries</th>
                <th>Earliest Entry</th><th>Latest Entry</th>
                <th>Freshness</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)' }}>Loading…</td></tr>
              ) : rows.map((r) => (
                <tr key={r.code}>
                  <td><span className="badge badge-muted">{r.code}</span></td>
                  <td style={{ fontWeight: 500 }}>{r.name}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{r.total_entries.toLocaleString()}</td>
                  <td className="table-mono" style={{ fontSize: 12 }}>{fmtDate(r.date_from)}</td>
                  <td className="table-mono" style={{ fontSize: 12 }}>{fmtDate(r.date_to)}</td>
                  <td>
                    <span className={`badge ${r.freshness === 'current' ? 'badge-success' : r.freshness === 'stale' ? 'badge-warning' : 'badge-muted'}`}>
                      {r.freshness === 'current' ? 'Current' : r.freshness === 'stale' ? 'Stale' : 'Unknown'}
                    </span>
                  </td>
                  <td><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
