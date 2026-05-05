# PRD_02 — Multi-ERP Data Source Integration
## Feature Index (SPARC Methodology)

**PRD:** 01_prd/PRD_02.md
**Created:** 2026-04-29
**Version:** 1.0

---

## Phase 1 — MVP (BC + SAP S/4HANA Cloud + Odoo)

### Connector Framework
| Ticket | Feature | Priority | Owner | Status |
|--------|---------|---------|-------|--------|
| [ERP-CF-001](CF/ERP-CF-001_universal-connector-interface.md) | Universal Connector Interface | Critical | Meera_Architect_002 | Planned |
| [ERP-CF-002](CF/ERP-CF-002_credential-vault.md) | Credential Vault | Critical | Ishaan_Security_007 | Planned |
| [ERP-CF-003](CF/ERP-CF-003_connection-health-monitor.md) | Connection Health Monitor | High | Rohan_Backend_003 | Planned |
| [ERP-CF-004](CF/ERP-CF-004_field-mapping-ui.md) | Field Mapping UI | High | Ananya_Frontend_004 | Planned |
| [ERP-CF-005](CF/ERP-CF-005_incremental-sync.md) | Incremental Sync (Delta Load) | Critical | Rohan_Backend_003 | Planned |

### Data Normalization
| Ticket | Feature | Priority | Owner | Status |
|--------|---------|---------|-------|--------|
| [ERP-DN-001](DN/ERP-DN-001_currency-conversion.md) | Currency Conversion | High | Kiran_Data_008 | Planned |
| [ERP-DN-002](DN/ERP-DN-002_fiscal-year-alignment.md) | Fiscal Year Alignment | High | Kiran_Data_008 | Planned |
| [ERP-DN-003](DN/ERP-DN-003_account-code-normalization.md) | Account Code Normalization → Canonical CoA | High | Kiran_Data_008 | Planned |
| [ERP-DN-005](DN/ERP-DN-005_dimension-mapping.md) | Dimension Mapping | High | Kiran_Data_008 | Planned |

### Scheduler & Pipeline
| Ticket | Feature | Priority | Owner | Status |
|--------|---------|---------|-------|--------|
| [ERP-SP-001](SP/ERP-SP-001_configurable-sync-schedule.md) | Configurable Sync Schedule | High | Rohan_Backend_003 | Planned |
| [ERP-SP-003](SP/ERP-SP-003_audit-trail.md) | Audit Trail | High | Rohan_Backend_003 | Planned |
| [ERP-SP-004](SP/ERP-SP-004_failed-sync-alerts.md) | Failed Sync Alerts & Retry Logic | High | Rohan_Backend_003 | Planned |

### CFO Dashboard Enhancements
| Ticket | Feature | Priority | Owner | Status |
|--------|---------|---------|-------|--------|
| [ERP-DS-001](DS/ERP-DS-001_cross-erp-pl-comparison.md) | Cross-ERP P&L Comparison | Critical | Ananya_Frontend_004 | Planned |
| [ERP-DS-002](DS/ERP-DS-002_consolidated-dashboard.md) | Consolidated Dashboard | Critical | Ananya_Frontend_004 | Planned |
| [ERP-DS-004](DS/ERP-DS-004_data-freshness-indicator.md) | Data Freshness Indicator | High | Ananya_Frontend_004 | Planned |

### ERP Connectors (Phase 1)
| Ticket | Connector | Priority | Owner | Status |
|--------|-----------|---------|-------|--------|
| [ERP-CON-BC](CON/ERP-CON-BC_business-central-api.md) | Business Central REST API Upgrade | Critical | Rohan_Backend_003 | Planned |
| [ERP-CON-SAP](CON/ERP-CON-SAP_s4hana-connector.md) | SAP S/4HANA Cloud Connector | Critical | Rohan_Backend_003 | Planned |
| [ERP-CON-ODOO](CON/ERP-CON-ODOO_odoo-connector.md) | Odoo JSON-RPC Connector | Critical | Rohan_Backend_003 | Planned |

---

## Phase 2 — Full Platform

