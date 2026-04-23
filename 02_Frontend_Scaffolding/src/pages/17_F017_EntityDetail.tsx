/**
 * F017 — Entity Detail View
 * Subsidiary-scoped: trial balance, AR/AP detail, DQ exceptions, IC reconciliation.
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { PowerBIEmbed } from '../components/shared/PowerBIEmbed';

const entityMeta: Record<string, { name: string; currency: string; controller: string }> = {
  SUB01: { name: 'Apex Capital Advisors LLC',    currency: 'USD', controller: 'Sarah Gonzalez' },
  SUB02: { name: 'Blue Ridge Wealth Management', currency: 'USD', controller: 'James Park' },
  SUB04: { name: 'Dune Capital Partners',         currency: 'GBP', controller: 'Priya Nair' },
};

const trialBalance = [
  { accountNo: '4001', accountName: 'Advisory Fee Income',   type: 'Revenue',   openingBal: 0, debitMTD: 0,         creditMTD: 4_820_000, closingBal: 4_820_000 },
  { accountNo: '4002', accountName: 'Management Fee Income', type: 'Revenue',   openingBal: 0, debitMTD: 0,         creditMTD: 1_840_000, closingBal: 1_840_000 },
  { accountNo: '6001', accountName: 'Salaries & Benefits',   type: 'Expense',   openingBal: 0, debitMTD: 2_102_000, creditMTD: 0,         closingBal: -2_102_000 },
  { accountNo: '6010', accountName: 'Technology Costs',      type: 'Expense',   openingBal: 0, debitMTD: 312_000,   creditMTD: 0,         closingBal: -312_000 },
  { accountNo: '1001', accountName: 'Operating Cash',        type: 'Asset',     openingBal: 8_200_000, debitMTD: 4_820_000, creditMTD: 2_414_000, closingBal: 10_606_000 },
  { accountNo: '1101', accountName: 'Accounts Receivable',   type: 'Asset',     openingBal: 1_210_000, debitMTD: 4_820_000, creditMTD: 3_940_000, closingBal: 2_090_000 },
  { accountNo: '2001', accountName: 'Accounts Payable',      type: 'Liability', openingBal: -420_000,  debitMTD: 312_000,   creditMTD: 480_000,   closingBal: -588_000 },
];

const arInvoices = [
  { invoiceNo: 'INV-2026-0412', customer: 'Blackrock Advisors',   dueDate: '2026-05-01', amount: 420_000, outstanding: 420_000, agingBucket: 'Current' },
  { invoiceNo: 'INV-2026-0389', customer: 'Fidelity Management',  dueDate: '2026-04-15', amount: 310_000, outstanding: 310_000, agingBucket: '1–30 days' },
  { invoiceNo: 'INV-2026-0341', customer: 'Vanguard Group',       dueDate: '2026-03-31', amount: 180_000, outstanding: 180_000, agingBucket: '31–60 days' },
];

const dqExceptions = [
  { ruleId: 'DQ-001', ruleName: 'GL Account Canonical Mapping Required', severity: 'critical' as const, rowsFailed: 97, guidance: 'Account 44020 "Digital Marketing" not mapped. Contact group finance → Mapping Console.' },
];

function fmtUSD(n: number) {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

export default function EntityDetail() {
  const { id } = useParams<{ id: string }>();
  const entity = entityMeta[id ?? 'SUB01'] ?? entityMeta.SUB01;
  const code = id ?? 'SUB01';
  const [activeTab, setActiveTab] = useState<'tb' | 'ar' | 'dq' | 'ic' | 'pbi'>('tb');
  const [tbView, setTbView] = useState<'canonical' | 'local'>('canonical');

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span className="badge badge-info" style={{ fontSize: 13 }}>{code}</span>
              <h1 className="page-title" style={{ margin: 0 }}>{entity.name}</h1>
            </div>
            <p className="page-subtitle">
              Subsidiary controller: {entity.controller} · Currency: {entity.currency} · Last refresh: 2026-04-23 14:02 ET
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary">Export Trial Balance</button>
            <button className="btn btn-secondary">Upload BC Export (Reconcile)</button>
          </div>
        </div>
      </div>

      {dqExceptions.filter((e) => e.severity === 'critical').length > 0 && (
        <div className="alert alert-error mb-24">
          ✗ <strong>{dqExceptions.filter((e) => e.severity === 'critical').length} critical DQ exception(s)</strong> blocking Gold promotion for this entity.
        </div>
      )}

      <div className="card">
        <div className="tabs">
          <div className={`tab ${activeTab === 'tb' ? 'active' : ''}`} onClick={() => setActiveTab('tb')}>Trial Balance</div>
          <div className={`tab ${activeTab === 'ar' ? 'active' : ''}`} onClick={() => setActiveTab('ar')}>AR Detail</div>
          <div className={`tab ${activeTab === 'dq' ? 'active' : ''}`} onClick={() => setActiveTab('dq')}>
            DQ Exceptions {dqExceptions.length > 0 && <span className="badge badge-error" style={{ marginLeft: 4 }}>{dqExceptions.length}</span>}
          </div>
          <div className={`tab ${activeTab === 'ic' ? 'active' : ''}`} onClick={() => setActiveTab('ic')}>IC Reconciliation</div>
          <div className={`tab ${activeTab === 'pbi' ? 'active' : ''}`} onClick={() => setActiveTab('pbi')}>Power BI Report</div>
        </div>

        {activeTab === 'tb' && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button className={`btn btn-sm ${tbView === 'canonical' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTbView('canonical')}>Canonical View</button>
              <button className={`btn btn-sm ${tbView === 'local' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTbView('local')}>Local BC View</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Account No</th><th>Account Name</th><th>Type</th><th style={{ textAlign: 'right' }}>Opening Bal</th><th style={{ textAlign: 'right' }}>Debit MTD</th><th style={{ textAlign: 'right' }}>Credit MTD</th><th style={{ textAlign: 'right' }}>Closing Bal</th></tr>
                </thead>
                <tbody>
                  {trialBalance.map((r) => (
                    <tr key={r.accountNo}>
                      <td className="table-mono">{r.accountNo}</td>
                      <td style={{ fontWeight: 500 }}>{r.accountName}</td>
                      <td><span className="badge badge-muted">{r.type}</span></td>
                      <td style={{ textAlign: 'right' }}>{fmtUSD(r.openingBal)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--color-info)' }}>{r.debitMTD > 0 ? fmtUSD(r.debitMTD) : '—'}</td>
                      <td style={{ textAlign: 'right', color: 'var(--color-success)' }}>{r.creditMTD > 0 ? fmtUSD(r.creditMTD) : '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtUSD(r.closingBal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === 'ar' && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Invoice</th><th>Customer</th><th>Due Date</th><th style={{ textAlign: 'right' }}>Amount</th><th style={{ textAlign: 'right' }}>Outstanding</th><th>Aging</th></tr></thead>
              <tbody>
                {arInvoices.map((i) => (
                  <tr key={i.invoiceNo}>
                    <td className="table-mono">{i.invoiceNo}</td>
                    <td>{i.customer}</td>
                    <td>{i.dueDate}</td>
                    <td style={{ textAlign: 'right' }}>{fmtUSD(i.amount)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtUSD(i.outstanding)}</td>
                    <td><span className={`badge ${i.agingBucket === 'Current' ? 'badge-success' : i.agingBucket === '1–30 days' ? 'badge-warning' : 'badge-error'}`}>{i.agingBucket}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'dq' && (
          <div>
            {dqExceptions.map((e) => (
              <div key={e.ruleId} style={{ padding: 16, border: '2px solid var(--color-error)', borderRadius: 8, marginBottom: 12 }}>
                <div className="flex items-center gap-8 mb-16">
                  <span className="badge badge-error">{e.severity}</span>
                  <span style={{ fontWeight: 600 }}>{e.ruleName}</span>
                  <span className="badge badge-error">{e.rowsFailed} rows failed</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{e.guidance}</p>
                <button className="btn btn-secondary btn-sm mt-16">Open Mapping Console</button>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'ic' && (
          <div style={{ padding: 16, fontSize: 13, color: 'var(--color-text-secondary)' }}>
            No IC transactions for {code} in Apr 2026. IC flag not set on any canonical accounts for this entity.
          </div>
        )}

        {activeTab === 'pbi' && (
          <div style={{ padding: '0 0 16px' }}>
            <PowerBIEmbed title={`${entity.name} — Entity Financial Report`} height={450} />
          </div>
        )}
      </div>
    </div>
  );
}
