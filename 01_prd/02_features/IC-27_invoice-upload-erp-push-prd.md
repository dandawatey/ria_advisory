# PRD — IC-27: Invoice Upload & ERP Push Utility

**Version:** 1.0
**Date:** 2026-04-30
**Owner:** Aarav_PM_001
**Reviewer:** Kabir_Reviewer_010
**Status:** Draft
**Jira Epic:** [IC-27](https://isourceinnovation.atlassian.net/browse/IC-27)

---

## 1. Executive Summary

### Problem

Finance teams across all i-CFO360 client organisations receive vendor invoices in heterogeneous formats — PDF, Excel, and scanned images. The current workflow is:

1. Finance staff manually reads each invoice
2. Manually keys all fields into the ERP (Business Central or other)
3. No validation layer — duplicate postings and amount errors discovered weeks later, during reconciliation

At scale this means:
- **5–15 minutes per invoice** of manual data entry
- **3–8% error rate** (industry benchmark for manual keying)
- **Zero audit trail** on who entered what and when
- **Month-end bottleneck** — 200–500 invoices queued, Finance team overtime

### Opportunity

An AI-powered invoice ingestion layer that extracts, validates, and pushes structured data directly into ERP eliminates manual entry, enforces data quality at source, and provides a complete audit trail — while keeping Finance in control through a human-in-the-loop review console.

### Strategic Goal

Build an agentic invoice processing utility within i-CFO360 that:
- Accepts PDF, Excel, and image invoices (batch or individual)
- Uses an AI agent (Claude claude-sonnet-4-6 + tool use) to extract, validate, and resolve ambiguity
- Surfaces a Finance review console for human approval before any ERP push
- Pushes approved invoices into the configured ERP (Phase 1: Business Central) within 30 seconds
- Maintains an immutable audit log of every action

### Business Impact

| Metric | Before | After |
|--------|--------|-------|
| Time per invoice | 5–15 min (manual) | < 2 min (review only) |
| Error rate | 3–8% (manual keying) | < 0.5% (AI extract + human confirm) |
| Audit trail | None | Complete — every state change timestamped |
| ERP coverage | Manual BC entry only | Programmatic push (BC Phase 1; others Phase 2) |
| Batch capacity | 1 at a time | 50 invoices per session |

---

## 2. User Personas

### P1 — Finance Data Entry Clerk

**Role:** Processes incoming vendor invoices daily.
**Pain:** Spends 60–80% of day on manual ERP data entry. Repetitive, error-prone.
**Goal:** Upload a batch of invoices, confirm AI-extracted data, approve. Done.
**Technical level:** Non-technical. Requires intuitive drag-drop UI.

### P2 — Finance Controller

**Role:** Owns AP process. Reviews exceptions and rejections.
**Pain:** No visibility into invoice processing status. Discovers errors in reconciliation.
**Goal:** See invoice queue health: how many pending, failed, posted. Drill into exceptions.
**Technical level:** Finance-domain expert. Comfortable with data tables and filters.

### P3 — Finance Manager / CFO

**Role:** Approves high-value invoices before ERP push.
**Pain:** No approval workflow — invoices either go in or get lost.
**Goal:** Review flagged invoices (above amount threshold), approve or reject with reason.
**Technical level:** Light digital user. Needs mobile-friendly review flow.

---

## 3. User Journey

```
[Finance Clerk]
  Upload batch of PDFs → Sees per-file extraction progress →
  Reviews extracted fields (AI pre-filled) → Corrects any WARN/FAIL →
  Approves → Invoice pushed to BC → Confirmation with ERP doc number

[Finance Controller]
  Opens History page → Filters by status=PENDING_REVIEW →
  Reviews exceptions → Clears backlog → Exports CSV for audit

[AI Agent - background]
  Receives file → Extracts fields → Validates rules →
  Asks Finance for help if confidence < 70% or FAIL rule →
  On approval → Pushes to ERP → Logs every action
```

---

## 4. Feature Requirements

### 4.1 — IC-28: File Upload UI

**Owner:** Ananya_Frontend_004 | **Story Points:** 5

| # | Requirement | Priority |
|---|-------------|----------|
| F1.1 | Drag-and-drop zone accepting PDF, Excel (.xlsx/.xls), Image (JPG/PNG/TIFF) | Must |
| F1.2 | File picker fallback (Browse button) | Must |
| F1.3 | Batch upload: up to 50 files per session | Must |
| F1.4 | Per-file upload progress bar | Must |
| F1.5 | Client-side validation: file type + 10MB max size enforced before upload | Must |
| F1.6 | Batch reference field (user labels the batch, e.g. "April AP Run") | Should |
| F1.7 | On upload complete, navigate to Review Console for first file in batch | Must |
| F1.8 | Accessible: keyboard nav, ARIA labels on all interactive elements | Must |

**Acceptance Criteria (IC-28):**
- AC-01: User can drag 10 PDFs onto drop zone; all 10 upload successfully
- AC-02: File > 10MB rejected client-side with clear error message before any API call
- AC-03: Unsupported file type (e.g. .docx) rejected with helpful error
- AC-04: Progress bar shows per-file upload % in real time
- AC-05: After all files uploaded, user sees extraction status screen

---

### 4.2 — IC-29: Parsing Engine (AI + Rule-Based)

**Owner:** Rohan_Backend_003 | **Story Points:** 8

The parsing engine uses a tiered approach:

| File type | Parser | Fallback |
|-----------|--------|----------|
| PDF (text layer) | pdfplumber — text extraction + regex field mapping | Claude Vision |
| PDF (scanned/image) | pdf2image → Claude Vision structured extraction | None |
| Excel (.xlsx/.xls) | openpyxl — header row detection + column mapping | None |
| Image (JPG/PNG/TIFF) | Claude Vision API — structured extraction prompt | None |

**Mandatory extracted fields (10):**

| Field | Source | Notes |
|-------|--------|-------|
| vendor_name | Invoice header | Fuzzy-matched to ERP vendor master |
| invoice_no | Invoice header | Used for duplicate check |
| invoice_date | Invoice header | ISO date format |
| due_date | Invoice header | Optional; WARN if missing |
| currency | Invoice header | Default: tenant default currency |
| subtotal | Invoice footer | Amount before tax |
| tax_amount | Invoice footer | May be zero |
| total_amount | Invoice footer | Must equal subtotal + tax |
| line_description | Line item(s) | One row per line item |
| line_amount | Line item(s) | Per-line amount |

**Confidence scoring:** Every extracted field carries a confidence score 0–100. Fields < 70 trigger `request_human_input` via InvoiceAgent.

**Acceptance Criteria (IC-29):**
- AC-01: Text-based PDF with clear layout → all 10 fields extracted, confidence > 85
- AC-02: Scanned PDF → Claude Vision extracts ≥ 8/10 fields; missing fields flagged WARN
- AC-03: Excel invoice → header row detected, line items mapped to canonical fields
- AC-04: Image invoice → Claude Vision extracts vendor, invoice #, total at minimum
- AC-05: Extraction completes async; frontend polls status; no blocking on upload endpoint
- AC-06: Parsing failure (unreadable file) → status=EXTRACTION_FAILED, error message stored

---

### 4.3 — IC-30: Validation Engine

**Owner:** Rohan_Backend_003 | **Story Points:** 5

Seven mandatory validation rules applied after extraction:

| Rule | Severity | Condition |
|------|----------|-----------|
| MANDATORY_FIELDS | FAIL | vendor_name, invoice_no, invoice_date, total_amount all present |
| AMOUNT_CONSISTENCY | FAIL | subtotal + tax_amount = total_amount (± 0.01 tolerance) |
| TAX_REASONABLENESS | WARN | tax_rate between 0–30%; flag if outside |
| DATE_VALID | FAIL | invoice_date ≤ today; due_date ≥ invoice_date if present |
| DUPLICATE_INVOICE | FAIL | invoice_no + vendor_no combination not already POSTED |
| VENDOR_EXISTS | FAIL | vendor_name matched to ERP vendor master with confidence ≥ 80% |
| CURRENCY_SUPPORTED | WARN | currency code in ERP configured currency list |

**Validation result statuses:**
- `PASS` — rule satisfied, no action needed
- `WARN` — anomaly detected, Finance should review but can proceed
- `FAIL` — blocking; Finance must correct field or override with reason before approval

**Acceptance Criteria (IC-30):**
- AC-01: Invoice with mismatched amounts → FAIL AMOUNT_CONSISTENCY, push blocked
- AC-02: Duplicate invoice # (same vendor, already POSTED) → FAIL DUPLICATE_INVOICE
- AC-03: Invoice with unknown vendor → FAIL VENDOR_EXISTS, agent asks Finance to select from candidate list
- AC-04: All 7 rules run and stored in `invoice_validations` table on every extraction
- AC-05: Finance can override a WARN rule with a reason; FAIL requires correction (not override)

---

### 4.4 — IC-31: Review Console (Human-in-the-Loop)

**Owner:** Ananya_Frontend_004 | **Story Points:** 8

The review console is the primary human control point. Finance reviews AI-extracted data against the source document before approving.

**Layout:**
```
┌──────────────────────────┬────────────────────────────────┐
│  LEFT: Document Viewer   │  RIGHT: Extracted Fields Form  │
│                          │                                │
│  [Document image/PDF]    │  Vendor:    Acme LLC    [✓]    │
│                          │  Inv No:    INV-2026-001 [✓]   │
│  Source highlights on    │  Date:      2026-04-28  [✓]    │
│  hover (field → doc)     │  Total:     $12,450.00  [⚠️]   │
│                          │                                │
│                          │  [VALIDATION BANNER]           │
│                          │  ⛔ AMOUNT_CONSISTENCY: FAIL   │
│                          │  ⚠️ TAX_REASONABLENESS: WARN   │
│                          │                                │
│                          │  [APPROVE]  [REJECT]           │
└──────────────────────────┴────────────────────────────────┘
      ◀ Previous (3/12)                        Next ▶ (5/12)
```

**Agent question widget:** When InvoiceAgent calls `request_human_input`, a question card appears above the fields form:
```
┌─────────────────────────────────────────────────────────┐
│ 🤖 Agent Question                                       │
│ "I found two vendors matching 'Acme'. Which is correct?"│
│  ○ Acme LLC (V001)  ● Acme Corp (V002)  ○ Neither       │
│                                         [Submit Answer] │
└─────────────────────────────────────────────────────────┘
```

**Acceptance Criteria (IC-31):**
- AC-01: Document renders in left panel (PDF pages, image); Finance can zoom
- AC-02: All extracted fields editable inline; edited fields marked with pencil icon
- AC-03: Validation banner shows all FAIL/WARN rules with message; PASS rules hidden by default
- AC-04: Agent question widget renders when pending_question present; Finance can answer
- AC-05: Approve button disabled until all FAIL rules cleared
- AC-06: Reject requires reason text (min 10 chars); reason stored in state log
- AC-07: Keyboard arrow keys navigate between invoices in batch
- AC-08: Batch progress indicator (e.g. "4 of 12 reviewed")

---

### 4.5 — IC-32: ERP Push Service

**Owner:** Rohan_Backend_003 | **Story Points:** 8

**Phase 1 target:** Microsoft Business Central (BC REST API v2.0)

**Push flow:**
```
POST /api/invoices/{id}/push
  → load tenant ERP config from vault (never from DB)
  → ERPInvoicePusher.push_invoice(invoice)
  → BC: POST /api/{tenant}/purchaseInvoices
       body: { vendorNumber, invoiceDate, dueDate, currencyCode }
  → BC: POST /api/{tenant}/purchaseInvoices({id})/purchaseInvoiceLines
       one request per line item
  → on success: update status=POSTED, store erp_document_number
  → on failure: store error, increment attempt_number, retry up to 3×
  → after 3 failures: status=PUSH_FAILED, alert Finance
```

**Idempotency:** If `erp_document_no` already present → return existing doc number, skip re-push. Prevents double-posting if Finance clicks Push twice.

**ERP Invoice Pusher ABC** (`03_Backend/connectors/invoice_pushers/base.py`):
```
push_invoice(invoice: ApprovedInvoice, erp_config: ERPConfig) → PushResult
check_vendor(vendor_no: str) → bool
get_doc_number(erp_ref: str) → str
```

**Acceptance Criteria (IC-32):**
- AC-01: Approved BC invoice → Purchase Invoice created in BC with correct vendor, amount, lines
- AC-02: Duplicate push (same invoice_id) → returns existing ERP doc number, no second BC request
- AC-03: BC auth token expired → caught, PUSH_FAILED status, Finance notified to re-auth
- AC-04: BC API 4xx → logged, PUSH_FAILED, no retry (Finance data issue)
- AC-05: BC API 5xx / timeout → retry up to 3×, exponential backoff (2s, 4s, 8s)
- AC-06: Push completes within 30 seconds for single invoice under normal conditions
- AC-07: Every push attempt logged in `invoice_push_log` (append-only)

---

### 4.6 — IC-33: Audit Trail & History Page

**Owner:** Ananya_Frontend_004 + Rohan_Backend_003 | **Story Points:** 5

**History page (`/invoices/history`):**

| Component | Detail |
|-----------|--------|
| Summary metric row | Uploaded Today / Pending Review / Posted / Failed |
| Filter bar | Status, Date Range (uploaded_at), Uploaded By, Batch Ref |
| Invoice table | Filename, Vendor, Invoice #, Amount, Status, Uploaded At, ERP Doc # |
| Pagination | 25 rows/page |
| CSV Export | All filtered results, streaming download |
| Row click | Opens Review Console for that invoice |

**Audit trail** — `invoice_state_log` is append-only. Every status transition records:
- `from_status` → `to_status`
- `changed_by` (user UUID)
- `reason` (for REJECTED and PUSH_FAILED)
- `created_at` (immutable timestamp)

Admin view shows full state log per invoice (accessible via expanded row).

**Acceptance Criteria (IC-33):**
- AC-01: History page loads with correct counts in summary row
- AC-02: Filter by status=PUSH_FAILED → shows only failed invoices
- AC-03: Export CSV → downloads within 5s for up to 10,000 rows (streaming)
- AC-04: Every state transition recorded in `invoice_state_log`
- AC-05: Admin can view complete state history for any invoice
- AC-06: No DELETE on `invoice_state_log` — enforced at DB privilege level

---

## 5. Agentic Architecture — InvoiceAgent

### 5.1 Overview

InvoiceAgent is a Claude claude-sonnet-4-6 model running in a tool-use loop. It replaces a hardcoded extraction pipeline because real-world invoices require reasoning:

- Vendor name on invoice ≠ exact ERP vendor master name
- Scanned invoices have partial OCR failures requiring contextual inference
- Multi-currency, multi-tax-rate invoices need business logic, not just field parsing
- Agent can ask Finance targeted questions instead of failing with a generic error

### 5.2 Tool Registry

| Tool | Signature | Returns |
|------|-----------|---------|
| `extract_fields` | `(file_path, file_type)` | `InvoiceExtraction(fields, confidence_scores, line_items)` |
| `validate_invoice` | `(fields)` | `ValidationResult[](rule, status, message, field_ref)` |
| `lookup_vendor` | `(name)` | `VendorMatch(vendor_no, confidence, candidates[])` |
| `check_duplicate` | `(invoice_no, vendor_no)` | `DuplicateResult(is_duplicate, existing_doc_no)` |
| `request_human_input` | `(field, question, options[])` | **PAUSE** → surfaces to Review Console → **RESUME** |
| `push_to_erp` | `(invoice, erp_config)` | `PushResult(doc_no, status, erp_response)` |
| `log_audit_event` | `(event_type, payload)` | writes `invoice_state_log` (immutable) |

### 5.3 Human-in-the-Loop Protocol

```
Agent calls request_human_input(
  field="vendor_no",
  question="I found two vendors matching 'Acme'. Which is correct?",
  options=["Acme LLC (V001)", "Acme Corp (V002)", "Neither — enter manually"]
)
  → Backend stores question in invoice_uploads.pending_question (JSONB)
  → Agent loop pauses; tool returns PENDING token
  → Frontend Review Console polls GET /api/invoices/{id}
  → On pending_question present → renders question widget
  → Finance selects answer → POST /api/invoices/{id}/answer { field, answer }
  → Backend appends Finance answer to agent conversation history
  → Agent resumes tool loop with confirmed vendor_no
```

**Rules enforced in system prompt:**
- NEVER push to ERP without explicit Finance `approve` action
- NEVER guess vendor match below 80% confidence — always call `request_human_input`
- ALWAYS call `check_duplicate` before `push_to_erp`
- FAIL validation that cannot be auto-resolved → call `request_human_input`
- One question at a time — no multi-question messages

### 5.4 Agent File Locations

| File | Purpose |
|------|---------|
| `03_Backend/agents/invoice_agent.py` | Agent class, tool registry, system prompt, conversation loop |
| `03_Backend/agents/invoice_tools.py` | Tool implementations called by agent |
| `03_Backend/agents/__init__.py` | Package init |

---

## 6. Data Model

**Migration file:** `03_Backend/migrations/005_invoice_upload.sql`

### Tables

| Table | Purpose | Immutable? |
|-------|---------|------------|
| `invoice_uploads` | One row per uploaded file; tracks status lifecycle | No |
| `invoice_line_items` | Extracted fields with confidence scores and source coordinates | No |
| `invoice_validations` | Validation rule results per upload | No |
| `invoice_push_log` | Every ERP push attempt | Yes (append-only) |
| `invoice_state_log` | Every status transition with actor + reason | Yes (append-only) |

### Key Columns

**invoice_uploads:**
- `id UUID PK`, `tenant_id UUID NOT NULL`, `uploaded_by UUID → users(id)`
- `filename`, `file_path` (tenant-scoped storage), `file_type` (pdf|excel|image)
- `status TEXT` — lifecycle: UPLOADED → EXTRACTING → EXTRACTED → VALIDATING → PENDING_REVIEW → APPROVED → PUSHING → POSTED
- `batch_ref`, `erp_document_no`, `pending_question JSONB` (agent HITL)

**invoice_line_items:**
- `field_name TEXT`, `field_value TEXT`, `confidence DECIMAL(5,2)` (0–100)
- `source_page INTEGER`, `source_coords JSONB` ({x1,y1,x2,y2} for UI highlight)
- `manually_edited BOOLEAN` — tracks Finance corrections

**invoice_validations:**
- `rule_name TEXT`, `status TEXT` (PASS|WARN|FAIL), `message TEXT`, `field_ref TEXT`

**invoice_push_log:**
- `erp_type TEXT`, `erp_document_no TEXT`, `push_status TEXT` (SUCCESS|FAILED|RETRYING)
- `attempt_number INTEGER`, `error_message TEXT`

**All tables:** `tenant_id UUID NOT NULL` — every query filters by tenant.

---

## 7. API Design

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/invoices/upload` | Multipart batch upload (≤50 files, ≤10MB each) | Bearer |
| `GET` | `/api/invoices/{id}` | Invoice detail: fields + validations + state | Bearer |
| `GET` | `/api/invoices/{id}/file` | Serve original file (auth-gated, no direct URL) | Bearer |
| `PATCH` | `/api/invoices/{id}/fields` | Update extracted field value (Finance correction) | Bearer |
| `POST` | `/api/invoices/{id}/answer` | Submit Finance answer to agent HITL question | Bearer |
| `POST` | `/api/invoices/{id}/approve` | Approve invoice for ERP push | Bearer |
| `POST` | `/api/invoices/{id}/reject` | Reject invoice with reason | Bearer |
| `POST` | `/api/invoices/{id}/push` | Push approved invoice to ERP | Bearer |
| `GET` | `/api/invoices/history` | Paginated list with status/date/user filters | Bearer |
| `GET` | `/api/invoices/history/export` | Streaming CSV export of filtered results | Bearer |

**Response shapes follow existing API conventions** (`client.ts` integration layer).

---

## 8. Security Requirements

| Requirement | Detail |
|-------------|--------|
| Authentication | All endpoints require Bearer JWT — no anonymous access |
| Multi-tenant isolation | Every DB query filters by `tenant_id = current_tenant()` — cross-tenant access = security incident |
| File storage | Tenant-scoped path: `/uploads/{tenant_id}/{upload_id}/{filename}` |
| File URL access | Files served via `/api/invoices/{id}/file` with auth check — no direct storage URL exposed |
| Virus scan | Every uploaded file scanned before storage (`python-clamd` or `clamscan`) |
| ERP credentials | Loaded from vault at push time — never stored in DB, never in logs |
| RBAC | `finance_user` role: upload/review/approve own invoices. `finance_admin` role: view all invoices in tenant. `admin`: full access |
| Audit immutability | `invoice_push_log` + `invoice_state_log`: `DELETE` and `UPDATE` revoked at PostgreSQL privilege level |
| File size limit | 10MB per file — enforced client-side AND server-side (FastAPI `UploadFile` size check) |
| File type validation | MIME type checked server-side (not just file extension) |
| Input validation | All PATCH field values validated via Pydantic schemas |
| No secrets in logs | Scrub ERP credentials + JWT tokens from all log statements (Rule 05) |

---

## 9. Non-Functional Requirements

### Performance

| Scenario | Target |
|----------|--------|
| Upload 10 PDFs (< 2MB each) | < 5 seconds total |
| Extraction (text-based PDF) | < 3 seconds per file |
| Extraction (Claude Vision — scanned/image) | < 10 seconds per file |
| Validation run | < 1 second |
| ERP push (single invoice) | < 30 seconds |
| History page initial load (25 rows) | < 2 seconds |
| CSV export (10,000 rows) | < 10 seconds (streaming) |

### Scalability

- Parsing tasks run async (BackgroundTasks or Celery) — upload endpoint always returns immediately
- Batch of 50 files: tasks queued, processed concurrently (max 5 parallel parsing workers)
- PDF viewer: lazy-load pages; render only visible page in viewport

### Retention

- Invoice files retained for 7 years (configurable per tenant)
- `invoice_state_log` and `invoice_push_log`: permanent retention — no scheduled deletion

### Availability

- Feature degrades gracefully: if Claude Vision API unavailable, fallback to rule-based parser with WARN flag
- If ERP push fails, invoice stays APPROVED — Finance can retry push from history page

---

## 10. Out of Scope — Phase 1

| Item | Rationale |
|------|-----------|
| ERP push targets beyond Business Central | Phase 2: SAP, Oracle, Odoo, Tally |
| OCR engine (Tesseract) | Using Claude Vision avoids OCR setup complexity |
| Automatic three-way matching (PO + GRN + Invoice) | Phase 2 — requires PO data model |
| Invoice approval workflow (multi-level) | Phase 2 — Finance approves directly; manager approval role in Phase 2 |
| Mobile app | Web responsive only in Phase 1 |
| Email-to-upload ingest | Phase 2 — mailbox polling integration |
| ERP outbound webhook (ERP → i-CFO360) | Phase 2 — current flow is i-CFO360 → ERP push only |
| Currency conversion at push time | Phase 2 — invoice pushed in its own currency; ERP handles FX |

---

## 11. Rollout Plan

### Sprint 1 — Foundation (IC-28, IC-29, IC-30)

| Story | Agent | Points | Deliverable |
|-------|-------|--------|-------------|
| IC-28: File Upload UI | Ananya_Frontend_004 | 5 | Upload page with drag-drop, batch, progress |
| IC-29: Parsing Engine | Rohan_Backend_003 | 8 | PDF + Excel + Image parsers + InvoiceAgent |
| IC-30: Validation Engine | Rohan_Backend_003 | 5 | 7 validation rules + state machine |

**Sprint 1 exit gate:** Upload → Extract → Validate pipeline working end-to-end for PDF and Excel.

### Sprint 2 — Intelligence + Push (IC-31, IC-32, IC-33)

| Story | Agent | Points | Deliverable |
|-------|-------|--------|-------------|
| IC-31: Review Console | Ananya_Frontend_004 | 8 | Side-by-side viewer + editable fields + HITL widget |
| IC-32: ERP Push Service | Rohan_Backend_003 | 8 | BC push with retry + idempotency + push log |
| IC-33: Audit Trail + History | Ananya + Rohan | 5 | History page + CSV export + state log |

**Sprint 2 exit gate:** Full end-to-end flow working: Upload PDF → Agent extracts → Finance reviews → Approves → BC Purchase Invoice created → History shows POSTED.

**Total: 39 story points across 2 sprints**

### Pre-Sprint Prerequisites

- [ ] DB migration `005_invoice_upload.sql` tested on staging
- [ ] Claude API key available in backend `.env`
- [ ] Virus scan service (clamd) available in dev environment
- [ ] BC sandbox tenant available for push testing
- [ ] Feature branch `feature/IC-27-invoice-upload-erp-push` created via worktree

---

## 12. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Invoice processing time | < 2 min/invoice (review only) | avg `(approved_at - uploaded_at)` |
| Extraction accuracy | ≥ 95% of fields correct without Finance edit | `manually_edited = false` rate |
| ERP push success rate | ≥ 99% on first or retry attempt | `push_status = SUCCESS` / total |
| User adoption | 80% of Finance team using within 30 days of launch | daily active users |
| Error reduction | < 0.5% duplicate/incorrect invoices | PUSH_FAILED + manual reversal count |
| Audit trail completeness | 100% of state transitions logged | `invoice_state_log` row count vs expected |

---

## 13. Jira Traceability

| Ticket | Title | Type | Points | Sprint |
|--------|-------|------|--------|--------|
| [IC-27](https://isourceinnovation.atlassian.net/browse/IC-27) | Invoice Upload & ERP Push Utility | Epic | — | — |
| [IC-28](https://isourceinnovation.atlassian.net/browse/IC-28) | File Upload UI (drag-drop, batch, progress) | Story | 5 | Sprint 1 |
| [IC-29](https://isourceinnovation.atlassian.net/browse/IC-29) | Parsing Engine (PDF/Excel/Image + InvoiceAgent) | Story | 8 | Sprint 1 |
| [IC-30](https://isourceinnovation.atlassian.net/browse/IC-30) | Validation Engine (7 rules + state machine) | Story | 5 | Sprint 1 |
| [IC-31](https://isourceinnovation.atlassian.net/browse/IC-31) | Review Console (HITL + approve/reject) | Story | 8 | Sprint 2 |
| [IC-32](https://isourceinnovation.atlassian.net/browse/IC-32) | ERP Push Service (BC + retry + idempotency) | Story | 8 | Sprint 2 |
| [IC-33](https://isourceinnovation.atlassian.net/browse/IC-33) | Audit Trail & History Page | Story | 5 | Sprint 2 |

---

## 14. Dependencies

| Dependency | Type | Owner | Risk |
|------------|------|-------|------|
| Claude API (claude-sonnet-4-6) | External | Anthropic | Low — stable API |
| Business Central sandbox | External | Client IT | Medium — BC setup required for push testing |
| PostgreSQL migration 005 | Internal | Neha_DevOps_006 | Low |
| ERP vault credential setup | Internal | Ishaan_Security_007 | Low |
| react-pdf or iframe PDF viewer | NPM package | Ananya_Frontend_004 | Low |
| python-clamd (virus scan) | System dependency | Neha_DevOps_006 | Medium — needs clamav daemon |

---

*PRD prepared by Aarav_PM_001. Reviewed by Kabir_Reviewer_010. All feature files at `.claude/features/2026-04-30T00-00_IC-27_invoice-upload-erp-push.md`.*
