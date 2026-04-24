import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function AppShell() {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-main">
        <header className="app-header">
          <div className="flex-1">
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              RIA Advisory · Unified Financial Intelligence Platform
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-secondary)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-success)', display: 'inline-block' }} />
            Data loaded: {new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })} · 188,380 GL entries · 17 entities
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px', background: 'var(--color-bg)', borderRadius: 20, border: '1px solid var(--color-border)' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
              RA
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>RIA Advisory</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Group Finance</div>
            </div>
          </div>
        </header>

        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
