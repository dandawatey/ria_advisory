import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import riaLogo        from '../../assets/ria-advisory-logo.svg';
import isourceLogo    from '../../assets/isource-logo.png';
import ifinsightsLogo from '../../assets/ifinsights-logo.svg';

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
    label: 'Financial Statements',
    items: [
      { label: 'Executive Dashboard', path: '/dashboard',              icon: '▦' },
      { label: 'P&L Statement',       path: '/pl',                     icon: '₱' },
      { label: 'Trial Balance',       path: '/reports/trial-balance',  icon: '⇌' },
      { label: 'Balance Sheet',       path: '/reports/balance-sheet',  icon: '⊟' },
      { label: 'Cash Flow',           path: '/reports/cash-flow',      icon: '⇄' },
      { label: 'KPI Dashboard',       path: '/reports/kpi',            icon: '◈' },
      { label: 'Health Score',        path: '/reports/health-score',   icon: '♥' },
    ],
  },
  {
    label: 'Revenue & Sales',
    items: [
      { label: 'Analytics',           path: '/analytics',              icon: '◈' },
      { label: 'Monthly Income',      path: '/income',                 icon: '↑' },
      { label: 'Invoices',            path: '/insights/invoices',      icon: '⊡' },
      { label: 'Posted Sales',        path: '/insights/posted-sales',  icon: '◉' },
    ],
  },
  {
    label: 'Collections & AR',
    items: [
      { label: 'Collections',         path: '/collections',            icon: '◷' },
      { label: 'AR Ageing',           path: '/ageing',                 icon: '⧖' },
      { label: 'Customers',           path: '/insights/customer',      icon: '◎' },
    ],
  },
  {
    label: 'GL & Expenses',
    items: [
      { label: 'GL Explorer',         path: '/explorer',               icon: '⊕' },
      { label: 'GL Insights',         path: '/insights/gl',            icon: '◑' },
      { label: 'Expense Analysis',    path: '/reports/expense',        icon: '↓' },
      { label: 'Department Spend',    path: '/reports/dept-spend',     icon: '⊞' },
      { label: 'Projects',            path: '/reports/projects',       icon: '◫' },
      { label: 'Verticals',           path: '/reports/verticals',      icon: '⊗' },
      { label: 'Entity Comparison',   path: '/reports/entities',       icon: '⊜' },
      { label: 'Chart of Accounts',   path: '/insights/coa',           icon: '≡' },
    ],
  },
  {
    label: 'Planning & Investments',
    items: [
      { label: 'Budget Planning',     path: '/budgeting',              icon: '📊' },
      { label: 'Investments',         path: '/investments',            icon: '💹' },
      { label: '360° View',           path: '/360-view',               icon: '🔭' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { label: 'Annotations (NLQ)',   path: '/annotations',            icon: '✦' },
      { label: 'Settings',            path: '/settings',               icon: '⚙' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Tenant Management',   path: '/admin/tenants',          icon: '🏢' },
      { label: 'BC Tenant Auth',      path: '/admin/bc-tenants',       icon: '🔑' },
      { label: 'Pipeline Health',     path: '/admin/pipeline-health',  icon: '⚡' },
      { label: 'API Status',          path: '/admin/api',              icon: '◎' },
    ],
  },
];

export function Sidebar() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useAuth();

  const role = user?.role;
  const logo = role === 'isource_admin' ? isourceLogo
             : role === 'ria_admin'     ? riaLogo
             : ifinsightsLogo;
  const logoAlt = role === 'isource_admin' ? 'i-Source Infosystems'
                : role === 'ria_admin'     ? 'RIA Advisory'
                : 'i-finsights';
  const logoStyle = role === 'isource_admin'
    ? { width: '100%', maxWidth: 140, display: 'block', marginBottom: 4 }
    : { width: '100%', maxWidth: 160, display: 'block', marginBottom: 4 };

  return (
    <aside className="app-sidebar">
      <div className="sidebar-logo" style={{ padding: '16px 12px 12px' }}>
        <img src={logo} alt={logoAlt} style={logoStyle} />
        {role !== 'isource_admin' && role !== 'ria_admin' && (
          <span style={{ fontSize: 9, color: '#9ca3af', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Unified Financial Intelligence</span>
        )}
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
