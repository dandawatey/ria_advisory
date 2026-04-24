/**
 * F001 — BC Tenant Authentication & Connectivity
 * Admin page: manage Entra ID app registrations and cert-based OAuth per tenant.
 */
import { useState } from 'react';
import { StatusBadge } from '../components/shared/StatusBadge';
import type { BCTenant } from '../types';

const mockTenants: BCTenant[] = [
  { subsidiaryCode: 'SUB01', subsidiaryName: 'Apex Capital Advisors LLC',       tenantId: 'a1b2c3d4-...', clientId: 'e5f6g7h8-...', certExpiry: '2025-09-15', authStatus: 'success', lastAuthTest: '2026-04-23 14:02', apiVersion: 'v2.0' },
  { subsidiaryCode: 'SUB02', subsidiaryName: 'Blue Ridge Wealth Management',    tenantId: 'b2c3d4e5-...', clientId: 'f6g7h8i9-...', certExpiry: '2025-07-01', authStatus: 'warning', lastAuthTest: '2026-04-23 14:02', apiVersion: 'v2.0' },
  { subsidiaryCode: 'SUB03', subsidiaryName: 'Clearwater Financial Group',      tenantId: 'c3d4e5f6-...', clientId: 'g7h8i9j0-...', certExpiry: '2025-11-20', authStatus: 'success', lastAuthTest: '2026-04-23 14:02', apiVersion: 'v2.0' },
  { subsidiaryCode: 'SUB04', subsidiaryName: 'Dune Capital Partners',           tenantId: 'd4e5f6g7-...', clientId: 'h8i9j0k1-...', certExpiry: '2026-03-10', authStatus: 'success', lastAuthTest: '2026-04-23 14:02', apiVersion: 'v2.0' },
  { subsidiaryCode: 'SUB05', subsidiaryName: 'Evergreen Investment Counsel',    tenantId: 'e5f6g7h8-...', clientId: 'i9j0k1l2-...', certExpiry: '2025-06-05', authStatus: 'error',   lastAuthTest: '2026-04-23 09:15', apiVersion: 'v2.0' },
  { subsidiaryCode: 'SUB06', subsidiaryName: 'Franklin Street Advisors',        tenantId: 'f6g7h8i9-...', clientId: 'j0k1l2m3-...', certExpiry: '2025-12-30', authStatus: 'success', lastAuthTest: '2026-04-23 14:02', apiVersion: 'v2.0' },
  { subsidiaryCode: 'SUB07', subsidiaryName: 'Greenfield Asset Management',     tenantId: 'g7h8i9j0-...', clientId: 'k1l2m3n4-...', certExpiry: '2026-01-15', authStatus: 'success', lastAuthTest: '2026-04-23 14:02', apiVersion: 'v2.0' },
  { subsidiaryCode: 'SUB08', subsidiaryName: 'Harbor Light Wealth Advisors',    tenantId: 'h8i9j0k1-...', clientId: 'l2m3n4o5-...', certExpiry: '2025-08-22', authStatus: 'pending', lastAuthTest: 'Never',           apiVersion: 'v2.0' },
];

function certDaysRemaining(expiry: string): number {
  return Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
}

export default function BCTenantAuth() {
  const [selected, setSelected] = useState<BCTenant | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const handleTest = (code: string) => {
    setTesting(code);
    setTimeout(() => setTesting(null), 2000);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">BC Tenant Authentication</h1>
        <p className="page-subtitle">
          Manage Entra ID app registrations and certificate-based OAuth 2.0 connections for all 17 BC tenants. (F001)
        </p>
        <div className="page-actions">
          <button className="btn btn-primary">+ Register Tenant</button>
          <button className="btn btn-secondary">Rotate All Certs</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="card-grid card-grid-4 mb-24">
        <div className="kpi-tile">
          <div className="kpi-label">Total Tenants</div>
          <div className="kpi-value">17</div>
          <div className="kpi-meta text-muted">17 subsidiaries registered</div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">Auth Healthy</div>
          <div className="kpi-value" style={{ color: 'var(--color-success)' }}>14</div>
          <div className="kpi-meta text-muted">OAuth token valid</div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">Cert Expiring &lt;30d</div>
          <div className="kpi-value" style={{ color: 'var(--color-warning)' }}>3</div>
          <div className="kpi-meta text-muted">Rotation required</div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">Auth Failed</div>
          <div className="kpi-value" style={{ color: 'var(--color-error)' }}>1</div>
          <div className="kpi-meta text-muted">SUB05 — cert expired</div>
        </div>
      </div>

      {/* Tenant table */}
      <div className="card">
        <div className="card-title">Tenant Registry</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Subsidiary</th>
                <th>Tenant ID</th>
                <th>Client ID</th>
                <th>Cert Expiry</th>
                <th>Days Left</th>
                <th>Auth Status</th>
                <th>Last Test</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mockTenants.map((t) => {
                const days = certDaysRemaining(t.certExpiry);
                const dayColor = days < 14 ? 'var(--color-error)' : days < 30 ? 'var(--color-warning)' : 'var(--color-success)';
                return (
                  <tr key={t.subsidiaryCode} onClick={() => setSelected(t)} style={{ cursor: 'pointer' }}>
                    <td><span className="badge badge-muted">{t.subsidiaryCode}</span></td>
                    <td style={{ fontWeight: 500 }}>{t.subsidiaryName}</td>
                    <td className="table-mono text-muted">{t.tenantId}</td>
                    <td className="table-mono text-muted">{t.clientId}</td>
                    <td className="table-mono">{t.certExpiry}</td>
                    <td style={{ color: dayColor, fontWeight: 600 }}>{days}d</td>
                    <td><StatusBadge status={t.authStatus} /></td>
                    <td className="text-muted" style={{ fontSize: 12 }}>{t.lastAuthTest}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={(e) => { e.stopPropagation(); handleTest(t.subsidiaryCode); }}
                        >
                          {testing === t.subsidiaryCode ? '…' : 'Test Auth'}
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={(e) => e.stopPropagation()}>
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="card mt-16">
          <div className="flex items-center justify-between mb-16">
            <div className="card-title" style={{ margin: 0 }}>
              {selected.subsidiaryName} — Auth Detail
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>✕ Close</button>
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">Tenant ID (Entra ID Directory)</label>
              <input className="form-input table-mono" readOnly value={selected.tenantId} />
            </div>
            <div className="form-group">
              <label className="form-label">Client ID (App Registration)</label>
              <input className="form-input table-mono" readOnly value={selected.clientId} />
            </div>
            <div className="form-group">
              <label className="form-label">Key Vault Secret Reference</label>
              <input className="form-input table-mono" readOnly value={`kv-ufip-prod/${selected.subsidiaryCode.toLowerCase()}-bc-cert`} />
            </div>
            <div className="form-group">
              <label className="form-label">Certificate Expiry</label>
              <input className="form-input" readOnly value={selected.certExpiry} />
            </div>
          </div>
          <div className="mt-16" style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm">Rotate Certificate</button>
            <button className="btn btn-secondary btn-sm">Download Audit Log</button>
          </div>
        </div>
      )}
    </div>
  );
}
