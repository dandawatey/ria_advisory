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

const nav: NavSection[] = [
  {
    label: 'Financial Statements',
    items: [
      { label: 'Executive Dashboard', path: '/dashboard',              icon: '▦' },
      { label: 'P&L Statement',       path: '/pl',                     icon: '₱' },
      { label: 'Trial Balance',       path: '/reports/trial-balance',  icon: '⇌' },
      { label: 'Balance Sheet',       path: '/reports/balance-sheet',  icon: '⊟' },
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
      { label: 'Chart of Accounts',   path: '/insights/coa',           icon: '≡' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { label: 'Annotations (NLQ)',   path: '/annotations',            icon: '✦' },
      { label: 'Settings',            path: '/settings',               icon: '⚙' },
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
