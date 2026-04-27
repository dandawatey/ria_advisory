import { useNavigate, useLocation } from 'react-router-dom';
import riaLogo from '../../assets/ria-advisory-logo.svg';

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
    label: 'Insights',
    items: [
      { label: 'GL Insights',             path: '/insights/gl',           icon: '◑' },
      { label: 'Chart of Accounts',       path: '/insights/coa',          icon: '≡' },
      { label: 'By Customer',             path: '/insights/customer',     icon: '◎' },
      { label: 'By Posted Sales',         path: '/insights/posted-sales', icon: '◈' },
      { label: 'By Invoices',             path: '/insights/invoices',     icon: '⊟' },
    ],
  },
  {
    label: 'GL',
    items: [
      { label: 'GL Explorer',         path: '/explorer',    icon: '◈' },
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
      <div className="sidebar-logo" style={{ padding: '16px 12px 12px' }}>
        <img src={riaLogo} alt="RIA Advisory" style={{ width: '100%', maxWidth: 160, display: 'block', marginBottom: 4 }} />
        <span style={{ fontSize: 10 }}>Unified Financial Intelligence</span>
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
