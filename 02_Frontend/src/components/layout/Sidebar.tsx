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
  adminOnly?: boolean;
}

const nav: NavSection[] = [
  {
    label: 'Command Center',
    items: [
      { label: 'Executive Dashboard', path: '/dashboard',             icon: '▦' },
      { label: 'Health Score',        path: '/reports/health-score',  icon: '♥' },
      { label: '360° View',           path: '/360-view',              icon: '◎' },
    ],
  },
  {
    label: 'Financial Statements',
    items: [
      { label: 'P&L Statement',  path: '/pl',                    icon: '₱' },
      { label: 'Balance Sheet',  path: '/reports/balance-sheet', icon: '⊟' },
      { label: 'Cash Flow',      path: '/reports/cash-flow',     icon: '⇄' },
      { label: 'Trial Balance',  path: '/reports/trial-balance', icon: '⇌' },
    ],
  },
  {
    label: 'Performance',
    items: [
      { label: 'KPI Dashboard',     path: '/reports/kpi',      icon: '◈' },
      { label: 'Analytics',         path: '/analytics',        icon: '◉' },
      { label: 'Entity Comparison', path: '/reports/entities', icon: '⊜' },
    ],
  },
  {
    label: 'Revenue & Income',
    items: [
      { label: 'Monthly Income', path: '/income',                 icon: '↑' },
      { label: 'Posted Sales',   path: '/insights/posted-sales',  icon: '◈' },
      { label: 'Invoices',       path: '/insights/invoices',      icon: '⊡' },
    ],
  },
  {
    label: 'Accounts Receivable',
    items: [
      { label: 'Collections', path: '/collections',        icon: '◷' },
      { label: 'AR Ageing',   path: '/ageing',             icon: '⧖' },
      { label: 'Customers',   path: '/insights/customer',  icon: '◎' },
    ],
  },
  {
    label: 'Cost Management',
    items: [
      { label: 'Expense Analysis',  path: '/reports/expense',    icon: '↓' },
      { label: 'Dept Spend',        path: '/reports/dept-spend', icon: '⊞' },
      { label: 'Projects',          path: '/reports/projects',   icon: '◫' },
      { label: 'Verticals',         path: '/reports/verticals',  icon: '⊗' },
    ],
  },
  {
    label: 'Planning',
    items: [
      { label: 'Budget Planning', path: '/budgeting',    icon: '📊' },
      { label: 'Investments',     path: '/investments',  icon: '💹' },
    ],
  },
  {
    label: 'ERP Integration',
    items: [
      { label: 'Consolidated View',  path: '/erp/consolidated', icon: '⊕' },
      { label: 'Cross-ERP P&L',      path: '/erp/cross-pl',     icon: '⇌' },
      { label: 'ERP Sources',        path: '/erp/sources',      icon: '⊙' },
      { label: 'Field Mapping',      path: '/erp/mapping',      icon: '⇔' },
    ],
  },
  {
    label: 'Close & Control',
    items: [
      { label: 'Close Cockpit', path: '/close',       icon: '✓' },
      { label: 'AI Query',      path: '/annotations', icon: '✦' },
    ],
  },
  {
    label: 'Data Pipeline',
    adminOnly: true,
    items: [
      { label: 'Data Extraction',    path: '/pipeline/extraction',    icon: '⬇' },
      { label: 'Orchestration',      path: '/pipeline/orchestration', icon: '⊛' },
      { label: 'Resilience',         path: '/pipeline/resilience',    icon: '⟳' },
      { label: 'Bronze Zone',        path: '/pipeline/bronze',        icon: '⬡' },
      { label: 'Silver Layer',       path: '/pipeline/silver',        icon: '⬡' },
      { label: 'Gold Layer',         path: '/pipeline/gold',          icon: '⬡' },
      { label: 'Data Lineage',       path: '/pipeline/lineage',       icon: '⇢' },
    ],
  },
  {
    label: 'Administration',
    adminOnly: true,
    items: [
      { label: 'RBAC Console',       path: '/admin/rbac',             icon: '🔒' },
      { label: 'GL Mapping',         path: '/admin/mappings',         icon: '⇔' },
      { label: 'Chart of Accounts',  path: '/admin/coa',              icon: '≡' },
      { label: 'Data Quality',       path: '/admin/dq',               icon: '◈' },
      { label: 'IC Elimination',     path: '/admin/ic-elimination',   icon: '⊖' },
      { label: 'Dimensions',         path: '/admin/dimensions',       icon: '⊞' },
      { label: 'FX Translation',     path: '/admin/fx',               icon: '⇄' },
      { label: 'Onboarding Wizard',  path: '/admin/onboarding',       icon: '⊕' },
      { label: 'Security & Compliance', path: '/admin/security',      icon: '⊛' },
      { label: 'Settings',           path: '/settings',               icon: '⚙' },
      { label: 'Tenant Management',  path: '/admin/tenants',          icon: '🏢' },
      { label: 'BC Tenant Auth',     path: '/admin/bc-tenants',       icon: '🔑' },
      { label: 'Pipeline Health',    path: '/admin/pipeline-health',  icon: '⚡' },
      { label: 'API Status',         path: '/admin/api',              icon: '◎' },
    ],
  },
];

export function Sidebar() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useAuth();

  const role = user?.role;
  const isAdmin = role === 'superadmin' || role === 'isource_admin' || role === 'ria_admin';

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

      {nav.map((section) => {
        if (section.adminOnly && !isAdmin) return null;
        return (
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
        );
      })}
    </aside>
  );
}
