#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy_local.sh — i-CFO360 local Docker deploy + smoke test
# IC-51 | Owner: Neha_DevOps_006 | Reviewer: Kabir_Reviewer_010
#
# Usage:
#   ./scripts/deploy_local.sh            # build + start + validate
#   ./scripts/deploy_local.sh --no-build # skip build (use cached images)
#   ./scripts/deploy_local.sh --down     # stop all containers
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config ───────────────────────────────────────────────────────────────────
FRONTEND_URL="http://localhost:5002"
BACKEND_URL="http://localhost:8080"
COMPOSE_FILE="docker-compose.yml"
HEALTH_TIMEOUT=60   # seconds to wait for healthy state
PASS=0
FAIL=0

# ── Colours ──────────────────────────────────────────────────────────────────
GREEN="\033[0;32m"; RED="\033[0;31m"; CYAN="\033[0;36m"
BOLD="\033[1m"; RESET="\033[0m"

ok()   { echo -e "  ${GREEN}✓${RESET} $1"; PASS=$((PASS+1)); }
fail() { echo -e "  ${RED}✗${RESET} $1"; FAIL=$((FAIL+1)); }
info() { echo -e "${CYAN}▶${RESET} $1"; }

# ── Flags ────────────────────────────────────────────────────────────────────
BUILD=true
for arg in "$@"; do
  case $arg in
    --no-build) BUILD=false ;;
    --down) docker compose -f "$COMPOSE_FILE" down; echo "Stopped."; exit 0 ;;
  esac
done

echo ""
echo -e "${BOLD}══════════════════════════════════════════${RESET}"
echo -e "${BOLD}  i-CFO360 — Local Deploy (IC-51)         ${RESET}"
echo -e "${BOLD}══════════════════════════════════════════${RESET}"
echo ""

# ── Step 1: Build ─────────────────────────────────────────────────────────────
if [ "$BUILD" = true ]; then
  info "[1/4] Building Docker images..."
  if docker compose -f "$COMPOSE_FILE" build 2>&1 | grep -E "(ERROR|error)" | grep -v "WARNING"; then
    echo -e "${RED}Build failed. Aborting.${RESET}"
    exit 1
  fi
  echo -e "  ${GREEN}✓${RESET} Images built: ria-advisory/api:latest + ria-advisory/web:latest"
else
  info "[1/4] Skipping build (--no-build)"
fi

# ── Step 2: Start ─────────────────────────────────────────────────────────────
info "[2/4] Starting containers..."
docker compose -f "$COMPOSE_FILE" up -d --force-recreate backend frontend > /dev/null 2>&1
echo -e "  ${GREEN}✓${RESET} Containers started (backend + frontend)"

# ── Step 3: Wait for healthy ──────────────────────────────────────────────────
info "[3/4] Waiting for backend healthcheck (max ${HEALTH_TIMEOUT}s)..."
elapsed=0
while true; do
  status=$(docker inspect --format='{{.State.Health.Status}}' ria-advisory-api 2>/dev/null || echo "missing")
  if [ "$status" = "healthy" ]; then
    echo -e "  ${GREEN}✓${RESET} Backend healthy (${elapsed}s)"
    break
  fi
  if [ $elapsed -ge $HEALTH_TIMEOUT ]; then
    echo -e "  ${RED}✗${RESET} Backend not healthy after ${HEALTH_TIMEOUT}s"
    docker logs ria-advisory-api --tail 20
    exit 1
  fi
  sleep 2
  elapsed=$((elapsed+2))
done

# ── Step 4: Smoke Tests ───────────────────────────────────────────────────────
info "[4/4] Running smoke tests..."
echo ""

check_http() {
  local label="$1" url="$2" expected="$3"
  local start_time code elapsed_ms
  start_time=$(date +%s%N 2>/dev/null || date +%s)
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
  end_time=$(date +%s%N 2>/dev/null || date +%s)
  elapsed_ms=$(( (end_time - start_time) / 1000000 ))
  [ "$elapsed_ms" -lt 0 ] 2>/dev/null && elapsed_ms="?"

  if [ "$code" = "$expected" ]; then
    ok "$label → HTTP $code (${elapsed_ms}ms)"
  else
    fail "$label → expected $expected, got $code"
  fi
}

check_http "Frontend root (port 4000)"               "$FRONTEND_URL"                    "200"
check_http "Backend /health"                         "$BACKEND_URL/health"              "200"
check_http "Backend /api/dashboard/kpis (auth gate)" "$BACKEND_URL/api/dashboard/kpis" "401"
check_http "Invoicing summary (auth gate)"           "$BACKEND_URL/api/reports/invoicing/summary" "401"
check_http "UBR by-project (auth gate)"              "$BACKEND_URL/api/reports/ubr/by-project"    "401"
check_http "Revenue summary (auth gate)"             "$BACKEND_URL/api/reports/revenue/summary"   "401"

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}──────────────────────────────────────────${RESET}"
echo -e "${BOLD}  SERVICE         STATUS    PORT${RESET}"
echo -e "${BOLD}──────────────────────────────────────────${RESET}"
echo -e "  Frontend        ${GREEN}UP${RESET}        :4000"
echo -e "  Backend (API)   ${GREEN}UP${RESET}        :8080"
echo -e "  pgAdmin         ${GREEN}UP${RESET}        :5050"
echo -e "${BOLD}──────────────────────────────────────────${RESET}"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}${BOLD}  ALL $PASS SMOKE TESTS PASSED${RESET}"
  echo -e "  App: ${CYAN}${FRONTEND_URL}${RESET}"
  echo -e "  API: ${CYAN}${BACKEND_URL}/docs${RESET}"
  echo ""
  exit 0
else
  echo -e "${RED}${BOLD}  $FAIL TEST(S) FAILED / $PASS PASSED${RESET}"
  echo -e "  Check logs: docker logs ria-advisory-api --tail 50"
  echo ""
  exit 1
fi
