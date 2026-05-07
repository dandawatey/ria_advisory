/**
 * F011 — FX Translation Engine
 * Admin page: rate table, translation policy config, missing rate exceptions.
 */
import { useState } from 'react';
import type { FXRate } from '../types';
import PageExplainer from '../components/common/PageExplainer';

const mockRates: FXRate[] = [
  { currencyPair: 'GBP/USD', rateDate: '2026-04-23', rateType: 'PERIOD_END', rateValue: 1.2734, source: 'BC Currency Table' },
  { currencyPair: 'EUR/USD', rateDate: '2026-04-23', rateType: 'PERIOD_END', rateValue: 1.0821, source: 'BC Currency Table' },
  { currencyPair: 'CAD/USD', rateDate: '2026-04-23', rateType: 'PERIOD_END', rateValue: 0.7312, source: 'BC Currency Table' },
  { currencyPair: 'GBP/USD', rateDate: '2026-04-23', rateType: 'AVERAGE',    rateValue: 1.2698, source: 'BC Currency Table' },
  { currencyPair: 'EUR/USD', rateDate: '2026-04-23', rateType: 'AVERAGE',    rateValue: 1.0794, source: 'BC Currency Table' },
  { currencyPair: 'CAD/USD', rateDate: '2026-04-23', rateType: 'AVERAGE',    rateValue: 0.7288, source: 'BC Currency Table' },
  { currencyPair: 'AUD/USD', rateDate: '2026-04-22', rateType: 'PERIOD_END', rateValue: 0.6512, source: 'BC Currency Table' },
];

const translationPolicy = [
  { accountType: 'Asset',     rationale: 'Balance Sheet',     rateType: 'PERIOD_END' },
  { accountType: 'Liability', rationale: 'Balance Sheet',     rateType: 'PERIOD_END' },
  { accountType: 'Equity',    rationale: 'Historical',         rateType: 'HISTORICAL' },
  { accountType: 'Revenue',   rationale: 'Income Statement',  rateType: 'AVERAGE' },
  { accountType: 'Expense',   rationale: 'Income Statement',  rateType: 'AVERAGE' },
];

const missingRates = [
  { currencyPair: 'AUD/USD', rateDate: '2026-04-23', rateType: 'PERIOD_END', rowsAffected: 42, subsidiary: 'SUB12' },
];