### Connector Framework
| Ticket | Feature | Priority | Owner | Status |
|--------|---------|---------|-------|--------|
| [ERP-CF-006](CF/ERP-CF-006_full-historical-backfill.md) | Full Historical Backfill | Medium | Rohan_Backend_003 | Planned |

### Data Normalization
| Ticket | Feature | Priority | Owner | Status |
|--------|---------|---------|-------|--------|
| [ERP-DN-004](DN/ERP-DN-004_intercompany-elimination.md) | Intercompany Elimination | Medium | Kiran_Data_008 | Planned |

### Scheduler & Pipeline
| Ticket | Feature | Priority | Owner | Status |
|--------|---------|---------|-------|--------|
| [ERP-SP-002](SP/ERP-SP-002_conflict-resolution.md) | Conflict Resolution | Medium | Rohan_Backend_003 | Planned |

### CFO Dashboard Enhancements
| Ticket | Feature | Priority | Owner | Status |
|--------|---------|---------|-------|--------|
| [ERP-DS-003](DS/ERP-DS-003_erp-benchmarking-kpis.md) | ERP-Specific Benchmarking KPIs | Low | Ananya_Frontend_004 | Planned |

### Reconciliation & Validation
| Ticket | Feature | Priority | Owner | Status |
|--------|---------|---------|-------|--------|
| [ERP-RV-001](RV/ERP-RV-001_trial-balance-reconciliation.md) | Cross-ERP Trial Balance Reconciliation | Medium | Kiran_Data_008 | Planned |
| [ERP-RV-002](RV/ERP-RV-002_variance-alerts.md) | Variance Alerts | Medium | Rohan_Backend_003 | Planned |
| [ERP-RV-003](RV/ERP-RV-003_data-quality-scoring.md) | Data Quality Scoring per ERP | Low | Kiran_Data_008 | Planned |
| [ERP-RV-004](RV/ERP-RV-004_missing-gl-code-detection.md) | Missing GL Code Detection | Low | Kiran_Data_008 | Planned |

### ERP Connectors (Phase 2)
| Ticket | Connector | Priority | Owner | Status |
|--------|-----------|---------|-------|--------|
| [ERP-CON-D365F](CON/ERP-CON-D365F_dynamics365-connector.md) | Microsoft Dynamics 365 Finance | High | Rohan_Backend_003 | Planned |
| [ERP-CON-JDE](CON/ERP-CON-JDE_jde-connector.md) | JD Edwards EnterpriseOne | Medium | Rohan_Backend_003 | Planned |
| [ERP-CON-ORACLE](CON/ERP-CON-ORACLE_oracle-erp-connector.md) | Oracle ERP Cloud | Medium | Rohan_Backend_003 | Planned |
| [ERP-CON-TALLY](CON/ERP-CON-TALLY_tally-connector.md) | Tally Prime Agent | Medium | Rohan_Backend_003 | Planned |

---

## Summary

| Phase | Features | Connectors | Total |
|-------|---------|----------|-------|
| Phase 1 | 15 | 3 | 18 |
| Phase 2 | 9 | 4 | 13 |
| **Total** | **24** | **7** | **31** |

---

## User Stories → Feature Mapping

| US | Story | Feature |
|----|-------|---------|
| US-01 | Universal connector interface | ERP-CF-001 |
| US-02 | SAP GL pull — no Excel | ERP-CON-SAP |
| US-03 | Consolidated P&L across ERPs | ERP-DS-002 |
| US-04 | Field mapping UI | ERP-CF-004 |
| US-05 | Multi-currency normalized to USD | ERP-DN-001 |
| US-06 | Data freshness indicator | ERP-DS-004 |
| US-07 | Credential vault — encrypted | ERP-CF-002 |
| US-08 | Sync audit log | ERP-SP-003 |
| US-09 | Trial balance reconciliation | ERP-RV-001 |
| US-10 | Tally on-premise agent | ERP-CON-TALLY |
| US-11 | Intercompany elimination | ERP-DN-004 |
| US-12 | Failed sync alerts | ERP-SP-004 |
| US-13 | Fiscal year alignment | ERP-DN-002 |
| US-14 | Data quality score per ERP | ERP-RV-003 |
| US-15 | ERP benchmarking KPIs | ERP-DS-003 |
