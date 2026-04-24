// ─── Domain Types ────────────────────────────────────────────────────────────

export type Status = 'success' | 'warning' | 'error' | 'running' | 'pending' | 'idle';
export type Severity = 'critical' | 'warning' | 'info';
export type LoadType = 'full' | 'incremental' | 'sftp';
export type CloseStatus = 'pending' | 'reviewed' | 'signed_off';
export type Role = 'exec' | 'group_finance' | 'subsidiary_controller' | 'fpa' | 'admin';

export interface Subsidiary {
  code: string;
  name: string;
  currency: string;
  jurisdiction: string;
  fiscalYearStart: number; // month 1-12
  status: 'active' | 'onboarding' | 'suspended';
}

export interface BCTenant {
  subsidiaryCode: string;
  subsidiaryName: string;
  tenantId: string;
  clientId: string;
  certExpiry: string;
  authStatus: Status;
  lastAuthTest: string;
  apiVersion: string;
}

export interface PipelineRun {
  runId: string;
  subsidiaryCode: string;
  entity: string;
  startTime: string;
  endTime: string | null;
  duration: number | null; // seconds
  status: Status;
  loadType: LoadType;
  rowsExtracted: number;
  rowsWritten: number;
  watermark: string | null;
  errorMessage: string | null;
}

export interface DQException {
  id: string;
  runId: string;
  entity: string;
  subsidiaryCode: string;
  ruleId: string;
  ruleName: string;
  severity: Severity;
  rowsChecked: number;
  rowsFailed: number;
  passRate: number;
  timestamp: string;
  status: 'open' | 'resolved';
}

export interface CanonicalAccount {
  id: string;
  name: string;
  financialStatement: 'P&L' | 'Balance Sheet';
  accountType: 'Revenue' | 'Expense' | 'Asset' | 'Liability' | 'Equity';
  isIntercompany: boolean;
  parentId: string | null;
  level: number;
}

export interface AccountMapping {
  subsidiaryCode: string;
  localAccountNo: string;
  localAccountName: string;
  canonicalAccountId: string | null;
  status: 'mapped' | 'unmapped' | 'pending_approval';
  mappedBy: string | null;
  approvedBy: string | null;
  effectiveFrom: string | null;
}

export interface KPIMetric {
  label: string;
  value: number;
  previousValue?: number;
  unit: 'usd' | 'pct' | 'days' | 'count';
  trend: 'up' | 'down' | 'flat' | 'neutral';
  positiveDirection: 'up' | 'down'; // which direction is good
}

export interface ClosePeriodStatus {
  subsidiaryCode: string;
  subsidiaryName: string;
  pipelineStatus: Status;
  lastRunAt: string | null;
  dqStatus: Status;
  dqExceptionCount: number;
  mappingCoverage: number; // 0-100
  icStatus: 'matched' | 'unmatched' | 'no_ic';
  closeStatus: CloseStatus;
  signedOffBy: string | null;
  signedOffAt: string | null;
}

export interface ICEntry {
  entityA: string;
  entityB: string;
  canonicalAccount: string;
  period: string;
  debitAmount: number;
  creditAmount: number;
  variance: number;
  matched: boolean;
}

export interface FXRate {
  currencyPair: string;
  rateDate: string;
  rateType: 'PERIOD_END' | 'AVERAGE' | 'HISTORICAL';
  rateValue: number;
  source: string;
}

export interface SavedView {
  id: string;
  name: string;
  description: string;
  owner: string;
  visibility: 'private' | 'shared';
  filters: Record<string, unknown>;
  createdAt: string;
}

export interface OnboardingStep {
  id: number;
  label: string;
  status: 'complete' | 'active' | 'pending' | 'error';
}

export interface CircuitBreaker {
  subsidiaryCode: string;
  entity: string;
  state: 'closed' | 'open' | 'half_open';
  consecutiveFailures: number;
  lastFailureAt: string | null;
  openedAt: string | null;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  resource: string;
  entityScope: string;
  timestamp: string;
  sourceIp: string;
  statusCode: number;
}

export interface PowerBIConfig {
  reportId: string;
  embedUrl: string;
  accessToken: string;
  workspaceId: string;
}
