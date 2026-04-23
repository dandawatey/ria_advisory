import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

const mockUser = {
  name: 'Elena Marchetti',
  role: 'Group CFO',
  entity: 'All Entities',
  initials: 'EM',
};

export const AppShell: React.FC = () => (
  <div className="app-layout">
    <Sidebar />
    <div className="app-main">
      <header className="app-header">
        <div className="flex-1">
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            RIA Advisory · Unified Financial Intelligence Platform
          </span>
        </div>

        {/* Freshness indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-secondary)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-success)', display: 'inline-block' }} />
          Last refresh: Today 14:02 ET
        </div>

        {/* User chip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', background: 'var(--color-bg)', borderRadius: 20, border: '1px solid var(--color-border)', cursor: 'pointer' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
            {mockUser.initials}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{mockUser.name}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{mockUser.role}</div>
          </div>
        </div>
      </header>

      <main className="app-content">
        <Outlet />
      </main>
    </div>
  </div>
);
