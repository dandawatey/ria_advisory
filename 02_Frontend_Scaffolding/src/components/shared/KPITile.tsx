import React from 'react';
import type { KPIMetric } from '../../types';

interface KPITileProps {
  metric: KPIMetric;
  onClick?: () => void;
}

function formatValue(value: number, unit: KPIMetric['unit']): string {
  switch (unit) {
    case 'usd':
      if (Math.abs(value) >= 1_000_000)
        return `$${(value / 1_000_000).toFixed(1)}M`;
      if (Math.abs(value) >= 1_000)
        return `$${(value / 1_000).toFixed(0)}K`;
      return `$${value.toFixed(0)}`;
    case 'pct':
      return `${value.toFixed(1)}%`;
    case 'days':
      return `${value.toFixed(1)}d`;
    case 'count':
      return value.toLocaleString();
    default:
      return String(value);
  }
}

export const KPITile: React.FC<KPITileProps> = ({ metric, onClick }) => {
  const delta = metric.value - metric.previousValue;
  const deltaPct = metric.previousValue !== 0
    ? ((delta / Math.abs(metric.previousValue)) * 100).toFixed(1)
    : '–';

  const isPositive = delta >= 0;
  const isGood = metric.positiveDirection === 'up' ? isPositive : !isPositive;
  const deltaClass = delta === 0 ? '' : isGood ? 'kpi-delta-up' : 'kpi-delta-down';
  const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';

  return (
    <div
      className="kpi-tile"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="kpi-label">{metric.label}</div>
      <div className="kpi-value">{formatValue(metric.value, metric.unit)}</div>
      <div className={`kpi-meta ${deltaClass}`}>
        {delta !== 0 && <span>{arrow} {Math.abs(Number(deltaPct))}% vs prior period</span>}
        {delta === 0 && <span className="text-muted">No change vs prior period</span>}
      </div>
    </div>
  );
};
