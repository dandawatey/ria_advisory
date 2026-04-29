/**
 * F003 — Pipeline Orchestration & Scheduling
 * Admin page: schedule config, run triggers, job dependency status.
 */
import React, { useState } from 'react';
import { StatusBadge } from '../components/shared/StatusBadge';
import type { Status } from '../types';

interface Schedule {
  id: string;
  name: string;
  cron: string;
  description: string;
  lastRun: string;
  nextRun: string;
  status: 'success' | 'running' | 'error' | 'pending';
  entityScope: string;
}

const mockSchedules: Schedule[] = [
  { id: 'sched-001', name: 'Morning Full Extract',   cron: '0 6 * * 1-5',  description: 'All tenants, all entities — incremental',   lastRun: '2026-04-23 06:00 ET', nextRun: '2026-04-24 06:00 ET', status: 'success', entityScope: 'ALL' },
  { id: 'sched-002', name: 'Afternoon Full Extract', cron: '0 14 * * 1-5', description: 'All tenants, all entities — incremental',   lastRun: '2026-04-23 14:00 ET', nextRun: '2026-04-24 14:00 ET', status: 'success', entityScope: 'ALL' },
  { id: 'sched-003', name: 'GL Entry CDC (Hourly)',  cron: '0 * * * 1-5',  description: 'GL entries only — hourly delta',            lastRun: '2026-04-23 15:00 ET', nextRun: '2026-04-23 16:00 ET', status: 'running', entityScope: 'GeneralLedgerEntries' },
  { id: 'sched-004', name: 'Weekend Reconciliation', cron: '0 8 * * 6',    description: 'Full reload for reconciliation',            lastRun: '2026-04-19 08:00 ET', nextRun: '2026-04-26 08:00 ET', status: 'success', entityScope: 'ALL' },
];

const stages: { id: number; name: string; status: Status; duration: string; entities: number; rows: number }[] = [
  { id: 1, name: 'Extract → Bronze',     status: 'success', duration: '4m 32s',  entities: 12, rows: 74_231 },
  { id: 2, name: 'Bronze → Silver',      status: 'success', duration: '6m 18s',  entities: 12, rows: 73_892 },
  { id: 3, name: 'DQ Check',             status: 'warning', duration: '1m 45s',  entities: 12, rows: 73_892 },
  { id: 4, name: 'Silver → Gold',        status: 'success', duration: '3m 10s',  entities: 12, rows: 73_541 },
  { id: 5, name: 'FX Translation',       status: 'success', duration: '0m 48s',  entities: 4,  rows: 8_230 },
  { id: 6, name: 'IC Elimination',       status: 'success', duration: '1m 02s',  entities: 0,  rows: 0 },
];

export default function PipelineOrchestration() {
  const [triggering, setTriggering] = useState(false);

  const handleTrigger = () => {
    setTriggering(true);
    setTimeout(() => setTriggering(false), 3000);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Pipeline Orchestration & Scheduling</h1>
        <p className="page-subtitle">
          Manage schedules, trigger on-demand runs, and view pipeline stage dependency status. (F003)
        </p>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={handleTrigger} disabled={triggering}>
            {triggering ? '⟳ Triggering...' : '▶ Run Now (All Entities)'}
          </button>
          <button className="btn btn-secondary">+ New Schedule</button>
        </div>
      </div>

      {triggering && (
        <div className="alert alert-info mb-24">
          ⟳ On-demand run triggered for all 17 tenants. Run ID: run-20260423-1602-adhoc
        </div>
      )}

      {/* Schedules */}
      <div className="card mb-16">
        <div className="card-title">Schedules (defined in IaC / Databricks Workflows)</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Cron</th>
                <th>Scope</th>
                <th>Last Run</th>
                <th>Next Run</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mockSchedules.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 500 }}>{s.name}</td>
                  <td className="table-mono">{s.cron}</td>
                  <td><span className="badge badge-info">{s.entityScope}</span></td>
                  <td style={{ fontSize: 12 }} className="text-muted">{s.lastRun}</td>
                  <td style={{ fontSize: 12 }}>{s.nextRun}</td>
                  <td><StatusBadge status={s.status} /></td>
                  <td>
                    <button className="btn btn-secondary btn-sm">▶ Trigger</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Last run DAG */}
      <div className="card">
        <div className="card-title">Last Run — Stage Pipeline (Morning Extract · 2026-04-23)</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {stages.map((stage, idx) => (
            <React.Fragment key={stage.id}>
              <div style={{
                padding: '12px 16px',
                border: `2px solid ${stage.status === 'success' ? 'var(--color-success)' : stage.status === 'warning' ? 'var(--color-warning)' : 'var(--color-border)'}`,
                borderRadius: 8,
                minWidth: 160,
                background: 'var(--color-surface)',
              }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{stage.name}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                  {stage.duration} · {stage.rows > 0 ? stage.rows.toLocaleString() + ' rows' : ''}
                </div>
                <div style={{ marginTop: 6 }}>
                  <StatusBadge status={stage.status} />
                </div>
              </div>
              {idx < stages.length - 1 && (
                <span style={{ color: 'var(--color-text-muted)', fontSize: 18 }}>→</span>
              )}
            </React.Fragment>
          ))}
        </div>
        <div className="divider" />
        <div style={{ display: 'flex', gap: 24, fontSize: 12, color: 'var(--color-text-secondary)' }}>
          <span>Total duration: <strong>17m 35s</strong></span>
          <span>Tenants: <strong>17/17</strong></span>
          <span>Total rows written: <strong>74,231</strong></span>
          <span>Run ID: <code style={{ fontSize: 11 }}>run-20260423-0600-sched</code></span>
        </div>
      </div>
    </div>
  );
}