export default function FXTranslation() {
  const [activeTab, setActiveTab] = useState<'policy' | 'rates' | 'exceptions'>('policy');

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">FX Translation Engine</h1>
        <p className="page-subtitle">
          Multi-rate FX translation policy (period-end, average, historical) and rate source management. (F011)
        </p>
      </div>

      <PageExplainer
        icon="💱"
        title="What is the FX Translation Engine?"
        description="Subsidiaries operate in local currencies (GBP, CAD, EUR, AUD). For <strong>consolidated USD reporting, all amounts must be translated using the correct exchange rate type</strong> as defined by accounting standards. Balance sheet items use period-end rates; income statement items use average rates; equity uses historical rates. Finance admins use this page to review rate policy, check the rate table, and resolve missing-rate exceptions that would block GL entries from being translated."
        concepts={[
          { icon: 'PE', color: '#2563eb', label: 'Period-End', desc: 'Rate on the last day of the reporting period — used for balance sheet' },
          { icon: 'AV', color: '#16a34a', label: 'Average', desc: 'Average rate over the period — used for income statement items' },
          { icon: 'HI', color: '#7c3aed', label: 'Historical', desc: 'Rate at the time of original transaction — used for equity' },
        ]}
        glossary={[
          { term: 'Currency Pair', def: 'Source/target currency combination (e.g. GBP/USD = British Pounds to US Dollars)' },
          { term: 'Rows Affected', def: 'GL entries that cannot be translated until this missing rate is provided' },
          { term: 'fx_translated', def: 'Flag on each GL entry — false means the rate was missing at translation time' },
        ]}
      />

      <div className="card-grid card-grid-4 mb-24">
        <div className="kpi-tile"><div className="kpi-label">Currency Pairs</div><div className="kpi-value">7</div><div className="kpi-meta">Active in Gold</div></div>
        <div className="kpi-tile"><div className="kpi-label">Rates Today</div><div className="kpi-value">21</div><div className="kpi-meta">3 types × 7 pairs</div></div>
        <div className="kpi-tile"><div className="kpi-label">Missing Rates</div><div className="kpi-value" style={{ color: 'var(--color-warning)' }}>{missingRates.length}</div><div className="kpi-meta">DQ warning</div></div>
        <div className="kpi-tile"><div className="kpi-label">Rows Translated</div><div className="kpi-value">8,230</div><div className="kpi-meta">Non-USD GL rows</div></div>
      </div>

      {missingRates.length > 0 && (
        <div className="alert alert-warning mb-24">
          ⚠ {missingRates.length} missing rate(s) detected. Affected rows flagged <code>fx_translated = false</code>. Upload rates or configure fallback source.
        </div>
      )}

      <div className="card">
        <div className="tabs">
          <div className={`tab ${activeTab === 'policy' ? 'active' : ''}`} onClick={() => setActiveTab('policy')}>Translation Policy</div>
          <div className={`tab ${activeTab === 'rates' ? 'active' : ''}`} onClick={() => setActiveTab('rates')}>Rate Table</div>
          <div className={`tab ${activeTab === 'exceptions' ? 'active' : ''}`} onClick={() => setActiveTab('exceptions')}>Missing Rates ({missingRates.length})</div>
        </div>

        {activeTab === 'policy' && (
          <>
            <p className="text-secondary mb-16" style={{ fontSize: 13 }}>
              Policy approved by CFO. Changes require two-person approval. Effective from 2026-01-01.
            </p>
            <table>
              <thead>
                <tr><th>Account Type</th><th>F/S Line</th><th>Rate Type</th><th></th></tr>
              </thead>
              <tbody>
                {translationPolicy.map((p) => (
                  <tr key={p.accountType}>
                    <td style={{ fontWeight: 600 }}>{p.accountType}</td>
                    <td>{p.rationale}</td>
                    <td><span className="badge badge-info">{p.rateType}</span></td>
                    <td><button className="btn btn-secondary btn-sm">Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {activeTab === 'rates' && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Pair</th><th>Date</th><th>Rate Type</th><th>Rate</th><th>Source</th></tr>
              </thead>
              <tbody>
                {mockRates.map((r, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{r.currencyPair}</td>
                    <td className="table-mono">{r.rateDate}</td>
                    <td><span className="badge badge-muted">{r.rateType}</span></td>
                    <td className="table-mono" style={{ fontWeight: 600 }}>{r.rateValue.toFixed(4)}</td>
                    <td style={{ fontSize: 12 }} className="text-muted">{r.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-16">
              <button className="btn btn-secondary btn-sm">Upload Manual Rates (CSV)</button>
            </div>
          </div>
        )}

        {activeTab === 'exceptions' && (
          <div className="table-wrap">
            {missingRates.length === 0 ? (
              <div className="text-muted" style={{ padding: 32, textAlign: 'center' }}>No missing rates</div>
            ) : (
              <table>
                <thead>
                  <tr><th>Currency Pair</th><th>Date</th><th>Rate Type</th><th>Subsidiary</th><th>Rows Affected</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {missingRates.map((m, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{m.currencyPair}</td>
                      <td className="table-mono">{m.rateDate}</td>
                      <td><span className="badge badge-warning">{m.rateType}</span></td>
                      <td><span className="badge badge-muted">{m.subsidiary}</span></td>
                      <td style={{ color: 'var(--color-error)', fontWeight: 600 }}>{m.rowsAffected}</td>
                      <td><button className="btn btn-primary btn-sm">Upload Rate</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
