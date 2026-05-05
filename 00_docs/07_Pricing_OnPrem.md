# CFO360 — On-Premises Pricing & Server Requirements

**Document Type:** Pricing — On-Premises  
**Version:** 1.0.0  
**Status:** Draft  
**Date:** 2026-05-05  
**Owner:** Aarav_PM_001  
**Reviewers:** Meera_Architect_002, Kabir_Reviewer_010  
**Related:** [05_ConceptNote.md](05_ConceptNote.md) | [06_Pricing_Cloud.md](06_Pricing_Cloud.md)

---

## 1. Overview

CFO360 On-Premises (Self-Hosted) is deployed entirely within the customer's own data center or private cloud. The vendor supplies the software, container images, deployment runbooks, and support — the customer owns and operates the infrastructure.

This model is preferred by:
- Banks and NBFCs with strict data residency requirements
- Government and public sector entities
- Defence and regulated industries
- Enterprises with existing data center investments

---

## 2. On-Premises Architecture

```
Internal Corporate Network
         │
         ▼
  Internal DNS / Hardware Load Balancer
         │
         ▼
  Docker Host or Kubernetes Cluster
  ┌──────────────────────────────────┐
  │  iaf-nginx       port 80 / 443   │
  │  iaf-frontend    port 5173        │
  │  iaf-backend     port 8000        │
  │  iaf-postgres    port 5432        │
  │  iaf-minio       port 9000 / 9001 │
  │  iaf-redis       port 6379        │
  └──────────────────────────────────┘
         │
  Internal AD / LDAP  │  Internal SMTP
  ERP RFC / API endpoints (internal network)
```

---

## 3. On-Premises License Model

On-premises licenses are **perpetual with annual maintenance**, or available as **annual subscription**.

### 3.1 License Tiers

| Tier | Users | Entities | License Fee | Annual Maintenance |
|---|---|---|---|---|
| **Small** | Up to 20 | Up to 3 | ₹15,00,000 one-time | ₹3,00,000 / year (20%) |
| **Medium** | Up to 100 | Up to 10 | ₹35,00,000 one-time | ₹7,00,000 / year (20%) |
| **Enterprise** | Unlimited | Unlimited | ₹75,00,000 one-time | ₹15,00,000 / year (20%) |

**Annual subscription alternative** (includes support + updates, no large upfront):

| Tier | Annual Subscription |
|---|---|
| Small | ₹6,00,000 / year |
| Medium | ₹14,00,000 / year |
| Enterprise | ₹30,00,000 / year |

### 3.2 What Annual Maintenance Covers

- Software version upgrades (quarterly releases)
- Security patches and hotfixes
- Access to deployment runbooks and upgrade scripts
- Support portal access (ticket-based)
- 8×5 email support (standard); 24×7 available as add-on

---

## 4. Server Requirements

### 4.1 Small Deployment
**Scope:** 1–3 legal entities, up to 20 finance users

| Component | Minimum | Recommended |
|---|---|---|
| **CPU** | 8 vCPU | 16 vCPU |
| **RAM** | 16 GB | 32 GB |
| **Application Disk (OS + Docker)** | 100 GB SSD | 200 GB NVMe SSD |
| **Data Disk (PostgreSQL + MinIO)** | 500 GB SSD | 1 TB NVMe SSD |
| **Network** | 100 Mbps | 1 Gbps |
| **OS** | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| **Docker Engine** | v26+ | v26+ |
| **Topology** | Single host | 1 primary + 1 standby |

**Estimated infrastructure cost (customer-owned):** ₹3–6L one-time (server hardware)  
**Estimated cloud VM cost if on private cloud:** ₹15,000–25,000 / month (AWS/Azure equivalent)

---

### 4.2 Medium Deployment
**Scope:** 3–10 legal entities, up to 100 finance users

| Component | Minimum | Recommended |
|---|---|---|
| **CPU** | 16 vCPU | 32 vCPU |
| **RAM** | 32 GB | 64 GB |
| **Application Disk** | 200 GB SSD | 500 GB NVMe SSD |
| **Data Disk (PostgreSQL + MinIO)** | 2 TB SSD | 4 TB NVMe SSD |
| **Network** | 1 Gbps | 10 Gbps |
| **OS** | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| **Orchestration** | Docker Compose | Kubernetes 3-node |
| **Topology** | 2 nodes (app + DB separate) | 3+ node cluster |
| **Load Balancer** | Nginx | HAProxy or F5 |

**Estimated infrastructure cost (customer-owned):** ₹12–20L one-time  
**Estimated cloud VM cost if on private cloud:** ₹50,000–90,000 / month

---

### 4.3 Large / Enterprise Deployment
**Scope:** 10+ legal entities, 100+ users, full group consolidation

| Component | Specification |
|---|---|
| **Application Cluster** | 4–8 nodes, 32 vCPU / 64 GB RAM each |
| **Database Cluster** | PostgreSQL HA (Patroni) — 3 nodes (primary + 2 replicas), 32 vCPU / 128 GB RAM |
| **Object Storage (MinIO)** | Distributed mode — 4+ nodes, 8+ drives each, 20 TB+ raw |
| **Redis** | Redis Sentinel or Cluster — 3 nodes |
| **Load Balancer** | Dedicated hardware LB or HA Nginx pair |
| **Network** | 10 Gbps internal; isolated VLAN for DB |
| **Backup Storage** | Secondary NAS / tape + offsite / cloud cold storage |
| **DR Site** | Hot standby (secondary DC), RPO < 1h, RTO < 4h |
| **Orchestration** | Kubernetes v1.29+ |

