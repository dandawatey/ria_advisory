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
    label: 'Reports',
    items: [
      { label: 'Executive Dashboard', path: '/dashboard',         icon: '▦' },
      { label: 'P&L Statements',      path: '/pl',                icon: '₱' },
      { label: 'GL Insights',         path: '/insights/gl',       icon: '◑' },
      { label: 'Chart of Accounts',   path: '/insights/coa',      icon: '≡' },
      { label: 'Invoices',            path: '/insights/invoices', icon: '⊟' },
      { label: 'Collection',          path: '/collections',       icon: '◷' },
      { label: 'Ageing',              path: '/ageing',            icon: '⧖' },
      { label: 'Annotations (NLQ)',   path: '/annotations',       icon: '◎' },
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
