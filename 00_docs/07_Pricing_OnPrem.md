# i-finsights — On-Premises Pricing & Server Requirements

**Product:** i-finsights  
**Document Type:** Pricing — On-Premises  
**Version:** 1.0.0  
**Status:** Draft — For Review  
**Date:** 2026-05-05  
**Prepared by:** i-Source Infosystems  
**Prepared for:** RIA Advisory  
**Related:** [05_ConceptNote.md](05_ConceptNote.md) | [06_Pricing_Cloud.md](06_Pricing_Cloud.md)

---

## 1. Overview

i-finsights On-Premises (Self-Hosted) is deployed entirely within RIA Advisory's own data center or private Azure subscription. i-Source Infosystems supplies the software container images, deployment runbooks, migration scripts, and ongoing support — RIA Advisory owns and operates the infrastructure.

**When to choose this model:**
- Strict data residency — financial data must not leave RIA Advisory's own infrastructure
- Group IT policy requires self-hosted software
- RIA Advisory has existing data center or Azure private subscription capacity
- Regulatory requirement (banking, government, regulated financial services)

> Note: For most organisations at RIA Advisory's scale, the **Cloud (SaaS) model is recommended** — lower TCO in Year 1, zero infrastructure management, Azure-native for BC API access. See [06_Pricing_Cloud.md](06_Pricing_Cloud.md).

---

## 2. On-Premises Architecture

```
RIA Advisory Internal Network or Private Azure VNet
        │
        ▼
Internal DNS / Load Balancer (Nginx or hardware LB)
        │
        ▼
Docker Host or Azure Container Instance (Customer-managed)
┌──────────────────────────────────────────┐
│  nginx             port 80 / 443          │
│  Frontend (React)  port 5173              │
│  Backend (FastAPI) port 8000              │
│  PostgreSQL        port 5432              │
│  MinIO (storage)   port 9000 / 9001       │
│  Redis (cache)     port 6379              │
└──────────────────────────────────────────┘
        │
Azure Entra ID (external — MSAL SSO still works via outbound HTTPS)
        │
17 BC Tenants (OData API — intranet or Azure VNet peered)
```

---

## 3. On-Premises License Model

On-premises licenses are **perpetual with annual maintenance**, or available as **annual subscription** (no large upfront payment).

### 3.1 License Tiers

| Tier | BC Tenants | Users | Perpetual License | Annual Maintenance (20%) |
|---|---|---|---|---|
| **Growth** | Up to 5 | Up to 20 | ₹10,00,000 | ₹2,00,000 / year |
| **Professional** | Up to 17 | Up to 100 | ₹25,00,000 | ₹5,00,000 / year |
| **Enterprise** | Unlimited | Unlimited | ₹55,00,000 | ₹11,00,000 / year |

### 3.2 Annual Subscription Alternative

For organisations preferring OpEx over CapEx (no large upfront):

| Tier | Annual Subscription (includes updates + support) |
|---|---|
| Growth | ₹4,50,000 / year |
| Professional | ₹11,00,000 / year |
| Enterprise | ₹24,00,000 / year |

### 3.3 What Annual Maintenance Covers

- Quarterly software version upgrades
- Security patches and hotfixes (monthly delivery)
- Access to deployment runbooks, upgrade scripts, and migration files
- Support portal access (ticket-based)
- 8×5 email support (standard); 24×7 available as add-on (see Section 8)

---

## 4. Server Requirements

### 4.1 Growth Deployment
**Scope:** Up to 5 BC subsidiaries, up to 20 finance users

| Component | Minimum | Recommended |
|---|---|---|
| **CPU** | 4 vCPU | 8 vCPU |
| **RAM** | 8 GB | 16 GB |
| **Application Disk (OS + Docker + app)** | 50 GB SSD | 100 GB NVMe SSD |
| **Data Disk (PostgreSQL + MinIO)** | 200 GB SSD | 500 GB NVMe SSD |
| **Network** | 100 Mbps | 1 Gbps |
| **OS** | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| **Docker Engine** | v26+ | v26+ |
| **Topology** | Single host | 1 primary + 1 standby |

