# CFO360 — Cloud (SaaS) Pricing & Subscription Model

**Document Type:** Pricing — Cloud  
**Version:** 1.0.0  
**Status:** Draft  
**Date:** 2026-05-05  
**Owner:** Aarav_PM_001  
**Reviewers:** Kabir_Reviewer_010  
**Related:** [05_ConceptNote.md](05_ConceptNote.md) | [07_Pricing_OnPrem.md](07_Pricing_OnPrem.md)

---

## 1. Overview

CFO360 SaaS is a fully managed, multi-tenant cloud deployment hosted on AWS / Azure. Customers access the platform via browser or mobile with SSO — zero infrastructure required.

All tiers are priced **per active user per month**, billed annually. Month-to-month billing available at a 20% premium.

---

## 2. Cloud Architecture

```
Customer Browser / Mobile
         │
         ▼
    CDN (CloudFront / Azure CDN)
         │
         ▼
    Load Balancer (SSL termination)
         │
     ┌───┴───┐
     │ Nginx  │  ← Port 443 (HTTPS)
     └───┬───┘
         │
    ┌────┴──────────────────────┐
    │ Frontend   React / Vite    │
    │ Backend    FastAPI          │
    │ PostgreSQL RDS / Azure DB  │
    │ Redis      ElastiCache      │
    │ MinIO      S3 / Blob Store  │
    └───────────────────────────┘
         │
    Multi-AZ  │  99.9%+ SLA  │  SOC 2 + ISO 27001
```

---

## 3. Subscription Tiers

### 3.1 Tier Comparison

| Feature | **Starter** | **Professional** | **Enterprise** |
|---|---|---|---|
| **Price** | ₹8,000 / user / month | ₹18,000 / user / month | Custom |
| **Minimum Users** | 3 | 5 | 10 |
| **Entities / Legal Entities** | 1 | Up to 5 | Unlimited |
| **ERP Connectors** | 1 | Up to 3 | Unlimited |
| **AI Agents** | CashAgent, FPAAgent | All 8 agents | All agents + custom agents |
| **Conversational CFO Chat** | Basic | Advanced | Advanced + Voice |
| **Board Pack Generation** | Manual trigger | Scheduled + Manual | Scheduled + Manual + API |
| **Consolidation** | Single entity | Multi-entity | Full group consolidation |
| **FX / Multi-currency** | No | Yes | Yes |
| **Custom Dashboards** | 3 | 10 | Unlimited |
| **Data Retention** | 12 months | 36 months | 7 years |
| **API Access** | No | Read-only | Full read/write |
| **SLA** | 99.5% | 99.9% | 99.95% |
| **Support** | Email (48h SLA) | Priority email + chat | Dedicated CSM + 4h SLA |
| **SSO / SAML** | No | Yes | Yes |
| **Audit Trail** | 90 days | 1 year | 7 years |
| **Custom Branding** | No | No | Yes |
| **On-prem option** | No | No | Yes (separate agreement) |

---

### 3.2 Starter — ₹8,000 / user / month

**Best for:** Single-entity companies, early-stage finance teams, pilot deployments.

**Includes:**
- 1 legal entity
- 1 ERP connector (Business Central or Dynamics 365)
- CashAgent + FPAAgent
- Real-time cash position dashboard
- Budget vs actuals reporting
- 3 custom dashboard tiles
- 12 months data retention
- Email support (48h SLA)
- Video library training

**Minimum commitment:** 3 users × 12 months = ₹2,88,000 / year

---

### 3.3 Professional — ₹18,000 / user / month

**Best for:** Multi-entity mid-market companies, active FP&A teams, board reporting needs.

**Includes everything in Starter, plus:**
- Up to 5 legal entities
- Up to 3 ERP connectors
- All 8 AI agents (Cash, FPA, Close, Risk, Tax, Report, Audit, Treasury)
- Advanced conversational CFO interface
- Multi-entity consolidation
- FX / multi-currency support
- 10 custom dashboard tiles
- Scheduled board pack generation
- 36 months data retention
- Read-only API access
- Priority email + chat support
- 4 live training sessions
- SSO / SAML integration

