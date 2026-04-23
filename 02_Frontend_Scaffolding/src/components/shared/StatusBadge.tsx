import React from 'react';
import type { Status, Severity } from '../../types';

interface StatusBadgeProps {
  status?: Status;
  severity?: Severity;
  label?: string;
}

const statusConfig: Record<Status, { cls: string; dot: string; label: string }> = {
  success:  { cls: 'badge-success', dot: '●', label: 'Success' },
  warning:  { cls: 'badge-warning', dot: '●', label: 'Warning' },
  error:    { cls: 'badge-error',   dot: '●', label: 'Error' },
  running:  { cls: 'badge-info',    dot: '◌', label: 'Running' },
  pending:  { cls: 'badge-muted',   dot: '○', label: 'Pending' },
  idle:     { cls: 'badge-muted',   dot: '○', label: 'Idle' },
};

const severityConfig: Record<Severity, { cls: string; label: string }> = {
  critical: { cls: 'badge-error',   label: 'Critical' },
  warning:  { cls: 'badge-warning', label: 'Warning' },
  info:     { cls: 'badge-info',    label: 'Info' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, severity, label }) => {
  if (severity) {
    const cfg = severityConfig[severity];
    return <span className={`badge ${cfg.cls}`}>{label ?? cfg.label}</span>;
  }
  if (status) {
    const cfg = statusConfig[status];
    return <span className={`badge ${cfg.cls}`}><span>{cfg.dot}</span>{label ?? cfg.label}</span>;
  }
  return null;
};
