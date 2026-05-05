# i-finsights — Cloud (SaaS) Pricing & Subscription Model

**Product:** i-finsights  
**Document Type:** Pricing — Cloud  
**Version:** 1.0.0  
**Status:** Draft — For Review  
**Date:** 2026-05-05  
**Prepared by:** i-Source Infosystems  
**Prepared for:** RIA Advisory  
**Related:** [05_ConceptNote.md](05_ConceptNote.md) | [07_Pricing_OnPrem.md](07_Pricing_OnPrem.md)

---

## 1. Overview

i-finsights SaaS is a fully managed cloud deployment hosted on Azure — co-located with Microsoft Business Central tenants for minimal API latency. RIA Advisory users access the platform via browser using their existing **Azure Entra ID (Microsoft 365) credentials** — no new passwords, no separate identity provider.

All tiers are priced **per active user per month**, billed annually. Monthly billing available at +20%.

---

## 2. Cloud Architecture

```
RIA Advisory Users (Browser / Mobile)
        │  Azure Entra ID SSO (existing M365 credentials)
        ▼
Azure CDN + Load Balancer (SSL/TLS 1.3)
        │
        ├── Netlify (React Frontend)
        │
        └── Azure Container Apps (FastAPI Backend)
                   │
            Azure PostgreSQL (Star Schema)
                   │
        17 BC Tenants (OData API v2.0 — Azure-to-Azure, low latency)
```

**Why Azure:**
- BC tenants run on Azure — co-location means faster API calls, no cross-cloud latency
- Entra ID SSO works out of the box — no new credentials for RIA Advisory users
- Azure PostgreSQL — managed, HA, automated backups, point-in-time restore

---

## 3. Subscription Tiers

### 3.1 Tier Comparison

| Feature | **Starter** | **Professional** | **Enterprise** |
|---|---|---|---|
| **Price** | ₹6,000 / user / month | ₹14,000 / user / month | Custom |
| **Minimum Users** | 3 | 5 | 10 |
| **BC Tenants (Subsidiaries)** | Up to 5 | Up to 17 | Unlimited |
| **Pipeline Runs** | Daily | Every 4 hours | Real-time + On-demand |
| **Dashboards** | Executive + Entity Detail | All dashboards | All + custom |
| **Reports** | 10 standard | All 22 reports | All + custom |
| **Analytics** | Basic | Multi-dimensional | Full workbench |
| **GL Explorer** | Yes (read) | Yes + export | Yes + export + API |
| **Close Cockpit** | No | Yes | Yes |
| **IC Elimination** | Automated | Automated + audit | Automated + audit + rules engine |
| **FX Translation** | USD only | Multi-currency | Multi-currency + custom rates |
| **Data Retention** | 12 months | 36 months | 7 years |
| **Data Lineage** | Summary | Column-level | Column-level + impact analysis |
| **Azure Entra ID SSO** | Yes | Yes | Yes |
| **RBAC Roles** | 3 roles | All 5 roles | All 5 + custom |
| **API Access** | No | Read-only | Full read/write |
| **SLA** | 99.5% | 99.9% | 99.95% |
| **Support** | Email (48h) | Priority email + chat | Dedicated CSM + 4h SLA |
| **Audit Trail** | 90 days | 1 year | 7 years |
| **Custom Branding** | No | No | Yes |
| **On-prem option** | No | No | Available (separate agreement) |

---

### 3.2 Starter — ₹6,000 / user / month

**Best for:** Single-entity pilots, small finance teams, proof-of-concept deployments.

**Includes:**
- Up to 5 BC subsidiaries
- Daily pipeline runs
- Executive Dashboard + Entity Detail
- 10 standard reports (P&L, Trial Balance, Balance Sheet, AR/AP, Cash Flow, KPI)
- GL Explorer (read)
- Azure Entra ID SSO
- 12 months data retention
- Email support (48h SLA)
- Video library + documentation

**Minimum annual commitment:** 3 users × ₹6,000 × 12 months = **₹2,16,000 / year**

---

### 3.3 Professional — ₹14,000 / user / month

**Best for:** Active finance teams, full close automation, all 17 BC tenants, multi-currency.

**Includes everything in Starter, plus:**
- Up to 17 BC subsidiaries (full RIA Advisory scope)
- Pipeline runs every 4 hours
- All dashboards including Close Cockpit
- All 22 standard reports
- Full multi-dimensional analytics workbench
- GL Explorer with export
- Complete IC Elimination with per-run audit log
- Multi-currency FX translation
- Close Cockpit — entity sign-off, IC reconciliation, Controller approval
- 36 months data retention
- Column-level data lineage
- All 5 RBAC roles
- Read-only API access
- Priority email + chat support
- 4 live onboarding and training sessions
- SSO role mapping to Azure AD groups