**Estimated Azure VM cost (customer subscription):** ~₹8,000–15,000 / month (B4ms equivalent)  
**Estimated bare-metal server cost:** ₹2–4L one-time

---

### 4.2 Professional Deployment
**Scope:** All 17 BC subsidiaries, up to 100 finance users — full RIA Advisory scope

| Component | Minimum | Recommended |
|---|---|---|
| **CPU** | 8 vCPU | 16 vCPU |
| **RAM** | 16 GB | 32 GB |
| **Application Disk** | 100 GB SSD | 200 GB NVMe SSD |
| **Data Disk (PostgreSQL + MinIO)** | 500 GB SSD | 1 TB NVMe SSD |
| **Network** | 1 Gbps | 1 Gbps |
| **OS** | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| **Docker / Container** | Docker Compose | Docker Compose or ACI |
| **Topology** | 1 application host | 2 nodes: app + DB separate |
| **Load Balancer** | Nginx (included) | Nginx or Azure App Gateway |

**Estimated Azure VM cost (customer subscription):** ~₹20,000–35,000 / month (D8s_v3 equivalent)  
**Estimated bare-metal server cost:** ₹6–10L one-time

---

### 4.3 Enterprise Deployment
**Scope:** Unlimited subsidiaries, 100+ users, HA required

| Component | Specification |
|---|---|
| **Application Nodes** | 2–4 nodes, 16 vCPU / 32 GB RAM each |
| **Database** | PostgreSQL HA (Patroni or Azure PostgreSQL Flexible Server) — 1 primary + 1–2 replicas |
| **Object Storage** | MinIO distributed or Azure Blob Storage (private endpoint) |
| **Redis** | Redis Sentinel — 2 nodes |
| **Load Balancer** | Azure Application Gateway or HA Nginx pair |
| **Network** | Isolated VNet/VLAN for DB nodes |
| **Backup** | Daily automated snapshots → Azure Blob cold tier |
| **DR** | Secondary region or standby, RPO < 1h, RTO < 4h |
| **Orchestration** | Docker Compose (standard) or AKS (large) |

**Estimated Azure cost (customer subscription):** ₹60,000–1,20,000 / month  
**Estimated bare-metal cost:** ₹20–40L one-time infrastructure

---

## 5. Software Prerequisites

All software is open source or community edition — no additional third-party licensing.

| Software | Version | Purpose |
|---|---|---|
| Ubuntu Server | 22.04 LTS | Host operating system |
| Docker Engine | 26.x | Container runtime |
| Docker Compose | v2.x | Service orchestration (Growth / Professional) |
| PostgreSQL | 16.x | Primary star schema database |
| Redis | 7.x | API response cache |
| MinIO | Latest stable | Object and document storage |
| Nginx | 1.25+ | Reverse proxy and SSL termination |
| Python | 3.11+ | FastAPI backend runtime |
| Node.js | 20 LTS | React frontend build (build-time only) |

---

## 6. Network & Security Requirements

| Requirement | Detail |
|---|---|
| **TLS / SSL** | Valid certificate required; Azure-issued or internal CA accepted |
| **External exposure** | Only ports 80 / 443 exposed; inter-container traffic stays internal |
| **BC API access** | App server must reach BC OData endpoints — outbound HTTPS to `api.businesscentral.dynamics.com` |
| **Azure Entra ID** | Outbound HTTPS to `login.microsoftonline.com` for MSAL SSO (even on-prem) |
| **SMTP relay** | Internal or external SMTP for system notifications and alerts |
| **Firewall** | Inbound: 80/443 only. Outbound: BC API + Entra ID endpoints |
| **Air-gapped** | Not recommended — BC and Entra ID require outbound internet. Contact i-Source if fully air-gapped. |

---

## 7. Implementation Services

