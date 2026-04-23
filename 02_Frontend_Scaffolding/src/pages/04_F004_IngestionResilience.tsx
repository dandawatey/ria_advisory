/**
 * F004 — Ingestion Resilience, Error Handling & Fallback
 * Admin page: circuit breaker status, retry config, SFTP fallback management.
 */
import React from 'react';
import { StatusBadge } from '../components/shared/StatusBadge';
import type { CircuitBreaker } from '../types';

const mockCircuitBreakers: CircuitBreaker[] = [
  { subsidiaryCode: 'SUB05', entity: 'GeneralLedgerEntries', state: 'open',      consecutiveFailures: 3, lastFailureAt: '2026-04-23T09:15:00Z', openedAt: '2026-04-23T09:15:00Z' },
  { subsidiaryCode: 'SUB11', entity: 'SalesInvoices',        state: 'half_open', consecutiveFailures: 1, lastFailureAt: '2026-04-23T13:55:00Z', openedAt: null },
];

const retryConfig = {
  initialDelayMs: 1000,
  maxDelayMs: 60000,
  maxAttempts: 5,
  jitterFactor: 0.3,
  circuitBreakerThreshold: 3,
};

const sftpSlots = [
  { code: 'SUB05', name: 'Evergreen Investment Counsel', enabled: true,  lastFile: '2026-04-22_SUB05_trial_balance.csv', uploadedAt: '2026-04-22 23:15', status: 'success' as const },
  { code: 'SUB08', name: 'Harbor Light Wealth Advisors', enabled: false, lastFile: null, uploadedAt: null, status: 'idle' as const },
];

export default function IngestionResilience() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Ingestion Resilience & Fallback</h1>
        <p className="page-subtitle">
          Circuit breaker status, retry configuration, and SFTP fallback ingestion management. (F004)
        </p>
      </div>

      {/* Active circuit breakers */}
      {mockCircuitBreakers.length > 0 && (
        <div className="alert alert-error mb-24">
          <strong>⚡ {mockCircuitBreakers.length} Circuit Breaker(s) Open</strong> — extraction halted for affected entities. Manual reset required after root cause resolution.
        </div>
      )}

      <div className="card-grid card-grid-2 mb-16">
        {/* Circuit breakers */}
        <div className="card">
          <div className="card-title">Circuit Breakers</div>
          {mockCircuitBreakers.length === 0 ? (
            <div className="text-muted" style={{ textAlign: 'center', padding: 32 }}>All circuits closed — no failures</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Tenant</th>
                  <th>Entity</th>
                  <th>State</th>
                  <th>Failures</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mockCircuitBreakers.map((cb) => (
                  <tr key={`${cb.subsidiaryCode}-${cb.entity}`}>
                    <td><span className="badge badge-muted">{cb.subsidiaryCode}</span></td>
                    <td style={{ fontSize: 12 }}>{cb.entity}</td>
                    <td>
                      <span className={`badge ${cb.state === 'open' ? 'badge-error' : 'badge-warning'}`}>
                        {cb.state.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--color-error)' }}>{cb.consecutiveFailures}</td>
                    <td>
                      <button className="btn btn-secondary btn-sm">Reset</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Retry config */}
        <div className="card">
          <div className="card-title">Retry & Backoff Configuration</div>
          <div className="form-row" style={{ gap: 12 }}>
            {Object.entries(retryConfig).map(([key, val]) => (
              <div className="form-group" key={key}>
                <label className="form-label">{key.replace(/([A-Z])/g, ' $1').trim()}</label>
                <input className="form-input" type="number" defaultValue={val} />
              </div>
            ))}
          </div>
          <div className="mt-16">
            <div className="alert alert-info" style={{ fontSize: 12 }}>
              HTTP 429 responses honour <code>Retry-After</code> header; backoff values used for other transient errors only.
            </div>
          </div>
          <button className="btn btn-primary btn-sm mt-16">Save Config</button>
        </div>
      </div>

      {/* SFTP fallback */}
      <div className="card">
        <div className="card-title">SFTP Fallback Ingestion</div>
        <p className="text-secondary mb-16" style={{ fontSize: 13 }}>
          Secure SFTP drop zones for subsidiaries temporarily unable to expose BC APIs.
          Files are validated, parsed, and landed in Bronze tagged as <code>source_type = 'sftp_fallback'</code>.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Subsidiary</th>
                <th>SFTP Enabled</th>
                <th>Last File</th>
                <th>Uploaded</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sftpSlots.map((s) => (
                <tr key={s.code}>
                  <td><span className="badge badge-muted">{s.code}</span> {s.name}</td>
                  <td>
                    <span className={`badge ${s.enabled ? 'badge-success' : 'badge-muted'}`}>
                      {s.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td className="table-mono" style={{ fontSize: 11 }}>{s.lastFile ?? '—'}</td>
                  <td style={{ fontSize: 12 }} className="text-muted">{s.uploadedAt ?? '—'}</td>
                  <td><StatusBadge status={s.status} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-secondary btn-sm">{s.enabled ? 'Disable' : 'Enable'}</button>
                      <button className="btn btn-secondary btn-sm">View Files</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
