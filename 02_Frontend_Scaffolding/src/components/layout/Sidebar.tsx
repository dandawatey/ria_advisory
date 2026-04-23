import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const nav: NavSection[] = [
  {
    label: 'Finance',
    items: [
      { label: 'Executive Dashboard', path: '/dashboard',  icon: '▦' },
      { label: 'Close Cockpit',       path: '/close',      icon: '✓' },
      { label: 'Explorer',            path: '/explorer',   icon: '◈' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Mapping Console',     path: '/admin/mappings',        icon: '⇄' },
      { label: 'Onboarding Wizard',   path: '/admin/onboarding',      icon: '+' },
      { label: 'Pipeline Health',     path: '/admin/pipeline-health', icon: '⚡' },
      { label: 'BC Tenants',          path: '/admin/bc-tenants',      icon: '⊞' },
    ],
  },
  {
    label: 'Data Platform',
    items: [
      { label: 'Canonical CoA',       path: '/admin/coa',            icon: '≡' },
      { label: 'Dimensions',          path: '/admin/dimensions',     icon: '⊕' },
      { label: 'Data Quality',        path: '/admin/dq',             icon: '◎' },
      { label: 'Data Lineage',        path: '/admin/lineage',        icon: '⊸' },
      { label: 'FX Translation',      path: '/admin/fx',             icon: '$' },
      { label: 'IC Elimination',      path: '/admin/ic-elimination', icon: '⇌' },
    ],
  },
  {
    label: 'Security',
    items: [
      { label: 'Security & Compliance', path: '/admin/security', icon: '⚿' },
      { label: 'API Status',            path: '/admin/api',      icon: '⟁' },
    ],
  },
];

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <aside className="app-sidebar">
      <div className="sidebar-logo">
        UFIP
        <span>Unified Financial Intelligence</span>
      </div>

      {nav.map((section) => (
        <div className="sidebar-section" key={section.label}>
          <div className="sidebar-section-label">{section.label}</div>
          {section.items.map((item) => (
            <button
              key={item.path}
              className={`sidebar-nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span className="sidebar-nav-icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      ))}
    </aside>
  );
};