| Service | Growth | Professional | Enterprise |
|---|---|---|---|
| **Infrastructure Assessment** | Self-service checklist | 3-day remote review | 1-week architecture review |
| **Deployment & Configuration** | Runbook + remote support | Remote — 1 week | On-site — 2 weeks |
| **BC Tenant Connection Setup** | Up to 5, self-serve | All 17, guided | All, managed |
| **CoA and Dimension Mapping** | Self-serve via console | Guided by i-Source | Fully managed |
| **Historical Data Migration** | Not included | 1 year | 3 years |
| **User and Role Configuration** | Self-serve | Guided | Managed |
| **UAT Support** | Not included | Remote support | Fully managed UAT |
| **Go-Live Hypercare** | 1 week remote | 2 weeks remote | 4 weeks (on-site + remote) |
| **Training** | Video + docs | 4 live sessions | Unlimited + train-the-trainer |
| **One-time Implementation Fee** | ₹60,000 | ₹2,00,000 | Custom |

---

## 8. Ongoing Support Tiers (Annual)

| Tier | Coverage | Response SLA | Annual Price |
|---|---|---|---|
| **Standard** | 8×5, ticket portal + email | 24h response | Included in maintenance |
| **Premium** | 8×5, phone + email + remote | 4h response | ₹1,50,000 / year |
| **Enterprise 24×7** | 24×7, dedicated engineer | 1h critical / 4h major | ₹4,00,000 / year |

---

## 9. Upgrade & Maintenance Process

| Activity | Frequency | Who | How |
|---|---|---|---|
| Security patches | Monthly | Customer IT | i-Source-supplied Docker image update |
| Minor version upgrades | Quarterly | Customer IT + i-Source support | Docker pull + compose up + migration scripts |
| Major version upgrades | Annually | i-Source-led | On-site or remote upgrade sprint |
| DB schema migrations | With each release | Automated (Alembic) | Executed by deployment script |
| Pipeline ETL updates | With each release | Automated | Part of Docker image |
| BC API compatibility | As Microsoft releases | i-Source patches | Security update channel |

---

## 10. 3-Year Total Cost of Ownership

### Growth — 5 BC Subsidiaries, 10 Users

| Item | Cost |
|---|---|
| Perpetual license | ₹10,00,000 |
| Annual maintenance (yr 1–3) | ₹6,00,000 |
| Implementation | ₹60,000 |
| Azure VM (₹12K/month × 36) | ₹4,32,000 |
| **3-Year On-Prem TCO** | **₹20,92,000** |

*vs Cloud Starter (10 users × ₹6K × 36 months): ₹21,60,000 — roughly equivalent.*

---

### Professional — All 17 BC Subsidiaries, 20 Users

| Item | Cost |
|---|---|
| Perpetual license | ₹25,00,000 |
| Annual maintenance (yr 1–3) | ₹15,00,000 |
| Implementation | ₹2,00,000 |
| Azure VM (₹30K/month × 36) | ₹10,80,000 |
| **3-Year On-Prem TCO** | **₹52,80,000** |

*vs Cloud Professional (20 users × ₹14K × 36 months): ₹1,00,80,000 — **On-prem saves ~₹48L over 3 years***

---

## 11. Cloud vs On-Premises — Decision Guide

| Factor | Choose Cloud | Choose On-Prem |
|---|---|---|
| Data residency | Flexible | Must stay within RIA premises |
| IT team | Small or none | Dedicated IT team available |
| Budget type | OpEx preferred | CapEx budget available |
| Time to go-live | Days (self-serve) | Weeks |
| Maintenance | i-Source managed | Customer IT managed |
| BC API latency | Lowest (Azure-to-Azure) | Acceptable if VNet-peered |
| Entra ID SSO | Native, zero config | Works (requires outbound internet) |
| 3-year cost (20 users, 17 BC) | ~₹1,00,80,000 | ~₹52,80,000 |
| Year 1 cash outlay | Lower (OpEx) | Higher (licence + impl) |
| Upgrade effort | Zero | Quarterly IT effort |

---

*Document prepared by i-Source Infosystems for RIA Advisory | Version 1.0.0 | 2026-05-05*
