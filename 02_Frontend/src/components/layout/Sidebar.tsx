import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useFeatureFlags } from '../../contexts/FeatureFlagContext';
import riaLogo        from '../../assets/ria-advisory-logo.svg';
import isourceLogo    from '../../assets/isource-logo.png';
import ifinsightsLogo from '../../assets/ifinsights-logo.svg';

interface NavItem {
  label:    string;
  path:     string;
  icon:     string;
  flagKey?: string;  // undefined = always visible (system pages)
}

interface NavSection {
  label:      string;
  items:      NavItem[];
  adminOnly?: boolean;
}

const nav: NavSection[] = [
  {
    label: 'Command Center',
    items: [
      { label: 'Executive Dashboard', path: '/dashboard',            icon: '▦', flagKey: 'page_executive_dashboard' },
      { label: 'Health Score',        path: '/reports/health-score', icon: '♥', flagKey: 'page_health_score' },
      { label: '360° View',           path: '/360-view',             icon: '◎', flagKey: 'page_360_view' },
    ],
  },
  {
    label: 'Financial Statements',
    items: [
      { label: 'P&L Statement',  path: '/pl',                    icon: '₱', flagKey: 'page_pl' },
      { label: 'Balance Sheet',  path: '/reports/balance-sheet', icon: '⊟', flagKey: 'page_balance_sheet' },
      { label: 'Cash Flow',      path: '/reports/cash-flow',     icon: '⇄', flagKey: 'page_cash_flow' },
      { label: 'Trial Balance',  path: '/reports/trial-balance', icon: '⇌', flagKey: 'page_trial_balance' },
    ],
  },
  {
    label: 'Performance',
    items: [
      { label: 'KPI Dashboard',     path: '/reports/kpi',        icon: '◈', flagKey: 'page_kpi_dashboard' },
      { label: 'CFO Ratios',        path: '/reports/cfo-ratios', icon: '⊛', flagKey: 'page_cfo_ratios' },
      { label: 'Analytics',         path: '/analytics',          icon: '◉', flagKey: 'page_analytics' },
      { label: 'Entity Comparison', path: '/reports/entities',   icon: '⊜', flagKey: 'page_entity_comparison' },
    ],
  },
  {
    label: 'Revenue & Income',
    items: [
      { label: 'Revenue Report',   path: '/reports/revenue',      icon: '$', flagKey: 'page_revenue' },
      { label: 'Unbilled Revenue', path: '/reports/ubr',          icon: 'U', flagKey: 'page_ubr' },
      { label: 'Invoicing Report', path: '/reports/invoicing',    icon: 'I', flagKey: 'page_invoicing' },
      { label: 'Monthly Income',   path: '/income',               icon: '↑', flagKey: 'page_monthly_income' },
      { label: 'Posted Sales',     path: '/insights/posted-sales',icon: '◈', flagKey: 'page_posted_sales' },
      { label: 'Invoices',         path: '/insights/invoices',    icon: '⊡', flagKey: 'page_invoice_insights' },
    ],
  },
  {
    label: 'Accounts Receivable',
    items: [
      { label: 'Collections', path: '/collections',       icon: '◷', flagKey: 'page_collections' },
      { label: 'AR Ageing',   path: '/ageing',            icon: '⧖', flagKey: 'page_ar_aging' },
      { label: 'Customers',   path: '/insights/customer', icon: '◎', flagKey: 'page_customers' },
    ],
  },
  {
    label: 'Cost Management',
    items: [
      { label: 'Expense Analysis', path: '/reports/expense',    icon: '↓', flagKey: 'page_expense_analysis' },
      { label: 'Dept Spend',       path: '/reports/dept-spend', icon: '⊞', flagKey: 'page_dept_spend' },
      { label: 'Projects',         path: '/reports/projects',   icon: '◫', flagKey: 'page_projects' },
      { label: 'Verticals',        path: '/reports/verticals',  icon: '⊗', flagKey: 'page_verticals' },
    ],
  },
  {
    label: 'Planning',
    items: [
      { label: 'Budget Planning', path: '/budgeting',   icon: '📊', flagKey: 'page_budgeting' },
      { label: 'Investments',     path: '/investments', icon: '💹', flagKey: 'page_investments' },
    ],
  },
  {
    label: 'ERP Integration',
    items: [
      { label: 'Consolidated View', path: '/erp/consolidated', icon: '⊕', flagKey: 'page_consolidated' },
      { label: 'Cross-ERP P&L',    path: '/erp/cross-pl',     icon: '⇌', flagKey: 'page_cross_erp_pl' },
      { label: 'ERP Sources',      path: '/erp/sources',      icon: '⊙', flagKey: 'page_erp_sources' },
      { label: 'Field Mapping',    path: '/erp/mapping',      icon: '⇔', flagKey: 'page_field_mapping' },
    ],
  },
  {
    label: 'Close & Control',
    items: [
      { label: 'Close Cockpit', path: '/close',       icon: '✓', flagKey: 'page_close_cockpit' },
      { label: 'AI Query',      path: '/annotations', icon: '✦', flagKey: 'page_ai_query' },
    ],
  },
  {
    label: 'Data Pipeline',
    adminOnly: true,
    items: [
      { label: 'Data Extraction',  path: '/pipeline/extraction',    icon: '⬇', flagKey: 'page_data_extraction' },
      { label: 'Orchestration',    path: '/pipeline/orchestration', icon: '⊛', flagKey: 'page_orchestration' },
      { label: 'Resilience',       path: '/pipeline/resilience',    icon: '⟳', flagKey: 'page_resilience' },
      { label: 'Bronze Zone',      path: '/pipeline/bronze',        icon: '⬡', flagKey: 'page_bronze_zone' },
      { label: 'Silver Layer',     path: '/pipeline/silver',        icon: '⬡', flagKey: 'page_silver_layer' },
      { label: 'Gold Layer',       path: '/pipeline/gold',          icon: '⬡', flagKey: 'page_gold_layer' },
      { label: 'Data Lineage',     path: '/pipeline/lineage',       icon: '⇢', flagKey: 'page_data_lineage' },
    ],
  },
  {
    label: 'Administration',
    adminOnly: true,
    items: [
      { label: 'Feature Flags',       path: '/admin/feature-flags',    icon: '⚑' },  // always visible to admin
      { label: 'RBAC Console',        path: '/admin/rbac',             icon: '🔒', flagKey: 'page_rbac' },
      { label: 'GL Mapping',          path: '/admin/mappings',         icon: '⇔', flagKey: 'page_gl_mapping' },
      { label: 'Chart of Accounts',   path: '/admin/coa',              icon: '≡', flagKey: 'page_coa' },
      { label: 'Data Quality',        path: '/admin/dq',               icon: '◈', flagKey: 'page_data_quality' },
      { label: 'IC Elimination',      path: '/admin/ic-elimination',   icon: '⊖', flagKey: 'page_ic_elimination' },
      { label: 'Dimensions',          path: '/admin/dimensions',       icon: '⊞', flagKey: 'page_dimensions' },
      { label: 'FX Translation',      path: '/admin/fx',               icon: '⇄', flagKey: 'page_fx_translation' },
      { label: 'Onboarding Wizard',   path: '/admin/onboarding',       icon: '⊕', flagKey: 'page_onboarding_wizard' },
      { label: 'Security & Compliance', path: '/admin/security',       icon: '⊛', flagKey: 'page_security' },
      { label: 'Settings',            path: '/settings',               icon: '⚙', flagKey: 'page_settings' },
      { label: 'Tenant Management',   path: '/admin/tenants',          icon: '🏢', flagKey: 'page_tenant_management' },
      { label: 'BC Tenant Auth',      path: '/admin/bc-tenants',       icon: '🔑', flagKey: 'page_bc_tenants' },
      { label: 'Pipeline Health',     path: '/admin/pipeline-health',  icon: '⚡', flagKey: 'page_pipeline_health' },
      { label: 'API Status',          path: '/admin/api',              icon: '◎', flagKey: 'page_api_status' },
    ],
  },
];

export function Sidebar() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useAuth();
  const { isEnabled, isLoading } = useFeatureFlags();

  const role    = user?.role;
  const isAdmin = role === 'superadmin' || role === 'isource_admin' || role === 'ria_admin';

  const logo    = role === 'isource_admin' ? isourceLogo
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
          <span style={{ fontSize: 9, color: '#9ca3af', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Unified Financial Intelligence
          </span>
        )}
      </div>

      {!isLoading && nav.map((section) => {
        if (section.adminOnly && !isAdmin) return null;

        const visibleItems = section.items.filter((item) =>
          // No flagKey → always show (system/admin-only items)
          !item.flagKey || isEnabled(item.flagKey)
        );

        if (visibleItems.length === 0) return null;

        return (
          <div className="sidebar-section" key={section.label}>
            <div className="sidebar-section-label">{section.label}</div>
            {visibleItems.map((item) => (
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