**Estimated infrastructure cost (customer-owned):** ₹60–120L+ depending on HA requirements  
**Estimated private cloud cost:** ₹2,50,000–5,00,000 / month

---

## 5. Software Prerequisites

| Software | Version | Purpose |
|---|---|---|
| Ubuntu Server | 22.04 LTS | Host operating system |
| Docker Engine | 26.x | Container runtime |
| Docker Compose | v2.x | Orchestration (small deployments) |
| Kubernetes | 1.29+ | Orchestration (medium / enterprise) |
| PostgreSQL | 16.x | Primary relational database |
| Redis | 7.x | Cache and Celery task queue |
| MinIO | Latest stable | Object and document storage |
| Nginx | 1.25+ | Reverse proxy |
| Python | 3.11+ | Backend application runtime |
| Node.js | 20 LTS | Frontend asset build |

All software is open source or community edition — no additional third-party license costs.

---

## 6. Network & Security Requirements

| Requirement | Detail |
|---|---|
| **TLS / SSL** | Valid certificate required; internal CA accepted |
| **External exposure** | Only ports 80 / 443 exposed; all inter-container traffic stays internal |
| **ERP access** | App server must reach ERP API / RFC endpoints on internal network |
| **Bank API access** | Outbound HTTPS to banking APIs (if treasury module active) |
| **LDAP / AD** | Port 389 / 636 accessible for SSO and user sync |
| **SMTP relay** | Internal SMTP relay for report delivery and alerts |
| **Air-gapped option** | Available — requires offline AI model endpoint (additional setup fee) |

---

## 7. Implementation Services (On-Prem)

| Service | Small | Medium | Enterprise |
|---|---|---|---|
| **Infrastructure Assessment** | Self-service checklist | 1-week engagement | 2-week architecture review |
| **Deployment & Configuration** | Runbook + remote support | On-site 1 week | On-site 2–3 weeks |
| **ERP Integration Setup** | 1 connector, remote | Up to 3, guided | All connectors, managed |
| **Data Migration** | Not included | 1 year historical | 3 years historical |
| **User Acceptance Testing** | Not included | Supported | Fully managed |
| **Go-Live Hypercare** | 1 week remote | 2 weeks (mixed) | 4 weeks on-site |
| **Training** | Video + docs | 4 live sessions | Unlimited + ToT |
| **Implementation Fee** | ₹75,000 | ₹2,50,000 | Custom |

---

## 8. Ongoing Support Tiers (Annual)

| Support Tier | Coverage | SLA | Price |
|---|---|---|---|
| **Standard** | 8×5, ticket portal, email | 24h response | Included in maintenance |
| **Premium** | 8×5, phone + email + remote | 4h response | ₹2,00,000 / year |
| **Enterprise 24×7** | 24×7, dedicated engineer | 1h critical / 4h major | ₹5,00,000 / year |

---

## 9. Upgrade & Patch Process

| Activity | Frequency | Who | How |
|---|---|---|---|
| Security patches | Monthly | Customer IT | Vendor-supplied patch package |
| Minor version upgrades | Quarterly | Customer IT + vendor support | Docker image pull + restart |
| Major version upgrades | Annually | Vendor-led | On-site or remote upgrade sprint |
| Database migrations | With each release | Automated (Alembic) | Run via deployment script |
| Health monitoring | 24×7 | Customer IT | Vendor-supplied runbook + Grafana dashboards |

---

## 10. Total Cost of Ownership — Indicative 3-Year TCO

### Small Deployment (20 users, 2 entities, perpetual license)

| Item | Cost |
|---|---|
| License (one-time) | ₹15,00,000 |
| Annual maintenance (yr 1–3) | ₹9,00,000 |
| Implementation | ₹75,000 |
| Server hardware (estimated) | ₹5,00,000 |
| **3-Year TCO** | **₹29,75,000** |

*vs Cloud (Starter, 20 users × ₹8K × 36 months): ₹57,60,000 — **On-prem saves ~₹28L over 3 years***

---

### Medium Deployment (50 users, 5 entities, perpetual license)

| Item | Cost |
|---|---|
| License (one-time) | ₹35,00,000 |
| Annual maintenance (yr 1–3) | ₹21,00,000 |
| Implementation | ₹2,50,000 |
| Server hardware (estimated) | ₹15,00,000 |
| **3-Year TCO** | **₹73,50,000** |

*vs Cloud (Professional, 50 users × ₹18K × 36 months): ₹3,24,00,000 — **On-prem saves ~₹2.5Cr over 3 years***

---

## 11. Decision Guide: Cloud vs On-Prem

| Factor | Choose Cloud | Choose On-Prem |
|---|---|---|
| IT team size | Small / no dedicated team | Dedicated IT / infra team |
| Data residency | Flexible | Strict — data cannot leave premises |
| Budget type | OpEx preferred | CapEx available |
| Time to go-live | Fast (days) | Longer (weeks) |
| Customization | Configuration only | Deep customization possible |
| Internet dependency | Acceptable | Cannot depend on internet |
| Sector | Private sector, SME | Banking, Govt, Defence, Regulated |
| 3-year cost | Higher | Lower (after Year 1) |

---

*Document Owner: Aarav_PM_001 | Reviewer: Kabir_Reviewer_010 | Next Review: 2026-06-05*