**Minimum commitment:** 5 users × 12 months = ₹10,80,000 / year

---

### 3.4 Enterprise — Custom Pricing

**Best for:** Large enterprises, group holding companies, banks, regulated industries.

**Includes everything in Professional, plus:**
- Unlimited entities and ERP connectors
- Custom AI agents built to specification
- Voice-enabled CFO interface
- Full group consolidation with minority interest
- Full read/write API access
- 7-year data retention and audit trail
- 99.95% SLA
- Dedicated Customer Success Manager
- 4-hour incident response SLA
- Custom branding and white-label option
- Unlimited training and train-the-trainer
- On-premises deployment option (separate agreement)

**Pricing:** Based on entity count, user count, connector count, and support tier. Contact sales.

---

## 4. Add-On Modules

Available across all tiers:

| Add-On | Price | Notes |
|---|---|---|
| Additional ERP connector | ₹25,000 / month | Beyond tier limit |
| Additional legal entity | ₹5,000 / entity / month | Beyond tier limit |
| TaxAgent (GST / TDS automation) | ₹12,000 / month | — |
| AuditAgent (internal audit sampling) | ₹15,000 / month | — |
| Advanced AI narrative (Claude Opus) | ₹10,000 / month | Richer board pack prose |
| WhatsApp / Slack / Teams briefings | ₹5,000 / month | Daily CFO digest delivery |
| Custom report templates | ₹20,000 one-time | Per template |
| Historical data migration (extra years) | ₹30,000 / year of data | Beyond tier default |

---

## 5. Implementation & Onboarding

| Service | Starter | Professional | Enterprise |
|---|---|---|---|
| **ERP Integration Setup** | Self-serve (docs + videos) | Guided — 2 weeks | Managed — 4 to 8 weeks |
| **Historical Data Migration** | Not included | 1 year | 3 years |
| **User Training** | Video library | 4 live sessions | Unlimited + train-the-trainer |
| **Go-Live Support** | Not included | 2-week hypercare | 4-week hypercare |
| **One-time Implementation Fee** | ₹50,000 | ₹1,50,000 | Custom |

---

## 6. Cloud Deployment SLA & Security

| Attribute | Value |
|---|---|
| **Uptime SLA** | 99.5% (Starter) / 99.9% (Pro) / 99.95% (Enterprise) |
| **Data Encryption** | AES-256 at rest; TLS 1.3 in transit |
| **Certifications** | SOC 2 Type II, ISO 27001 |
| **Data Residency** | India (Mumbai region) — EU on request |
| **Backup** | Daily automated snapshots, 30-day retention |
| **DR / RTO** | < 4 hours (multi-AZ failover) |
| **Penetration Testing** | Annual third-party pentest; reports shared on NDA |
| **GDPR / DPDP India** | Compliant — DPA available on request |

---

## 7. Billing Terms

- **Annual billing:** Invoiced upfront for the full year. 10% discount vs monthly.
- **Monthly billing:** Available at +20% premium on per-user rate.
- **Overages:** Add-on modules billed monthly on actuals.
- **Upgrades:** Prorated. Effective immediately on request.
- **Downgrades:** Effective at next renewal period.
- **Cancellation:** 30-day notice required. No refund on annual pre-payment.
- **Currency:** INR. USD pricing available for international entities.

---

## 8. Indicative Annual Cost Examples

| Scenario | Users | Tier | ERP Connectors | Est. Annual Cost |
|---|---|---|---|---|
| Startup CFO pilot | 3 | Starter | 1 (BC) | ₹2,88,000 + ₹50K impl |
| Mid-market company | 8 | Professional | 2 (SAP + BC) | ₹17,28,000 + ₹1,50K impl |
| Group holding (5 entities) | 15 | Professional | 3 | ₹32,40,000 + impl |
| Large enterprise | 30+ | Enterprise | Unlimited | Custom |

---

*Document Owner: Aarav_PM_001 | Reviewer: Kabir_Reviewer_010 | Next Review: 2026-06-05*
