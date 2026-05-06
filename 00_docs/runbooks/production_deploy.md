# Production Deployment Runbook — i-CFO360

**IC-48 | Owner:** Neha_DevOps_006
**Target:** Ubuntu 22.04 LTS — 4 vCPU, 16 GB RAM, 500 GB SSD
**Stack:** Docker + docker-compose.prod.yml + Nginx SSL

---

## Prerequisites

Install on the production server:
- Docker Engine 24+ and Docker Compose plugin
- `curl` (for healthchecks)
- `certbot` (for SSL — optional if using self-signed certs)

---

## First-time Setup

### 1. Clone repo

```
git clone https://github.com/dandawatey/ria_advisory.git
cd ria_advisory
```

### 2. Configure environment

```
cp .env.prod.example .env.prod
# Edit .env.prod — fill in all values (DB credentials, JWT_SECRET, Azure IDs)
```

### 3. Obtain SSL certificate

Option A — Let's Encrypt (domain must resolve to this server):
```
sudo certbot certonly --standalone -d your-domain.com
mkdir -p certs
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem certs/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem certs/key.pem
sudo chown $USER:$USER certs/*.pem
```

Option B — Self-signed (for internal/testing only):
```
mkdir -p certs
openssl req -x509 -newkey rsa:4096 -keyout certs/key.pem -out certs/cert.pem \
  -days 365 -nodes -subj '/CN=localhost'
```

### 4. Run database migrations

Migrations must run before starting the backend:
```
cd 03_Backend
source .env.prod  # or export vars manually
python db_migrate.py
```

### 5. Build images

```
cd /path/to/ria_advisory
export GIT_SHA=$(git rev-parse --short HEAD)
docker compose -f docker-compose.prod.yml build
```

### 6. Start services

```
docker compose -f docker-compose.prod.yml up -d
```

---

## Smoke Test Checklist (run after every deploy)

- [ ] HTTPS responds: `curl -I https://your-domain.com` → 200
- [ ] Login page loads in browser
- [ ] Azure SSO login completes without error
- [ ] Executive Dashboard renders with data
- [ ] At least one sidebar link navigates correctly
- [ ] API responds: `curl https://your-domain.com/api/dashboard/kpis` → JSON
- [ ] BC Sync trigger works: `POST /api/erp/sources/{id}/sync` → 200

---

## Update / Redeploy

```
git pull origin main
export GIT_SHA=$(git rev-parse --short HEAD)
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate backend frontend
```

---

## Rollback

```
# Revert to previous image tag
export GIT_SHA=<previous-sha>
docker compose -f docker-compose.prod.yml up -d --no-deps --force-recreate backend frontend

# If schema changed and rollback needed:
# 1. Run down migration manually
# 2. Then redeploy previous image
```

---

## Logs

```
# Backend logs
docker logs ria-backend --tail 100 -f

# Frontend/Nginx logs
docker logs ria-frontend --tail 100 -f

# All services
docker compose -f docker-compose.prod.yml logs -f
```

---

## SSL Certificate Renewal (Let's Encrypt)

Certificates expire every 90 days. Auto-renew:
```
# Add to crontab: renew at 2am on 1st of each month
0 2 1 * * certbot renew --quiet && \
  cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /path/to/ria_advisory/certs/cert.pem && \
  cp /etc/letsencrypt/live/your-domain.com/privkey.pem /path/to/ria_advisory/certs/key.pem && \
  docker exec ria-frontend nginx -s reload
```

---

## Escalation

| Issue | Owner | Action |
|-------|-------|--------|
| Service won't start | Neha_DevOps_006 | Check `docker logs ria-backend` |
| DB connection fails | DBA + Neha | Verify PGHOST/PGPASSWORD in .env.prod |
| SSL cert expired | Neha | Run certbot renew + reload nginx |
| Auth broken | Ishaan_Security_007 | Check JWT_SECRET + Azure App Registration |
| Data not loading | Rohan_Backend_003 | Check backend logs + migrations |
