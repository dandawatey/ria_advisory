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

// Only sections/routes backed by real GL data or API endpoints
const nav: NavSection[] = [
  {
    label: 'Finance',
    items: [
      { label: 'Executive Dashboard', path: '/dashboard',   icon: '▦' },
      { label: 'Close Cockpit',       path: '/close',       icon: '✓' },
      { label: 'Analytics',           path: '/analytics',   icon: '◉' },
      { label: 'Annotations / NLQ',   path: '/annotations', icon: '◎' },
    ],
  },
  {
    label: 'GL',
    items: [
      { label: 'GL Explorer',         path: '/explorer',    icon: '◈' },
      { label: 'GL Insights',         path: '/gl-insights', icon: '◑' },
      { label: 'Canonical CoA',       path: '/admin/coa',   icon: '≡' },
      { label: 'Data Quality',        path: '/admin/dq',    icon: '◎' },
      { label: 'IC Elimination',      path: '/admin/ic-elimination', icon: '⇌' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Mapping Console',   path: '/admin/mappings',        icon: '⇄' },
      { label: 'Pipeline Health',   path: '/admin/pipeline-health', icon: '⚡' },
      { label: 'BC Tenants',        path: '/admin/bc-tenants',      icon: '⊞' },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'API Status',        path: '/admin/api',      icon: '⟁' },
    ],
  },
];

export function Sidebar() {
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
}