**Minimum annual commitment:** 5 users × ₹14,000 × 12 months = **₹8,40,000 / year**

---

### 3.4 Enterprise — Custom Pricing

**Best for:** Large group structures, regulated entities, custom analytics requirements.

**Includes everything in Professional, plus:**
- Unlimited BC subsidiaries
- Real-time pipeline + on-demand triggers
- Custom reports and dashboard modules
- Full read/write API access
- 7-year data retention and audit trail
- 99.95% SLA with dedicated infrastructure
- Dedicated Customer Success Manager
- 4-hour incident response SLA
- Custom branding and white-label option
- Unlimited training including train-the-trainer
- On-premises deployment option (separate agreement)
- Custom IC elimination rule sets
- Custom FX rate sources

**Pricing:** Contact i-Source Infosystems for a tailored proposal.

---

## 4. Add-On Modules

Available across all tiers:

| Add-On | Price | Description |
|---|---|---|
| Additional BC tenant (beyond tier limit) | ₹8,000 / tenant / month | Each additional subsidiary |
| AI variance commentary | ₹10,000 / month | Auto-drafted narrative on P&L variances |
| Natural language query (full) | ₹8,000 / month | Ask financial questions in plain English |
| WhatsApp / Slack / Teams daily briefing | ₹5,000 / month | CFO digest delivered to messaging apps |
| Custom report template | ₹15,000 one-time | Per board-quality report template |
| Extra historical data migration | ₹25,000 / year of data | Beyond tier default |
| Power BI embedded reports | ₹12,000 / month | Embedded Power BI visuals in dashboards |
| 24×7 support upgrade | ₹3,00,000 / year | For Starter and Professional tiers |

---

## 5. Implementation & Onboarding

| Service | Starter | Professional | Enterprise |
|---|---|---|---|
| **BC Tenant Connection Setup** | Self-serve (docs + wizard) | Guided — 1 week | Managed — 2 to 3 weeks |
| **CoA and Dimension Mapping** | Self-serve via console | Guided — i-Source assists | Fully managed by i-Source |
| **Historical Data Migration** | Not included | 1 year | 3 years |
| **User and Role Setup** | Self-serve | Guided | Managed |
| **Azure Entra ID SSO Configuration** | Self-serve | Guided | Managed |
| **User Training** | Video library | 4 live sessions | Unlimited + train-the-trainer |
| **Go-Live Hypercare** | Not included | 2-week remote | 4-week mixed (on-site + remote) |
| **One-time Implementation Fee** | ₹40,000 | ₹1,20,000 | Custom |

---

## 6. SLA & Security

| Attribute | Value |
|---|---|
| **Uptime SLA** | 99.5% (Starter) / 99.9% (Pro) / 99.95% (Enterprise) |
| **Data Encryption** | AES-256 at rest; TLS 1.3 in transit |
| **Auth** | Azure Entra ID SSO (MSAL) + JWT (HS256, 60-min access tokens) |
| **Data Residency** | Azure India (South / Central) — EU on request |
| **Backup** | Daily automated PostgreSQL snapshots, 30-day retention |
| **Point-in-time restore** | Up to 35 days (Azure managed) |
| **DR / RTO** | < 4 hours (Azure multi-AZ) |
| **BC Credential Storage** | Encrypted at rest; Azure Key Vault in production |
| **Audit Log** | All data access logged with user, timestamp, query, and IP |
| **RBAC** | Role enforced at API layer — every query filtered by tenant_id + role |

---

## 7. Billing Terms

- **Annual billing:** Invoiced upfront. 10% discount vs monthly equivalent.
- **Monthly billing:** Available at +20% per-user premium.
- **Overages:** Add-on modules billed monthly on actuals.
- **Upgrades:** Prorated. Effective immediately on written request.
- **Downgrades:** Effective at next renewal period.
- **Cancellation:** 30-day written notice. No refund on annual pre-payment.
- **Currency:** INR. USD pricing available.

---

## 8. Indicative Annual Cost — RIA Advisory Scenarios

| Scenario | Users | Tier | BC Tenants | Est. Annual Cost |
|---|---|---|---|---|
| Pilot — 3 entities only | 3 | Starter | 3 | ₹2,16,000 + ₹40K impl |
| Core finance team — all 17 BC | 8 | Professional | 17 | ₹13,44,000 + ₹1,20K impl |
| Full Group — CFO + all controllers | 20 | Professional | 17 | ₹33,60,000 + ₹1,20K impl |
| Enterprise with custom modules | 30+ | Enterprise | Unlimited | Custom |

---

*Document prepared by i-Source Infosystems for RIA Advisory | Version 1.0.0 | 2026-05-05*
