/**
 * F001 — BC Tenant Authentication & Connectivity
 * Admin page: manage Entra ID app registrations and cert-based OAuth per tenant.
 * Subsidiary list loaded from /api/entities/ (real data).
 */
import { useState, useEffect } from 'react';
import { StatusBadge } from '../components/shared/StatusBadge';
import type { Status } from '../types';
import { api } from '../api/client';

interface TenantRow {
  code: string;
  name: string;
  tenantId: string;
  clientId: string;
  certExpiry: string;
  authStatus: Status;
  lastAuthTest: string;
  apiVersion: string;
}

// Deterministic mock auth status per code (real auth requires BC API connection)
function mockAuthStatus(code: string): Status {
  const s: Record<string, Status> = {
    IND: 'success', USA: 'success', PHILS: 'success', TUAS: 'success',
    SYN: 'success', MXN: 'warning', GBP: 'success', ZAF: 'success',
    CAN: 'success', PTY: 'success', TCAN: 'success', TOFF: 'success',
    TBID: 'warning', TSUB: 'pending', AGG: 'pending', BOR: 'pending', GUA: 'pending',
  };
  return s[code] ?? 'pending';
}

function mockCertExpiry(code: string) {
  const expiryMap: Record<string, string> = {
    IND: '2027-03-15', USA: '2027-03-15', PHILS: '2027-04-01', TUAS: '2027-02-28',
    SYN: '2027-01-10', MXN: '2026-08-31', GBP: '2027-03-15', ZAF: '2026-11-30',
    CAN: '2027-03-15', PTY: '2027-02-15', TCAN: '2027-01-31', TOFF: '2026-12-31',
    TBID: '2026-06-30', TSUB: '2026-06-30', AGG: '2026-09-15', BOR: '2026-09-15', GUA: '2026-09-15',
  };
  return expiryMap[code] ?? '2026-12-31';
}

export default function BCTenantAuth() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [testingCode, setTestingCode] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.entities.list()
      .then((entities) => {
        const rows: TenantRow[] = entities.map((e, i) => ({
          code: e.code,
          name: e.name,
          tenantId: `${e.code.toLowerCase()}-tenant-${(0xABCDEF + i * 0x1234).toString(16).slice(0, 8)}`,
          clientId: `client-${(0xFEDCBA - i * 0x5678).toString(16).slice(0, 8)}`,
          certExpiry: mockCertExpiry(e.code),
          authStatus: mockAuthStatus(e.code),
          lastAuthTest: new Date(Date.now() - i * 3600000).toISOString().slice(0, 16).replace('T', ' '),
          apiVersion: 'v2.0',
        }));
        setTenants(rows);
      })
      .catch(() => setApiError(true))
      .finally(() => setLoading(false));
  }, []);

  const filtered = search
    ? tenants.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()) || t.code.toLowerCase().includes(search.toLowerCase()))
    : tenants;

  const handleTest = (code: string) => {
    setTestingCode(code);
    setTimeout(() => setTestingCode(null), 2000);
  };

  const successCount = tenants.filter((t) => t.authStatus === 'success').length;
  const warnCount    = tenants.filter((t) => t.authStatus === 'warning').length;
  const pendingCount = tenants.filter((t) => t.authStatus === 'pending').length;

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">BC Tenant Authentication</h1>
            <p className="page-subtitle">
              Entra ID app registrations · Certificate-based OAuth · {tenants.length} tenants
              {apiError && <span style={{ color: 'var(--color-warning)', marginLeft: 8 }}>⚠ API offline</span>}
            </p>
          </div>
          <button className="btn btn-primary btn-sm">+ Register New Tenant</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Connected', count: successCount, color: 'var(--color-success)' },
          { label: 'Warning',   count: warnCount,    color: 'var(--color-warning)' },
          { label: 'Pending',   count: pendingCount, color: 'var(--color-text-muted)' },
        ].map(({ label, count, color }) => (
          <div key={label} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color }}>{loading ? '…' : count}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-16">
          <div className="card-title" style={{ margin: 0 }}>Tenant Registry</div>
          <input className="form-input" style={{ width: 220 }} placeholder="Search tenant…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="table-wrap">
          <table style={{ fontSize: 13 }}>
            <thead>
              <tr>
                <th>Code</th><th>Subsidiary</th><th>Tenant ID</th><th>Client ID</th>
                <th>Cert Expiry</th><th>API Ver</th><th>Last Test</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--color-text-muted)' }}>Loading…</td></tr>
              ) : filtered.map((t) => {
                const expiringSoon = new Date(t.certExpiry) < new Date(Date.now() + 90 * 86400000);
                return (
                  <tr key={t.code}>
                    <td><span className="badge badge-muted">{t.code}</span></td>
                    <td style={{ fontWeight: 500 }}>{t.name}</td>
                    <td className="table-mono" style={{ fontSize: 11 }}>{t.tenantId}</td>
                    <td className="table-mono" style={{ fontSize: 11 }}>{t.clientId}</td>
                    <td>
                      <span style={{ color: expiringSoon ? 'var(--color-warning)' : 'inherit', fontSize: 12 }}>
                        {t.certExpiry} {expiringSoon && '⚠'}
                      </span>
                    </td>
                    <td style={{ fontSize: 11 }}>{t.apiVersion}</td>
                    <td style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{t.lastAuthTest}</td>
                    <td><StatusBadge status={t.authStatus} /></td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={testingCode === t.code}
                        onClick={() => handleTest(t.code)}
                      >
                        {testingCode === t.code ? 'Testing…' : 'Test Auth'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
